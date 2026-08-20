import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. If running inside an iframe, don't redirect the parent.
    // However, if the iframe itself gets navigated to a top-level proxy URL,
    // we want to ensure it remains a seamless experience.
    if (window.self !== window.top) {
      return;
    }

    // 2. If loaded at the top-level window and pathname contains scramjet proxy, redirect back home
    const pathname = window.location.pathname;
    if (pathname.includes("/~/scramjet/")) {
      const parts = pathname.split("/~/scramjet/");
      if (parts.length > 1) {
        const afterProxy = parts[1];
        const pathParts = afterProxy.split("/");
        let targetPart = afterProxy;

        // If it starts with an 8-character hex/alphanumeric frameId, skip it
        if (pathParts.length > 1 && /^[a-z0-9]{8}$/i.test(pathParts[0])) {
          targetPart = pathParts.slice(1).join("/");
        }

        try {
          let decoded = decodeURIComponent(targetPart);
          if (!decoded.startsWith("http://") && !decoded.startsWith("https://")) {
            decoded = decodeURIComponent(decoded);
          }
          if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
            window.location.replace("/?url=" + encodeURIComponent(decoded));
            return;
          }
        } catch (e) {
          console.error("Failed parsing top-level proxy URL for redirect", e);
        }
      }
      window.location.replace("/");
    }
  }, []);

  // 3. STRICT REQUIREMENT: If this route is rendered inside an iframe (proxy window),
  // hide the 404 UI completely to prevent "Page not found" from showing inside video/web components.
  if (typeof window !== "undefined" && window.self !== window.top) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "StudyHub" },
      {
        name: "description",
        content: "StudyHub — an educational workspace and browser.",
      },
      { property: "og:site_name", content: "StudyHub" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/studyhub.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
