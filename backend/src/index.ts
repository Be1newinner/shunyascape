import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import "dotenv/config";
import http from "http";

import { connectDB } from "./config/db";
import User from "./models/User";
import { hashPassword, verifyPassword, signToken } from "./utils/auth";
import { authMiddleware, requireAuth, requireAdmin, AuthenticatedRequest, setSessionCookies, signRefreshToken } from "./middlewares/auth";
import { sendOtpEmail } from "./utils/mailer";
import { googleClientId, verifyGoogleIdToken } from "./utils/google";
import { OUTFITS, levelFor, matchXp } from "./game/profile";
import { STREAK_OUTFITS, applyResult, checkIn, claim, describe, ensureDaily } from "./game/missions";
import { CONQUEROR_TOP, applyRanked, ensureSeason, seasonEnds, seasonId, tierFor, type RankedState } from "./game/ranked";
import { attachMatchServer } from "./match/socket";
import { initPhysics } from "./match/World";
import type { HumanResult } from "./match/Match";

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
  res.send("Welcome to the Unthikable API server!");
});

function randomOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

// ==========================================
// SESSIONS
// ==========================================

/**
 * Start a new single-device session: rotate the session id, store the
 * refresh token and set the auth cookies.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function startSession(user: any, res: express.Response) {
  user.currentSessionId = crypto.randomUUID();
  const refreshToken = signRefreshToken(user);
  user.currentRefreshToken = refreshToken;
  user.previousRefreshToken = null;
  user.refreshRotatedAt = null;
  await user.save();
  setSessionCookies(res, user, refreshToken);
  return refreshToken;
}

/**
 * The mobile app (header `X-Client: app`) can't read cookies, so it also gets
 * the session's refresh token in the response, kept in the device's secure
 * storage and sent back as `Authorization: Bearer`. Same session, same
 * single-device rule: signing in elsewhere invalidates it.
 */
function appSession(req: express.Request, refreshToken: string) {
  return req.get("x-client") === "app" ? { appToken: refreshToken } : {};
}

