import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import "dotenv/config";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";

import { connectDB } from "./config/db";
import User from "./models/User";
import GridCell from "./models/GridCell";
import Npc from "./models/Npc";
import Settings from "./models/Settings";
import { hashPassword, verifyPassword, signToken, verifyToken } from "./utils/auth";
import { authMiddleware, requireAuth, requireAdmin, AuthenticatedRequest } from "./middlewares/auth";

const app = express();
const PORT = process.env.PORT || 8005;

// Basic middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, true);
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
}

const userCache = new Map<string, CachedUser>();
let npcCache: any[] = [];
let npcCacheDirty = false;
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

    // 2. Load NPCs
    const npcs = await Npc.find({});
    npcCache = npcs.map((n) => n.toObject());

    // 3. Load Users
    const users = await User.find({});
    users.forEach((u) => {
      userCache.set(u._id.toString(), {
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        role: u.role,
        x: u.x,
        z: u.z,
        clothingColor: u.clothingColor,
        shunyaCoins: u.shunyaCoins !== undefined ? u.shunyaCoins : 100,
        level: u.level !== undefined ? u.level : 1,
        xp: u.xp !== undefined ? u.xp : 0,
        wood: u.wood !== undefined ? u.wood : 0,
        unlockedPermits: u.unlockedPermits || [],
        completedAchievements: u.completedAchievements || [],
        dirty: false,
      });
    });

    console.log(`Cache initialized: ${userCache.size} users, ${npcCache.length} NPCs.`);
  } catch (error) {
    console.error("Failed to initialize backend cache:", error);
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
              completedAchievements: u.completedAchievements
            } 
          },
        },
      }));
      await User.bulkWrite(bulkOps);
      dirtyUsers.forEach((u) => (u.dirty = false));
      console.log(`Flushed ${dirtyUsers.length} user stats and positions to database.`);
    }

    // 3. Flush NPCs
    if (npcCacheDirty) {
      const bulkOps = npcCache.map((npc) => ({
        updateOne: {
          filter: { npcId: npc.npcId },
          update: {
            $set: {
              name: npc.name,
              x: npc.x,
              z: npc.z,
              targetX: npc.targetX,
              targetZ: npc.targetZ,
              state: npc.state,
              clothingColor: npc.clothingColor,
            },
          },
          upsert: true,
          },
      }));
      if (bulkOps.length > 0) {
        await Npc.bulkWrite(bulkOps);
      }

      const currentNpcIds = npcCache.map((npc) => npc.npcId);
      await Npc.deleteMany({ npcId: { $nin: currentNpcIds } });

      npcCacheDirty = false;
      console.log(`Flushed ${npcCache.length} NPCs to database.`);
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
            completedAchievements: u.completedAchievements
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
          x: req.user.x,
          z: req.user.z,
          clothingColor: req.user.clothingColor,
          shunyaCoins: req.user.shunyaCoins !== undefined ? req.user.shunyaCoins : 100,
          level: req.user.level !== undefined ? req.user.level : 1,
          xp: req.user.xp !== undefined ? req.user.xp : 0,
          wood: req.user.wood !== undefined ? req.user.wood : 0,
          unlockedPermits: req.user.unlockedPermits || [],
          completedAchievements: req.user.completedAchievements || [],
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

      const isPasswordValid = verifyPassword(password, user.password);
      if (!isPasswordValid) {
        res.status(401).json({ error: "Invalid email or password" });
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

      // Add or update in-memory cache
      userCache.set(user._id.toString(), {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        x: user.x,
        z: user.z,
        clothingColor: user.clothingColor,
        shunyaCoins: user.shunyaCoins !== undefined ? user.shunyaCoins : 100,
        level: user.level !== undefined ? user.level : 1,
        xp: user.xp !== undefined ? user.xp : 0,
        wood: user.wood !== undefined ? user.wood : 0,
        unlockedPermits: user.unlockedPermits || [],
        completedAchievements: user.completedAchievements || [],
        dirty: false,
      });

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
          x: user.x,
          z: user.z,
          clothingColor: user.clothingColor,
          shunyaCoins: user.shunyaCoins !== undefined ? user.shunyaCoins : 100,
          level: user.level !== undefined ? user.level : 1,
          xp: user.xp !== undefined ? user.xp : 0,
          wood: user.wood !== undefined ? user.wood : 0,
          unlockedPermits: user.unlockedPermits || [],
          completedAchievements: user.completedAchievements || [],
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

      const hashedPassword = hashPassword(password);
      const sessionId = crypto.randomUUID();

      const newUser = new User({
        name: name.trim(),
        email: emailLower,
        password: hashedPassword,
        role,
        x: 0,
        z: 0,
        lastX: 0,
        lastZ: 0,
        currentSessionId: sessionId,
      });

      const accessToken = signToken(
        {
          userId: newUser._id,
          email: newUser.email,
          role: newUser.role,
          sessionId,
        },
        "1d",
      );
      const refreshToken = signToken(
        {
          userId: newUser._id,
          email: newUser.email,
          role: newUser.role,
          sessionId,
        },
        "30d",
      );

      newUser.currentRefreshToken = refreshToken;
      await newUser.save();

      // Put new registered user in cache
      userCache.set(newUser._id.toString(), {
        id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        x: newUser.x,
        z: newUser.z,
        clothingColor: newUser.clothingColor,
        shunyaCoins: 100,
        level: 1,
        xp: 0,
        wood: 0,
        unlockedPermits: [],
        completedAchievements: [],
        dirty: false,
      });

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

      res.status(201).json({
        message: "User registered successfully",
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          x: newUser.x,
          z: newUser.z,
          clothingColor: newUser.clothingColor,
          shunyaCoins: 100,
          level: 1,
          xp: 0,
          wood: 0,
          unlockedPermits: [],
          completedAchievements: [],
        },
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
        userCache.delete(user._id.toString());
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

// POST /api/auth/reset
app.post(
  "/api/auth/reset",
  async (req: express.Request, res: express.Response) => {
    try {
      await connectDB();
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: "Email and new password are required" });
        return;
      }

      const emailLower = email.toLowerCase().trim();

      const user = await User.findOne({ email: emailLower });
      if (!user) {
        res.status(404).json({ error: "User with this email does not exist" });
        return;
      }

      const hashedPassword = hashPassword(password);
      const sessionId = crypto.randomUUID();

      user.password = hashedPassword;
      user.currentSessionId = sessionId;
      user.currentRefreshToken = undefined;

      await user.save();

      // Update password in user cache
      const cached = userCache.get(user._id.toString());
      if (cached) {
        // Just invalidate session or delete from cache so it forces re-fetch/re-login
        userCache.delete(user._id.toString());
      }

      res.status(200).json({ message: "Password reset successfully" });
    } catch (error: any) {
      console.error("Password Reset API Error:", error);
      res
        .status(500)
        .json({ error: "Internal server error during password reset" });
    }
  },
);

