import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { DEFAULT_WISP, SEARCH_ENGINES } from "./proxy";

export type Settings = {
  closeProtection: boolean;
  panicKey: string;
  panicUrl: string;
  wisp: string;
  engine: string;
  logoText: string;
};

const DEFAULTS: Settings = {
  closeProtection: false,
  panicKey: "`",
  panicUrl: "https://classroom.google.com",
  wisp: DEFAULT_WISP,
  engine: SEARCH_ENGINES[0].url,
  logoText: "Mater",
};

const STORAGE_KEY = "frosted.settings";

type Ctx = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  ready: boolean;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) });
    } catch {
      /* ignore corrupt storage */
    }
    setReady(true);
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, update, ready }), [settings, update, ready]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}

/** Applies tab title + favicon, close protection and the panic key. */
export function useBrowserChrome(pageTitle: string, pageIcon: string) {
  const { settings, ready } = useSettings();

  useEffect(() => {
    if (!ready) return;
    const defaultTitle = settings.logoText !== undefined ? settings.logoText : "Mater";
    document.title = pageTitle || defaultTitle;

    const href = pageIcon || "/chrome.svg";
    let link = document.querySelector<HTMLLinkElement>("link[data-frosted-icon]");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.dataset["frostedIcon"] = "true";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [settings, ready, pageTitle, pageIcon]);

  useEffect(() => {
    if (!ready || !settings.closeProtection) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [ready, settings.closeProtection]);

  useEffect(() => {
    if (!ready || !settings.panicKey) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /input|textarea|select/i.test(target.tagName)) return;
      if (event.key.toLowerCase() === settings.panicKey.toLowerCase()) {
        window.location.replace(settings.panicUrl || "https://google.com");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [ready, settings.panicKey, settings.panicUrl]);
}