/** The signed-in user's own view of their account (includes their email). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sessionUser(user: any) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
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
      res.status(200).json({ user: sessionUser(req.user) });
    } catch (error) {
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

      if (!user.password && user.googleId) {
        res.status(401).json({
          error: "This account uses Google sign-in. Continue with Google, or use \"Forgot password\" to add a password.",
          useGoogle: true,
        });
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

      const refresh = await startSession(user, res);
      res.status(200).json({ message: "Login successful", user: sessionUser(user), ...appSession(req, refresh) });
    } catch (error) {
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
    } catch (error) {
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
        user.previousRefreshToken = null;
        user.currentSessionId = null;
        await user.save();
      }

      res.clearCookie("accessToken", { path: "/" });
      res.clearCookie("refreshToken", { path: "/" });

      res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
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
      const refresh = await startSession(user, res);

      res.status(200).json({ message: "Verification successful", user: sessionUser(user), ...appSession(req, refresh) });
    } catch (error) {
      console.error("OTP Verification Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// GET /api/auth/config — public auth settings for the sign-in UI
app.get("/api/auth/config", (req: express.Request, res: express.Response) => {
  res.status(200).json({ googleClientId: googleClientId() });
});

// POST /api/auth/google — sign in (or sign up) with a Google ID token
app.post(
  "/api/auth/google",
  async (req: express.Request, res: express.Response) => {
    try {
      const credential = req.body?.credential;
      if (typeof credential !== "string" || credential.length === 0 || credential.length > 4096) {
        res.status(400).json({ error: "Missing Google credential" });
        return;
      }
      if (!googleClientId()) {
        res.status(503).json({ error: "Google sign-in is not configured on this server" });
        return;
      }

      let profile;
      try {
        profile = await verifyGoogleIdToken(credential);
      } catch (err) {
        console.warn("Rejected Google ID token:", (err as Error).message);
        res.status(401).json({ error: "Google sign-in failed. Please try again." });
        return;
      }
      if (!profile.emailVerified) {
        res.status(403).json({ error: "Your Google account's email address isn't verified." });
        return;
      }

      await connectDB();
      let user =
        (await User.findOne({ googleId: profile.sub })) ??
        (await User.findOne({ email: profile.email }));
      let created = false;

      if (user && !user.googleId) {
        // Link an existing email account: Google has proven the person owns this email
        user.googleId = profile.sub;
        if (!user.isVerified) {
          // Someone registered this email without ever verifying it; their
          // password must not keep working now that the real owner is here
          user.password = null;
          user.isVerified = true;
          user.otp = null;
          user.otpExpires = null;
        }
      } else if (user && user.googleId !== profile.sub) {
        res.status(409).json({ error: "This email is already linked to a different Google account." });
        return;
      } else if (!user) {
        const totalUsers = await User.countDocuments({});
        user = new User({
          name: profile.name || profile.email.split("@")[0],
          email: profile.email,
          password: null,
          googleId: profile.sub,
          role: totalUsers === 0 ? "admin" : "user",
          isVerified: true,
        });
        created = true;
      }

      const refresh = await startSession(user, res);
      res.status(200).json({
        message: created ? "Account created with Google" : "Login successful",
        created,
        user: sessionUser(user),
        ...appSession(req, refresh),
      });
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      res.status(500).json({ error: "Internal server error during Google sign-in" });
    }
  },
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
    } catch (error) {
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
    } catch (error) {
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
      res.status(200).json({ message: "Profile updated", updates });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/** This season's leaderboard position (1 = top), or null without a ranked match yet. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function seasonRank(user: any) {
  const r = user.ranked as RankedState | undefined;
  if (!r || r.season !== seasonId() || !r.matches) return null;
  return (await User.countDocuments({ "ranked.season": r.season, "ranked.points": { $gt: r.points } })) + 1;
}

/** Ranked record for the lobby: tier, division, progress, this season's end, last season's tier. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rankedOf(user: any, rank: number | null) {
  const r = ensureSeason(user.ranked?.season ? (user.ranked as RankedState) : null);
  return {
    season: r.season,
    endsAt: seasonEnds().toISOString(),
    points: r.points,
    matches: r.matches,
    peak: r.peak,
    rank,
    ...tierFor(r.points, rank ?? undefined),
    last: r.last ?? null,
  };
}

/**
 * Load-time upkeep for the lobby: start today's missions, roll the ranked
 * season, and count the daily login (streak + XP + streak outfits).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dailyUpkeep(user: any) {
  const daily = ensureDaily(user.daily, user._id.toString());
  const ranked = ensureSeason(user.ranked?.season ? (user.ranked as RankedState) : null);
  const { streak, reward } = checkIn(user.streak);
  // Atomic: a match result may be adding XP at this very moment.
  await User.updateOne(
    { _id: user._id },
    {
      $set: { daily, ranked, streak },
      $inc: { "stats.xp": reward?.xp ?? 0 },
      ...(reward?.unlocked.length ? { $addToSet: { unlockedOutfits: { $each: reward.unlocked } } } : {}),
    },
  );
  // Mirror it in memory for this response.
  user.daily = daily;
  user.ranked = ranked;
  user.streak = streak;
  if (reward) {
    user.stats.xp = (user.stats?.xp ?? 0) + reward.xp;
    for (const id of reward.unlocked) if (!user.unlockedOutfits.includes(id)) user.unlockedOutfits.push(id);
  }
  return reward;
}

/** The player's battleground profile: outfit, lifetime stats and level. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function profileOf(user: any, extra: { rank?: number | null; checkIn?: unknown } = {}) {
  const st = user.stats ?? {};
  const stats = {
    matches: st.matches ?? 0,
    wins: st.wins ?? 0,
    kills: st.kills ?? 0,
    damage: st.damage ?? 0,
    top10: st.top10 ?? 0,
    bestPlacement: st.bestPlacement ?? null,
    timePlayed: st.timePlayed ?? 0,
    xp: st.xp ?? 0,
  };
  const daily = ensureDaily(user.daily, user._id.toString());
  return {
    name: user.name,
    outfit: user.outfit ?? "classic",
    stats,
    ...levelFor(stats.xp),
    missions: describe(daily),
    streak: { count: user.streak?.count ?? 0, best: user.streak?.best ?? 0 },
    unlocked: user.unlockedOutfits ?? [],
    lockedOutfits: STREAK_OUTFITS,
    ranked: rankedOf(user, extra.rank ?? null),
    lastMatchReward: user.lastMatchReward ?? null,
    checkIn: extra.checkIn ?? null,
  };
}

// GET /api/profile — battleground profile for the lobby
app.get(
  "/api/profile",
  requireAuth as express.RequestHandler,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      await connectDB();
      const user = await User.findById(req.user._id);
      if (!user) {
        res.status(404).json({ error: "Account not found" });
        return;
      }
      const reward = await dailyUpkeep(user);
      res.status(200).json({ profile: profileOf(user, { rank: await seasonRank(user), checkIn: reward }) });
    } catch (error) {
      console.error("Profile error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// POST /api/missions/claim — collect the XP of a finished daily mission
app.post(
  "/api/missions/claim",
  requireAuth as express.RequestHandler,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      await connectDB();
      const user = await User.findById(req.user._id);
      if (!user) {
        res.status(404).json({ error: "Account not found" });
        return;
      }
      const daily = ensureDaily(user.daily, user._id.toString());
      const out = claim(daily, String(req.body?.id ?? ""));
      if ("error" in out) {
        res.status(400).json({ error: out.error });
        return;
      }
      // Only claim it if it wasn't claimed by a parallel request in the meantime.
      const done = await User.updateOne(
        { _id: user._id, "daily.day": daily.day, "daily.missions": { $elemMatch: { id: req.body.id, claimed: false } } },
        { $set: { daily }, $inc: { "stats.xp": out.xp } },
      );
      if (!done.modifiedCount && user.daily?.day === daily.day) {
        res.status(400).json({ error: "Already claimed" });
        return;
      }
      if (!done.modifiedCount) await User.updateOne({ _id: user._id }, { $set: { daily }, $inc: { "stats.xp": out.xp } });
      user.daily = daily;
      user.stats.xp = (user.stats?.xp ?? 0) + out.xp;
      res.status(200).json({ xp: out.xp, profile: profileOf(user, { rank: await seasonRank(user) }) });
    } catch (error) {
      console.error("Mission claim error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// GET /api/leaderboard — this ranked season's top 50 (and where you are)
app.get(
  "/api/leaderboard",
  requireAuth as express.RequestHandler,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      await connectDB();
      const season = seasonId();
      const top = await User.find({ "ranked.season": season, "ranked.matches": { $gt: 0 } }, { name: 1, outfit: 1, ranked: 1, "stats.xp": 1 })
        .sort({ "ranked.points": -1, "ranked.matches": 1 })
        .limit(50)
        .lean();
      const me = req.user._id.toString();
      res.status(200).json({
        season,
        endsAt: seasonEnds().toISOString(),
        conquerorTop: CONQUEROR_TOP,
        players: top.map((u, i) => ({
          rank: i + 1,
          name: u.name,
          outfit: u.outfit ?? "classic",
          points: u.ranked?.points ?? 0,
          matches: u.ranked?.matches ?? 0,
          level: levelFor(u.stats?.xp ?? 0).level,
          tier: tierFor(u.ranked?.points ?? 0, i + 1).tier,
          you: u._id.toString() === me,
        })),
        you: rankedOf(req.user, await seasonRank(req.user)),
      });
    } catch (error) {
      console.error("Leaderboard error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// PATCH /api/profile/outfit — pick an outfit from the wardrobe
app.patch(
  "/api/profile/outfit",
  requireAuth as express.RequestHandler,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const outfit = req.body?.outfit;
      if (!OUTFITS.includes(outfit)) {
        res.status(400).json({ error: "Unknown outfit" });
        return;
      }
      if (outfit in STREAK_OUTFITS && !(req.user.unlockedOutfits ?? []).includes(outfit)) {
        res.status(403).json({ error: `Unlocked with a ${STREAK_OUTFITS[outfit]}-day login streak` });
        return;
      }
      await connectDB();
      req.user.outfit = outfit;
      await req.user.save();
      res.status(200).json({ profile: profileOf(req.user) });
    } catch (error) {
      console.error("Outfit update error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// DELETE /api/profile — the player deletes their own account (profile, stats, sign-in) for good
app.delete(
  "/api/profile",
  requireAuth as express.RequestHandler,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      await connectDB();
      await User.deleteOne({ _id: req.user._id });
      res.clearCookie("accessToken", { path: "/" });
      res.clearCookie("refreshToken", { path: "/" });
      res.status(200).json({ deleted: true });
    } catch (error) {
      console.error("Account deletion error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ==========================================
// MOBILE APP -> WEBVIEW SESSION HANDOFF
// ==========================================

/** One-time codes that log the app's WebView into the app's session (60 s, single use). */
const handoffCodes = new Map<string, { userId: string; sessionId: string; expires: number }>();
const HANDOFF_MS = 60_000;

