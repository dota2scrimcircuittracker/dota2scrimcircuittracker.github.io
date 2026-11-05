// Whether the token shop (lib/shop.js) shows. It's open everywhere; the Worker still refuses shop
// actions unless SHOP_ENABLED is "on". `localDevHost` gates the ?testShop account (lib/local-shop-test.js).
// Kept apart from shop.js so the tab lists (lib/pagetabs.js) don't load the card catalog.
export const SHOP_OPEN = true;
export const localDevHost = (host = globalThis.location?.hostname ?? '') => /^(localhost|127\.0\.0\.1|\[::1\])$|\.(localhost|test)$/.test(host);
export const shopVisible = (host) => SHOP_OPEN || localDevHost(host);
