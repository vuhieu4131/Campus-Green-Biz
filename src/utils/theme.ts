export type AppTheme = "light" | "dark";
export const AppTheme = {
  LIGHT: "light" as const,
  DARK: "dark" as const,
};

export const THEME_STORAGE_KEY = "cgb_theme_mode";

const getStorage = (): Storage | null => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== "undefined" && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage;
    }
  } catch {
    // Ignore storage errors
  }
  return null;
};

export const normalizeTheme = (val: unknown): AppTheme => {
  return val === "dark" ? "dark" : "light";
};

export const getInitialTheme = (): AppTheme => {
  const storage = getStorage();
  if (!storage) return "light";
  try {
    const raw = storage.getItem(THEME_STORAGE_KEY);
    if (!raw) return "light";
    if (raw === "dark" || raw === '"dark"') return "dark";
    return "light";
  } catch {
    return "light";
  }
};

export const persistTheme = (theme: AppTheme): AppTheme => {
  const normalized = normalizeTheme(theme);
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(THEME_STORAGE_KEY, normalized);
    } catch {
      // Ignore storage errors
    }
  }
  applyThemeToDom(normalized);
  return normalized;
};

export const toggleThemeValue = (current: AppTheme): AppTheme => {
  return current === "dark" ? "light" : "dark";
};

export const applyThemeToDom = (theme: AppTheme): void => {
  const normalized = normalizeTheme(theme);
  if (typeof document === "undefined") return;
  try {
    if (document.body) {
      document.body.setAttribute("zaui-theme", normalized);
    }
    if (document.documentElement) {
      document.documentElement.setAttribute("data-theme", normalized);
      if (normalized === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  } catch {
    // Ignore DOM errors in non-browser environments
  }
};
