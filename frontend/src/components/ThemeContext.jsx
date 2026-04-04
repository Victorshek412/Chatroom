import { createContext, useContext, useEffect, useRef, useState } from "react";
import "../styles/chat-theme.css";

const STORAGE_KEY = "chatroom-theme";

const ThemeContext = createContext({
  isDark: false,
  toggle: () => {},
});

const getStoredTheme = () => {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "dark" ? "dark" : "light";
};

const applyTheme = (theme) => {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getStoredTheme);
  const timerRef = useRef(null);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const toggle = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    document.documentElement.classList.add("theme-transitioning");

    setTheme((current) => {
      const nextTheme = current === "dark" ? "light" : "dark";
      applyTheme(nextTheme);
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
      return nextTheme;
    });

    timerRef.current = window.setTimeout(() => {
      document.documentElement.classList.remove("theme-transitioning");
    }, 220);
  };

  return (
    <ThemeContext.Provider
      value={{
        isDark: theme === "dark",
        toggle,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
