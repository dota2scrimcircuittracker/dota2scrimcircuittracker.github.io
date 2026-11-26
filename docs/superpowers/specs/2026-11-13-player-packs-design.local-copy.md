# Player packs for Winter Fantasy: design

Date: 2026-11-13. Status: approved in conversation, not built.
Target: the Winter tournament's Fantasy. One Fantasy across every division (league key `"all"`, as the
test week did).

## Summary

Players open packs of league players' cards. Each card has a rarity, a main bonus and a sub bonus.
In Fantasy you can only pick players you own a card of, and the card you equip in a slot adds its
bonuses to that pick's points. Rarity comes from community votes on the player's own card designs,
with the owner's own rating breaking ties.

## 1. Cards

A card is one league player at one rarity: `player:<account>:<rarity>`.

- **Rarities:** common, rare, epic, legendary (the existing `TIERS`), plus arcana.
- **Each player has up to 4 rarity slots:** at most one card per rarity.
- **Position:** a card's position is the player's main position, the one they played most in the
  league's games (`rosterOf` in `fantasy.js`). A player with no games has no card yet.
- **Arcana:** granted by hand to some players only. One arcana card per such player. Not voted.

### 1.1 Where each rarity's card comes from

Card designs are the saved designs players already make (`cardDesigns` in the collection Worker).
Players already have `CARD_SLOTS` (5) design slots plus any bought in the shop, so **a player
nominates up to 4 of their saved designs as pack cards** (`packCards` on their collection state).
Only nominated designs enter the slot assignment below. The `rate` action's stale limit
(`cardSlot` 0–2) moves to `slotCount(owner)`.

1. **Community votes** give each design a score: the average of its votes, with common 1, rare 2,
   epic 3, legendary 4. The design's voted rarity is `tally(votes).pick` (`card-ratings.js`).
