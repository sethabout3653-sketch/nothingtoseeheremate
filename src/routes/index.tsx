import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";

import { BrowserShell } from "@/components/browser/BrowserShell";
import { SettingsProvider } from "@/lib/settings";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StudyHub — Educational Workspace & Browser" },
      {
        name: "description",
        content: "StudyHub is a workspace and web browser with educational tools and lessons.",
      },
      { property: "og:title", content: "StudyHub — Educational Workspace & Browser" },
      {
        property: "og:description",
        content:
          "Browse the web through a fast proxy and access lessons in one clean black-and-white workspace.",
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
