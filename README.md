# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/hikmalalfatih/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/hikmalalfatih/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it reads the sealed DefiLlama snapshot, finds the
protocols that record no token yet (and are not a wrapped, staked or bridged
product of one that trades), ranks them by an implied launch value, gives each
one a concrete farm plan with costs and durations, and presents the board as a
static web dashboard.

## The value model

Implied value is derived only from the snapshot's own figures:

```
implied = TVL × category comp multiple × growth × tenure × reach × scale
```

- **Category comp multiple** — the median market-cap / TVL multiple of the
  already-tokenized protocols in the same category, from the same snapshot
  (thin categories blend toward the global median). The dashboard's detail
  view also shows the low–high band from the category's comp quartiles.
- **Growth** — seven-day TVL momentum, clamped.
- **Tenure** — how long the protocol has been tracked with no token yet.
- **Reach** — number of chains it runs on.
- **Scale** — a mild log premium between the $5M snapshot floor and $1B TVL.

No protocol name is ever consulted by the model.

## Layout

- `main.ts` — entry point: snapshot in, deliverables out.
- `lib/model.ts` — the comps model, board builder and farm-plan playbooks.
- `dashboard/` — the page: board, filters, sorting, per-protocol detail view.
- `vendor/makefun-board.ts` — the kit's dossier library, byte for byte.

MIT licensed — see `LICENSE`.

## Run it

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-snapshot.json>
```

Node 22+, standard library only. Outputs: `board.json`, `dashboard/`
(with `data.js`), `screenshots/`, and `dossier.json` built with the kit's
`vendor/makefun-board.ts`. Two runs on the same snapshot write identical bytes.

---
Entered on [make.fun](https://make.fun/?ref=53trrj7g&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards
