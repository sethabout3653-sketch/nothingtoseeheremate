/* Global Ultraviolet Configuration */
self.__uv$config = {
  prefix: "/~/uv/",
  bare: "/bare/",
  encodeUrl: (str) => {
    if (!str) return str;
    const uv = typeof self !== "undefined" ? self.Ultraviolet : typeof Ultraviolet !== "undefined" ? Ultraviolet : null;
    if (uv && uv.codec && uv.codec.xor && typeof uv.codec.xor.encode === "function") {
      return uv.codec.xor.encode(str);
    }
    return encodeURIComponent(
      str
        .toString()
        .split("")
        .map((char, ind) => (ind % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char))
        .join("")
    );
  },
  decodeUrl: (str) => {
    if (!str) return str;
    const uv = typeof self !== "undefined" ? self.Ultraviolet : typeof Ultraviolet !== "undefined" ? Ultraviolet : null;
    if (uv && uv.codec && uv.codec.xor && typeof uv.codec.xor.decode === "function") {
      return uv.codec.xor.decode(str);
    }
    const [input, ...search] = str.split("?");
    return (
      decodeURIComponent(input || "")
        .split("")
        .map((char, ind) => (ind % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char))
        .join("") + (search.length ? "?" + search.join("?") : "")
    );
  },
  handler: "/uv/uv.handler.js",
  client: "/uv/uv.client.js",
  bundle: "/uv/uv.bundle.js",
  config: "/uv/uv.config.js",
  sw: "/uv/uv.sw.js",
};
