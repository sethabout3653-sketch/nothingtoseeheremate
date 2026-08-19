export type TabKind = "new" | "web" | "games" | "game";

export type Tab = {
  id: string;
  kind: TabKind;
  title: string;
  icon: string;
  url: string;
  /** Pending navigation target for web tabs. */
  target: string;
  gameId?: string | number;
  gameUrl?: string;
  gameName?: string;
  gameAuthor?: string;
};

export function newTab(): Tab {
  return {
    id: Math.random().toString(36).slice(2),
    kind: "new",
    title: "New Tab",
    icon: "/studyhub.svg",
    url: "",
    target: "",
  };
}
