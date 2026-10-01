# Dota 2 Scrim Circuit Tracker

**Live: https://dota2scrimcircuittracker.github.io/**

A for-fun stats site for our Dota 2 scrims and every AD2L Season 48 division.

- **Scrims** — paste two post-game screenshots; the stats are read in your browser (Tesseract
  OCR, no AI, no API keys), you check them, and the game is saved.
- **AD2L divisions** — standings, every ticketed game with full stats from parsed replays
  (gold, laning, combat, items, ward and vision maps), players with a tier list, heroes and
  drafts, teams, a weekly recap, and predictions against a model. Pulled from PlayOn and OpenDota
  twice a day.
- **Search, shareable links, a guided tour, feedback** from any page.

## Docs

- [docs/features.md](docs/features.md) — what every page does, how the tier list is scored, how
  uploads are read.
- [docs/maintaining.md](docs/maintaining.md) — running it, code layout, deploy, the AD2L sync,
  adding a division or season, Firestore rules, feedback tickets.
- [docs/ideas/](docs/ideas/) — feature ideas and the site audit, with decisions.
- [docs/superpowers/specs/](docs/superpowers/specs/) — designs for bigger features.

## Run it

```
npm install
npm start      # http://localhost:3000
npm test
```

Static site on GitHub Pages: every push to `main` deploys. No backend; scrims, uploads and
predictions live in Firestore, AD2L data in `public/data/`.
