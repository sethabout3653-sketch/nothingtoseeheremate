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
