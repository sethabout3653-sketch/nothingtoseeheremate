import { useEffect, useRef } from "react";

import {
  ensureTransport,
  faviconFor,
  getAutoEngineForUrl,
  getAutoTransportForUrl,
  getAutoWispForUrl,
  getProxyUrl,
  initProxy,
} from "@/lib/proxy";

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
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const frameRef = useRef<AnyRecord | null>(null);
  const lastUrl = useRef<string>("");
  const metaRef = useRef(onMeta);
  metaRef.current = onMeta;

  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | undefined;

    (async () => {
      try {
        const targetUrl = url || lastUrl.current;
        const targetWisp = wisp || getAutoWispForUrl(targetUrl);
        const preferredTransport = getAutoTransportForUrl(targetUrl);
        const controller = await initProxy(targetWisp, targetUrl);
        if (cancelled || !hostRef.current) return;

        const engine = getAutoEngineForUrl(targetUrl);

        if (
          engine === "scramjet" &&
          controller &&
          typeof controller["createFrame"] === "function"
        ) {
          const createFrame = controller["createFrame"] as () => AnyRecord;
          const sjFrame = createFrame.call(controller);
          frameRef.current = sjFrame;

          const iframe = sjFrame["frame"] as HTMLIFrameElement;
          iframeRef.current = iframe;
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

          if (lastUrl.current) {
            (sjFrame["go"] as (u: string) => void).call(sjFrame, lastUrl.current);
          }
        } else {
          // Standard / Ultraviolet auto routing
          const iframe = document.createElement("iframe");
          iframeRef.current = iframe;
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

          registerNav({
            back: () => {
              try {
                iframe.contentWindow?.history.back();
              } catch {
                /* cross origin */
              }
            },
            forward: () => {
              try {
                iframe.contentWindow?.history.forward();
              } catch {
                /* cross origin */
              }
            },
            reload: () => {
              try {
                iframe.contentWindow?.location.reload();
              } catch {
                const currentSrc = iframe.src;
                if (currentSrc) iframe.src = currentSrc;
              }
            },
          });

          iframe.onload = () => {
            try {
              const doc = iframe.contentDocument;
              if (doc?.title) {
                metaRef.current({ title: doc.title });
              }
            } catch {
              /* cross origin */
            }
          };

          hostRef.current.replaceChildren(iframe);

          if (lastUrl.current) {
            iframe.src = getProxyUrl(lastUrl.current, engine);
          }
        }

        poll = setInterval(() => {
          try {
            const iframe = iframeRef.current;
            const doc = iframe?.contentDocument;
            if (doc?.title) metaRef.current({ title: doc.title });
          } catch {
            /* cross-origin document, ignore */
          }
        }, 1200);
      } catch (error) {
        console.error("Proxy auto-start notice:", error);
        metaRef.current({ title: "Connecting..." });
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
    const preferredTransport = getAutoTransportForUrl(url);
    ensureTransport(targetWisp, preferredTransport).catch(() => {});

    const engine = getAutoEngineForUrl(url);
    if (frameRef.current && typeof frameRef.current["go"] === "function" && engine === "scramjet") {
      (frameRef.current["go"] as (u: string) => void).call(frameRef.current, url);
    } else if (iframeRef.current) {
      iframeRef.current.src = getProxyUrl(url, engine);
    }
    metaRef.current({ url, icon: faviconFor(url) });
  }, [url, wisp]);

  return <div ref={hostRef} className="h-full w-full" data-active={active} />;
}
