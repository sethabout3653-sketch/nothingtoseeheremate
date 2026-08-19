import { useQuery } from "@tanstack/react-query";
import { BookOpen, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { fetchGames, gameCover, type Game } from "@/lib/games";

export function GamesLibrary({ onLaunch }: { onLaunch: (game: Game) => void }) {
  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("All");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["gn-math-games"],
    queryFn: fetchGames,
    staleTime: 1000 * 60 * 30,
  });

  const availableTags = useMemo(() => {
    const list = data ?? [];
    const counts = new Map<string, number>();
    for (const g of list) {
      if (g.tags) {
        for (const t of g.tags) {
          counts.set(t, (counts.get(t) || 0) + 1);
        }
      }
    }
    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
    return ["All", ...sorted];
  }, [data]);

  const games = useMemo(() => {
    const list = data ?? [];
    const q = query.trim().toLowerCase();
    return list.filter((g) => {
      const matchesQuery =
        !q || g.name.toLowerCase().includes(q) || (g.author && g.author.toLowerCase().includes(q));
      const matchesTag = selectedTag === "All" || (g.tags && g.tags.includes(selectedTag));
      return matchesQuery && matchesTag;
    });
  }, [data, query, selectedTag]);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-4xl font-light tracking-tight text-foreground">Lessons</h1>
              <span className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] text-muted-foreground">
                <Sparkles className="h-3 w-3 text-foreground" /> gn-math.dev
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLoading ? "Loading library…" : `${games.length} titles available`}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search lessons or creators"
              className="w-56 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Tags horizontal list */}
        {availableTags.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto py-4 scrollbar-none">
            {availableTags.slice(0, 16).map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs transition-colors ${
                  selectedTag === tag
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {isError && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            The lesson source could not be reached. Check your connection and try again.
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 py-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {isLoading &&
            Array.from({ length: 18 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-xl border border-border bg-card"
              />
            ))}

          {games.map((game) => (
            <button
              key={game.id}
              onClick={() => onLaunch(game)}
              className="group overflow-hidden rounded-xl border border-border bg-card text-left transition-colors hover:border-foreground/40"
            >
              <div className="relative aspect-square overflow-hidden bg-muted">
                <img
                  src={gameCover(game)}
                  alt={`${game.name} cover art`}
                  loading="lazy"
                  className="h-full w-full object-cover grayscale transition duration-300 group-hover:scale-105 group-hover:grayscale-0"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <BookOpen className="absolute inset-0 m-auto h-8 w-8 text-muted-foreground opacity-40" />
              </div>
              <div className="p-2.5">
                <p className="truncate text-xs font-medium text-foreground">{game.name}</p>
                {game.author && (
                  <p className="truncate text-[11px] text-muted-foreground">{game.author}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
