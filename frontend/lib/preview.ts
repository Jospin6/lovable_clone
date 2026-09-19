import type { Files } from "./types";

function localPath(reference: string): string | null {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference)) return null;
  try {
    return decodeURIComponent(new URL(reference, "https://preview.invalid/").pathname).replace(/^\//, "");
  } catch { return null; }
}

function assetUrl(path: string, content: string): string {
  const extension = path.split(".").pop();
  const mime = extension === "svg" ? "image/svg+xml" : "text/plain";
  return `data:${mime};charset=utf-8,${encodeURIComponent(content)}`;
}

export function createPreviewDocument(files: Files, savedFiles: Files): string {
  if (!files["index.html"]) return "";
  const doc = new DOMParser().parseFromString(files["index.html"], "text/html");
  // The generated page is isolated by both CSP and the iframe sandbox.
  doc.querySelectorAll("base, meta[http-equiv]").forEach((element) => element.remove());
  const policy = doc.createElement("meta");
  policy.httpEquiv = "Content-Security-Policy";
  policy.content = "default-src 'none'; script-src 'unsafe-inline' data: blob:; style-src 'unsafe-inline' https: data:; img-src https: data: blob:; font-src https: data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  doc.head.prepend(policy);

  for (const link of doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')) {
    const path = localPath(link.getAttribute("href") || "");
    if (path === null) continue;
    const style = doc.createElement("style");
    style.textContent = (files[path] || "").replace(/url\(\s*(['"]?)(.*?)\1\s*\)/g, (original, _quote, reference: string) => {
      try {
        if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference)) return original;
        const resolved = localPath(new URL(reference, `https://preview.invalid/${path}`).pathname);
        if (!resolved || !files[resolved]) return original;
        return `url("${assetUrl(resolved, files[resolved])}")`;
      } catch { return original; }
    }).replace(/<\/style/gi, "<\\/style");
    link.replaceWith(style);
  }
  for (const script of doc.querySelectorAll<HTMLScriptElement>("script[src]")) {
    const path = localPath(script.getAttribute("src") || "");
    if (!path || !(path in savedFiles)) { script.remove(); continue; }
    // Only run complete, saved JavaScript; partially streamed code is display-only.
    const inline = doc.createElement("script");
    inline.textContent = savedFiles[path].replace(/<\/script/gi, "<\\/script");
    script.remove();
    doc.body.append(inline);
  }
  for (const element of doc.querySelectorAll("[src], [poster]")) {
    for (const attribute of ["src", "poster"]) {
      const reference = element.getAttribute(attribute);
      const path = reference ? localPath(reference) : null;
      if (path && files[path]) element.setAttribute(attribute, assetUrl(path, files[path]));
    }
  }
  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}
