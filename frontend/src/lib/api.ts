const API = import.meta.env.VITE_API_URL ?? "http://localhost:8001";

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include", // sends httpOnly cookie
    });
    if (!res.ok) return null;
    const data = await res.json();
    accessToken = data.accessToken;
    return accessToken;
  } catch {
    return null;
  }
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const makeRequest = (token: string | null) =>
    fetch(`${API}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

  let res = await makeRequest(accessToken);

  // Auto-refresh on 401
  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await makeRequest(newToken);
    }
  }

  const data = await res.json();

  if (!res.ok) throw data;

  return data as T;
}

export const authApi = {
  register: (body: any) =>
    apiFetch("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  login: (body: any) =>
    apiFetch("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  sendOtp: (email: string) =>
    apiFetch("/api/v1/auth/otp/send", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  verifyOtp: (body: any) =>
    apiFetch("/api/v1/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  verifyEmail: (body: any) =>
    apiFetch("/api/v1/auth/verify-email", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  resendVerification: (email: string) =>
    apiFetch("/api/v1/auth/verify-email/resend", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  forgotPassword: (email: string) =>
    apiFetch("/api/v1/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (body: any) =>
    apiFetch("/api/v1/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  refresh: () => apiFetch("/api/v1/auth/refresh", { method: "POST" }),
  logout: () => apiFetch("/api/v1/auth/logout", { method: "POST" }),
  me: () => apiFetch("/api/v1/auth/me"),
  setPassword: (password: string) =>
    apiFetch("/api/v1/auth/set-password", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  getSessions: () => apiFetch("/api/v1/auth/sessions"),
  revokeSession: (id: string) =>
    apiFetch(`/api/v1/auth/sessions/${id}`, { method: "DELETE" }),
  revokeAllSessions: () =>
    apiFetch("/api/v1/auth/sessions", { method: "DELETE" }),
  googleLogin: () => {
    window.location.href = `${API}/api/v1/auth/google`;
  },
  githubLogin: () => {
    window.location.href = `${API}/api/v1/auth/github`;
  },
};
