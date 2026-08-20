import { useEffect, useRef } from "react";

import {
  ensureTransport,
  faviconFor,
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
        if (targetUrl) lastUrl.current = targetUrl;
        const targetWisp = wisp || getAutoWispForUrl(targetUrl);
        const preferredTransport = getAutoTransportForUrl(targetUrl);
        const controller = await initProxy(targetWisp, targetUrl);
        if (cancelled || !hostRef.current) return;

        const iframe = document.createElement("iframe");
        iframeRef.current = iframe;
        iframe.className = "h-full w-full border-0 bg-white";
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "0";
        iframe.style.display = "block";
        iframe.setAttribute(
          "allow",
          "fullscreen; autoplay; gamepad; clipboard-read; clipboard-write; encrypted-media; picture-in-picture; camera; microphone; geolocation; midi; accelerometer; gyroscope; xr-spatial-tracking",
        );
        iframe.setAttribute("allowfullscreen", "true");

        if (controller && typeof controller["createFrame"] === "function") {
          try {
            if (typeof controller["wait"] === "function") {
              await (controller["wait"] as () => Promise<void>).call(controller);
            }
            const createFrame = controller["createFrame"] as (el: HTMLIFrameElement) => AnyRecord;
            const sjFrame = createFrame.call(controller, iframe);
            frameRef.current = sjFrame;

            registerNav({
              back: () => {
                if (typeof sjFrame["back"] === "function") {
                  (sjFrame["back"] as () => void).call(sjFrame);
                } else {
                  iframe.contentWindow?.history.back();
                }
              },
              forward: () => {
                if (typeof sjFrame["forward"] === "function") {
                  (sjFrame["forward"] as () => void).call(sjFrame);
                } else {
                  iframe.contentWindow?.history.forward();
                }
              },
              reload: () => {
                if (typeof sjFrame["reload"] === "function") {
                  (sjFrame["reload"] as () => void).call(sjFrame);
                } else {
                  const currentSrc = iframe.src;
                  if (currentSrc) iframe.src = currentSrc;
                }
              },
            });

            if (targetUrl) {
              if (typeof sjFrame["go"] === "function") {
                (sjFrame["go"] as (u: string) => void).call(sjFrame, targetUrl);
              } else {
                iframe.src = getProxyUrl(targetUrl);
              }
            }
          } catch (err) {
            console.warn("Scramjet controller frame attach fallback:", err);
            if (targetUrl) iframe.src = getProxyUrl(targetUrl);
          }
        } else {
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

          if (targetUrl) {
            iframe.src = getProxyUrl(targetUrl);
          }
        }

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

        poll = setInterval(() => {
          try {
            const currentFrame = iframeRef.current;
            const doc = currentFrame?.contentDocument;
            if (doc?.title) metaRef.current({ title: doc.title });
          } catch {
            /* cross-origin document, ignore */
          }
        }, 1200);
      } catch (error) {
        console.error("Scramjet v2 proxy auto-start notice:", error);
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

    if (frameRef.current && typeof frameRef.current["go"] === "function") {
      try {
        (frameRef.current["go"] as (u: string) => void).call(frameRef.current, url);
      } catch {
        if (iframeRef.current) iframeRef.current.src = getProxyUrl(url);
      }
    } else if (iframeRef.current) {
      iframeRef.current.src = getProxyUrl(url);
    }
    metaRef.current({ url, icon: faviconFor(url) });
  }, [url, wisp]);

  return <div ref={hostRef} className="h-full w-full" data-active={active} />;
}
