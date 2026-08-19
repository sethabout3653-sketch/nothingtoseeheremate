import { ArrowLeft, Expand, Loader2, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { fetchGameHtml, resolveGameUrl } from "@/lib/games";

type Props = {
  url: string;
  name: string;
  author?: string;
  authorLink?: string;
  onBack: () => void;
};

export function GameView({ url, name, author, authorLink, onBack }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>("");

  const resolvedUrl = resolveGameUrl(url);
  const isDirectUrl = resolvedUrl.startsWith("http") && !url.includes("{");

  const loadGame = async () => {
    setError(null);
    setLoading(true);

    if (isDirectUrl) {
      setLoading(false);
      return;
    }

    try {
      const html = await fetchGameHtml(url);
      setHtmlContent(html);
    } catch (err) {
      console.error("Failed to load game HTML:", err);
      setError("Failed to load game assets. Check your connection or try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Library
        </button>

        <div className="flex items-center gap-2 truncate">
          <span className="truncate text-xs font-medium text-foreground">{name}</span>
          {author && (
            <span className="hidden text-[11px] text-muted-foreground sm:inline">
              by{" "}
              {authorLink ? (
                <a
                  href={authorLink}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-foreground"
                >
                  {author}
                </a>
              ) : (
                author
              )}
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            aria-label="Reload game"
            onClick={loadGame}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <RotateCw className="h-4 w-4" />
          </button>
          <button
            aria-label="Fullscreen"
            onClick={() => frameRef.current?.requestFullscreen?.()}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Expand className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative h-full w-full flex-1 bg-black">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/90 backdrop-blur-sm">
            <Loader2 className="h-6 w-6 animate-spin text-foreground" />
            <p className="text-xs text-muted-foreground">Loading game from CDN…</p>
          </div>
        )}

        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <button
              onClick={loadGame}
              className="rounded-lg border border-border bg-card px-4 py-2 text-xs text-foreground hover:bg-accent"
            >
              Retry
            </button>
          </div>
        ) : isDirectUrl ? (
          <iframe
            ref={frameRef}
            src={resolvedUrl}
            title={name}
            className="h-full w-full flex-1 border-0 bg-black"
            allow="fullscreen; autoplay; gamepad; pointer-lock; clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms allow-popups allow-modals allow-downloads"
          />
        ) : (
          <iframe
            ref={frameRef}
            srcDoc={htmlContent}
            title={name}
            className="h-full w-full flex-1 border-0 bg-black"
            allow="fullscreen; autoplay; gamepad; pointer-lock; clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms allow-popups allow-modals allow-downloads"
          />
        )}
      </div>
    </div>
  );
}