// GET /api/users
// Serve users directly from the in-memory cache!
app.get(
  "/api/users",
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const users = Array.from(userCache.values()).map(u => ({
        _id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        x: u.x,
        z: u.z,
        clothingColor: u.clothingColor,
        shunyaCoins: u.shunyaCoins !== undefined ? u.shunyaCoins : 100,
        level: u.level !== undefined ? u.level : 1,
        xp: u.xp !== undefined ? u.xp : 0,
        wood: u.wood !== undefined ? u.wood : 0,
        unlockedPermits: u.unlockedPermits || [],
        completedAchievements: u.completedAchievements || [],
      }));

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
    } catch (error: any) {
      console.error("Fetch Users Cache API Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// POST /api/users/position (legacy/HTTP fallback, WebSockets prefer the socket event)
app.post(
  "/api/users/position",
  requireAuth as express.RequestHandler,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const user = req.user;
      const { x, z } = req.body;

      if (x === undefined || z === undefined) {
        res.status(400).json({ error: "Coordinates (x, z) are required" });
        return;
      }

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

// GET /api/grid
app.get("/api/grid", async (req: express.Request, res: express.Response) => {
  try {
    await connectDB();

    const cellsCount = await GridCell.countDocuments();
    if (cellsCount !== 1024) {
      console.log(`Re-initializing grid: expected 1024 cells, found ${cellsCount}. Wiping database grid...`);
      await GridCell.deleteMany({});

      const center = 16;
      const initialCells = [];
      const treeSpots = new Set<string>();
      
      // Scatter 35 random trees
      while (treeSpots.size < 35) {
        const tx = Math.floor(Math.random() * 32);
        const tz = Math.floor(Math.random() * 32);
        // Keep trees away from central road
        if (Math.abs(tx - center) > 1) {
          treeSpots.add(`${tx}_${tz}`);
        }
      }

      for (let x = 0; x < 32; x++) {
        for (let z = 0; z < 32; z++) {
          let type = "empty";
          let constructionProgress = 0;
          let targetType = "empty";

          // Main vertical road
          if (x === center && z >= 4 && z <= 27) {
            type = "road";
            constructionProgress = 100;
            targetType = "road";
          }
          // Secondary horizontal road
          else if (z === center && x >= 4 && x <= 27) {
            type = "road";
            constructionProgress = 100;
            targetType = "road";
          } 
          // Default houses around intersections
          else if (
            (x === center - 1 && z === 8) ||
            (x === center + 1 && z === 22) ||
            (x === 8 && z === center - 1) ||
            (x === 22 && z === center + 1)
          ) {
            type = "house";
            constructionProgress = 100;
            targetType = "house";
          } 
          // Trees
          else if (treeSpots.has(`${x}_${z}`)) {
            type = "tree";
            constructionProgress = 100;
            targetType = "tree";
          }

          // Default shops: one of each in the four city quadrants
          else if ((x === 6 && z === 6) || (x === 25 && z === 6) || (x === 6 && z === 25) || (x === 25 && z === 25)) {
            const shopTypes: Record<string, string> = {
              '6_6': 'restaurant',
              '25_6': 'clothshop',
              '6_25': 'barbershop',
              '25_25': 'policestation',
            };
            type = shopTypes[`${x}_${z}`];
            constructionProgress = 100;
            targetType = type;
          }

          initialCells.push({
            x,
            z,
            type,
            targetType,
            constructionProgress,
            height: 0,
          });
        }
      }

      await GridCell.insertMany(initialCells);
      console.log("32x32 grid successfully initialized in database.");
    }

    const cells = await GridCell.find({});
    res.status(200).json({ cells });
  } catch (error: any) {
    console.error("Fetch Grid Cells Route Error:", error);
    res.status(500).json({ error: "Internal server error while fetching grid cells" });
  }
});

// POST /api/grid
app.post(
  "/api/grid",
  requireAuth as express.RequestHandler,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      await connectDB();
      const { x, z, type, targetType, constructionProgress, height } = req.body;

      if (x === undefined || z === undefined) {
        res.status(400).json({ error: "Coordinates x and z are required" });
        return;
      }

      const isUserAdmin = req.user?.role === "admin";
      const target = targetType || type || "empty";
      const isDemolish = target === "empty";
      const hasPermit = req.user?.unlockedPermits && req.user.unlockedPermits.includes(target);

      if (!isUserAdmin && (isDemolish || !hasPermit)) {
        res.status(403).json({ error: "Insufficient building permissions or missing permit" });
        return;
      }

      const cell = await GridCell.findOneAndUpdate(
        { x: Number(x), z: Number(z) },
        {
          type: type !== undefined ? type : "empty",
          targetType: targetType !== undefined ? targetType : "empty",
          constructionProgress:
            constructionProgress !== undefined ? Number(constructionProgress) : 0,
          height: height !== undefined ? Number(height) : 0,
        },
        { new: true, upsert: true },
      );

      // Broadcast update instantly to all users
      broadcast({
        type: "grid-updated",
        cell,
      });

      res.status(200).json({ message: "Grid cell updated successfully", cell });
    } catch (error: any) {
      console.error("Update Grid Cell API Error:", error);
      res.status(500).json({ error: "Internal server error while updating grid cell" });
    }
  },
);

// GET /api/npcs
// Serve directly from in-memory cache!
app.get("/api/npcs", async (req: express.Request, res: express.Response) => {
  try {
    res.status(200).json({ npcs: npcCache });
  } catch (error: any) {
    console.error("Fetch NPCs Cache API Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/npcs (legacy API, WebSockets prefer socket event)
app.post(
  "/api/npcs",
  requireAdmin as express.RequestHandler,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { npcs } = req.body;

      if (!npcs || !Array.isArray(npcs)) {
        res.status(400).json({ error: "An array of npcs is required" });
        return;
      }

      // Update memory cache
      npcCache = npcs.map((npc) => ({
        npcId: npc.npcId,
        name: npc.name,
        x: Number(npc.x),
        z: Number(npc.z),
        targetX: Number(npc.targetX),
        targetZ: Number(npc.targetZ),
        state: npc.state,
        clothingColor: Number(npc.clothingColor),
      }));
      npcCacheDirty = true;

      // Broadcast changes
      broadcast({
        type: "npcs-updated",
        npcs: npcCache,
      });

      res.status(200).json({ message: "NPCs updated in server memory successfully" });
    } catch (error: any) {
      console.error("Synchronize NPCs API Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// DELETE /api/npcs
app.delete(
  "/api/npcs",
  requireAdmin as express.RequestHandler,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      npcCache = [];
      npcCacheDirty = true;

      broadcast({
        type: "npcs-updated",
        npcs: [],
      });

      res.status(200).json({ message: "All NPCs cleared in server memory successfully" });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to clear NPCs" });
    }
  },
);

// POST /api/admin/settings (legacy API)
app.post(
  "/api/admin/settings",
  requireAdmin as express.RequestHandler,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { timeOfDay, timeSpeed, isPlaying } = req.body;

      if (!settingsCache) {
        settingsCache = { key: "global", timeOfDay: 8.0, timeSpeed: 0.5, isPlaying: true };
      }

      if (timeOfDay !== undefined) settingsCache.timeOfDay = Number(timeOfDay);
      if (timeSpeed !== undefined) settingsCache.timeSpeed = Number(timeSpeed);
      if (isPlaying !== undefined) settingsCache.isPlaying = Boolean(isPlaying);

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

        targetUser.lastX = targetUser.x;
        targetUser.lastZ = targetUser.z;
        targetUser.x = Number(x);
        targetUser.z = Number(z);
        await targetUser.save();

        // Sync to cache
        const cached = userCache.get(targetUserId);
        if (cached) {
          cached.x = Number(x);
          cached.z = Number(z);
          cached.dirty = false;
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
const wss = new WebSocketServer({ noServer: true });

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
function broadcast(message: any) {
  const payload = JSON.stringify(message);
  
  // Send to active authenticated clients
  activeClients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
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

// WebSocket connection lifecycle
wss.on("connection", async (ws: WebSocket, request: http.IncomingMessage) => {
  let userId: string | null = null;
  let userName = "Guest Spectator";
  let isGuest = true;

  try {
    const rawCookies = request.headers.cookie;
    const cookies = parseCookies(rawCookies);
    const dbUser = await getWsUser(cookies);

    if (dbUser) {
      const uId = dbUser._id.toString();
      userId = uId;
      userName = dbUser.name;
      isGuest = false;

      // Close existing socket connection for this user if they open a new tab/session (strict single connection)
      const existing = activeClients.get(uId);
      if (existing && existing.readyState === WebSocket.OPEN) {
        existing.close(1000, "Logged in from another location");
      }

      activeClients.set(uId, ws);
      console.log(`WebSocket connected: User '${userName}' (${uId})`);

      // Add to/update userCache online coordinates
      const cached = userCache.get(uId);
      if (!cached) {
        userCache.set(uId, {
          id: uId,
          name: dbUser.name,
          email: dbUser.email,
          role: dbUser.role,
          x: dbUser.x,
          z: dbUser.z,
          clothingColor: dbUser.clothingColor,
          shunyaCoins: dbUser.shunyaCoins !== undefined ? dbUser.shunyaCoins : 100,
          level: dbUser.level !== undefined ? dbUser.level : 1,
          xp: dbUser.xp !== undefined ? dbUser.xp : 0,
          wood: dbUser.wood !== undefined ? dbUser.wood : 0,
          unlockedPermits: dbUser.unlockedPermits || [],
          completedAchievements: dbUser.completedAchievements || [],
          dirty: false,
        });
      }

      // Broadcast player-connected to all other clients
      broadcast({
        type: "player-connected",
        user: {
          _id: uId,
          name: dbUser.name,
          email: dbUser.email,
          role: dbUser.role,
          x: dbUser.x,
          z: dbUser.z,
          clothingColor: dbUser.clothingColor,
          shunyaCoins: cached ? cached.shunyaCoins : (dbUser.shunyaCoins !== undefined ? dbUser.shunyaCoins : 100),
          level: cached ? cached.level : (dbUser.level !== undefined ? dbUser.level : 1),
          xp: cached ? cached.xp : (dbUser.xp !== undefined ? dbUser.xp : 0),
          wood: cached ? cached.wood : (dbUser.wood !== undefined ? dbUser.wood : 0),
          unlockedPermits: cached ? cached.unlockedPermits : (dbUser.unlockedPermits || []),
          completedAchievements: cached ? cached.completedAchievements : (dbUser.completedAchievements || []),
        }
      });
    } else {
      spectatorClients.add(ws);
      console.log(`WebSocket connected: Guest Spectator`);
    }

    // Send initial configuration payload immediately
    ws.send(
      JSON.stringify({
        type: "init",
        settings: settingsCache,
        npcs: npcCache,
        users: Array.from(userCache.values())
          .filter(u => activeClients.has(u.id))
          .map(u => ({
            _id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            x: u.x,
            z: u.z,
            clothingColor: u.clothingColor,
            shunyaCoins: u.shunyaCoins,
            level: u.level,
            xp: u.xp,
            wood: u.wood,
            unlockedPermits: u.unlockedPermits,
            completedAchievements: u.completedAchievements,
          }))
      })
    );

    // Client event processor
    ws.on("message", async (data: string) => {
      try {
        const msg = JSON.parse(data);

        switch (msg.type) {
          case "player-move":
            if (userId) {
              const { x, z } = msg;
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
              });
            }
            break;

          case "progress-update":
            if (userId) {
              const cached = userCache.get(userId);
              if (cached) {
                const { shunyaCoins, level, xp, wood, unlockedPermits, completedAchievements } = msg;
                if (shunyaCoins !== undefined) cached.shunyaCoins = Number(shunyaCoins);
                if (level !== undefined) cached.level = Number(level);
                if (xp !== undefined) cached.xp = Number(xp);
                if (wood !== undefined) cached.wood = Number(wood);
                if (unlockedPermits !== undefined) cached.unlockedPermits = unlockedPermits;
                if (completedAchievements !== undefined) cached.completedAchievements = completedAchievements;
                cached.dirty = true;

                // Broadcast progression update to all other clients
                broadcast({
                  type: "player-progressed",
                  userId,
                  shunyaCoins: cached.shunyaCoins,
                  level: cached.level,
                  xp: cached.xp,
                  wood: cached.wood,
                  unlockedPermits: cached.unlockedPermits,
                  completedAchievements: cached.completedAchievements,
                });
              }
            }
            break;

          case "npc-sync":
            // Only admin user can sync NPC coordinates
            if (userId) {
              const cached = userCache.get(userId);
              if (cached && cached.role === "admin") {
                npcCache = msg.npcs;
                npcCacheDirty = true;

                // Broadcast NPCs immediately to spectators/users
                broadcast({
                  type: "npcs-updated",
                  npcs: npcCache,
                });
              }
            }
            break;

          case "settings-update":
            if (userId) {
              const cached = userCache.get(userId);
              if (cached && cached.role === "admin") {
                const { timeOfDay, timeSpeed, isPlaying } = msg;
                if (!settingsCache) {
                  settingsCache = { key: "global", timeOfDay: 8.0, timeSpeed: 0.5, isPlaying: true };
                }

                if (timeOfDay !== undefined) settingsCache.timeOfDay = Number(timeOfDay);
                if (timeSpeed !== undefined) settingsCache.timeSpeed = Number(timeSpeed);
                if (isPlaying !== undefined) settingsCache.isPlaying = Boolean(isPlaying);

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
              if (cached) {
                const target = msg.cell.targetType || msg.cell.type || "empty";
                const isDemolish = target === "empty";
                const hasPermit = cached.unlockedPermits && cached.unlockedPermits.includes(target);

                if (cached.role === "admin" || (!isDemolish && hasPermit)) {
                  const { x, z, type, targetType, constructionProgress, height } = msg.cell;
                  await connectDB();
                  const cell = await GridCell.findOneAndUpdate(
                    { x: Number(x), z: Number(z) },
                    {
                      type: type !== undefined ? type : "empty",
                      targetType: targetType !== undefined ? targetType : "empty",
                      constructionProgress:
                        constructionProgress !== undefined ? Number(constructionProgress) : 0,
                      height: height !== undefined ? Number(height) : 0,
                    },
                    { new: true, upsert: true },
                  );

                  // Broadcast updated cell instantly
                  broadcast({
                    type: "grid-updated",
                    cell,
                  });
                }
              }
            }
            break;

          case "admin-revenue":
            // Player spent coins in a shop — credit the admin user
            if (userId) {
              const amount = Number(msg.amount) || 0;
              if (amount > 0) {
                // Find the admin in cache and credit them
                for (const [, u] of userCache.entries()) {
                  if (u.role === "admin") {
                    u.shunyaCoins = (u.shunyaCoins || 0) + amount;
                    u.dirty = true;
                    // Notify admin client of their updated coins
                    const adminWs = activeClients.get(u.id);
                    if (adminWs && adminWs.readyState === WebSocket.OPEN) {
                      adminWs.send(JSON.stringify({
                        type: "admin-coins-updated",
                        shunyaCoins: u.shunyaCoins,
                        fromUser: userCache.get(userId)?.name ?? "Unknown",
                        amount,
                      }));
                    }
                    console.log(`Admin revenue: +${amount} SC from user ${userCache.get(userId)?.name}`);
                    break;
                  }
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
        activeClients.delete(userId);
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

// Load DB values into cache and start server
initCache().then(() => {
  server.listen(PORT, () => {
    console.log(`Express WebSocket Server running on port ${PORT}`);
  });
}).catch((err) => {
  console.error("Failed to boot backend server:", err);
});
