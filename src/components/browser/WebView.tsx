import { useEffect, useRef } from "react";

import { ensureTransport, getAutoWispForUrl, initProxy } from "@/lib/proxy";

type Props = {
  url: string;
  wisp?: string;
  active: boolean;
  onMeta: (meta: { title?: string; url?: string; icon?: string }) => void;
  registerNav: (nav: { back: () => void; forward: () => void; reload: () => void } | null) => void;
};

type AnyRecord = Record<string, unknown>;

export function WebView({ url, wisp, active, onMeta, registerNav }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<AnyRecord | null>(null);
  const lastUrl = useRef<string>("");
  const metaRef = useRef(onMeta);
  metaRef.current = onMeta;

  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | undefined;

    (async () => {
      try {
        const targetWisp = wisp || getAutoWispForUrl(url || lastUrl.current);
        const controller = await initProxy(targetWisp, url || lastUrl.current);
        if (cancelled || !hostRef.current) return;

        const createFrame = controller["createFrame"] as () => AnyRecord;
        const sjFrame = createFrame.call(controller);
        frameRef.current = sjFrame;

        const iframe = sjFrame["frame"] as HTMLIFrameElement;
        iframe.className = "h-full w-full border-0 bg-background";
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "0";
        iframe.style.display = "block";
        iframe.setAttribute(
          "allow",
          "fullscreen; autoplay; gamepad; clipboard-read; clipboard-write; encrypted-media; picture-in-picture; camera; microphone; geolocation; midi; accelerometer; gyroscope; xr-spatial-tracking",
        );
        iframe.setAttribute("allowfullscreen", "true");
        hostRef.current.replaceChildren(iframe);

        registerNav({
          back: () => (sjFrame["back"] as () => void).call(sjFrame),
          forward: () => (sjFrame["forward"] as () => void).call(sjFrame),
          reload: () => (sjFrame["reload"] as () => void).call(sjFrame),
        });

        const addEvent = sjFrame["addEventListener"] as (
          type: string,
          cb: (e: { url: string }) => void,
        ) => void;
        addEvent.call(sjFrame, "urlchange", (event) => {
          if (!event.url) return;
          metaRef.current({ url: event.url, icon: faviconFor(event.url) });
        });

        poll = setInterval(() => {
          try {
            const doc = iframe.contentDocument;
            if (doc?.title) metaRef.current({ title: doc.title });
          } catch {
            /* cross-origin document, ignore */
          }
        }, 1200);

        if (lastUrl.current) {
          (sjFrame["go"] as (u: string) => void).call(sjFrame, lastUrl.current);
        }
      } catch (error) {
        console.error("Connection failed to start", error);
        metaRef.current({ title: "Connection failed" });
      }
    })();

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      registerNav(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wisp]);

  useEffect(() => {
    if (!url || url === lastUrl.current) return;
    lastUrl.current = url;
    const targetWisp = wisp || getAutoWispForUrl(url);
    ensureTransport(targetWisp).catch(() => {});
    const frame = frameRef.current;
    if (frame) (frame["go"] as (u: string) => void).call(frame, url);
    metaRef.current({ url, icon: faviconFor(url) });
  }, [url, wisp]);

  return <div ref={hostRef} className="h-full w-full" data-active={active} />;
}

export function faviconFor(url: string) {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
  } catch {
    return "";
  }
}
