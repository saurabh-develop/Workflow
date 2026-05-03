import {
  useState,
  useEffect,
  useRef,
  type SubmitEvent,
  type KeyboardEvent,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { authApi } from "../lib/api";
import type { AuthError, AuthStep } from "../types/auth.types";

function Input({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoFocus,
  disabled,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Btn({
  children,
  type = "button",
  variant = "primary",
  loading,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  type?: "button" | "submit";
  variant?: "primary" | "ghost" | "oauth";
  loading?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`btn btn-${variant}${loading ? " loading" : ""}`}
    >
      {loading ? <span className="spinner" /> : children}
    </button>
  );
}

function ErrorBox({ error }: { error: AuthError | null }) {
  if (!error) return null;
  return (
    <div className="error-box">
      <span className="error-icon">!</span>
      <span>{error.message}</span>
      {error.providers && (
        <div className="error-hint">
          Try signing in with: {error.providers.join(", ")}
        </div>
      )}
    </div>
  );
}

// OTP input

function OtpInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const inputs = useRef<HTMLInputElement[]>([]);
  const digits = value.padEnd(6, "").split("").slice(0, 6);

  const update = (idx: number, char: string) => {
    const next = digits.slice();
    next[idx] = char;
    onChange(next.join("").replace(/\s/g, ""));
  };

  const handleKey = (idx: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[idx] && idx > 0) inputs.current[idx - 1]?.focus();
      update(idx, "");
    } else if (e.key === "ArrowLeft" && idx > 0) {
      inputs.current[idx - 1]?.focus();
    } else if (e.key === "ArrowRight" && idx < 5) {
      inputs.current[idx + 1]?.focus();
    }
  };

  const handleInput = (idx: number, v: string) => {
    const char = v.replace(/\D/g, "").slice(-1);
    if (!char) return;
    update(idx, char);
    if (idx < 5) inputs.current[idx + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (pasted) {
      onChange(pasted);
      inputs.current[Math.min(pasted.length, 5)]?.focus();
    }
    e.preventDefault();
  };

  return (
    <div className="otp-row" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            if (el) inputs.current[i] = el;
          }}
          className="otp-cell"
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] || ""}
          autoFocus={i === 0}
          onChange={(e) => handleInput(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
        />
      ))}
    </div>
  );
}

// Countdown hook for resend timer

