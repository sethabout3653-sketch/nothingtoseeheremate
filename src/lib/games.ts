export type Game = {
  id: number | string;
  name: string;
  cover: string;
  url: string;
  author?: string;
  authorLink?: string;
  tags?: string[];
};

/**
 * GN-Math library hosted on GitHub and served through jsDelivr CDN.
 * Sources:
 * - Zones metadata: freebuisness/assets (or sealiee11/gnmathstuff)
 * - Covers: freebuisness/covers
 * - Game HTML bundles: freebuisness/html
 */
export const GN_MATH_ZONES_SOURCES = [
  "https://cdn.jsdelivr.net/gh/freebuisness/assets@latest/zones.json",
  "https://raw.githubusercontent.com/freebuisness/assets/main/zones.json",
  "https://cdn.jsdelivr.net/gh/sealiee11/gnmathstuff@main/zones.json",
  "https://raw.githubusercontent.com/sealiee11/gnmathstuff/main/zones.json",
];
export const GN_MATH_ZONES = GN_MATH_ZONES_SOURCES[0]!;
export const GN_MATH_TAGS_ZONES = GN_MATH_ZONES_SOURCES[2]!;
export const GN_MATH_COVERS = "https://cdn.jsdelivr.net/gh/freebuisness/covers@main";

export const GN_MATH_HTML_CDNS = [
  "https://cdn.jsdelivr.net/gh/freebuisness/html@main",
  "https://raw.githubusercontent.com/freebuisness/html/main",
  "https://rawcdn.githack.com/freebuisness/html/main",
  "https://fastly.jsdelivr.net/gh/freebuisness/html@main",
  "https://gcore.jsdelivr.net/gh/freebuisness/html@main",
];
export const GN_MATH_HTML = GN_MATH_HTML_CDNS[0]!;

export async function getLatestHtmlCdn(): Promise<string> {
  return GN_MATH_HTML;
}

export function resolveCoverUrl(cover: string): string {
  if (!cover) return "";
  if (cover.startsWith("http://") || cover.startsWith("https://")) return cover;
  return cover.replace("{COVER_URL}", GN_MATH_COVERS);
}

export function gameCover(game: Game): string {
  return resolveCoverUrl(game.cover);
}

export function resolveGameUrl(url: string, htmlCdn = GN_MATH_HTML): string {
  if (!url) return "";
  if (url.startsWith("http") && !url.includes("{")) return url;
  return url.replace("{COVER_URL}", GN_MATH_COVERS).replace("{HTML_URL}", htmlCdn);
}

export function gameEntry(game: Game): string {
  return resolveGameUrl(game.url);
}

const EMBED_CSS = `
<style id="frosted-game-fit">
  html, body {
    width: 100% !important;
    height: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    background-color: #000 !important;
    color: #fff !important;
  }
  canvas, #game, #c2canvas, #canvas, #player, .game-container, #unity-container, #unity-canvas, embed, object {
    max-width: 100% !important;
    max-height: 100% !important;
  }
  #sidebarad1, #sidebarad2, .adsbygoogle {
    display: none !important;
  }
</style>
`;

const ASSET_HOOK_SCRIPT = `
<script id="frosted-runtime-fix">
(function() {
  function rewriteUrl(u) {
    if (!u || typeof u !== 'string') return u;
    let full = u;
    try {
      if (document.baseURI && !/^https?:\\/\\//i.test(u) && !u.startsWith('data:') && !u.startsWith('blob:')) {
        full = new URL(u, document.baseURI).href;
      }
    } catch(e) {}

    // Rewrite blocked jsdelivr genizy repositories to rawcdn.githack.com
    if (/cdn\\.jsdelivr\\.net\\/gh\\/genizy\\//i.test(full) || /(?:fastly|gcore)\\.jsdelivr\\.net\\/gh\\/genizy\\//i.test(full)) {
      full = full
        .replace(/https?:\\/\\/(?:cdn|fastly|gcore)\\.jsdelivr\\.net\\/gh\\/genizy\\/([a-zA-Z0-9_-]+)@([a-zA-Z0-9_.-]+)\\//g, 'https://rawcdn.githack.com/genizy/$1/$2/')
        .replace(/https?:\\/\\/(?:cdn|fastly|gcore)\\.jsdelivr\\.net\\/gh\\/genizy\\/([a-zA-Z0-9_-]+)\\/(?!master\\/)/g, 'https://rawcdn.githack.com/genizy/$1/master/');
    }
    return full;
  }

  // Intercept window.fetch
  if (typeof window.fetch === 'function') {
    const origFetch = window.fetch;
    window.fetch = function(input, init) {
      if (typeof input === 'string') {
        input = rewriteUrl(input);
      } else if (input && typeof input.url === 'string') {
        try {
          input = new Request(rewriteUrl(input.url), input);
        } catch(e) {}
      }
      return origFetch.call(this, input, init);
    };
  }

  // Intercept XMLHttpRequest
  if (typeof XMLHttpRequest !== 'undefined') {
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
      if (typeof url === 'string') {
        url = rewriteUrl(url);
      }
      return origOpen.call(this, method, url, ...args);
    };
  }

  // Intercept Image.src
  if (typeof Image !== 'undefined') {
    const _Image = window.Image;
    window.Image = function Image() {
      const img = new _Image();
      try { img.crossOrigin = 'anonymous'; } catch(e) {}
      return img;
    };
    window.Image.prototype = _Image.prototype;
  }

  // Intercept dynamic script creation
  const origCreateElement = document.createElement;
  document.createElement = function(tagName, options) {
    const el = origCreateElement.call(this, tagName, options);
    if (tagName && typeof tagName === 'string' && tagName.toLowerCase() === 'script') {
      const origSetAttribute = el.setAttribute;
      el.setAttribute = function(name, value) {
        if (name && name.toLowerCase() === 'src' && typeof value === 'string') {
          value = rewriteUrl(value);
        }
        return origSetAttribute.call(this, name, value);
      };
    }
    return el;
  };
})();
</script>
`;

