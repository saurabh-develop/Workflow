import jwt from "jsonwebtoken";
import { db } from "../db";
import crypto from "node:crypto";

const ACCESS_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TTL = "15m";
const REFRESH_TTL = "30d";

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function issueTokens(userId, meta = {}, tx = db) {
  const accessToken = signAccessToken(userId);

  const sessionId = crypto.randomUUID();

  const rawRefreshToken = jwt.sign(
    { sub: userId, sessionId, type: "refresh" },
    REFRESH_SECRET,
    { expiresIn: REFRESH_TTL },
  );

  await tx.session.create({
    data: {
      id: sessionId,
      userId,
      token: hashToken(rawRefreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    },
  });

  return { accessToken, refreshToken: rawRefreshToken };
}

export async function rotateRefreshToken(oldRefreshToken, meta = {}) {
  let payload;
  try {
    payload = jwt.verify(oldRefreshToken, REFRESH_SECRET);

    if (payload.type !== "refresh") {
      throw new Error("Invalid token type");
    }
  } catch {
    throw new Error("Invalid refresh token");
  }

  const hashed = hashToken(oldRefreshToken);

  return await db.$transaction(async (tx) => {
    const session = await tx.session.findFirst({
      where: {
        id: payload.sessionId,
        token: hashed,
      },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new Error("Session expired or revoked");
    }

    // Delete old session
    await tx.session.delete({
      where: { id: payload.sessionId },
    });

    // Create new session + tokens (IMPORTANT: use tx)
    return await issueTokens(payload.sub, meta, tx);
  });
}
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, ACCESS_SECRET);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
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
