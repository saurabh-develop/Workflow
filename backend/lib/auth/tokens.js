import jwt from "jsonwebtoken";
import { db } from "../db";

const ACCESS_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TTL = "15m";
const REFRESH_TTL = "30d";

export function signAccessToken(userId) {
  return jwt.sign({ sub: userId, type: "access" }, ACCESS_SECRET, {
    expiresIn: ACCESS_TTL,
  });
}

export async function issueTokens(userId, meta = {}) {
  const accessToken = signAccessToken(userId);

  // Refresh token stored in DB — can be revoked
  const session = await db.session.create({
    data: {
      userId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    },
  });

  const refreshToken = jwt.sign(
    { sub: userId, sessionId: session.id, type: "refresh" },
    REFRESH_SECRET,
    { expiresIn: REFRESH_TTL },
  );

  return { accessToken, refreshToken };
}

export async function rotateRefreshToken(oldRefreshToken, meta = {}) {
  let payload;
  try {
    payload = jwt.verify(oldRefreshToken, REFRESH_SECRET);
  } catch {
    throw new Error("Invalid refresh token");
  }

  // Checking session still exists (not revoked)
  const session = await db.session.findUnique({
    where: { id: payload.sessionId },
  });
  if (!session || session.expiresAt < new Date()) {
    throw new Error("Session expired or revoked");
  }

  // Delete old session, issue new tokens (rotation)
  await db.session.delete({ where: { id: payload.sessionId } });
  return issueTokens(payload.sub, meta);
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, ACCESS_SECRET);
  } catch (error) {
    if (error === "TokenExpiredError") {
      throw {
        code: "TOKEN_EXPIRED",
        message: "Access token expired",
      };
    }
    throw {
      code: "TOKEN_INVALID",
      message: "Invalid access token",
    };
  }
}

export function setRefreshTokenCookie(res, token) {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/api/v1/auth",
  });
}

export function clearRefreshTokenCookie(res) {
  res.clearCookie("refreshToken", { path: "/api/v1/auth" });
}
