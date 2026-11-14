# Token Radar

Every protocol in a sealed DefiLlama snapshot that records no token, ranked by what
its launch would be worth — and what to do to farm it before it launches.

Built for make.fun's `token-radar-01` bounty ("Build the best token launch radar",
$1,325 in USDC). The board covers all 40 watchlist protocols plus every other
pre-token protocol the model can rank (198 rows), each with an implied value and a
six-step farm plan with costs and times. Wrapped, staked and bridged products of a
token that already trades (WBTC, Binance staked ETH, USDT0) are set aside, never
ranked; live-token protocols are shown apart with the market's own values.

## The model

```
implied = TVL × category multiple × growth × maturity × breadth
```

The category multiple is the median market-cap-to-TVL ratio of the tokenized
protocols in the same category (at least 3 comparables, else the global median),
clamped to 0.05–1.20. Growth is the 7-day TVL change, clamped to −50…+100% and
weighted 0.6. Maturity runs 0.7–1.2 over 1,095 days without a token. Breadth adds
0.02 per extra chain, up to 4. No protocol name is ever special-cased. See the
dashboard's "How the radar works" section for the full formula.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path to snapshot.json>
```

`main.ts` (Node 22, standard library only) writes `board.json`, `data.js`, the
dashboard and the screenshots to the output directory, plus `dossier.json` built
with the vendored `vendor/makefun-board.ts` library.

## Layout

- `main.ts` — entrypoint: snapshot in, ranked board + dashboard data out.
- `lib/model.ts` — the model, the farm-plan rules and the board builder.
- `dashboard/` — the static page (no network): `index.html`, `app.css`, `app.js`.
- `screenshots/` — the board, a detail view and a filtered view.
- `vendor/makefun-board.ts` — make.fun's dashboard-dossier library, as shipped in the kit.

## License

MIT. See `LICENSE`.
