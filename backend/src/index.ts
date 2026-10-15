import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import "dotenv/config";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";

import { connectDB } from "./config/db";
import User from "./models/User";
import Group from "./models/Group";
import GridCell from "./models/GridCell";
import Settings from "./models/Settings";
import { hashPassword, verifyPassword, signToken, verifyToken } from "./utils/auth";
import { authMiddleware, requireAuth, requireAdmin, AuthenticatedRequest } from "./middlewares/auth";
import { sendOtpEmail } from "./utils/mailer";
import * as economy from "./game/economy";
import { loadGrid, getOverrides, getCell, setCell, isNear, CellOverride } from "./world/grid";
import { createNpcSimulation } from "./world/npcs";
import {
  WORLD_SIZE,
  WORLD_SEED,
  WORLD_CELL_SIZE,
  baseLayoutString,
  inWorld,
  isParkCell,
  worldToCell,
} from "./world/layout";

const app = express();
const PORT = process.env.PORT || 8005;

// Basic middleware
app.use(express.json());
app.use(cookieParser());

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  }),
);

// Apply session authentication middleware globally to populate req.user on HTTP routes
app.use(authMiddleware as express.RequestHandler);

// Welcome route
app.get("/", (req: express.Request, res: express.Response) => {
  res.send("Welcome to TypedHome API Server with WebSockets!");
});

// ==========================================
// IN-MEMORY CACHE & DATABASE FLUSH LOOP
// ==========================================

interface CachedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  x: number;
  z: number;
  clothingColor: number;
  dirty: boolean;
  shunyaCoins: number;
  level: number;
  xp: number;
  wood: number;
  unlockedPermits: string[];
  completedAchievements: string[];
  completedQuests: string[];
  groupId: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCachedUser(u: any): CachedUser {
  return {
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    role: u.role,
    x: u.x,
    z: u.z,
    clothingColor: u.clothingColor,
    shunyaCoins: u.shunyaCoins ?? 100,
    level: u.level ?? 1,
    xp: u.xp ?? 0,
    wood: u.wood ?? 0,
    unlockedPermits: u.unlockedPermits || [],
    completedAchievements: u.completedAchievements || [],
    completedQuests: u.completedQuests || [],
    groupId: u.groupId ? u.groupId.toString() : null,
    dirty: false,
  };
}

/** Progression fields sent to clients; the server is the only writer. */
function progressOf(u: CachedUser) {
  return {
    shunyaCoins: u.shunyaCoins,
    level: u.level,
    xp: u.xp,
    wood: u.wood,
    unlockedPermits: u.unlockedPermits,
    completedAchievements: u.completedAchievements,
    completedQuests: u.completedQuests,
  };
}

/** What other players may see about a user: never the email address. */
function publicUser(u: CachedUser) {
  return {
    _id: u.id,
    name: u.name,
    role: u.role,
    x: u.x,
    z: u.z,
    clothingColor: u.clothingColor,
    ...progressOf(u),
    groupId: u.groupId,
  };
}

/**
 * Keep an existing cache entry when a user logs in again: it may hold
 * progress that has not been flushed to MongoDB yet.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ensureCachedUser(u: any): CachedUser {
  const id = u._id.toString();
  const existing = userCache.get(id);
  if (existing) return existing;
  const cached = toCachedUser(u);
  userCache.set(id, cached);
  return cached;
}

function randomOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

const userCache = new Map<string, CachedUser>();
let settingsCache: any = null;
let settingsCacheDirty = false;

// Initialize cache from MongoDB
async function initCache() {
  try {
    await connectDB();

    // 1. Load Settings
    let settings = await Settings.findOne({ key: "global" });
    if (!settings) {
      settings = new Settings({ key: "global" });
      await settings.save();
    }
    settingsCache = settings.toObject();

    // Migrate: if timeSpeed is still the old default (>=0.5) reset to 8h/day rate
    if (settingsCache.timeSpeed >= 0.5) {
      settingsCache.timeSpeed = 0.00833;
      settingsCacheDirty = true;
      await Settings.updateOne({ key: "global" }, { $set: { timeSpeed: 0.00833 } });
    }

    // 3. Load Users
    const users = await User.find({});
    users.forEach((u) => {
      userCache.set(u._id.toString(), toCachedUser(u));
    });

    // 4. Load grid changes on top of the seeded base layout
    await loadGrid();

    console.log(`Cache initialized: ${userCache.size} users.`);
  } catch (error) {
    console.error("Failed to initialize backend cache:", error);
    throw error;
  }
}

// 10-Second Write-Back Database Flush Loop
setInterval(async () => {
  try {
    await connectDB();

    // 1. Flush dynamic simulation time in settings cache (if isPlaying)
    if (settingsCache && settingsCache.isPlaying) {
      const now = Date.now();
      const lastUpdatedTime = settingsCache.lastUpdated
        ? new Date(settingsCache.lastUpdated).getTime()
        : now;
      const elapsedSeconds = (now - lastUpdatedTime) / 1000;
      const elapsedHours = elapsedSeconds * settingsCache.timeSpeed * 0.1;
      settingsCache.timeOfDay = (settingsCache.timeOfDay + elapsedHours) % 24;
      settingsCache.lastUpdated = new Date();
      settingsCacheDirty = true;

      // Broadcast time tick update to keep all connected clients synchronized
      broadcast({
        type: "settings-updated",
        settings: settingsCache,
      });
    }

    // 2. Flush dirty users
    const dirtyUsers = Array.from(userCache.values()).filter((u) => u.dirty);
    if (dirtyUsers.length > 0) {
      const bulkOps = dirtyUsers.map((u) => ({
        updateOne: {
          filter: { _id: u.id },
          update: { 
            $set: { 
              x: u.x, 
              z: u.z, 
              lastX: u.x, 
              lastZ: u.z,
              shunyaCoins: u.shunyaCoins,
              level: u.level,
              xp: u.xp,
              wood: u.wood,
              unlockedPermits: u.unlockedPermits,
              completedAchievements: u.completedAchievements,
              completedQuests: u.completedQuests,
            } 
          },
        },
      }));
      await User.bulkWrite(bulkOps);
      dirtyUsers.forEach((u) => (u.dirty = false));
      console.log(`Flushed ${dirtyUsers.length} user stats and positions to database.`);
    }

    // 4. Flush Settings
    if (settingsCacheDirty && settingsCache) {
      await Settings.updateOne(
        { key: "global" },
        {
          $set: {
            timeOfDay: settingsCache.timeOfDay,
            timeSpeed: settingsCache.timeSpeed,
            isPlaying: settingsCache.isPlaying,
            hungerDecayRate: settingsCache.hungerDecayRate,
            housingRentRate: settingsCache.housingRentRate,
            utilityBillRate: settingsCache.utilityBillRate,
            energyDrainRate: settingsCache.energyDrainRate,
            transactionTaxRate: settingsCache.transactionTaxRate,
            lastUpdated: settingsCache.lastUpdated,
          },
        },
      );
      settingsCacheDirty = false;
      console.log("Flushed simulation settings to database.");
    }
  } catch (error) {
    console.error("Database flush error:", error);
  }
}, 10000);

// Helper to flush a single user immediately (e.g. on disconnect)
async function flushUserPosition(userId: string) {
  const u = userCache.get(userId);
  if (u && u.dirty) {
    try {
      await connectDB();
      await User.updateOne(
        { _id: userId },
        { 
          $set: { 
            x: u.x, 
            z: u.z, 
            lastX: u.x, 
            lastZ: u.z,
            shunyaCoins: u.shunyaCoins,
            level: u.level,
            xp: u.xp,
            wood: u.wood,
            unlockedPermits: u.unlockedPermits,
            completedAchievements: u.completedAchievements,
            completedQuests: u.completedQuests,
          } 
        },
      );
      u.dirty = false;
      console.log(`Immediately flushed user ${u.name} position and stats on disconnect.`);
    } catch (error) {
      console.error(`Failed to flush user ${userId} on disconnect:`, error);
    }
  }
}

// ==========================================
// GAME RULES (server-authoritative)
// ==========================================

/** Players can wander slightly past the grid edge, never further. */
const MAX_WORLD_COORD = (WORLD_SIZE * WORLD_CELL_SIZE) / 2 + 75;