function useCountdown(seconds: number) {
  const [count, setCount] = useState(seconds);
  useEffect(() => {
    setCount(seconds);
    const t = setInterval(() => setCount((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [seconds]);
  return count;
}

// Auth page

export default function AuthPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [step, setStep] = useState<AuthStep>("login");
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [newPass, setNewPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [success, setSuccess] = useState("");
  const [resendKey, setResendKey] = useState(0);
  const countdown = useCountdown(resendKey ? 120 : 0);

  // Handle OAuth callback — token arrives in URL
  useEffect(() => {
    const token = params.get("token");
    const err = params.get("error");
    if (err) {
      setError({
        code: "OAUTH_FAILED",
        message: "OAuth login failed. Try again.",
      });
      return;
    }
    if (token) {
      authApi.me().then((user) => {
        login({ accessToken: token, user });
        navigate("/dashboard", { replace: true });
      });
    }
  }, []);

  const go = (s: AuthStep) => {
    setError(null);
    setSuccess("");
    setCode("");
    setStep(s);
  };

  const handle = async (fn: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    setSuccess("");
    try {
      await fn();
    } catch (e: any) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  const onRegister = (e: SubmitEvent) => {
    e.preventDefault();
    if (!name.trim())
      return setError({ code: "VALIDATION", message: "Name is required." });
    handle(async () => {
      await authApi.register({ email, password, name });
      go("verify-email");
      setSuccess("Check your email for a verification code.");
    });
  };

  const onLogin = (e: SubmitEvent) => {
    e.preventDefault();
    handle(async () => {
      const res = await authApi.login({ email, password });
      login(res);
      navigate("/dashboard", { replace: true });
    });
  };

  const onSendOtp = (e: SubmitEvent) => {
    e.preventDefault();
    handle(async () => {
      await authApi.sendOtp(email);
      go("otp-sent");
      setResendKey((k) => k + 1);
      setSuccess("Code sent to " + email);
    });
  };

  const onVerifyOtp = (e: SubmitEvent) => {
    e.preventDefault();
    handle(async () => {
      const res = await authApi.verifyOtp({ email, code });
      login(res);
      navigate("/dashboard", { replace: true });
    });
  };

  const onVerifyEmail = (e: SubmitEvent) => {
    e.preventDefault();
    handle(async () => {
      await authApi.verifyEmail({ email, code });
      setSuccess("Email verified! You can now log in.");
      setTimeout(() => go("login"), 1500);
    });
  };

  const onForgot = (e: SubmitEvent) => {
    e.preventDefault();
    handle(async () => {
      await authApi.forgotPassword(email);
      go("reset-password");
      setResendKey((k) => k + 1);
      setSuccess("Reset code sent.");
    });
  };

  const onReset = (e: SubmitEvent) => {
    e.preventDefault();
    handle(async () => {
      await authApi.resetPassword({ email, code, newPassword: newPass });
      setSuccess("Password reset! Redirecting...");
      setTimeout(() => go("login"), 1500);
    });
  };

  const resendOtp = () =>
    handle(async () => {
      await authApi.sendOtp(email);
      setResendKey((k) => k + 1);
      setSuccess("New code sent.");
    });

  return (
    <div className="auth-root">
      <div className="auth-bg">
        <div className="bg-grid" />
        <div className="bg-glow" />
      </div>

      <div className="auth-card">
        <div className="auth-logo">⬡ WorkFlow</div>

        {/* ── Login ── */}
        {step === "login" && (
          <>
            <h1 className="auth-title">Welcome back</h1>
            <p className="auth-sub">Sign in to your account</p>

            <div className="oauth-row">
              <button className="btn btn-oauth" onClick={authApi.googleLogin}>
                <GoogleIcon /> Google
              </button>
              <button className="btn btn-oauth" onClick={authApi.githubLogin}>
                <GitHubIcon /> GitHub
              </button>
            </div>

            <div className="divider">
              <span>or</span>
            </div>

            <div className="mode-tabs">
              <button
                className={mode === "password" ? "active" : ""}
                onClick={() => setMode("password")}
              >
                Password
              </button>
              <button
                className={mode === "otp" ? "active" : ""}
                onClick={() => setMode("otp")}
              >
                Magic code
              </button>
            </div>

            <ErrorBox error={error} />
            {success && <div className="success-box">{success}</div>}

            {mode === "password" ? (
              <form onSubmit={onLogin}>
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@example.com"
                  autoFocus
                />
                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="link-btn forgot-link"
                  onClick={() => go("forgot-password")}
                >
                  Forgot password?
                </button>
                <Btn type="submit" loading={loading}>
                  Sign in
                </Btn>
              </form>
            ) : (
              <form onSubmit={onSendOtp}>
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@example.com"
                  autoFocus
                />
                <Btn type="submit" loading={loading}>
                  Send code
                </Btn>
              </form>
            )}

            <p className="auth-switch">
              No account?{" "}
              <button className="link-btn" onClick={() => go("register")}>
                Create one
              </button>
            </p>
          </>
        )}

        {/* ── Register ── */}
        {step === "register" && (
          <>
            <h1 className="auth-title">Create account</h1>
            <p className="auth-sub">Start building with AI</p>

            <div className="oauth-row">
              <button className="btn btn-oauth" onClick={authApi.googleLogin}>
                <GoogleIcon /> Google
              </button>
              <button className="btn btn-oauth" onClick={authApi.githubLogin}>
                <GitHubIcon /> GitHub
              </button>
            </div>

            <div className="divider">
              <span>or</span>
            </div>

            <ErrorBox error={error} />
            {success && <div className="success-box">{success}</div>}

            <form onSubmit={onRegister}>
              <Input
                label="Full name"
                value={name}
                onChange={setName}
                placeholder="Ada Lovelace"
                autoFocus
              />
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="At least 8 characters"
              />
              <Btn type="submit" loading={loading}>
                Create account
              </Btn>
            </form>

            <p className="auth-switch">
              Have an account?{" "}
              <button className="link-btn" onClick={() => go("login")}>
                Sign in
              </button>
            </p>
          </>
        )}

        {/* OTP sent  */}
        {step === "otp-sent" && (
          <>
            <h1 className="auth-title">Check your email</h1>
            <p className="auth-sub">
              Enter the 6-digit code sent to <strong>{email}</strong>
            </p>

            <ErrorBox error={error} />
            {success && <div className="success-box">{success}</div>}

            <form onSubmit={onVerifyOtp}>
              <OtpInput value={code} onChange={setCode} />
              <Btn type="submit" loading={loading} disabled={code.length < 6}>
                Verify code
              </Btn>
            </form>

            <div className="resend-row">
              {countdown > 0 ? (
                <span className="resend-timer">Resend in {countdown}s</span>
              ) : (
                <button
                  className="link-btn"
                  onClick={resendOtp}
                  disabled={loading}
                >
                  Resend code
                </button>
              )}
            </div>

            <p className="auth-switch">
              <button className="link-btn" onClick={() => go("login")}>
                ← Back to login
              </button>
            </p>
          </>
        )}

        {/* Email verification */}
        {step === "verify-email" && (
          <>
            <h1 className="auth-title">Verify your email</h1>
            <p className="auth-sub">
              Enter the code sent to <strong>{email}</strong>
            </p>

            <ErrorBox error={error} />
            {success && <div className="success-box">{success}</div>}

            <form onSubmit={onVerifyEmail}>
              <OtpInput value={code} onChange={setCode} />
              <Btn type="submit" loading={loading} disabled={code.length < 6}>
                Verify email
              </Btn>
            </form>

            <div className="resend-row">
              <button
                className="link-btn"
                onClick={() => {
                  authApi.resendVerification(email);
                  setSuccess("New code sent.");
                }}
              >
                Resend code
              </button>
            </div>
          </>
        )}

        {/* Forgot password */}
        {step === "forgot-password" && (
          <>
            <h1 className="auth-title">Reset password</h1>
            <p className="auth-sub">
              Enter your email and we'll send a reset code
            </p>

            <ErrorBox error={error} />
            {success && <div className="success-box">{success}</div>}

            <form onSubmit={onForgot}>
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                autoFocus
              />
              <Btn type="submit" loading={loading}>
                Send reset code
              </Btn>
            </form>

            <p className="auth-switch">
              <button className="link-btn" onClick={() => go("login")}>
                ← Back to login
              </button>
            </p>
          </>
        )}

        {/* Reset password */}
        {step === "reset-password" && (
          <>
            <h1 className="auth-title">New password</h1>
            <p className="auth-sub">
              Enter the code from your email and choose a new password
            </p>

            <ErrorBox error={error} />
            {success && <div className="success-box">{success}</div>}

            <form onSubmit={onReset}>
              <div className="field">
                <label>Reset code</label>
                <OtpInput value={code} onChange={setCode} />
              </div>
              <Input
                label="New password"
                type="password"
                value={newPass}
                onChange={setNewPass}
                placeholder="At least 8 characters"
              />
              <Btn
                type="submit"
                loading={loading}
                disabled={code.length < 6 || newPass.length < 8}
              >
                Set new password
              </Btn>
            </form>

            <div className="resend-row">
              {countdown > 0 ? (
                <span className="resend-timer">Resend in {countdown}s</span>
              ) : (
                <button
                  className="link-btn"
                  onClick={() => {
                    authApi.forgotPassword(email);
                    setResendKey((k) => k + 1);
                    setSuccess("New code sent.");
                  }}
                >
                  Resend code
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
