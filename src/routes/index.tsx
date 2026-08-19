import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";

import { BrowserShell } from "@/components/browser/BrowserShell";
import { SettingsProvider } from "@/lib/settings";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Frosted — Private Browser & Game Library" },
      {
        name: "description",
        content:
          "Frosted is a monochrome tabbed proxy browser with a built-in game library, tab cloaking and close protection.",
      },
      { property: "og:title", content: "Frosted — Private Browser & Game Library" },
      {
        property: "og:description",
        content:
          "Browse the web through a fast proxy and play hundreds of games in one clean black-and-white workspace.",
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
