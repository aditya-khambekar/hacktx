/** Google Maps photo sizes are encoded in the image URL, not the API key. */
function atWidth(source: string, width: number) {
  try {
    const url = new URL(source);
    if (url.protocol !== "https:" || !/(^|\.)(googleusercontent\.com|ggpht\.com)$/.test(url.hostname)) return source;
    if (url.search || url.hash) return source;
    // Only rewrite known Google photo size suffixes, never signed query strings
    // or arbitrary third-party image URLs. Width-only preserves the photo ratio.
    url.pathname = url.pathname.replace(/=w\d+(?:-h\d+)?(?:-[a-zA-Z0-9]+)*$/, `=w${width}`);
    return url.toString();
  } catch { return source; }
}

export function photoSources(photo: { url: string; thumbnail: string }, gallery: boolean) {
  return [...new Set([
    atWidth(photo.url, gallery ? 2000 : 1200),
    photo.url,
    atWidth(photo.thumbnail, gallery ? 2000 : 1200),
    photo.thumbnail,
  ])];
}
