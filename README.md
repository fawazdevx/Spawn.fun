# Spawn.fun

**Permissionless memecoin launches on BOT Chain** — fair bonding curves, locked post-grad trading, and a protocol fee that buys and burns `$SPAWN`.

Spawn.fun is built for creators, traders, and agents who want pump-style discovery with clearer economics: creators earn from volume, referrers get a cut, and the platform token absorbs protocol revenue the way `$PONS` and `$ARGUS` do on their chains.

---

## Why this model

Most launchpads either (a) dump you onto an external DEX and walk away, or (b) skim fees with no transparent sink. Spawn.fun keeps the full lifecycle on one venue and routes protocol revenue into a fixed-supply platform token.

| Principle | How Spawn.fun does it |
| --- | --- |
| Fair start | Fixed **1B** supply, public curve, no team allocation on the meme |
| Price discovery | Constant-product bonding curve in native **BOT** |
| Continuity | Graduation is a **status** change — buy/sell stay open on the locked AMM |
| Creator alignment | **50%** of every trade fee is claimable by the creator |
| Distribution | Optional **10%** referrer share on buys |
| Platform flywheel | **~80%** of protocol fees → buy `$SPAWN` → burn |
| Ops runway | **20%** of protocol fees → treasury |
| Sniper friction | Launch-block creator-only; next **3** blocks capped at **2%** supply per buy |
| Identity | Image + description required; **unique** name and ticker |

Design lineage: **Pons** (curve → locked venue + fee→platform burn) and **Argus** (locked liquidity mindset, platform buybacks).

---

## How a launch works

```
Creator uploads image + metadata
        │
        ▼
 SpawnFactory.spawn()
  · mints SpawnToken (1B)
  · deploys BondingCurve
  · 800M tokens for sale on the curve
        │
        ▼
 Traders buy/sell with BOT
  · 1.25% fee on each trade
  · price follows x·y = k (virtual + real reserves)
  · anti-snipe window on the first blocks
        │
        ▼
 Real BOT raised ≥ graduation threshold
        │
        ▼
 Graduated · AMM live
  · same locked liquidity, venue label flips to "amm"
  · chart, tape, and trade UI keep running
```

### Bonding phase

Each launch seeds a constant-product curve with virtual BOT/token reserves so the first buys have a smooth price path. **800M** of the 1B supply is sold through the curve; the rest stays with the curve as locked inventory for the AMM phase.

Progress is `realBotReserves / graduationThreshold`. The threshold is set at factory deploy (and can be updated for new launches).

### Graduation

When raised BOT hits the threshold, the curve marks `graduated = true` and emits `Graduated`. Liquidity does **not** get yanked to a third-party pool you have to chase. Traders keep using the same contract; `tradeVenue()` returns `"amm"` instead of `"bonding"`.

### What you need to launch

- **Image** (upload or URL) and **description** — empty values revert on-chain  
- **Unique name** (case-insensitive) and **unique symbol**  
- Wallet on BOT Chain with gas  

The app compresses and hosts images, then stores the public URL as `imageURI` on the token.

---

## Fee model

Every buy and sell pays **1.25%** in BOT:

```
1.25% trade fee
 ├── 50%  → creator (claimCreatorFees)
 ├── 10%  → referrer, if set on the buy and eligible
 └── ~40% → protocol treasury (SpawnFeeRouter)
              ├── 80% → SpawnBuybackVault → buy SPAWN on SpawnMarket → burn
              └── 20% → ops treasury
```

Worked example: **1 BOT** of volume generates **0.0125 BOT** in fees.

| Slice | Amount | Who |
| --- | --- | --- |
| Creator | 0.00625 BOT | Token creator, claimable anytime |
| Referrer | 0.00125 BOT | Optional; skipped if unset / self-ref |
| Protocol | 0.005 BOT | Router → 0.004 buyback + 0.001 ops |

Creators claim from the curve. Protocol BOT is swept via `claimProtocolFees` → `FeeRouter.distribute` → `BuybackVault.buyAndBurn`. Anyone can run that keeper path.

---

## `$SPAWN` — platform token

| | |
| --- | --- |
| Name | Spawn |
| Ticker | **SPAWN** |
| Supply | **1,000,000,000** fixed |
| Role | Buyback sink for protocol revenue |

Deploy seeds a **BOT/SPAWN** constant-product market (`SpawnMarket`). As meme volume grows, protocol fees push BOT into that market, buy SPAWN, and send it to `0x…dEaD`.

**Flywheel:** more launches and volume → more protocol BOT → more SPAWN burned → scarcer float. Same shape as Pons (`$PONS`) and Argus (`$ARGUS`), adapted to BOT Chain without assuming Uniswap v4.

---

## Fairness defaults

- **No bonding-curve team cut** on the meme — creators earn from fees, not from pre-mined float on the curve  
- **Anti-snipe:** only the creator can buy on the launch block; for the next three blocks, each buy is capped at 2% of total supply  
- **Locked liquidity mindset:** reserves stay in the curve/AMM; there is no “rug the LP” withdraw for the bonding inventory  
- **Namespace:** duplicate names/tickers revert so the feed stays searchable  

Phase 2 can add Argus-style per-meme buy/sell tax with a four-way creator split (funds / meme buyback / dividends / LP). That is optional and separate from the live 1.25% model.

---

## Who uses it

**Creators** — Spawn a token with image and story, share a link, earn 50% of fees for the life of the market, claim from Studio.

**Traders** — Discover live / new / graduating / graduated markets, trade on the curve then the AMM without changing venues, read mcap charts and the trade tape.

**Agents** — `buyFor` and referrer hooks support agent wallets and fee streaming. Agent-oriented UX is on the roadmap; the contract surface is already there.

---

## Product surface

| Surface | What you get |
| --- | --- |
| Markets | Live feed with bonding progress and graduation state |
| Launch | Image upload, metadata, uniqueness checks, spawn tx |
| Token page | Chart, buy/sell, tape, explorer links |
| Studio | Your launches and creator fee claims |

UI direction: mission-control (dark base, cyan accents, monospace labels) — built for trading density, not a toy landing page.

---

## Protocol stack

| Contract | Job |
| --- | --- |
| `SpawnFactory` | Creates token + curve; enforces metadata and unique name/symbol |
| `SpawnToken` | Fixed-supply ERC-20 with image + description |
| `BondingCurve` | Buy/sell, fees, anti-snipe, graduation, locked AMM phase |
| `SPAWN` | Platform ERC-20 |
| `SpawnMarket` | BOT/SPAWN pool for buybacks |
| `SpawnFeeRouter` | 80% vault / 20% ops |
| `SpawnBuybackVault` | Permissionless buy-and-burn |

---

## Networks

| Network | Chain ID | Explorer |
| --- | --- | --- |
| BOT testnet | 968 | [scan.bohr.life](https://scan.bohr.life) |
| BOT mainnet | 677 | [scan.botchain.ai](https://scan.botchain.ai) |

---

## For builders

```bash
forge test
cd frontend && npm install && npm run dev
```

Frontend deploy (Vercel, env vars, image upload): [frontend/README.md](frontend/README.md).

---

## Roadmap

- Agent wallet fee streaming in the UI  
- Optional BDEX deep-link / migration aids at graduation  
- TWAB-style holder rewards  
- Argus-depth meme tax (Phase 2)  
- Instant-pool mode when BOT has a mature public AMM standard  

---

## License

MIT
