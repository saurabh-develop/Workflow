import express from "express";
import passport from "../lib/auth/passport.js";
import {
  issueTokens,
  rotateRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} from "../lib/auth/tokens.js";
import {
  registerWithEmail,
  loginWithEmail,
  requestPasswordReset,
  resetPassword,
  setPassword,
  getUserSessions,
  revokeSession,
  revokeAllSessions,
} from "../services/auth.service.js";
import { authenticate } from "../middleware/auth.js";
import { db } from "../lib/db.js";

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

function handleError(res, err) {
  if (err?.code) return res.status(400).json(err);
  console.error(err);
  return res
    .status(500)
    .json({ code: "SERVER_ERROR", message: "Something went wrong." });
}

function getMeta(req) {
  return {
    userAgent: req.headers["user-agent"],
    ipAddress: req.ip,
  };
}

// OAuth -- Google

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  }),
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${FRONTEND_URL}/login?error=oauth_failed`,
  }),
  async (req, res) => {
    try {
      const user = req.user;
      const tokens = await issueTokens(user.id, getMeta(req));
      setRefreshTokenCookie(res, tokens.refreshToken);
      res.redirect(
        `${process.env.FRONTEND_URL}/auth/callback?token=${tokens.accessToken}`,
      );
    } catch (error) {
      handleError(res, error);
    }
  },
);

// OAuth -- Github

router.get("/github", passport.authenticate("github", { session: false }));

router.get(
  "/github/callback",
  passport.authenticate("github", {
    session: false,
    failureRedirect: `${FRONTEND_URL}/login?error=oauth_failed`,
  }),
  async (req, res) => {
    try {
      const user = req.user;
      const tokens = await issueTokens(user.id, getMeta(req));
      setRefreshTokenCookie(res, tokens.refreshToken);
      res.redirect(`${FRONTEND_URL}/auth/callback?token=${tokens.accessToken}`);
    } catch (error) {
      handleError(res, error);
    }
  },
);

// Email Password Register and Login

router.post("/register", async (req, res) => {
  const { email, name, password } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({
      code: "VALIDATION",
      message: "email, password and name are required.",
    });
  }
  if (password.length < 8) {
    return res.status(400).json({
      code: "VALIDATION",
      message: "Password must be at least 8 characters.",
    });
  }

  try {
    const user = await registerWithEmail({ email, password, name });
    res.status(201).json({
      message: "Account created. Check your email to verify.",
      userId: user.id,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      code: "VALIDATION",
      message: "email and password are required.",
    });
  }

  try {
    const user = await loginWithEmail({ email, password });
    const tokens = await issueTokens(user.id, getMeta(req));
    setRefreshTokenCookie(res, tokens.refreshToken);
    res.json({
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
});

// Password reset

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  try {
    await requestPasswordReset(email);
    res.json({ message: "Reset code sent if account exists." });
  } catch (err) {
    handleError(res, error);
  }
});

router.post("/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res
      .status(400)
      .json({ code: "VALIDATION", message: "All fields required." });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({
      code: "VALIDATION",
      message: "Password must be at least 8 characters.",
    });
  }

  try {
    await resetPassword(email, code, newPassword);
    res.json({ message: "Password reset successfully." });
  } catch (err) {
    handleError(res, error);
  }
});

// Token refresh

router.post("/refresh", async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) {
    return res
      .status(401)
      .json({ code: "TOKEN_INVALID", message: "No refresh token." });
  }

  try {
    const tokens = await rotateRefreshToken(token, getMeta(req));
    setRefreshTokenCookie(res, tokens.refreshToken);
    res.json({ accessToken: tokens.accessToken });
  } catch (err) {
    clearRefreshTokenCookie(res);
    handleError(res, error);
  }
});

// Set password For OAuth user who havent set password and wanted to login with email and password

router.post("/set-password", authenticate, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({
      code: "VALIDATION",
      message: "Password must be at least 8 characters.",
    });
  }
  try {
    await setPassword(req.user.id, password);
    res.json({ message: "Password set successfully." });
  } catch (err) {
    handleError(res, error);
  }
});

router.post("/logout", authenticate, async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;

    if (token) {
      // Delete only the session linked to this refresh token
      await db.session.deleteMany({
        where: {
          refreshToken: token,
          userId: req.user.id,
        },
      });
    }

    clearRefreshTokenCookie(res);

    res.json({ message: "Logged out from this device." });
  } catch (err) {
    handleError(res, error);
  }
});

// Get profile

router.get("/me", authenticate, async (req, res) => {
  const user = await db.user.findUnique({
    where: { id: req.user.id },
    include: {
      accounts: {
        select: { provider: true, createdAt: true },
      },
    },
  });
  res.json(user);
});

router.patch("/me", authenticate, async (req, res) => {
  const { name, avatarUrl } = req.body;
  try {
    const user = await db.user.update({
      where: { id: req.user.id },
      data: { name, avatarUrl },
    });
    res.json(user);
  } catch (err) {
    handleError(res, error);
  }
});

// Sessions

router.get("/sessions", authenticate, async (req, res) => {
  try {
    const sessions = await getUserSessions(req.user.id);
    res.json(sessions);
  } catch (err) {
    handleError(res, error);
  }
});

router.delete("/sessions/:id", authenticate, async (req, res) => {
  try {
    await revokeSession(req.params.id, req.user.id);
    res.json({ message: "Session revoked." });
  } catch (err) {
    handleError(res, error);
  }
});

router.delete("/sessions", authenticate, async (req, res) => {
  try {
    await revokeAllSessions(req.user.id);
    clearRefreshTokenCookie(res);
    res.json({ message: "All sessions revoked." });
  } catch (err) {
    handleError(res, error);
  }
});

export default router;