function parsePosition(body: unknown): { x: number; z: number } | null {
  const { x, z } = (body ?? {}) as { x?: unknown; z?: unknown };
  const nx = Number(x);
  const nz = Number(z);
  if (!Number.isFinite(nx) || !Number.isFinite(nz)) return null;
  if (Math.abs(nx) > MAX_WORLD_COORD || Math.abs(nz) > MAX_WORLD_COORD) return null;
  return { x: nx, z: nz };
}

const CELL_TYPES = new Set([
  "empty", "road", "tree", "house", "skyscraper", "construction",
  "restaurant", "clothshop", "barbershop", "policestation",
]);
const STORE_TYPES = new Set(["restaurant", "clothshop", "barbershop", "policestation"]);

type GridResult =
  | { ok: true; cell: CellOverride }
  | { ok: false; error: string; cell?: CellOverride; silent?: boolean };

function finiteOr(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Validate a requested cell change against the current world state and apply
 * it. Admins may set any cell. Players may only:
 *  - order construction on an empty cell they hold a permit for (paid here),
 *  - advance an existing construction site,
 *  - complete a construction site into its target type.
 */
async function applyGridUpdate(user: CachedUser, raw: unknown): Promise<GridResult> {
  const req = (raw ?? {}) as Record<string, unknown>;
  const x = Number(req.x);
  const z = Number(req.z);
  if (!inWorld(x, z)) return { ok: false, error: "Cell is outside the world" };
  if (isParkCell(x, z)) return { ok: false, error: "The park can't be built on" };

  const type = String(req.type ?? "empty");
  const targetType = String(req.targetType ?? type);
  if (!CELL_TYPES.has(type) || !CELL_TYPES.has(targetType) || targetType === "construction") {
    return { ok: false, error: "Unknown cell type" };
  }

  const current = getCell(x, z);
  const progress = Math.min(100, Math.max(0, finiteOr(req.constructionProgress, 0)));
  let next: CellOverride;

  if (user.role === "admin") {
    const str = (v: unknown) => (typeof v === "string" ? v : null);
    next = {
      x,
      z,
      type,
      targetType,
      constructionProgress: type === "construction" ? progress : type === "empty" ? 0 : 100,
      height: finiteOr(req.height, 0),
      scale: Math.min(3, Math.max(0.25, finiteOr(req.scale, 1))),
      ownerId: str(req.ownerId),
      ownerName: str(req.ownerName),
      builderId: user.id,
      price: Math.max(0, finiteOr(req.price, 0)),
      isPurchased: Boolean(req.isPurchased),
    };
    if (type === "construction" && current.type !== "construction" && STORE_TYPES.has(targetType)) {
      // Admin-built stores belong to the admin, like any other builder
      next = { ...next, ownerId: user.id, ownerName: user.name, isPurchased: true };
    } else if (type === "empty") {
      next = { ...next, ownerId: null, ownerName: null, builderId: null, price: 0, isPurchased: false };
    }
  } else if (type === "construction" && current.type === "empty") {
    if (!economy.BUILD_COSTS[targetType]) return { ok: false, error: "That can't be built" };
    if (!user.unlockedPermits.includes(targetType)) {
      return { ok: false, error: `You need the ${targetType} permit first` };
    }
    const scale = finiteOr(req.scale, 1);
    if (!economy.BUILD_SCALES.includes(scale)) return { ok: false, error: "Invalid building size" };

    const cost = economy.buildCost(targetType, scale);
    const charged = economy.spend(user, cost);
    if (!charged.ok) return { ok: false, error: charged.error, cell: current };
    user.dirty = true;
    sendProgress(user, charged);

    const isStore = STORE_TYPES.has(targetType);
    next = {
      x,
      z,
      type: "construction",
      targetType,
      constructionProgress: 0,
      height: 0,
      scale,
      ownerId: isStore ? user.id : null,
      ownerName: isStore ? user.name : null,
      builderId: user.id,
      price: isStore ? cost : 0,
      isPurchased: isStore,
    };
  } else if (current.type === "construction" && targetType === current.targetType) {
    if (type === "construction" && progress > current.constructionProgress && progress < 100) {
      next = { ...current, constructionProgress: progress };
    } else if (type === current.targetType && progress >= 100) {
      next = { ...current, type, constructionProgress: 100 };
    } else {
      return { ok: false, error: "Stale construction update", cell: current, silent: true };
    }
  } else {
    // Usually a second client reporting a completion that already happened
    const silent = current.type === targetType;
    return { ok: false, error: "You can't change this cell", cell: current, silent };
  }

  const cell = await setCell(next);
  broadcast({ type: "grid-updated", cell });
  return { ok: true, cell };
}

function sendToUser(userId: string, message: object) {
  const ws = activeClients.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

/** Push authoritative progress to the player and their level to everyone else. */
function sendProgress(user: CachedUser, result?: economy.EconomyResult, requestId?: unknown) {
  const ok = result?.ok ? result : null;
  sendToUser(user.id, {
    type: "progress",
    requestId: typeof requestId === "string" ? requestId : undefined,
    ...progressOf(user),
    delta: ok?.delta,
    leveledUp: ok?.leveledUp ?? false,
  });
  broadcast({ type: "player-progressed", userId: user.id, ...progressOf(user) }, user.id);
}

function playerCell(user: CachedUser) {
  return worldToCell(user.x, user.z);
}

/** Credit shop revenue to the admin account (existing game rule). */
function creditAdminRevenue(amount: number, fromUser: CachedUser) {
  for (const u of userCache.values()) {
    if (u.role !== "admin") continue;
    u.shunyaCoins += amount;
    u.dirty = true;
    sendToUser(u.id, {
      type: "admin-coins-updated",
      shunyaCoins: u.shunyaCoins,
      fromUser: fromUser.name,
      amount,
    });
    return;
  }
}

// ==========================================
// HTTP ROUTE HANDLERS
// ==========================================

// GET /api/auth/me
app.get(
  "/api/auth/me",
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      await connectDB();
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      res.status(200).json({
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          clothingColor: req.user.clothingColor,
          // Cache holds progress not yet flushed to MongoDB
          ...(() => {
            const cached = ensureCachedUser(req.user);
            return { x: cached.x, z: cached.z, ...progressOf(cached) };
          })(),
        },
      });
    } catch (error: any) {
      console.error("Session verification error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// POST /api/auth/login
app.post(
  "/api/auth/login",
  async (req: express.Request, res: express.Response) => {
    try {
      await connectDB();
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }

      const emailLower = email.toLowerCase().trim();

      const user = await User.findOne({ email: emailLower });
      if (!user) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      const passwordCheck = await verifyPassword(String(password), user.password);
      if (passwordCheck === "needs-reset") {
        res.status(403).json({
          error: "Your password needs to be reset. Use \"Forgot password\" to set a new one.",
          requiresPasswordReset: true,
        });
        return;
      }
      if (passwordCheck !== "valid") {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      if (!user.isVerified) {
        // If they try to login but aren't verified, generate a new OTP and email them
        const otp = randomOtp();
        user.otp = otp;
        user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
        await user.save();
        await sendOtpEmail(user.email, otp, "verify");
        
        res.status(403).json({ error: "Email not verified", requiresVerification: true });
        return;
      }

      const sessionId = crypto.randomUUID();
      const accessToken = signToken(
        { userId: user._id, email: user.email, role: user.role, sessionId },
        "1d",
      );
      const refreshToken = signToken(
        { userId: user._id, email: user.email, role: user.role, sessionId },
        "30d",
      );

      user.currentRefreshToken = refreshToken;
      user.currentSessionId = sessionId;
      await user.save();

      // Add to in-memory cache (keeps unflushed progress if already cached)
      const cachedUser = ensureCachedUser(user);

      res.cookie("accessToken", accessToken, {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
      res.cookie("refreshToken", refreshToken, {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });

      res.status(200).json({
        message: "Login successful",
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          x: cachedUser.x,
          z: cachedUser.z,
          clothingColor: user.clothingColor,
          ...progressOf(cachedUser),
        },
      });
    } catch (error: any) {
      console.error("Login API Error:", error);
      res.status(500).json({ error: "Internal server error during login" });
    }
  },
);

// POST /api/auth/register
app.post(
  "/api/auth/register",
  async (req: express.Request, res: express.Response) => {
    try {
      await connectDB();
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        res
          .status(400)
          .json({ error: "Name, email, and password are required" });
        return;
      }

      const emailLower = email.toLowerCase().trim();

      const existingUser = await User.findOne({ email: emailLower });
      if (existingUser) {
        res.status(409).json({ error: "User with this email already exists" });
        return;
      }

      const totalUsers = await User.countDocuments({});
      const role = totalUsers === 0 ? "admin" : "user";

      const hashedPassword = await hashPassword(String(password));
      const otp = randomOtp();

      const newUser = new User({
        name: name.trim(),
        email: emailLower,
        password: hashedPassword,
        role,
        x: 0,
        z: 0,
        lastX: 0,
        lastZ: 0,
        isVerified: false,
        otp,
        otpExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      });

      await newUser.save();
      await sendOtpEmail(emailLower, otp, "verify");

      res.status(201).json({
        message: "User registered. OTP sent to email.",
        requiresVerification: true,
      });
    } catch (error: any) {
      console.error("Registration API Error:", error);
      res
        .status(500)
        .json({ error: "Internal server error during registration" });
    }
  },
);

// POST /api/auth/logout
app.post(
  "/api/auth/logout",
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      await connectDB();
      const user = req.user;
      if (user) {
        user.currentRefreshToken = null;
        user.currentSessionId = null;
        await user.save();
        await flushUserPosition(user._id.toString());
      }

      res.clearCookie("accessToken", { path: "/" });
      res.clearCookie("refreshToken", { path: "/" });

      res.status(200).json({ message: "Logged out successfully" });
    } catch (error: any) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// POST /api/auth/verify-otp
app.post(
  "/api/auth/verify-otp",
  async (req: express.Request, res: express.Response) => {
    try {
      await connectDB();
      const { email, otp } = req.body;

      if (!email || !otp) {
        res.status(400).json({ error: "Email and OTP are required" });
        return;
      }

      const emailLower = email.toLowerCase().trim();
      const user = await User.findOne({ email: emailLower });

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      if (user.otp !== otp || !user.otpExpires || new Date() > user.otpExpires) {
        res.status(400).json({ error: "Invalid or expired OTP" });
        return;
      }

      user.isVerified = true;
      user.otp = null;
      user.otpExpires = null;
      
      const sessionId = crypto.randomUUID();
      user.currentSessionId = sessionId;

      const accessToken = signToken({ userId: user._id, email: user.email, role: user.role, sessionId }, "1d");
      const refreshToken = signToken({ userId: user._id, email: user.email, role: user.role, sessionId }, "30d");

      user.currentRefreshToken = refreshToken;
      await user.save();

      ensureCachedUser(user);

      res.cookie("accessToken", accessToken, { maxAge: 24 * 60 * 60 * 1000, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
      res.cookie("refreshToken", refreshToken, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });

      res.status(200).json({ message: "Verification successful" });
    } catch (error: any) {
      console.error("OTP Verification Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// POST /api/auth/forgot-password
app.post(
  "/api/auth/forgot-password",
  async (req: express.Request, res: express.Response) => {
    try {
      await connectDB();
      const { email } = req.body || {};
      if (!email) {
        res.status(400).json({ error: "Email is required" });
        return;
      }
      
      const emailLower = email.toLowerCase().trim();
      const user = await User.findOne({ email: emailLower });
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const otp = randomOtp();
      user.otp = otp;
      user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();
      await sendOtpEmail(emailLower, otp, "reset");

      res.status(200).json({ message: "Password reset OTP sent to email" });
    } catch (error: any) {
      console.error("Forgot Password Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// POST /api/auth/reset-password
app.post(
  "/api/auth/reset-password",
  async (req: express.Request, res: express.Response) => {
    try {
      await connectDB();
      const { email, otp, newPassword } = req.body || {};

      if (!email || !otp || !newPassword) {
        res.status(400).json({ error: "Email, OTP, and new password are required" });
        return;
      }

      const emailLower = email.toLowerCase().trim();
      const user = await User.findOne({ email: emailLower });

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      if (user.otp !== otp || !user.otpExpires || new Date() > user.otpExpires) {
        res.status(400).json({ error: "Invalid or expired OTP" });
        return;
      }

      user.password = await hashPassword(String(newPassword));
      user.otp = null;
      user.otpExpires = null;
      user.currentSessionId = null;
      user.currentRefreshToken = undefined;
      await user.save();

      res.status(200).json({ message: "Password reset successfully" });
    } catch (error: any) {
      console.error("Reset Password Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// PATCH /api/auth/profile — update name, gender, dob
app.patch(
  "/api/auth/profile",
  requireAuth as express.RequestHandler,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      await connectDB();
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { name, gender, dob } = req.body;
      const updates: Record<string, string> = {};
      if (name && typeof name === "string") updates.name = name.trim();
      if (gender && ["male", "female", "other", "skip"].includes(gender)) updates.gender = gender;
      if (dob !== undefined) updates.dob = dob;

      if (Object.keys(updates).length === 0) {
        res.status(400).json({ error: "No valid fields provided" });
        return;
      }

      await User.updateOne({ _id: user._id }, { $set: updates });

      // Update in-memory cache too
      const cached = userCache.get(user._id.toString());
      if (cached && updates.name) cached.name = updates.name;

      res.status(200).json({ message: "Profile updated", updates });
    } catch (error: any) {
      console.error("Profile update error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// GET /api/users — public player list (no emails)
// GET /api/admin/users — same list with emails, admins only
async function sendUserList(includeEmail: boolean, res: express.Response) {
  try {
    const users = Array.from(userCache.values()).map((u) =>
      includeEmail ? { ...publicUser(u), email: u.email } : publicUser(u),
    );

    // Adjust timeOfDay in memory before response
    if (settingsCache && settingsCache.isPlaying) {
      const now = Date.now();
      const lastUpdatedTime = settingsCache.lastUpdated
        ? new Date(settingsCache.lastUpdated).getTime()
        : now;
      const elapsedSeconds = (now - lastUpdatedTime) / 1000;
      const elapsedHours = elapsedSeconds * settingsCache.timeSpeed * 0.1;
      settingsCache.timeOfDay = (settingsCache.timeOfDay + elapsedHours) % 24;
      settingsCache.lastUpdated = new Date();
      settingsCacheDirty = true;
    }

    res.status(200).json({ users, settings: settingsCache });
  } catch (error) {
    console.error("Fetch Users Cache API Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

app.get("/api/users", (req: express.Request, res: express.Response) => sendUserList(false, res));
app.get(
  "/api/admin/users",
  requireAdmin as express.RequestHandler,
  (req: express.Request, res: express.Response) => sendUserList(true, res),
);

// POST /api/users/position (legacy/HTTP fallback, WebSockets prefer the socket event)
app.post(
  "/api/users/position",
  requireAuth as express.RequestHandler,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const user = req.user;
      const pos = parsePosition(req.body);

      if (!pos) {
        res.status(400).json({ error: "Valid coordinates (x, z) are required" });
        return;
      }
      const { x, z } = pos;

      // Update in-memory cache
      const cached = userCache.get(user._id.toString());
      if (cached) {
        cached.x = x;
        cached.z = z;
        cached.dirty = true;
      }

      // Broadcast position immediately
      broadcast({
        type: "player-moved",
        userId: user._id.toString(),
        x,
        z,
      });

      res.status(200).json({
        message: "Position updated successfully in cache",
        x,
        z,
      });
    } catch (error: any) {
      console.error("Position Update API Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// GET /api/world — shared city: seeded base layout plus every changed cell
app.get("/api/world", (req: express.Request, res: express.Response) => {
  res.status(200).json({
    size: WORLD_SIZE,
    cellSize: WORLD_CELL_SIZE,
    seed: WORLD_SEED,
    layout: baseLayoutString,
    cells: getOverrides(),
  });
});

// GET /api/grid — cells that differ from the base layout
app.get("/api/grid", (req: express.Request, res: express.Response) => {
  res.status(200).json({ cells: getOverrides() });
});

// POST /api/grid (HTTP fallback, WebSockets prefer the socket event)
app.post(
  "/api/grid",
  requireAuth as express.RequestHandler,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const cached = ensureCachedUser(req.user);
      const result = await applyGridUpdate(cached, req.body);
      if (!result.ok) {
        res.status(403).json({ error: result.error, cell: result.cell });
        return;
      }
      res.status(200).json({ message: "Grid cell updated successfully", cell: result.cell });
    } catch (error) {
      console.error("Update Grid Cell API Error:", error);
      res.status(500).json({ error: "Internal server error while updating grid cell" });
    }
  },
);

// GET /api/npcs — current city population (simulated on the server)
app.get("/api/npcs", (req: express.Request, res: express.Response) => {
  res.status(200).json({ t: Date.now(), npcs: npcSim?.snapshot() ?? [] });
});

// POST /api/admin/settings (legacy API)
app.post(
  "/api/admin/settings",
  requireAdmin as express.RequestHandler,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { timeOfDay, timeSpeed, isPlaying, hungerDecayRate, housingRentRate, utilityBillRate, energyDrainRate, transactionTaxRate } = req.body;

      if (!settingsCache) {
        settingsCache = { key: "global", timeOfDay: 8.0, timeSpeed: 0.00833, isPlaying: true, hungerDecayRate: 1.0, housingRentRate: 10, utilityBillRate: 5, energyDrainRate: 1.5, transactionTaxRate: 10 };
      }

      if (timeOfDay !== undefined) settingsCache.timeOfDay = Number(timeOfDay);
      if (timeSpeed !== undefined) settingsCache.timeSpeed = Number(timeSpeed);
      if (isPlaying !== undefined) settingsCache.isPlaying = Boolean(isPlaying);
      if (hungerDecayRate !== undefined) settingsCache.hungerDecayRate = Number(hungerDecayRate);
      if (housingRentRate !== undefined) settingsCache.housingRentRate = Number(housingRentRate);
      if (utilityBillRate !== undefined) settingsCache.utilityBillRate = Number(utilityBillRate);
      if (energyDrainRate !== undefined) settingsCache.energyDrainRate = Number(energyDrainRate);
      if (transactionTaxRate !== undefined) settingsCache.transactionTaxRate = Number(transactionTaxRate);

      settingsCache.lastUpdated = new Date();
      settingsCacheDirty = true;

      broadcast({
        type: "settings-updated",
        settings: settingsCache,
      });

      res.status(200).json({
        message: "Settings updated in cache successfully",
        settings: settingsCache,
      });
    } catch (error: any) {
      console.error("Settings Update API Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// POST /api/admin/users
app.post(
  "/api/admin/users",
  requireAdmin as express.RequestHandler,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      await connectDB();
      const requester = req.user;
      const { action, targetUserId, ...data } = req.body;

      if (!action || !targetUserId) {
        res.status(400).json({ error: "Missing required parameters (action, targetUserId)" });
        return;
      }

      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        res.status(404).json({ error: "Target user not found" });
        return;
      }

      if (action === "teleport") {
        const { x, z } = data;
        if (x === undefined || z === undefined) {
          res.status(400).json({ error: "Coordinates (x, z) are required for teleport action" });
          return;
        }

        const pos = parsePosition({ x, z });
        if (!pos) {
          res.status(400).json({ error: "Teleport target is outside the world" });
          return;
        }

        targetUser.lastX = targetUser.x;
        targetUser.lastZ = targetUser.z;
        targetUser.x = pos.x;
        targetUser.z = pos.z;
        await targetUser.save();

        // Sync to cache (leave `dirty` alone: other progress may be unflushed)
        const cached = userCache.get(targetUserId);
        if (cached) {
          cached.x = pos.x;
          cached.z = pos.z;
        }

        // Broadcast to everyone
        broadcast({
          type: "player-moved",
          userId: targetUserId,
          x: Number(x),
          z: Number(z),
        });

        res.status(200).json({
          message: `Teleported ${targetUser.name} successfully`,
          user: targetUser,
        });
      } else if (action === "changeRole") {
        const { role } = data;
        if (!role || !["user", "admin"].includes(role)) {
          res.status(400).json({ error: "Invalid or missing role parameter" });
          return;
        }

        if (targetUser._id.toString() === requester._id.toString() && role !== "admin") {
          res.status(400).json({ error: "Cannot demote yourself. Another admin must perform this action." });
          return;
        }

        targetUser.role = role;
        await targetUser.save();

        const cached = userCache.get(targetUserId);
        if (cached) {
          cached.role = role;
        }

        res.status(200).json({
          message: `Updated role for ${targetUser.name} to ${role}`,
          user: targetUser,
        });
      } else if (action === "modifyCoins") {
        const { shunyaCoins } = data;
        if (shunyaCoins === undefined) {
          res.status(400).json({ error: "Missing shunyaCoins parameter" });
          return;
        }

        const coins = Number(shunyaCoins);
        if (!Number.isFinite(coins) || coins < 0) {
          res.status(400).json({ error: "shunyaCoins must be a non-negative number" });
          return;
        }

        targetUser.shunyaCoins = coins;
        await targetUser.save();

        // Leave `dirty` alone: other progress may be unflushed
        const cached = userCache.get(targetUserId);
        if (cached) {
          cached.shunyaCoins = coins;
          sendProgress(cached);
        }

        res.status(200).json({
          message: `Updated coins for ${targetUser.name} to ${shunyaCoins}`,
          user: targetUser,
        });
      } else if (action === "delete") {
        if (targetUser._id.toString() === requester._id.toString()) {
          res.status(400).json({ error: "Cannot delete your own admin account." });
          return;
        }

        await User.findByIdAndDelete(targetUserId);
        userCache.delete(targetUserId);

        broadcast({
          type: "player-disconnected",
          userId: targetUserId,
        });

        res.status(200).json({
          message: `Deleted user ${targetUser.name} successfully`,
          deletedUserId: targetUserId,
        });
      } else {
        res.status(400).json({ error: `Unknown action: ${action}` });
      }
    } catch (error: any) {
      console.error("Admin API Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ==========================================
// WEBSOCKET INTEGRATION
// ==========================================

// HTTP Server wrapper
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

// Close code telling a client it was replaced by a newer session; it must not reconnect
const WS_CLOSE_REPLACED = 4001;
// Liveness: sockets that miss a ping round are terminated
const HEARTBEAT_MS = 30000;
const aliveSockets = new WeakSet<WebSocket>();

// Map of userId -> WebSocket connection
const activeClients = new Map<string, WebSocket>();
// Set of guest spectator connections
const spectatorClients = new Set<WebSocket>();

// Semicolon-separated cookie string parser
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const name = parts[0].trim();
    const value = parts.slice(1).join("=").trim();
    if (name) {
      cookies[name] = decodeURIComponent(value);
    }
  });
  return cookies;
}

// Token session validation
async function getWsUser(cookies: Record<string, string>) {
  const accessToken = cookies.accessToken;
  const refreshToken = cookies.refreshToken;

  if (!accessToken && !refreshToken) return null;

  try {
    if (accessToken) {
      const payload = verifyToken(accessToken);
      if (payload) {
        const user = await User.findById(payload.userId);
        if (user && user.currentSessionId === payload.sessionId) {
          return user;
        }
      }
    }

    if (refreshToken) {
      const payload = verifyToken(refreshToken);
      if (payload) {
        const user = await User.findById(payload.userId);
        if (
          user &&
          user.currentRefreshToken === refreshToken &&
          user.currentSessionId === payload.sessionId
        ) {
          return user;
        }
      }
    }
  } catch (err) {
    console.error("WS Authenticate Error:", err);
  }

  return null;
}

// Broadcast helper (sends JSON string to all clients: active players and guest spectators)
function broadcast(message: object, exceptUserId?: string) {
  const payload = JSON.stringify(message);
  
  // Send to active authenticated clients
  activeClients.forEach((ws, id) => {
    if (id !== exceptUserId && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });

  // Send to guest spectators
  spectatorClients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

// Upgrade HTTP request to WebSocket on '/ws'
server.on("upgrade", (request, socket, head) => {
  const { pathname } = new URL(request.url || "", `http://${request.headers.host}`);
  if (pathname === "/ws") {
    wss.handleUpgrade(request, socket, head, (wsSocket) => {
      wss.emit("connection", wsSocket, request);
    });
  } else {
    socket.destroy();
  }
});

const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!aliveSockets.has(ws)) {
      ws.terminate();
      return;
    }
    aliveSockets.delete(ws);
    ws.ping();
  });
}, HEARTBEAT_MS);
wss.on("close", () => clearInterval(heartbeat));

// WebSocket connection lifecycle
wss.on("connection", async (ws: WebSocket, request: http.IncomingMessage) => {
  let userId: string | null = null;
  let userName = "Guest Spectator";

  aliveSockets.add(ws);
  ws.on("pong", () => aliveSockets.add(ws));
  // Without this, one malformed or oversized frame crashes the whole server
  ws.on("error", (err) => {
    console.warn(`WebSocket error (${userName}):`, err.message);
  });

  try {
    const rawCookies = request.headers.cookie;
    const cookies = parseCookies(rawCookies);
    const dbUser = await getWsUser(cookies);

    if (dbUser) {
      const uId = dbUser._id.toString();
      userId = uId;
      userName = dbUser.name;

      // Close existing socket connection for this user if they open a new tab/session (strict single connection)
      const existing = activeClients.get(uId);
      if (existing && existing.readyState === WebSocket.OPEN) {
        existing.close(WS_CLOSE_REPLACED, "Logged in from another location");
      }

      activeClients.set(uId, ws);
      console.log(`WebSocket connected: User '${userName}' (${uId})`);

      // Add to/update userCache online coordinates
      const cached = ensureCachedUser(dbUser);

      // Broadcast player-connected to all other clients
      broadcast({
        type: "player-connected",
        user: publicUser(cached),
      });
    } else {
      spectatorClients.add(ws);
      console.log(`WebSocket connected: Guest Spectator`);
    }

    // Send initial configuration payload immediately
    ws.send(
      JSON.stringify({
        type: "init",
        t: Date.now(),
        selfId: userId,
        settings: settingsCache,
        npcs: npcSim?.snapshot() ?? [],
        users: Array.from(userCache.values())
          .filter((u) => activeClients.has(u.id))
          .map(publicUser),
      })
    );

    // Client event processor
    ws.on("message", async (data: string) => {
      try {
        const msg = JSON.parse(data);

        switch (msg.type) {
          case "player-move":
            if (userId) {
              const pos = parsePosition(msg);
              if (!pos) break;
              const { x, z } = pos;
              const cached = userCache.get(userId);
              if (cached) {
                cached.x = x;
                cached.z = z;
                cached.dirty = true;
              }

              // Broadcast player movement immediately to all other clients
              broadcast({
                type: "player-moved",
                userId,
                x,
                z,
              }, userId);
            }
            break;

          // Economy: clients report what happened; amounts come from game/economy.ts
          case "earn":
          case "achievement":
          case "buy-permit":
          case "buy-item":
          case "progress-reset":
            if (userId) {
              const cached = userCache.get(userId);
              if (!cached) break;

              let result: economy.EconomyResult;
              if (msg.type === "earn") {
                result = economy.earn(userId, cached, String(msg.reason));
              } else if (msg.type === "achievement") {
                result = economy.unlockAchievement(cached, String(msg.key));
              } else if (msg.type === "buy-permit") {
                result = economy.buyPermit(cached, String(msg.permit));
              } else if (msg.type === "buy-item") {
                const item = String(msg.item);
                const shop = economy.SHOP_ITEMS[item]?.shop;
                const { x, z } = playerCell(cached);
                result = shop && !isNear(x, z, shop, 2)
                  ? { ok: false, error: "You need to be at the shop to buy that" }
                  : economy.buyShopItem(cached, item);
                if (result.ok) creditAdminRevenue(-result.delta.coins, cached);
              } else {
                economy.resetProgress(cached);
                result = { ok: true, delta: { coins: 0, xp: 0, wood: 0 }, leveledUp: false };
              }

              if (result.ok) {
                cached.dirty = true;
                sendProgress(cached, result, msg.requestId);
              } else {
                ws.send(JSON.stringify({
                  type: "action-rejected",
                  requestId: msg.requestId,
                  action: msg.type,
                  error: result.error,
                }));
              }
            }
            break;

          case "job-start":
            if (userId) {
              const cached = userCache.get(userId);
              const job = economy.JOBS[String(msg.job)];
              if (!cached || !job) break;
              const { x, z } = playerCell(cached);
              if (isNear(x, z, job.cell, 2)) {
                economy.startJob(userId, String(msg.job));
              } else {
                ws.send(JSON.stringify({
                  type: "action-rejected",
                  action: "job-start",
                  error: "There's no work for that job here",
                }));
              }
            }
            break;

          case "settings-update":
            if (userId) {
              const cached = userCache.get(userId);
              if (cached && cached.role === "admin") {
                const { timeOfDay, timeSpeed, isPlaying, hungerDecayRate, housingRentRate, utilityBillRate, energyDrainRate, transactionTaxRate } = msg;
                if (!settingsCache) {
                  settingsCache = { key: "global", timeOfDay: 8.0, timeSpeed: 0.00833, isPlaying: true, hungerDecayRate: 1.0, housingRentRate: 10, utilityBillRate: 5, energyDrainRate: 1.5, transactionTaxRate: 10 };
                }

                if (timeOfDay !== undefined) settingsCache.timeOfDay = Number(timeOfDay);
                if (timeSpeed !== undefined) settingsCache.timeSpeed = Number(timeSpeed);
                if (isPlaying !== undefined) settingsCache.isPlaying = Boolean(isPlaying);
                if (hungerDecayRate !== undefined) settingsCache.hungerDecayRate = Number(hungerDecayRate);
                if (housingRentRate !== undefined) settingsCache.housingRentRate = Number(housingRentRate);
                if (utilityBillRate !== undefined) settingsCache.utilityBillRate = Number(utilityBillRate);
                if (energyDrainRate !== undefined) settingsCache.energyDrainRate = Number(energyDrainRate);
                if (transactionTaxRate !== undefined) settingsCache.transactionTaxRate = Number(transactionTaxRate);

                settingsCache.lastUpdated = new Date();
                settingsCacheDirty = true;

                // Broadcast new settings instantly
                broadcast({
                  type: "settings-updated",
                  settings: settingsCache,
                });
              }
            }
            break;

          case "grid-update":
            if (userId) {
              const cached = userCache.get(userId);
              if (!cached) break;
              const result = await applyGridUpdate(cached, msg.cell);
              if (!result.ok) {
                // Re-sync the sender with the authoritative cell
                if (result.cell) ws.send(JSON.stringify({ type: "grid-updated", cell: result.cell }));
                if (!result.silent) {
                  ws.send(JSON.stringify({
                    type: "action-rejected",
                    requestId: msg.requestId,
                    action: "grid-update",
                    error: result.error,
                  }));
                }
              }
            }
            break;

          case "party-create":
            if (userId) {
              await connectDB();
              const newGroup = new Group({ name: msg.name || "New Party", leaderId: userId, members: [userId] });
              await newGroup.save();
              const cached = userCache.get(userId);
              if (cached) {
                cached.groupId = newGroup._id.toString();
                cached.dirty = true;
              }
              await User.updateOne({ _id: userId }, { groupId: newGroup._id });
              
              const wsClient = activeClients.get(userId);
              if (wsClient && wsClient.readyState === WebSocket.OPEN) {
                wsClient.send(JSON.stringify({ type: "party-updated", group: newGroup }));
              }
              broadcast({ type: "player-party-changed", userId, groupId: newGroup._id.toString() });
            }
            break;

          case "party-invite":
            if (userId) {
              const { targetUserId } = msg;
              const targetWs = activeClients.get(targetUserId);
              const cached = userCache.get(userId);
              if (targetWs && targetWs.readyState === WebSocket.OPEN && cached && cached.groupId) {
                targetWs.send(JSON.stringify({
                  type: "party-invite-received",
                  fromUserId: userId,
                  fromUserName: cached.name,
                  groupId: cached.groupId
                }));
              }
            }
            break;

          case "party-accept":
            if (userId) {
              const { groupId } = msg;
              await connectDB();
              const group = await Group.findById(groupId);
              if (group && group.members.length < 8 && !group.members.includes(userId)) {
                group.members.push(userId);
                await group.save();
                
                const cached = userCache.get(userId);
                if (cached) {
                  cached.groupId = group._id.toString();
                  cached.dirty = true;
                }
                await User.updateOne({ _id: userId }, { groupId: group._id });
                
                for (const memberId of group.members) {
                  const mWs = activeClients.get(memberId.toString());
                  if (mWs && mWs.readyState === WebSocket.OPEN) {
                    mWs.send(JSON.stringify({ type: "party-updated", group }));
                  }
                }
                broadcast({ type: "player-party-changed", userId, groupId: group._id.toString() });
              }
            }
            break;

          case "party-leave":
            if (userId) {
              const cached = userCache.get(userId);
              if (cached && cached.groupId) {
                await connectDB();
                const group = await Group.findById(cached.groupId);
                if (group) {
                  group.members = group.members.filter((m: any) => m.toString() !== userId);
                  if (group.members.length === 0) {
                    await Group.deleteOne({ _id: group._id });
                  } else {
                    if (group.leaderId.toString() === userId) {
                      group.leaderId = group.members[0];
                    }
                    await group.save();
                    for (const memberId of group.members) {
                      const mWs = activeClients.get(memberId.toString());
                      if (mWs && mWs.readyState === WebSocket.OPEN) {
                        mWs.send(JSON.stringify({ type: "party-updated", group }));
                      }
                    }
                  }
                }
                
                cached.groupId = null;
                cached.dirty = true;
                await User.updateOne({ _id: userId }, { $unset: { groupId: "" } });
                
                const wsClient = activeClients.get(userId);
                if (wsClient && wsClient.readyState === WebSocket.OPEN) {
                  wsClient.send(JSON.stringify({ type: "party-updated", group: null }));
                }
                broadcast({ type: "player-party-changed", userId, groupId: null });
              }
            }
            break;

          case "party-kick":
            if (userId) {
              const { targetUserId } = msg;
              const cached = userCache.get(userId);
              if (cached && cached.groupId) {
                await connectDB();
                const group = await Group.findById(cached.groupId);
                if (group && group.leaderId.toString() === userId) {
                  group.members = group.members.filter((m: any) => m.toString() !== targetUserId);
                  await group.save();
                  
                  const targetCached = userCache.get(targetUserId);
                  if (targetCached) {
                    targetCached.groupId = null;
                    targetCached.dirty = true;
                  }
                  await User.updateOne({ _id: targetUserId }, { $unset: { groupId: "" } });
                  
                  const targetWs = activeClients.get(targetUserId);
                  if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                    targetWs.send(JSON.stringify({ type: "party-updated", group: null, kicked: true }));
                  }
                  
                  for (const memberId of group.members) {
                    const mWs = activeClients.get(memberId.toString());
                    if (mWs && mWs.readyState === WebSocket.OPEN) {
                      mWs.send(JSON.stringify({ type: "party-updated", group }));
                    }
                  }
                  broadcast({ type: "player-party-changed", userId: targetUserId, groupId: null });
                }
              }
            }
            break;

          default:
            console.warn(`Received unknown WS event type: ${msg.type}`);
        }
      } catch (err) {
        console.error("WS handle message error:", err);
      }
    });

    // Connection termination
    ws.on("close", async () => {
      if (userId) {
        // A newer socket may already have replaced this one (second tab / reconnect)
        if (activeClients.get(userId) !== ws) return;
        activeClients.delete(userId);
        economy.forgetRateState(userId);
        console.log(`WebSocket closed: User '${userName}' (${userId})`);
        
        // Immediately flush position to MongoDB to guarantee consistency
        await flushUserPosition(userId);

        // Broadcast disconnection
        broadcast({
          type: "player-disconnected",
          userId,
        });
      } else {
        spectatorClients.delete(ws);
        console.log(`WebSocket closed: Guest Spectator`);
      }
    });
  } catch (error) {
    console.error("WS Connection Init Error:", error);
    ws.close();
  }
});

/** In-game hour right now, without mutating the cached settings. */
function currentHour(): number {
  if (!settingsCache) return 8;
  let hour = Number(settingsCache.timeOfDay) || 0;
  if (settingsCache.isPlaying && settingsCache.lastUpdated) {
    const elapsedSeconds = (Date.now() - new Date(settingsCache.lastUpdated).getTime()) / 1000;
    hour += elapsedSeconds * settingsCache.timeSpeed * 0.1;
  }
  return ((hour % 24) + 24) % 24;
}

let npcSim: ReturnType<typeof createNpcSimulation> | null = null;

// Load DB values into cache and start server
initCache().then(() => {
  npcSim = createNpcSimulation({ broadcast, getHour: currentHour });
  server.listen(PORT, () => {
    console.log(`Express WebSocket Server running on port ${PORT}`);
  });
}).catch((err) => {
  console.error("Failed to boot backend server:", err);
  process.exit(1);
});
