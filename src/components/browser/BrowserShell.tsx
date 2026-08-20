import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Plus,
  RotateCw,
  Settings as SettingsIcon,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

import { faviconFor, toUrl } from "@/lib/proxy";
import { useBrowserChrome, useSettings } from "@/lib/settings";
import type { Game } from "@/lib/games";
import { ChromeIcon } from "./ChromeIcon";
import { GameView } from "./GameView";
import { GamesLibrary } from "./GamesLibrary";
import { NewTabPage } from "./NewTabPage";
import { SettingsPanel } from "./SettingsPanel";
import { WebView } from "./WebView";
import { newTab, type Tab } from "./types";

type Nav = { back: () => void; forward: () => void; reload: () => void } | null;

export function BrowserShell() {
  const { settings, update } = useSettings();
  const [tabs, setTabs] = useState<Tab[]>(() => [newTab()]);
  const [activeId, setActiveId] = useState(() => tabs[0]!.id);
  const [showSettings, setShowSettings] = useState(false);
  const [omnibox, setOmnibox] = useState("");
  const navs = useRef<Record<string, Nav>>({});
  const [reloadRotate, setReloadRotate] = useState(0);

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0]!;
  useBrowserChrome();

  const patchTab = useCallback((id: string, patch: Partial<Tab>) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const addTab = (patch: Partial<Tab> = {}) => {
    const tab = { ...newTab(), ...patch };
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
    setOmnibox(tab.url ?? "");
  };

  const closeTab = (id: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (next.length === 0) {
        const fresh = newTab();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) setActiveId(next[next.length - 1]!.id);
      return next;
    });
    delete navs.current[id];
  };

  const navigate = (input: string, id = activeId) => {
    const url = toUrl(input, settings.engine);
    if (!url) return;
    patchTab(id, {
      kind: "web",
      url,
      target: url,
      title: hostOf(url),
      icon: faviconFor(url),
    });
    setOmnibox(url);
  };

  const openGames = (id = activeId) =>
    patchTab(id, { kind: "games", title: "Lessons", url: "frosted://lessons", icon: "" });

  const launchGame = (game: Game) =>
    patchTab(activeId, {
      kind: "game",
      title: game.name,
      url: `frosted://lessons/${game.id}`,
      gameId: game.id,
      gameUrl: game.url,
      gameName: game.name,
      gameAuthor: game.author,
    });

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Tab strip */}
      <div className="flex items-center gap-1 border-b border-border bg-card px-2 pt-2">
        <div className="flex flex-1 items-end gap-1 overflow-x-auto relative">
          <AnimatePresence initial={false}>
            {tabs.map((tab) => (
              <motion.div
                key={tab.id}
                layout="position"
                initial={{ opacity: 0, width: 0, x: -15 }}
                animate={{ opacity: 1, width: "auto", x: 0 }}
                exit={{ opacity: 0, width: 0, x: -15 }}
                transition={{ type: "spring", stiffness: 350, damping: 28 }}
                onClick={() => {
                  setActiveId(tab.id);
                  setOmnibox(tab.kind === "web" ? tab.url : "");
                }}
                style={{ overflow: "hidden" }}
                className={`group flex min-w-[9rem] max-w-[14rem] cursor-pointer items-center gap-2 rounded-t-lg border border-b-0 px-3 py-2 text-xs select-none ${
                  tab.id === activeId
                    ? "border-border bg-background text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-accent"
                }`}
              >
                {tab.kind === "games" || tab.kind === "game" ? (
                  <BookOpen className="h-3.5 w-3.5 shrink-0" />
                ) : tab.kind === "new" ||
                  tab.icon === "/studyhub.svg" ||
                  tab.icon === "/matter.svg" ? (
                  <img src="/studyhub.svg" alt="" className="h-3.5 w-3.5 shrink-0 rounded-sm" />
                ) : tab.icon ? (
                  <img
                    src={tab.icon}
                    alt=""
                    className="h-3.5 w-3.5 shrink-0 rounded-sm"
                    onError={(e) => {
                      e.currentTarget.src = "/studyhub.svg";
                    }}
                  />
                ) : (
                  <img src="/studyhub.svg" alt="" className="h-3.5 w-3.5 shrink-0 rounded-sm" />
                )}
                <span className="truncate flex-1">{tab.title}</span>
                {tabs.length > 1 && (
                  <motion.button
                    aria-label="Close tab"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className="ml-auto rounded p-0.5 transition-opacity hover:bg-accent cursor-pointer opacity-100 md:opacity-0 md:group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </motion.button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          <motion.button
            aria-label="New tab"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            onClick={() => addTab()}
            className="mb-1 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
          >
            <Plus className="h-4 w-4" />
          </motion.button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
        <ToolbarButton label="Back" onClick={() => navs.current[activeId]?.back()}>
          <ArrowLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Forward" onClick={() => navs.current[activeId]?.forward()}>
          <ArrowRight className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Reload"
          onClick={() => {
            if (active.kind === "web") {
              navs.current[activeId]?.reload();
              setReloadRotate((r) => r + 360);
            } else {
              setReloadRotate((r) => r + 360);
            }
          }}
        >
          <motion.div
            animate={{ rotate: reloadRotate }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="flex items-center justify-center"
          >
            <RotateCw className="h-4 w-4" />
          </motion.div>
        </ToolbarButton>

        <form
          className="flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(omnibox);
          }}
        >
          <input
            value={omnibox}
            onChange={(e) => setOmnibox(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            onFocus={(e) => e.currentTarget.select()}
            placeholder="Search or enter address"
            className="w-full rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground transition-all duration-200 ease-out focus:ring-2 focus:ring-primary/20 focus:border-foreground/40"
          />
        </form>

        <ToolbarButton
          label="Lessons"
          onClick={() => addTab({ kind: "games", title: "Lessons", url: "frosted://lessons" })}
        >
          <BookOpen className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Settings" onClick={() => setShowSettings(true)}>
          <SettingsIcon className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Content */}
      <div className="relative flex-1 overflow-hidden">
        {tabs.map((tab) => (
          <motion.div
            key={tab.id}
            initial={{ opacity: 0, scale: 0.99, y: 4 }}
            animate={{
              opacity: tab.id === activeId ? 1 : 0,
              scale: tab.id === activeId ? 1 : 0.99,
              y: tab.id === activeId ? 0 : 4,
            }}
            transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
            style={{
              visibility: tab.id === activeId ? "visible" : "hidden",
              pointerEvents: tab.id === activeId ? "auto" : "none",
            }}
            className="absolute inset-0"
          >
            {tab.kind === "new" && (
              <NewTabPage
                engine={settings.engine}
                onEngineChange={(engine) => update({ engine })}
                onNavigate={(input) => navigate(input, tab.id)}
                onOpenGames={() => openGames(tab.id)}
              />
            )}
            {tab.kind === "games" && <GamesLibrary onLaunch={launchGame} />}
            {tab.kind === "game" && (
              <GameView
                url={tab.gameUrl ?? ""}
                name={tab.gameName ?? tab.title}
                author={tab.gameAuthor}
                onBack={() => openGames(tab.id)}
              />
            )}
            {tab.kind === "web" && (
              <WebView
                url={tab.target}
                wisp={settings.wisp}
                active={tab.id === activeId}
                onMeta={(meta) => {
                  patchTab(tab.id, {
                    ...(meta.title ? { title: meta.title } : {}),
                    ...(meta.icon ? { icon: meta.icon } : {}),
                    ...(meta.url ? { url: meta.url } : {}),
                  });
                  if (meta.url && tab.id === activeId) setOmnibox(meta.url);
                }}
                registerNav={(nav) => {
                  navs.current[tab.id] = nav;
                }}
              />
            )}
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      </AnimatePresence>
    </div>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      aria-label={label}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
    >
      {children}
    </motion.button>
  );
}
