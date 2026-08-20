import { BookOpen, Globe, Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "motion/react";

import { SEARCH_ENGINES } from "@/lib/proxy";

export type Shortcut = { id: string; label: string; url: string };

const STORAGE_KEY = "frosted.shortcuts";

type Props = {
  engine: string;
  onEngineChange: (url: string) => void;
  onNavigate: (input: string) => void;
  onOpenGames: () => void;
};

export function NewTabPage({ engine, onEngineChange, onNavigate, onOpenGames }: Props) {
  const logoText = "StudyHub";
  const [value, setValue] = useState("");
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ label: "", url: "" });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Shortcut[];
        if (Array.isArray(parsed)) {
          setShortcuts(parsed);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persist = (next: Shortcut[]) => {
    setShortcuts(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const engineName = SEARCH_ENGINES.find((e) => e.url === engine)?.name ?? SEARCH_ENGINES[0].name;

  return (
    <div className="frosted-grid relative h-full overflow-y-auto bg-background">
      <div className="flex min-h-full flex-col items-center justify-center px-6 py-16">
        <motion.h1
          className="select-none text-7xl font-light tracking-tight text-foreground md:text-8xl cursor-default flex flex-wrap justify-center"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {logoText.split("").map((char, index) => (
            <motion.span
              key={index}
              className="inline-block transition-colors duration-200 hover:text-foreground"
              whileHover={{
                y: -12,
                scale: 1.15,
                filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.15))",
              }}
              transition={{ type: "spring", stiffness: 450, damping: 12 }}
            >
              {char === " " ? "\u00A0" : char}
            </motion.span>
          ))}
        </motion.h1>
        <div className="mt-4 h-[3px] w-80 md:w-96 bg-gradient-to-r from-transparent via-foreground to-transparent" />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) onNavigate(value);
          }}
          className="mt-14 flex w-full max-w-3xl items-center gap-3 rounded-2xl border border-border bg-card px-5 py-3"
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`Search ${engineName} or type a URL`}
            className="flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
          />
          <select
            value={engine}
            onChange={(e) => onEngineChange(e.target.value)}
            aria-label="Search engine"
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none"
          >
            {SEARCH_ENGINES.map((e) => (
              <option key={e.name} value={e.url}>
                {e.name}
              </option>
            ))}
          </select>
        </form>

        <div className="mt-14 flex flex-wrap items-start justify-center gap-10">
          <ShortcutButton label="Lessons" onClick={onOpenGames}>
            <BookOpen className="h-6 w-6" />
          </ShortcutButton>

          {shortcuts.map((s) => (
            <div key={s.id} className="group relative">
              <ShortcutButton label={s.label} onClick={() => onNavigate(s.url)}>
                <Globe className="h-6 w-6" />
              </ShortcutButton>
              <button
                aria-label={`Remove ${s.label}`}
                onClick={() => persist(shortcuts.filter((x) => x.id !== s.id))}
                className="absolute -right-1 top-0 hidden rounded-full border border-border bg-background p-1 text-muted-foreground group-hover:block"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          <ShortcutButton label="Add" onClick={() => setAdding(true)}>
            <Plus className="h-6 w-6" />
          </ShortcutButton>
        </div>

        {adding && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.label.trim() || !draft.url.trim()) return;
              persist([
                ...shortcuts,
                { id: Math.random().toString(36).slice(2), label: draft.label, url: draft.url },
              ]);
              setDraft({ label: "", url: "" });
              setAdding(false);
            }}
            className="mt-10 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-border bg-card p-3"
          >
            <input
              autoFocus
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder="Name"
              className="w-32 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <input
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              placeholder="example.com"
              className="w-56 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground">
              Save
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground"
            >
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function ShortcutButton({
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
      onClick={onClick}
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className="flex w-20 flex-col items-center gap-3 cursor-pointer outline-none focus:ring-2 focus:ring-primary/20 rounded-xl p-1"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-accent shadow-sm">
        {children}
      </span>
      <span className="truncate text-xs text-foreground">{label}</span>
    </motion.button>
  );
}
