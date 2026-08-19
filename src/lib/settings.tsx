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
  panicKey: string;
  panicUrl: string;
  wisp: string;
  engine: string;
};

const DEFAULTS: Settings = {
  panicKey: "`",
  panicUrl: "https://classroom.google.com",
  wisp: DEFAULT_WISP,
  engine: SEARCH_ENGINES[0].url,
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

/** Keeps the real browser tab title locked to Matter and favicon to /matter.svg, plus close protection and panic key. */
export function useBrowserChrome() {
  const { settings, ready } = useSettings();

  useEffect(() => {
    if (!ready) return;
    document.title = "StudyHub";

    const href = "/studyhub.svg";
    let link = document.querySelector<HTMLLinkElement>("link[data-studyhub-icon]");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/svg+xml";
      link.dataset["studyhubIcon"] = "true";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [ready]);

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
