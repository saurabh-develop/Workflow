import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import "./pages/auth.css";
import AppRoutes from "./routes/AppRoutes.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
