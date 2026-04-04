import { Navigate, Route, Routes } from "react-router";
import ChatPage from "./pages/ChatPage";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import { initializeSoundPlayback } from "./lib/soundEffects";
import { useAuthStore } from "./store/useAuthStore";
import { useEffect } from "react";
import PageLoader from "./components/PageLoader";
import { ThemeProvider } from "./components/ThemeContext";

import { Toaster } from "react-hot-toast";

function App() {
  const { checkAuth, isCheckingAuth, authUser } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    initializeSoundPlayback();
  }, []);

  if (isCheckingAuth) return <PageLoader />;

  return (
    <ThemeProvider>
      <div className="min-h-screen">
        <Routes>
          <Route
            path="/"
            element={authUser ? <ChatPage /> : <Navigate to={"/login"} />}
          />
          <Route
            path="/login"
            element={!authUser ? <LoginPage /> : <Navigate to={"/"} />}
          />
          <Route
            path="/signup"
            element={!authUser ? <SignUpPage /> : <Navigate to={"/"} />}
          />
        </Routes>

        <Toaster
          toastOptions={{
            style: {
              borderRadius: "14px",
              border: "1px solid var(--ct-border)",
              background: "var(--ct-surface)",
              color: "var(--ct-text1)",
              boxShadow: "var(--ct-shadow-sm)",
            },
          }}
        />
      </div>
    </ThemeProvider>
  );
}
export default App;
