import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import "dotenv/config";

import { connectDB } from "./config/db";
import User from "./models/User";
import { hashPassword, verifyPassword, signToken } from "./utils/auth";
import { authMiddleware, requireAuth, requireAdmin, AuthenticatedRequest } from "./middlewares/auth";
import { sendOtpEmail } from "./utils/mailer";
import { googleClientId, verifyGoogleIdToken } from "./utils/google";
import { OUTFITS, MIN_MATCH_GAP_MS, levelFor, matchXp, parseMatch } from "./game/profile";

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

const ACCESS_TOKEN_MS = 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Start a new single-device session: rotate the session id, store the
 * refresh token and set the auth cookies.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function startSession(user: any, res: express.Response) {
  const sessionId = crypto.randomUUID();
  const claims = { userId: user._id, email: user.email, role: user.role, sessionId };
  const accessToken = signToken(claims, "1d");
  const refreshToken = signToken(claims, "30d");

  user.currentSessionId = sessionId;
  user.currentRefreshToken = refreshToken;
  await user.save();

  const cookie = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
  res.cookie("accessToken", accessToken, { ...cookie, maxAge: ACCESS_TOKEN_MS });
  res.cookie("refreshToken", refreshToken, { ...cookie, maxAge: REFRESH_TOKEN_MS });
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

      await startSession(user, res);
      res.status(200).json({ message: "Login successful", user: sessionUser(user) });
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
      await startSession(user, res);

      res.status(200).json({ message: "Verification successful" });
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

      await startSession(user, res);
      res.status(200).json({
        message: created ? "Account created with Google" : "Login successful",
        created,
        user: sessionUser(user),
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

/** The player's battleground profile: outfit, lifetime stats and level. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function profileOf(user: any) {
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
  return { name: user.name, outfit: user.outfit ?? "classic", stats, ...levelFor(stats.xp) };
}

// GET /api/profile — battleground profile for the lobby
app.get(
  "/api/profile",
  requireAuth as express.RequestHandler,
  (req: AuthenticatedRequest, res: express.Response) => {
    res.status(200).json({ profile: profileOf(req.user) });
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

// POST /api/matches — record a finished match (placement, kills, damage, time survived)
app.post(
  "/api/matches",
  requireAuth as express.RequestHandler,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const match = parseMatch(req.body);
      if (!match) {
        res.status(400).json({ error: "Invalid match result" });
        return;
      }
      await connectDB();
      const user = req.user;
      const now = Date.now();
      if (user.lastMatchAt && now - new Date(user.lastMatchAt).getTime() < MIN_MATCH_GAP_MS) {
        res.status(429).json({ error: "Match reported too soon after the previous one" });
        return;
      }
      const xp = matchXp(match);
      const best = user.stats?.bestPlacement;
      await User.updateOne(
        { _id: user._id },
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
            lastMatchAt: new Date(now),
            "stats.bestPlacement": best ? Math.min(best, match.placement) : match.placement,
          },
        },
      );
      const updated = await User.findById(user._id);
      res.status(200).json({ xpGained: xp, profile: profileOf(updated) });
    } catch (error) {
      console.error("Match report error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

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

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to boot backend server:", err);
    process.exit(1);
  });
