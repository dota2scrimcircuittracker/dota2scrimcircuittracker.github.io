# Items and item timings — design

AD2L divisions only. Scrims come from OCR of post-game screenshots, which can't read item icons.

## Data

`scripts/ad2l-sync.js` adds two fields per player, from the cached OpenDota match JSON:

- `items`: final inventory, `[slot0..slot5, neutral]` as item keys (`"bfury"`), `null` for empty.
- `item_times`: flat `[key, sec, key, sec, …]`, the first purchase of each core item, in order.
  Core = built from components with cost ≥ 1000, or Blink Dagger / Aghanim's Shard.
  Consumables, recipes and components are left out.

`scripts/items-backfill.js` adds the same fields to existing `public/data/*.json` from `.cache/opendota`
with no network calls. Games with no cached match keep no item fields; the UI skips them.

Aggregates are computed in the browser so the week filter applies.

## Catalog

`scripts/gen-item-meta.js` writes `public/lib/items-data.js` from OpenDota `/constants/items` and
`/constants/item_ids`: key → display name, cost, icon slug, kind (built / consumable / recipe / neutral).
Icons come from `cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/`.

## Logic — `public/lib/items.js`

- `itemsFrom(odPlayer)` → `{ items, item_times }` (used by sync and backfill).
- `isCore(key)`, `itemName(key)`, `itemImg(key)`, `itemIcon(key, sec?)` HTML.
- `itemStats(rows)` → per item: games built, % of games, average / fastest second, win % when built.
- `fastestCore(rows)` → the earliest finish of a costly item (≥ 3000) in a set of games.

Tests in `test/items.test.js`.

## UI

- Game page → **Items** tab: per player the final 7 icons, then the core timeline (icon + mm:ss).
- Hero page → **Items** tab: that hero's core items: built %, average and fastest time, win % built.
- Player page → **Items** tab: per hero played, their core items with their average time next to
  the league average for the same hero and item.
- Weekly recap: a "Fastest core" highlight card.
