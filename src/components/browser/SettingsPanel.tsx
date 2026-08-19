import { X } from "lucide-react";
import { motion } from "motion/react";

import { useSettings } from "@/lib/settings";

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { settings, update } = useSettings();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 z-30 flex justify-end bg-background/80 backdrop-blur-sm"
    >
      <button aria-label="Close settings" className="flex-1" onClick={onClose} />
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-card p-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-light tracking-tight text-foreground">Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <Section title="Tab close protection">
          <Toggle
            label="Confirm before the tab is closed"
            checked={settings.closeProtection}
            onChange={(v) => update({ closeProtection: v })}
          />
        </Section>

        <Section title="Panic key">
          <div className="grid grid-cols-[5rem_1fr] gap-2">
            <Field
              label="Key"
              value={settings.panicKey}
              onChange={(v) => update({ panicKey: v.slice(-1) })}
              placeholder="`"
            />
            <Field
              label="Redirect to"
              value={settings.panicUrl}
              onChange={(v) => update({ panicUrl: v })}
              placeholder="https://classroom.google.com"
            />
          </div>
        </Section>
      </motion.aside>
    </motion.div>
  );
}

function openAboutBlank() {
  const win = window.open("about:blank", "_blank");
  if (!win) return;
  const frame = win.document.createElement("iframe");
  frame.style.cssText = "position:fixed;inset:0;border:0;width:100%;height:100%";
  frame.src = window.location.href;
  win.document.body.style.margin = "0";
  win.document.body.appendChild(frame);
  window.location.replace("https://classroom.google.com");
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-border pt-6 first-of-type:border-0">
      <h3 className="mb-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm text-foreground"
    >
      {label}
      <span
        className={`ml-3 h-5 w-9 shrink-0 rounded-full border border-border p-0.5 transition-colors ${
          checked ? "bg-foreground" : "bg-background"
        }`}
      >
        <span
          className={`block h-3.5 w-3.5 rounded-full transition-transform ${
            checked ? "translate-x-4 bg-background" : "bg-muted-foreground"
          }`}
        />
      </span>
    </button>
  );
}