// POST /api/auth/handoff — the app (Bearer token) asks for a code for its WebView
app.post(
  "/api/auth/handoff",
  requireAuth as express.RequestHandler,
  (req: AuthenticatedRequest, res: express.Response) => {
    const now = Date.now();
    for (const [c, v] of handoffCodes) if (v.expires < now) handoffCodes.delete(c);
    const code = crypto.randomBytes(24).toString("base64url");
    handoffCodes.set(code, { userId: req.user._id.toString(), sessionId: req.user.currentSessionId, expires: now + HANDOFF_MS });
    // A fresh 30-day token for the app each launch, so an app that's opened keeps its session.
    const u = req.user;
    const appToken = signToken({ userId: u._id, email: u.email, role: u.role, sessionId: u.currentSessionId, kind: "app" }, "30d");
    res.status(200).json({ code, appToken });
  },
);

// GET /api/auth/handoff?code=…&next=/battleground — the WebView opens this; it sets the
// session cookies for this site and continues into the game
app.get("/api/auth/handoff", async (req: express.Request, res: express.Response) => {
  const code = String(req.query.code ?? "");
  const next = String(req.query.next ?? "/battleground");
  // Only same-site paths: never redirect to another origin.
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/battleground";
  const entry = handoffCodes.get(code);
  handoffCodes.delete(code);
  try {
    if (!entry || entry.expires < Date.now()) throw new Error("expired");
    await connectDB();
    const user = await User.findById(entry.userId);
    // Still the same session (no sign-in elsewhere in the meantime).
    if (!user || user.currentSessionId !== entry.sessionId || !user.currentRefreshToken) throw new Error("stale");
    setSessionCookies(res, user, user.currentRefreshToken);
    res.redirect(302, target);
  } catch {
    res.redirect(302, `${target}${target.includes("?") ? "&" : "?"}handoff=failed`);
  }
});

