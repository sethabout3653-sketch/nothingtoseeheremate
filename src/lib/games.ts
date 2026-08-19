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
export const GN_MATH_ZONES = "https://cdn.jsdelivr.net/gh/freebuisness/assets@latest/zones.json";
export const GN_MATH_TAGS_ZONES =
  "https://cdn.jsdelivr.net/gh/sealiee11/gnmathstuff@main/zones.json";
export const GN_MATH_COVERS = "https://cdn.jsdelivr.net/gh/freebuisness/covers@main";
export const GN_MATH_HTML = "https://cdn.jsdelivr.net/gh/freebuisness/html@main";

let cachedCommit = "8ef4c030fa3b63ab71d7ab989031000220b334f7";
let commitFetched = false;

export async function getLatestHtmlCdn(): Promise<string> {
  if (commitFetched) {
    return `https://cdn.jsdelivr.net/gh/freebuisness/html@${cachedCommit}`;
  }
  try {
    const res = await fetch("https://gn-math.dev/commits", { cache: "no-store" });
    if (res.ok) {
      const hash = (await res.text()).trim();
      if (hash && /^[0-9a-fA-F]{20,40}$/.test(hash)) {
        cachedCommit = hash;
      }
    }
  } catch {
    /* fallback to known good commit */
  } finally {
    commitFetched = true;
  }
  return `https://cdn.jsdelivr.net/gh/freebuisness/html@${cachedCommit}`;
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
  const htmlCdn = await getLatestHtmlCdn();
  const resolved = resolveGameUrl(rawUrl, htmlCdn);
  try {
    const res = await fetch(`${resolved}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text.trim().startsWith("Couldn't find the requested file")) {
      // Fallback to main branch
      const fallbackUrl = rawUrl
        .replace("{COVER_URL}", GN_MATH_COVERS)
        .replace("{HTML_URL}", GN_MATH_HTML);
      const res2 = await fetch(`${fallbackUrl}?t=${Date.now()}`);
      if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
      const text2 = await res2.text();
      return sanitizeGameHtml(text2);
    }
    return sanitizeGameHtml(text);
  } catch (err) {
    console.error("Failed to fetch game HTML:", err);
    throw err;
  }
}

export async function fetchGames(): Promise<Game[]> {
  try {
    const [zonesRes, tagsRes] = await Promise.allSettled([
      fetch(GN_MATH_ZONES),
      fetch(GN_MATH_TAGS_ZONES),
    ]);

    let rawGames: Game[] = [];
    if (zonesRes.status === "fulfilled" && zonesRes.value.ok) {
      rawGames = (await zonesRes.value.json()) as Game[];
    } else if (tagsRes.status === "fulfilled" && tagsRes.value.ok) {
      rawGames = (await tagsRes.value.json()) as Game[];
    }

    // Index tags by game ID or name if available
    const tagMap = new Map<string | number, string[]>();
    if (tagsRes.status === "fulfilled" && tagsRes.value.ok) {
      try {
        const tagGames = (await tagsRes.value.json()) as Game[];
        for (const tg of tagGames) {
          if (tg.tags && Array.isArray(tg.tags) && tg.tags.length > 0) {
            tagMap.set(tg.id, tg.tags);
            tagMap.set(tg.name.toLowerCase(), tg.tags);
          }
        }
      } catch {
        /* ignore tag parsing error */
      }
    }

    // Filter valid games (exclude discord suggestions/non-game placeholders)
    const validGames: Game[] = [];
    for (const g of rawGames) {
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
