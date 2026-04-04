import { useState } from "react";
import { Link } from "react-router";
import {
  LoaderIcon,
  LockIcon,
  MailIcon,
  MoonIcon,
  SunIcon,
  UserIcon,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useTheme } from "../components/ThemeContext";

const bubbles = [
  { text: "Just made my account! What's up everyone? 🎉", align: "end", maxWidth: 268 },
  { text: "Welcome to the chat!", align: "start", maxWidth: 172 },
  { text: "Love how fast and clean this app is.", align: "end", maxWidth: 232 },
  { text: "Wait till you try the media sharing!", align: "start", maxWidth: 256 },
];

function BrandMark() {
  return (
    <svg width="31" height="31" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        stroke="var(--ct-accent)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SignUpPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [focusedField, setFocusedField] = useState(null);
  const { signup, isSigningUp } = useAuthStore();
  const { isDark, toggle } = useTheme();

  const authPanelColor = isDark ? "#151515" : "#f8f9fd";
  const authFieldColor = isDark ? "#343434" : "#f6f6f8";
  const authFieldBorder = isDark
    ? "1.5px solid rgba(255, 255, 255, 0.08)"
    : "1.5px solid #d3d5db";
  const authToggleBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.08)"
    : "1.8px solid rgba(26, 28, 39, 0.16)";

  const handleSubmit = (event) => {
    event.preventDefault();
    signup(formData);
  };

  const fieldBorder = (fieldName) =>
    focusedField === fieldName
      ? "1.5px solid var(--ct-field-focus)"
      : authFieldBorder;

  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center px-6 py-10 md:px-10 md:py-14"
      style={{ background: "var(--ct-page-bg)" }}
    >
      <button
        type="button"
        className="absolute right-5 top-5 flex h-[48px] w-[48px] items-center justify-center rounded-full md:right-6 md:top-6"
        style={{
          background: "var(--ct-surface)",
          color: "var(--ct-icon)",
          border: authToggleBorder,
          boxShadow: "var(--ct-toggle-shadow)",
        }}
        onClick={toggle}
        title={isDark ? "Light mode" : "Dark mode"}
      >
        {isDark ? <SunIcon size={18} strokeWidth={1.9} /> : <MoonIcon size={18} strokeWidth={1.9} />}
      </button>

      <div
        className="w-full max-w-[1018px] overflow-hidden rounded-[22px] md:flex md:min-h-[626px]"
        style={{
          background: "var(--ct-surface)",
          border: "1px solid var(--ct-border)",
          boxShadow: "var(--ct-card-shadow)",
        }}
      >
        <div className="flex flex-1 flex-col justify-center px-8 py-11 md:px-[58px] md:py-[66px]">
          <div className="mb-[38px]">
            <div className="mb-[34px]">
              <BrandMark />
            </div>
            <h1
              className="text-[22px] font-semibold"
              style={{ color: "var(--ct-text1)", letterSpacing: "-0.025em" }}
            >
              Create your account
            </h1>
            <p className="mt-2 text-[14px]" style={{ color: "var(--ct-text2)" }}>
              Join Chatroom and start messaging
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-[16px]">
            <div>
              <label
                htmlFor="signup-full-name"
                className="mb-2 block text-[13px] font-semibold"
                style={{ color: "var(--ct-text2)" }}
              >
                Display name
              </label>
              <div
                className="flex h-[54px] items-center gap-3 rounded-[15px] px-[15px]"
                style={{
                  background: authFieldColor,
                  border: fieldBorder("fullName"),
                }}
              >
                <UserIcon size={16} strokeWidth={1.9} style={{ color: "var(--ct-text3)" }} />
                <input
                  id="signup-full-name"
                  type="text"
                  autoComplete="name"
                  value={formData.fullName}
                  onChange={(event) =>
                    setFormData({ ...formData, fullName: event.target.value })
                  }
                  onFocus={() => setFocusedField("fullName")}
                  onBlur={() => setFocusedField(null)}
                  className="w-full bg-transparent text-[14px] outline-none"
                  style={{ color: "var(--ct-text1)" }}
                  placeholder="Johnny"
                  data-testid="signup-name"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="signup-email"
                className="mb-2 block text-[13px] font-semibold"
                style={{ color: "var(--ct-text2)" }}
              >
                Email address
              </label>
              <div
                className="flex h-[54px] items-center gap-3 rounded-[15px] px-[15px]"
                style={{
                  background: authFieldColor,
                  border: fieldBorder("email"),
                }}
              >
                <MailIcon size={16} strokeWidth={1.9} style={{ color: "var(--ct-text3)" }} />
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={(event) =>
                    setFormData({ ...formData, email: event.target.value })
                  }
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  className="w-full bg-transparent text-[14px] outline-none"
                  style={{ color: "var(--ct-text1)" }}
                  placeholder="you@example.com"
                  data-testid="signup-email"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="signup-password"
                className="mb-2 block text-[13px] font-semibold"
                style={{ color: "var(--ct-text2)" }}
              >
                Password
              </label>
              <div
                className="flex h-[54px] items-center gap-3 rounded-[15px] px-[15px]"
                style={{
                  background: authFieldColor,
                  border: fieldBorder("password"),
                }}
              >
                <LockIcon size={16} strokeWidth={1.9} style={{ color: "var(--ct-text3)" }} />
                <input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={(event) =>
                    setFormData({ ...formData, password: event.target.value })
                  }
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  className="w-full bg-transparent text-[14px] outline-none"
                  style={{ color: "var(--ct-text1)" }}
                  placeholder="••••••••"
                  data-testid="signup-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSigningUp}
              aria-label={isSigningUp ? "Creating account" : "Create account"}
              aria-busy={isSigningUp}
              data-testid="signup-submit"
              className="mt-[8px] flex h-[48px] w-full items-center justify-center rounded-[14px] text-[15px] font-semibold"
              style={{
                background: "var(--ct-accent)",
                color: "var(--ct-accent-fg)",
                opacity: isSigningUp ? 0.86 : 1,
              }}
            >
              {isSigningUp ? (
                <LoaderIcon className="animate-spin" size={18} aria-hidden="true" />
              ) : (
                "Create account"
              )}
            </button>
            </button>
          </form>

          <p
            className="mt-[26px] text-center text-[13px]"
            style={{ color: "var(--ct-text3)" }}
          >
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-[17px] font-semibold"
              style={{ color: "var(--ct-text2)" }}
            >
              Sign in
            </Link>
          </p>
        </div>

        <div
          className="hidden w-[398px] shrink-0 flex-col justify-center gap-[12px] px-[46px] md:flex"
          style={{
            background: authPanelColor,
            borderLeft: "1px solid var(--ct-border-light)",
          }}
        >
          {bubbles.map((bubble) => (
            <div
              key={bubble.text}
              className={`flex ${bubble.align === "end" ? "justify-end" : "justify-start"}`}
            >
              <div
                className="rounded-[18px] px-[16px] py-[11px] text-[14px]"
                style={{
                  maxWidth: bubble.maxWidth,
                  background: "var(--ct-auth-bubble-bg)",
                  border: "1px solid var(--ct-auth-bubble-border)",
                  color: "var(--ct-bubble-text)",
                  lineHeight: 1.45,
                }}
              >
                {bubble.text}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SignUpPage;
