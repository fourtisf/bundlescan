# BundleScan

Block-zero launch forensics for Solana. Paste a token mint, replay the first
~12 blocks after deploy, and surface every wallet that captured supply alongside
the deployer (bundles, snipers, dev-funded wallets). Everything collapses into a
single **Launch Health Score (0–100)** across four tiers — TRAP / RIGGED / MILD
/ CLEAN.

Built from the approved prototype (`bundlescan-nav.html`) per the technical
handoff. Part of the **Fourtis** ecosystem; pairs with **DevRadar**.

## Stack

- **Web:** Next.js 14 (App Router, TypeScript), Tailwind + ported prototype CSS
- **API:** Next.js route handlers (`src/app/api/*`)
- **Worker:** standalone Node process (`worker/`), run via `tsx` under PM2
- **DB:** PostgreSQL + Prisma · **Cache/pub-sub:** Redis (ioredis)
- **Chain:** Helius RPC + DAS (`@solana/web3.js`)
- **Share card:** `next/og` (satori) · **Telegram:** grammY · **Verdict copy:** Anthropic (optional)

## Quick start

```bash
cp .env.example .env          # fill in HELIUS_API_KEY, DATABASE_URL, REDIS_URL, …
npm install
npm run prisma:migrate:dev    # create the schema (needs Postgres)
npm run dev                   # web on :3000
npm run worker:dev            # indexer + alerts + telegram (needs Redis)
```

Verify the forensic core with no external services:

```bash
npx tsx scripts/verify-pipeline.ts   # detection hand-calc + scoring tiers
npm run build && npm run typecheck   # full compile + types
```

## Architecture

```
new mint ─▶ Helius webhook ─▶ /api/helius/webhook ─▶ Redis queue
                                                        │
on-demand: POST /api/scan ──┐                           ▼
                            ├─▶ scanToken() ◀── worker indexer (BRPOP)
                            │     replay → detect → score → persist → cache
                            ▼     (Postgres + Redis)            │ publish
                       ScanResult                               ▼
                                                          live feed / alerts
```

- **On-demand scan:** `POST /api/scan` → Redis (10m) / DB cache → else a
  synchronous `scanToken` (replay → detect → score → persist).
- **Live indexing:** the worker consumes new mints from the Redis queue, scores
  them, and publishes to the feed; movement alerts re-scan watched tokens and DM
  Telegram watchers when insider-held % drops past `ALERT_DROP`.

## Forensic pipeline (`src/lib`)

| Module | Handoff | Responsibility |
|---|---|---|
| `chain.ts` | §6.1 | Helius RPC wrapper + block-zero replay |
| `detect.ts` | §6.2–6.6 | bundle / sniper / funding / cluster / held-vs-dumped |
| `score.ts` | §7 | Launch Health Score, tiers, chain-free `rescore` |
| `verdict.ts` | §9 | deterministic verdict/note/stats (+ guarded LLM rephrase) |
| `scan.ts` | Prompt 5 | cache → pipeline → persist → feed publish |
| `solana.ts` / `subscribe.ts` | §11 | SOL payment verification → tier |
| `auth.ts` | §11 | wallet signature verify + HMAC session cookie |
| `telegram.ts` | §9 | bot commands (`/scan`, `/watch`, `/link`) |

Scoring is tunable in `config.ts`; re-scoring from `Token.raw` applies new
weights with no chain calls.

## API (handoff §8)

```
POST   /api/scan            { mint }   → ScanResult (cached; Scout = 5/day)
GET    /api/token/:mint                → stored ScanResult
GET    /api/feed?limit=20              → live feed
GET    /api/shame?range=week&limit=10  → hall of shame
GET    /api/card/:mint.png             → share-card PNG
POST   /api/subscribe       { txSig }  → verify SOL payment → tier
GET    /api/me                         → user + tier + watchlist
POST   /api/watchlist       { mint }   → add (operator+)
DELETE /api/watchlist/:mint
POST   /api/auth/nonce | /api/auth/verify | /api/auth/logout
POST   /api/telegram/webhook | /api/helius/webhook
```

## Deploy (handoff §3/§10)

`deploy/ecosystem.config.js` runs two PM2 apps (`bundlescan-web`,
`bundlescan-worker`); `deploy/nginx.conf` proxies to `:3000` behind Cloudflare.
Keep secrets in a file **outside** the repo — never commit `.env`.

## Build sequence ↔ commits

Implements all ten prompts from handoff §15 (scaffold → chain replay → detection
→ scoring → scan pipeline → frontend port → API wiring → indexer/feed/shame →
telegram/share-card → payments/gating/deploy).

## Known follow-ups (need provisioning / real chain data)

- Tune `WINDOW_BLOCKS` / `SNIPE_BLOCKS` on real launches (§13).
- Finalize SOL pricing + treasury wallet (§11/§13).
- External **API access** for Syndicate (API-key management) is scaffolded by
  tier gating but key issuance is not yet built.
- Verify replay/detection against known Pump.fun mints once a Helius key is set
  (the pipeline is unit-verified but not yet validated against live chain data).
- DevRadar cross-link activates when `DEVRADAR_API_URL` is set.

*On-chain analytics, not financial advice. Scores are probabilistic and may
misclassify.*
