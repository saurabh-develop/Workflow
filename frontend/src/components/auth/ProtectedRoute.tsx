import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.tsx";

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#0f1117",
          color: "#9d8ff9",
          fontFamily: "monospace",
        }}
      >
        ⬡ Loading...
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#0f1117",
          color: "#9d8ff9",
          fontFamily: "monospace",
        }}
      >
        ⬡ Loading...
      </div>
    );
  }
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
