import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";

import { BrowserShell } from "@/components/browser/BrowserShell";
import { SettingsProvider } from "@/lib/settings";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Matter — Private Browser & Lessons" },
      {
        name: "description",
        content:
          "Matter is a monochrome tabbed browser with built-in lessons and close protection.",
      },
      { property: "og:title", content: "Matter — Private Browser & Lessons" },
      {
        property: "og:description",
        content: "Browse the web and access lessons in one clean black-and-white workspace.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Index,
});

function Index() {
  return (
    <SettingsProvider>
      <ClientOnly fallback={<div className="h-screen w-full bg-background" />}>
        <BrowserShell />
      </ClientOnly>
    </SettingsProvider>
  );
}
