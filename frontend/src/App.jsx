import { Routes, Route } from "react-router";
import ChatPage from "./pages/ChatPage";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import { useAuthStore } from "./store/useAuthStore";

function App() {
  const { authUser, login, isLoggedIn } = useAuthStore();

  console.log("auth user:", authUser);
  console.log("isLoggedIn:", isLoggedIn);

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* DECORATORS - GRID BG & GLOW SHAPES (除錯測試版) */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none bg-white">
        {/* 網格層 + 邊緣淡出遮罩 */}
        <div
          className="absolute inset-0 bg-[radial-gradient(#d1d5db_1px,transparent_1px)] [background-size:24px_24px]"
          style={{
            // 使用 style 來寫 mask-image，因為語法較長，這樣寫會比 Tailwind 的 [] 語法更容易閱讀和修改
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 80% at 50% 50%, #000 40%, transparent 100%)",
            maskImage:
              "radial-gradient(ellipse 80% 80% at 50% 50%, #000 40%, transparent 100%)",
          }}
        />
      </div>

      <button onClick={login} className="z-10">
        login
      </button>

      {/* ROUTES */}
      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
      </Routes>
    </div>
  );
}

export default App;
