export type Lesson = {
  id: number | string;
  name: string;
  cover: string;
  url: string;
  author?: string;
  authorLink?: string;
  tags?: string[];
};

export type Game = Lesson;

/**
 * GN-Math educational modules hosted on GitHub and served through jsDelivr CDN.
 * Sources:
 * - Zones metadata: freebuisness/assets (or sealiee11/gnmathstuff)
 * - Covers: freebuisness/covers
 * - Module HTML bundles: freebuisness/html
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

export function lessonCover(lesson: Lesson): string {
  return resolveCoverUrl(lesson.cover);
}
export const gameCover = lessonCover;

export function resolveLessonUrl(url: string, htmlCdn = GN_MATH_HTML): string {
  if (!url) return "";
  if (url.startsWith("http") && !url.includes("{")) return url;
  return url.replace("{COVER_URL}", GN_MATH_COVERS).replace("{HTML_URL}", htmlCdn);
}
export const resolveGameUrl = resolveLessonUrl;

export function lessonEntry(lesson: Lesson): string {
  return resolveLessonUrl(lesson.url);
}
export const gameEntry = lessonEntry;

const EMBED_CSS = `
<style id="frosted-lesson-fit">
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
 * Sanitizes and prepares lesson HTML:
 * 1. Rewrites blocked jsDelivr author URLs (such as genizy repos) to fast CDN mirrors (rawcdn.githack.com).
 * 2. Strips obfuscated anti-hotlink domain locking scripts that destroy document.body.
 * 3. Injects runtime fetch / XHR hooks to ensure relative assets and nested bundles resolve seamlessly.
 * 4. Injects full-viewport layout styling so canvases and viewports fit seamlessly.
 */
export function sanitizeLessonHtml(rawHtml: string): string {
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
export const sanitizeGameHtml = sanitizeLessonHtml;

export async function fetchLessonHtml(rawUrl: string): Promise<string> {
  const htmlCdn = await getLatestHtmlCdn();
  const resolved = resolveLessonUrl(rawUrl, htmlCdn);
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
      return sanitizeLessonHtml(text2);
    }
    return sanitizeLessonHtml(text);
  } catch (err) {
    console.error("Failed to fetch lesson HTML:", err);
    throw err;
  }
}
export const fetchGameHtml = fetchLessonHtml;

export async function fetchLessons(): Promise<Lesson[]> {
  try {
    const [zonesRes, tagsRes] = await Promise.allSettled([
      fetch(GN_MATH_ZONES),
      fetch(GN_MATH_TAGS_ZONES),
    ]);

    let rawLessons: Lesson[] = [];
    if (zonesRes.status === "fulfilled" && zonesRes.value.ok) {
      rawLessons = (await zonesRes.value.json()) as Lesson[];
    } else if (tagsRes.status === "fulfilled" && tagsRes.value.ok) {
      rawLessons = (await tagsRes.value.json()) as Lesson[];
    }

    // Index tags by lesson ID or name if available
    const tagMap = new Map<string | number, string[]>();
    if (tagsRes.status === "fulfilled" && tagsRes.value.ok) {
      try {
        const tagLessons = (await tagsRes.value.json()) as Lesson[];
        for (const tg of tagLessons) {
          if (tg.tags && Array.isArray(tg.tags) && tg.tags.length > 0) {
            tagMap.set(tg.id, tg.tags);
            tagMap.set(tg.name.toLowerCase(), tg.tags);
          }
        }
      } catch {
        /* ignore tag parsing error */
      }
    }

    // Filter valid lessons
    const validLessons: Lesson[] = [];
    for (const g of rawLessons) {
      if (!g || !g.name || !g.url) continue;
      const numId = Number(g.id);
      if (numId < 0) continue;
      if (g.url.includes("discord.gg")) continue;

      const tags = g.tags || tagMap.get(g.id) || tagMap.get(g.name.toLowerCase()) || [];
      validLessons.push({
        ...g,
        tags,
      });
    }

    return validLessons;
  } catch (err) {
    console.error("Could not load GN-Math lessons library:", err);
    throw new Error("Could not load the lessons library");
  }
}
export const fetchGames = fetchLessons;
