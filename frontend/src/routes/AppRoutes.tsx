import { Routes, Route, Navigate } from "react-router-dom";
import {
  ProtectedRoute,
  PublicOnlyRoute,
} from "../components/auth/ProtectedRoute";
import AuthPage from "../pages/AuthPage";
import OAuthCallback from "../pages/OAuthCallback";
import { useAuth } from "../hooks/useAuth";

function Dashboard() {
  const { user, logout } = useAuth();
  return (
    <div
      style={{
        padding: 40,
        fontFamily: "monospace",
        color: "#e8ecf4",
        background: "#0f1117",
        minHeight: "100vh",
      }}
    >
      <h1>Dashboard</h1>
      <p>Welcome, {user?.name ?? user?.email}</p>
      <button
        onClick={logout}
        style={{
          marginTop: 16,
          padding: "8px 16px",
          background: "#7c6df8",
          border: "none",
          borderRadius: 8,
          color: "#fff",
          cursor: "pointer",
        }}
      >
        Log out
      </button>
    </div>
  );
}

const AppRoutes = () => {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<AuthPage />} />
      </Route>

      <Route path="/auth/callback" element={<OAuthCallback />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default AppRoutes;
