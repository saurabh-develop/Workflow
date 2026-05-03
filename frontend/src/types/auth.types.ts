export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  accounts: Array<{ provider: string; createdAt: string }>;
}

export interface AuthTokens {
  accessToken: string;
}

export interface AuthError {
  code: string;
  message: string;
  providers?: string[];
}

export type AuthStep =
  | "idle"
  | "register"
  | "login"
  | "otp-sent"
  | "verify_email"
  | "forgot-password"
  | "reset-password";
