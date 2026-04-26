import { verifyAccessToken } from "../lib/auth/tokens.js";
import { db } from "../lib/db.js";

// Authenticate

export async function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({
      code: "TOKEN_INVALID",
      message: "No token provided.",
    });
  }

  const token = header.slice(7);

  try {
    const payload = verifyAccessToken(token);

    const user = await db.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        emailVerified: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        code: "NO_ACCOUNT",
        message: "User not found.",
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json(err);
  }
}

// Email not verified

export function requireEmailVerified(req, res, next) {
  if (!req.user?.emailVerified) {
    return res.status(403).json({
      code: "EMAIL_NOT_VERIFIED",
      message: "Please verify your email to continue.",
    });
  }

  next();
}


export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return next();
  }

  try {
    const payload = verifyAccessToken(header.slice(7));

    db.user
      .findUnique({ where: { id: payload.sub } })
      .then((user) => {
        if (user) req.user = user;
        next();
      })
      .catch(() => next());
  } catch {
    next();
  }
}
