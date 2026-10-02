// Where this copy of the site is served from. The live site is at "/"; staging is the
// `staging` branch, built into /staging/ by .github/workflows/pages.yml, which sets
// <base href="/staging/"> in its index.html. Staging is read-only: lib/store.js refuses every
// write there, so trying a change never touches real uploads, picks, casts or feedback.
export const BASE = typeof document === "undefined" ? "/" : new URL(document.baseURI).pathname;
export const STAGING = BASE !== "/";
export const READ_ONLY_MESSAGE = "This is the staging site, which is read-only. Uploads, picks, casts and feedback only work on the live site.";
