// Link previews (Discord, iMessage, Slack) read a page's HTML and never see the part of a
// link after "#", so every #/... route looked like the home page. At deploy time
// scripts/share-pages.js writes a tiny page at a real path for each shareable route
// (/heroic/week/, /champion/teams/123/, ...) with that page's own title and description,
// which then forwards to the #/ route. These two functions are the mapping both ways.

// / (and /ad2l/) is the league picker, scrim standings are /scrims/, Champion is /champion/.
// /all/ (every division together) has only its list tabs: no Predict, Upload, team or game pages.
const TABS = "week|players|heroes|predict|upload";
const LEAGUES = "champion|conqueror|warrior|challenger|voyager|explorer";
const SHAREABLE = new RegExp(`^(?:(?:${TABS}|teams|scrims)|ad2l|all(?:/(?:week|players|heroes))?|(?:${LEAGUES}|heroic(?:/[ab])?)(?:/(?:${TABS}))?|(?:${LEAGUES}|heroic)/(?:teams|game)/\\d+)?$`);

// "#/heroic/b/week" -> "/heroic/b/week/"; null when the route has no preview page.
export function sharePath(hash) {
  const p = String(hash || "#/").replace(/^#\/?/, "").replace(/\/+$/, "");
  return SHAREABLE.test(p) ? (p ? `/${p}/` : "/") : null;
}

// "heroic/b/week" -> "#/heroic/b/week"; a bare league root keeps its trailing slash.
export function routeOf(path) {
  const p = path.replace(/^\/+|\/+$/g, "");
  return new RegExp(`^(?:ad2l|all|${LEAGUES}|heroic/[ab]|heroic)$`).test(p) ? `#/${p}/` : `#/${p}`;
}
