import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db } from "../lib/db.js";
import { sendOtpEmail, sendWelcomeEmail } from "../lib/email.js";

const OTP_EXPIRY_MINUTES = 5;

// Finding Or Creating User

export async function findOrCreateUser({
  provider,
  providerAccountId,
  email,
  name,
  avatarUrl,
}) {
  return await db.$transaction(async (tx) => {
    // Checking if user with same provider exists
    const existingAccount = await tx.account.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      include: { user: true },
    });

    if (existingAccount) {
      return { user: existingAccount.user, isNew: false, wasLinked: false };
    }

    // Checking if user with same email but different provider exist
    const existingUser = await tx.user.findUnique({ where: { email } });

    if (existingUser) {
      await tx.account.create({
        data: {
          userId: existingUser.id,
          provider,
          providerAccountId,
        },
      });

      return { user: existingUser, isNew: false, wasLinked: true };
    }

    // New user account
    const user = await tx.user.create({
      data: {
        email,
        name,
        avatarUrl,
        emailVerified: provider !== "email",
        accounts: {
          create: {
            provider,
            providerAccountId,
          },
        },
      },
      include: { accounts: true },
    });

    await sendWelcomeEmail(user.email, user.name || "");

    return { user, isNew: true, wasLinked: false };
  });
}

// Email And Password

export async function registerWithEmail(input) {
  const { email, password, name } = input;

  const existing = await db.user.findUnique({
    where: { email },
    include: { accounts: true },
  });

  if (existing) {
    const hasEmailAccount = existing.accounts.some(
      (a) => a.provider === "email",
    );
    if (!hasEmailAccount) {
      const providers = existing.accounts.map((a) => a.provider);
      return res.status(409).json({
        error: "ACCOUNT_EXISTS_OAUTH",
        message: `An account with this email already exists via ${providers.join(", ")}.`,
        providers,
        suggestion: "LOGIN_WITH_OAUTH",
      });
    }
    return res.status(409).json({
      error: "ACCOUNT_EXISTS",
      message: "Email already registered.",
    });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await db.user.create({
    data: {
      email,
      name,
      emailVerified: false,
      accounts: {
        create: {
          provider: "email",
          providerAccountId: email,
          passwordHash,
        },
      },
    },
  });

  await createAndSendOtp(user.id, user.email, "verifyEmail");

  return user;
}

export async function loginWithEmail(input) {
  const { email, password } = input;

  const user = await db.user.findUnique({
    where: { email },
    include: { accounts: true },
  });

  if (!user) {
    return res
      .status(401)
      .json({ error: "NO_ACCOUNT", message: "No account found." });
  }

  const emailAccount = user.accounts.find((a) => a.provider === "email");

  if (!emailAccount) {
    const providers = user.accounts.map((a) => a.provider);
    return res.status(401).json({
      error: "WRONG_PROVIDER",
      message: `This account uses ${providers.join(" and ")} login.`,
      providers,
    });
  }

  if (!emailAccount.passwordHash) {
    return res.status(401).json({
      error: "NO_PASSWORD",
      message: "No password set for this account.",
      suggestion: "RESET_PASSWORD",
    });
  }

  const valid = await bcrypt.compare(password, emailAccount.passwordHash);

  if (!valid) {
    return res
      .status(401)
      .json({ error: "WRONG_PASSWORD", message: "Incorrect password." });
  }

  return user;
}

// OTP creating and sending

export async function createAndSendOtp(userId, email, purpose) {
  await db.otpCode.deleteMany({
    where: { userId, purpose, usedAt: null },
  });

  const code = crypto.randomInt(100000, 999999).toString();
  const hash = await bcrypt.hash(code, 10);

  await db.otpCode.create({
    data: {
      userId,
      code: hash,
      purpose,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    },
  });

  await sendOtpEmail(email, code, purpose);

  return code;
}

export async function verifyOtp(userId, rawCode, purpose) {
  const record = await db.otpCode.findFirst({
    where: {
      userId,
      purpose,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    throw {
      code: "OTP_EXPIRED",
      message: "Code expired or not found.",
    };
  }

  const valid = await bcrypt.compare(rawCode, record.code);

  if (!valid) {
    throw {
      code: "INVALID_OTP",
      message: "Incorrect code.",
    };
  }

  await db.otpCode.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  return true;
}
// Password Reset

export async function requestPasswordReset(email) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return;

  await createAndSendOtp(user.id, user.email, "passwordReset");
}

export async function resetPassword(email, code, newPassword) {
  const user = await db.user.findUnique({
    where: { email },
    include: { accounts: true },
  });

  if (!user) {
    throw {
      code: "NO_ACCOUNT",
      message: "Account not found.",
    };
  }

  await verifyOtp(user.id, code, "passwordReset");

  const passwordHash = await bcrypt.hash(newPassword, 12);

  const emailAccount = user.accounts.find((a) => a.provider === "email");

  if (emailAccount) {
    await db.account.update({
      where: { id: emailAccount.id },
      data: { passwordHash },
    });
  } else {
    await db.account.create({
      data: {
        userId: user.id,
        provider: "email",
        providerAccountId: user.email,
        passwordHash,
      },
    });
  }
}

// Set Password

export async function setPassword(userId, newPassword) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      accounts: { where: { provider: "email" } },
    },
  });

  if (!user) {
    throw { code: "NO_ACCOUNT", message: "User not found." };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const emailAccount = user.accounts[0];

  if (emailAccount) {
    await db.account.update({
      where: { id: emailAccount.id },
      data: { passwordHash },
    });
  } else {
    await db.account.create({
      data: {
        userId,
        provider: "email",
        providerAccountId: user.email,
        passwordHash,
      },
    });
  }
}

// Session management

export async function getUserSessions(userId) {
  return db.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: "desc" },
    select: {
      id: true,
      userAgent: true,
      ipAddress: true,
      lastUsedAt: true,
      createdAt: true,
      expiresAt: true,
    },
  });
}

export async function revokeSession(sessionId, userId) {
  const session = await db.session.findUnique({
    where: { id: sessionId },
  });

  if (!session || session.userId !== userId) {
    throw {
      code: "FORBIDDEN",
      message: "Cannot revoke this session.",
    };
  }

  await db.session.delete({ where: { id: sessionId } });
}

export async function revokeAllSessions(userId, exceptSessionId) {
  await db.session.deleteMany({
    where: {
      userId,
      ...(exceptSessionId && {
        id: { not: exceptSessionId },
      }),
    },
  });
}
