// Whether the token shop (lib/shop.js) shows: local dev hosts only, until Fav opens it. Kept apart
// from shop.js so the tab lists (lib/pagetabs.js) don't load the card catalog.
export const shopVisible = (host = globalThis.location?.hostname ?? '') => /^(localhost|127\.0\.0\.1|\[::1\])$|\.(localhost|test)$/.test(host);