// GET /api/match/ticket — short-lived pass for the game server's WebSocket
app.get(
  "/api/match/ticket",
  requireAuth as express.RequestHandler,
  (req: AuthenticatedRequest, res: express.Response) => {
    const u = req.user;
    const level = levelFor(u.stats?.xp ?? 0).level;
    const ticket = signToken({ kind: "match", userId: u._id.toString(), name: u.name, outfit: u.outfit ?? "classic", level }, "90s");
    res.status(200).json({ ticket });
  },
);

/** Bonus XP the game server grants once a match is decided (top-3 killers). */
async function awardXp(userId: string, xp: number) {
  try {
    await connectDB();
    await User.updateOne({ _id: userId }, { $inc: { "stats.xp": xp } });
  } catch (err) {
    console.error("Failed to award XP:", err);
  }
}

/**
 * The game server reports each human's result; stats, daily missions and
 * ranked points are written here, never by clients.
 */
async function recordHumanResult(userId: string, match: HumanResult) {
  try {
    await connectDB();
    const user = await User.findById(userId);
    if (!user) return;
    const xp = matchXp(match);
    const best = user.stats?.bestPlacement;
    const daily = ensureDaily(user.daily, userId);
    applyResult(daily, match);
    const ranked = ensureSeason(user.ranked?.season ? (user.ranked as RankedState) : null);
    const rp = applyRanked(ranked, match);
    // Counters with $inc so a podium bonus landing at the same moment isn't lost.
    await User.updateOne(
      { _id: userId },
      {
        $inc: {
          "stats.matches": 1,
          "stats.wins": match.placement === 1 ? 1 : 0,
          "stats.kills": match.kills,
          "stats.damage": match.damage,
          "stats.top10": match.placement <= 10 ? 1 : 0,
          "stats.timePlayed": match.survived,
          "stats.xp": xp,
        },
        $set: {
          lastMatchAt: new Date(),
          "stats.bestPlacement": best ? Math.min(best, match.placement) : match.placement,
          daily,
          ranked,
          lastMatchReward: { xp, rp, points: ranked.points, at: new Date().toISOString() },
        },
      },
    );
  } catch (error) {
    console.error("Failed to record match result:", error);
  }
}

// GET /api/admin/users — every account with its email, admins only
app.get(
  "/api/admin/users",
  requireAdmin as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    try {
      await connectDB();
      const users = await User.find({}, { name: 1, email: 1, role: 1, isVerified: 1, googleId: 1, createdAt: 1 })
        .sort({ createdAt: -1 })
        .lean();
      res.status(200).json({
        users: users.map((u) => ({
          _id: u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          isVerified: u.isVerified,
          google: Boolean(u.googleId),
          createdAt: u.createdAt,
        })),
      });
    } catch (error) {
      console.error("Admin user list error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// POST /api/admin/users — change a user's role or delete them
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

      if (action === "changeRole") {
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

        res.status(200).json({
          message: `Updated role for ${targetUser.name} to ${role}`,
          user: sessionUser(targetUser),
        });
      } else if (action === "delete") {
        if (targetUser._id.toString() === requester._id.toString()) {
          res.status(400).json({ error: "Cannot delete your own admin account." });
          return;
        }

        await User.findByIdAndDelete(targetUserId);

        res.status(200).json({
          message: `Deleted user ${targetUser.name} successfully`,
          deletedUserId: targetUserId,
        });
      } else {
        res.status(400).json({ error: `Unknown action: ${action}` });
      }
    } catch (error) {
      console.error("Admin API Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

const server = http.createServer(app);
const { matchmaker } = attachMatchServer(server, {
  result: (userId, r) => void recordHumanResult(userId, r),
  award: (userId, xp) => void awardXp(userId, xp),
});

// GET /api/match/status — live matches and the waiting line, for the lobby
app.get("/api/match/status", (_req: express.Request, res: express.Response) => {
  res.set("Cache-Control", "no-store").json(matchmaker.status());
});

// The bots' physics engine (WebAssembly) must be ready before any match starts.
Promise.all([connectDB(), initPhysics()])
  .then(() => {
    server.listen(PORT, () => {
      console.log(`API + game server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to boot backend server:", err);
    process.exit(1);
  });
