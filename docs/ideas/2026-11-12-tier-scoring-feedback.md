# Player tier scoring — feedback to revisit

Status: to do later. Not approved for building.

Source: three feedback tickets from dr spike, sent 2026-11-07, all on
`/champion/players/?tab=tiers` (the Tiers tab category rows). Tickets closed 2026-11-12;
screenshots kept locally in `.cache/feedback/FB-7M5NUQ`, `FB-1IFSMS`, `FB-V9SNSM`.

## 1. Kill share / KDA weighted too high for supports (FB-7M5NUQ)

Row: **Kill share** (e.g. "12%, 4.0 kills a game").

Supports deliberately give kills away, so kill share and general KDA undervalue them.
Keep tracking it, but give it fewer points in the weighted average, or use a different formula
for supports.

## 2. Vision categories: 4 vs 5 weighting (FB-1IFSMS, note 1)

Rows: **New vision**, **Dewards**.

Important, but should count for less on a position 4 than a position 5 — even though each team
splits warding its own way.

## 3. Healing: make it a 3-point category and compare to hero averages (FB-1IFSMS, note 2)

Row: **Healing** (currently out of 7, e.g. "1.8/7").

Few 4s are healing right now. Consider dropping it to a 3-point category. Or score it against the
hero's healing average at that Dota MMR bracket, which handles heroes that have no healing at all.

## 4. New category: performance vs the hero's bracket average (FB-V9SNSM)

Snipped on **Stun time**, but the idea is general: add a category that compares a player's
performance on a hero to the expected average for that hero at their MMR.

## Common thread

Notes 3 and 4 both point at the same thing: judge stats against hero + bracket baselines rather
than raw role-wide numbers. Would need a source for per-hero bracket averages (OpenDota hero
benchmarks are a candidate — unchecked).