/**
 * Sanitizes and prepares game HTML:
 * 1. Rewrites blocked jsDelivr author URLs (such as genizy repos) to fast CDN mirrors (rawcdn.githack.com).
 * 2. Strips obfuscated anti-hotlink domain locking scripts that destroy document.body.
 * 3. Injects runtime fetch / XHR hooks to ensure relative assets and nested bundles resolve seamlessly.
 * 4. Injects full-viewport layout styling so canvases and game viewports fit seamlessly.
 */
export function sanitizeGameHtml(rawHtml: string): string {
  if (!rawHtml) return "";

  // 1. Rewrite static URLs in HTML attributes & base tags for blocked authors on jsdelivr
  let cleaned = rawHtml
    .replace(
      /https?:\/\/(?:cdn|fastly|gcore)\.jsdelivr\.net\/gh\/genizy\/([a-zA-Z0-9_-]+)@([a-zA-Z0-9_.-]+)\//g,
      "https://rawcdn.githack.com/genizy/$1/$2/",
    )
    .replace(
      /https?:\/\/(?:cdn|fastly|gcore)\.jsdelivr\.net\/gh\/genizy\/([a-zA-Z0-9_-]+)\/(?!master\/)/g,
      "https://rawcdn.githack.com/genizy/$1/master/",
    );

  // 2. Remove individual script blocks containing domain locks or anti-embed logic
  const singleScriptRegex = /<script\b[^>]*>(?:(?!<\/script>)[\s\S])*?<\/script>/gi;
  cleaned = cleaned.replace(singleScriptRegex, (scriptBlock) => {
    if (/sFfEkK|_0x257e|IuySzzpOiISwZDDrwmF|ailogic_gn-math/i.test(scriptBlock)) {
      return "";
    }
    return scriptBlock;
  });

  // 3. Remove broken ad divs and overlay sidebars
  cleaned = cleaned.replace(/<div\s+id=["']sidebarad[12]["'][\s\S]*?<\/div>\s*<\/div>/gi, "");

  // 4. Inject runtime hooks & responsive fit styling into <head>
  const injection = `${ASSET_HOOK_SCRIPT}${EMBED_CSS}`;
  if (/<head[^>]*>/i.test(cleaned)) {
    cleaned = cleaned.replace(/<head([^>]*)>/i, `<head$1>${injection}`);
  } else {
    cleaned = `${injection}${cleaned}`;
  }

  return cleaned;
}

export async function fetchGameHtml(rawUrl: string): Promise<string> {
  const isDirectUrl = rawUrl.startsWith("http") && !rawUrl.includes("{");
  const candidates = isDirectUrl
    ? [rawUrl]
    : GN_MATH_HTML_CDNS.map((cdn) =>
        rawUrl.replace("{COVER_URL}", GN_MATH_COVERS).replace("{HTML_URL}", cdn),
      );

  let lastError: Error | null = null;
  for (const candidateUrl of candidates) {
    try {
      const res = await fetch(`${candidateUrl}?t=${Date.now()}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (
        !text ||
        text.trim().startsWith("Couldn't find the requested file") ||
        text.trim() === "404: Not Found"
      ) {
        continue;
      }
      return sanitizeGameHtml(text);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  const errMessage = lastError ? lastError.message : "Game assets not found on any mirror";
  console.error("Failed to fetch game HTML:", errMessage);
  throw new Error(`Failed to load game HTML: ${errMessage}`);
}

export async function fetchGames(): Promise<Game[]> {
  try {
    const fetchPromises = GN_MATH_ZONES_SOURCES.map((url) =>
      fetch(url, { signal: AbortSignal.timeout(6000) })
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return (await res.json()) as Game[];
        })
        .catch(() => null),
    );

    const results = await Promise.all(fetchPromises);
    const validResults = results.filter((r): r is Game[] => Array.isArray(r) && r.length > 0);

    if (validResults.length === 0) {
      throw new Error("Unable to reach game metadata mirrors");
    }

    // Pick the most complete result as primary
    validResults.sort((a, b) => b.length - a.length);
    const primaryGames = validResults[0]!;

    // Build tags map from all available sources
    const tagMap = new Map<string | number, string[]>();
    for (const list of validResults) {
      for (const item of list) {
        if (item.tags && Array.isArray(item.tags) && item.tags.length > 0) {
          if (item.id !== undefined) tagMap.set(item.id, item.tags);
          if (item.name) tagMap.set(item.name.toLowerCase(), item.tags);
        }
      }
    }

    // Filter valid games (exclude discord suggestions/non-game placeholders)
    const validGames: Game[] = [];
    for (const g of primaryGames) {
      if (!g || !g.name || !g.url) continue;
      const numId = Number(g.id);
      if (numId < 0) continue;
      if (g.url.includes("discord.gg")) continue;

      const tags = g.tags || tagMap.get(g.id) || tagMap.get(g.name.toLowerCase()) || [];
      validGames.push({
        ...g,
        tags,
      });
    }

    return validGames;
  } catch (err) {
    console.error("Could not load GN-Math games library:", err);
    throw new Error("Could not load the GN-Math game library");
  }
}