2. **The owner rates their own designs.** Today the Worker rejects self-votes ("Rate other players'
   cards, not your own"). Add a separate self-rating, stored apart from community votes
   (`selfrating:<account>:<designKey>`), that never counts as a community vote.
3. **Assign slots.** Each design takes its voted rarity. When two designs want the same rarity, the
   one the owner rated higher keeps it, and the other moves to the nearest open slot below, or
   above if nothing below is open. A further tie (same owner rating) goes to the higher community
   score, then the older design.
4. **A design with no community votes** uses the owner's rating as its voted rarity until votes
   come in. With neither, it is common.
5. **Default card:** if no design ends up common, the player's default card fills common.
   A player with no designs has only the default common.

| Designs | Cards |
|---|---|
| 0 | Default common |
| 1, voted epic | Epic + default common |
| 1, voted common | Their common, no default |
| 2, both voted rare | Owner's pick stays rare, the other drops to common, no default |
| 4 | One of each, by votes + owner tiebreak |

The owner's rating only orders designs inside a conflict. It never lifts a design over one with a
higher voted rarity.

**Rarity changes when votes change.** A card someone already owns follows the design's current
slot: owned copies are stored by player + rarity, not by design. If a player deletes a design and a
slot empties, owned copies of that rarity show the default art.

## 2. Bonuses

Every card has a **main bonus** and a **sub bonus**. Each one is "+X% points from stat S", taken from
the card's position's stat list (`WEIGHTS` in `tiers.js`).

### 2.1 Sizing: equal ceilings

A stat at a position is worth `WEIGHTS[pos][stat]` points (100 per position). A bonus of +X% on it
can add at most `X% × weight` points. So:

    X% = budget ÷ WEIGHTS[pos][stat]

Every bonus at the same budget has the same ceiling in stat points, whichever stat it is. Pos 1 kill
share (weight 14) at budget 1.4 = +10%. Pos 1 stuns (weight 3) at budget 1.4 ≈ +47%.

Starting budgets (stat points; placeholders, to be calibrated):

| Rarity | Main | Sub |
|---|---|---|
| Common | 1 | 0.4 |
| Rare | 1.5 | 0.6 |
| Epic | 2 | 0.8 |
| Legendary | 3 | 1.2 |
| Arcana | 4.5 | 1.8 |

Sub = 40% of main. Percentages round to the nearest whole %.

**Calibration before launch:** compute each stat's average 0–100 score per position over the
season's games and check expected gains per rarity. Equal ceilings are the rule; expected gains
will differ by player, and matching a bonus to a player who earns that stat is the skill.

### 2.2 Applying a bonus

The bonus multiplies that stat's points in the game's score: `stat.points × (1 + X%)`, before the
survival, consistency and opponent multipliers, the same as the base stat points. Only counted
games (best `GAMES_COUNTED`) matter, as today.

### 2.3 Who picks the stats

- **Main, on a player's own design:** the owner picks the stat from their position's list when
  they save or edit the design. Stored on the design.
- **Main, on a default card:** random from the player's 3 best stats at their main position
  (highest season 0–100), rolled once when the default card is first needed, then fixed.
- **Sub:** random for **each copy** when it's pulled, any stat on the position's list except the
  card's main stat, rolled uniformly. Two copies of the same card can have different subs.
- **Arcana:** main picked by Fav when granting, plus a unique effect. The unique effects are out of
  scope here; the first arcanas launch with the arcana budget only.

## 3. Packs

- **A pack has 5 cards, one per position** (pos 1–5).
- **Pool:** every rostered player on a team in the Winter tournament, across every division, who
  has a main position.
- **Per card:** roll a rarity with the existing `PACK_ODDS` (common 69, rare 17, epic 10,
  legendary 4) and arcana with the existing arcana odds. Then pick uniformly among that position's
  players who have a card at that rarity. If none do, step down a rarity (legendary → epic → rare
  → common).
- **Duplicates** are kept. Each copy has its own sub. Inventory holds copies, not counts:
  `{ key: "player:<account>:<rarity>", sub: { stat, pct }, at }`.
- **Replaces** the draft in `public/lib/player-packs.js` (3 cards, rarity from player tier). Nothing
  uses it yet.

## 4. Fantasy: gated

- **You can only pick a player you own a card of.** A pick must carry one card copy you own,
  of that player.
- **The card's position doesn't restrict the slot.** A pick still scores as the slot's position
  (current rule). The bonus stat is read in the slot's position too; if the stat isn't on that
  position's list, it adds nothing. The lineup screen warns about this.
- **One copy per pick.** The same copy can't fill two slots in one week. Copies aren't used up and
  can be reused next week.
- **Captain** doubles base points only. Card bonuses aren't doubled.
- **Validation** runs at save time in the Worker (`checkPicks`): every pick has an owned copy, and
  ownership is checked against the inventory at save time.
- **Scoring:** `scoreEntry` reads each pick's card from the entry and applies main + sub to
  `pickPoints`. Entries without a card (from before this change) score as today.

## 5. Pack supply

The Winter tournament is elimination, so cards for knocked-out teams go dead. Supply must keep
every active player able to field 5.

- **Starter grant:** 3 packs (15 cards, 3 per position) per signed-in player when Winter Fantasy
  opens.
- **Daily pack:** 1 free pack a day, claimed on the site. The day resets at midnight US Eastern.
  Missed days don't bank: a day's pack is gone if it isn't claimed that day.
- **Safety net:** if you own no card of a live player at a position, the lineup screen offers a
  free default common of a random live player at that position, once per position per week. It
  goes into your inventory like any copy.
- **Existing sources** (token shop, gifts) can sell or give player packs too.

Numbers are placeholders.

## 6. Pages

- **Card editor:** 4 design slots; pick the main bonus stat on save, with the % shown for the
  slot's current rarity; rate your own designs.
- **Gallery / profile:** each design shows its current rarity slot and its main bonus.
- **Pack opening:** reuse the cosmetics pack animation; each card shows player, position, rarity,
  main and sub.
- **Collection:** a Players tab listing copies, filterable by position, rarity and live team.
- **Fantasy lineup:** pick from owned players only; each slot shows the equipped copy's bonuses
  and the warning from section 4.

## 7. Out of scope

Trading, dusting or crafting duplicates, arcana unique effects, rarity for non-Winter leagues.

## 8. Testing

- Unit tests (Node, `test/`): slot assignment (every table row above, plus no-vote and
  equal-rating cases), bonus sizing (equal ceiling per budget), pack roll (5 positions,
  step-down when a rarity is empty, sub never equals main), gated `checkPicks`, scoring with
  bonuses and captain.
- Worker: self-rating stored apart from community votes; a pick without an owned copy is
  rejected.
- Calibration script output (section 2.1) reviewed before launch.

## Open numbers

Budgets and starter-grant size are placeholders until calibration. Nothing here is
settled until Fav signs off.
