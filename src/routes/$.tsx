import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";

import { BrowserShell } from "@/components/browser/BrowserShell";
import { SettingsProvider } from "@/lib/settings";

export const Route = createFileRoute("/$")({
  head: () => ({
    meta: [
      { title: "Matter" },
      {
        name: "description",
        content: "Matter — a monochrome browser with built-in lessons.",
      },
    ],
    links: [{ rel: "icon", href: "/matter.svg", type: "image/svg+xml" }],
  }),
  component: CatchAll,
});

function CatchAll() {
  return (
    <SettingsProvider>
      <ClientOnly fallback={<div className="h-screen w-full bg-background" />}>
        <BrowserShell />
      </ClientOnly>
    </SettingsProvider>
  );
}
