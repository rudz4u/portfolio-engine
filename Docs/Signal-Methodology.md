# Signal Methodology

> How Portfolio Engine scores your holdings and generates **BUY / HOLD / SELL / WATCH** signals.

---

## Overview

Every holding in your portfolio is scored on a **0–100 composite scale** that blends four data-driven components. The score is then mapped to an actionable signal, personalised by your investor profile and any per-stock overrides you have set.

```
┌──────────────┐
│  Raw Market  │  LTP, Day Change, Intraday %
│  Data        │  from Upstox V3 API
└──────┬───────┘
       ▼
┌──────────────┐   ┌──────────────┐
│  Candle Data │   │  Advisory    │
│  (180-day)   │   │  Consensus   │
│  RSI, MACD,  │   │  SEBI-registered
│  Patterns    │   │  sources     │
└──────┬───────┘   └──────┬───────┘
       ▼                  ▼
┌─────────────────────────────────┐
│      Composite Scoring Engine   │
│  ┌───────────┐ ┌────────────┐   │
│  │ Momentum  │ │ Valuation  │   │
│  │  (0–30)   │ │  (0–25)    │   │
│  └───────────┘ └────────────┘   │
│  ┌───────────┐ ┌────────────┐   │
│  │ Position  │ │ Advisory   │   │
│  │  (0–20)   │ │  (0–25)    │   │
│  └───────────┘ └────────────┘   │
│  + Sector Bonus (+4 / -6)       │
│  + Holding Overrides            │
└──────────┬──────────────────────┘
           ▼
┌──────────────────────┐
│  Signal Generation   │
│  BUY ≥ 70 & PnL>-10  │
│  HOLD ≥ 50           │
│  SELL < 35 or PnL<-20│
│  WATCH = else        │
└──────────────────────┘
```

---

## Score Components

### 1. Momentum Score — 0 to 30 points

Measures the **directional strength and trend quality** of a holding using multiple technical factors.

| Factor | How it's measured | Score impact |
|--------|------------------|-------------|
| **Unrealised P&L %** | `(current_value - invested) / invested × 100` | +9 if >15%, +5 if >5%, -5 if <-5%, -9 if <-15% |
| **Intraday Change %** | Day change from Upstox market data | +4 if >2%, +2 if >0.5%, -2 if <-0.5%, -4 if <-2% |
| **RSI (14-period)** | Relative Strength Index from 180-day candle data | +3 if oversold (<30), -3 if overbought (>70) |
| **MACD Trend** | MACD(12,26,9) crossover direction from candle data | +2 if bullish, -2 if bearish |
| **Candlestick Patterns** | Bullish/bearish pattern count from candle analysis | +1 to +3 for bullish, -1 to -3 for bearish |

**Base:** 15 (neutral). Result clamped to [0, 30].

#### Technical Indicator Details

- **RSI(14):** Computed from 180-day daily closing prices. Uses the standard Wilder smoothed RSI formula. Signals: `oversold` (<30), `neutral` (30–70), `overbought` (>70).
- **MACD(12,26,9):** 12-day EMA minus 26-day EMA, with a 9-day signal line. Trend: `bullish` when MACD > signal, `bearish` when MACD < signal.
- **Candlestick Patterns:** Detected from recent candle data — includes hammer, engulfing, doji, morning/evening star, and other standard patterns. Pattern counts contribute ±1 to ±3 to momentum.
- **Fallback:** When real candle data is unavailable (no Upstox token), the system uses P&L-percentage-based approximations for RSI and day-change proxies for MACD trend.

### 2. Valuation Score — 0 to 25 points

Measures how the **current market price compares to the investor's average buy price** — the position's entry point.

| Scenario | Price Gap | Score | Interpretation |
|----------|-----------|-------|---------------|
| Deep discount | LTP < avg × 0.80 | 23 | Potential buying opportunity |
| Near cost basis | -5% to +5% gap | 18 | Good entry zone, accumulate |
| Slight premium | +5% to +20% gap | 14–16 | Moderate, hold territory |
| Extended premium | >+20% gap | 8 | Expensive relative to entry |

**Formula:** `priceGapPct = (LTP - avg_price) / avg_price × 100`

This component ensures signals account for your specific **average buy price** — not just the general market direction. A stock that's 30% below your cost basis will score high on Valuation (potential buy-the-dip), while a stock 25% above your cost scores lower (consider taking profits).

### 3. Position Score — 0 to 20 points

Measures **position sizing quality** — how well the holding's portfolio weight fits within your risk parameters.

| Weight Zone | Score | Meaning |
|-------------|-------|---------|
| Within ideal band | 18 | Portfolio weight is within your target allocation range |
| Within warning band | 13 | Slightly off-target but acceptable |
| Over-concentrated | 7 | Weight exceeds your max allocation — risk signal |
| Under-represented | 8 | Weight is too low relative to your target |

**Ideal band** is derived from your investor profile:
- `idealLow = max_single_stock_allocation × 0.3`
- `idealHigh = max_single_stock_allocation` (e.g. 10% for a moderate investor)
- `warnHigh = max_single_stock_allocation × 1.5`

A conservative investor with `max_single_stock_allocation = 5%` has a tighter ideal band ([1.5%, 5%]) than an aggressive trader with `max_single_stock_allocation = 15%` ([4.5%, 15%]).

### 4. Advisory Score — 0 to 25 points

Measures **consensus from SEBI-registered advisory sources** — real analyst recommendations aggregated by our advisory pipeline.

- Computed daily by a cron job that aggregates BUY/SELL/HOLD recommendations from multiple SEBI-registered advisors.
- Weighted by source reliability and recency.
- Range: 0 (strong sell consensus) to 25 (strong buy consensus).
- **Fallback:** When no advisory data exists for a stock, the system uses **12** (neutral) — this prevents advisory-less stocks from being unfairly penalised while still preserving the overall score distribution.

---

## Composite Score Calculation

```
rawScore = (momentum / 30) × W_momentum
         + (valuation / 25) × W_valuation
         + (position / 20)  × W_position
         + (advisory / 25)  × W_advisory

score = clamp(round(rawScore + sectorBonus), 0, 100)
```

### Default Weights

| Component | Default Weight | Contribution |
|-----------|---------------|-------------|
| Momentum | 30 | 30% of score |
| Valuation | 25 | 25% of score |
| Position | 20 | 20% of score |
| Advisory | 25 | 25% of score |

Weights are customisable at three levels:
1. **Strategy Preset** — pre-defined weight sets for different trading styles
2. **User Settings** — custom weights in `/settings`
3. **Per-stock Override** — target price, stop-loss, forced signals

### Sector Bonus

If you have configured preferred/avoided sectors in your investor profile:
- **Preferred sector:** +4 bonus points
- **Avoided sector:** -6 penalty points

This tilts scores toward your sector expertise and away from sectors you want to avoid.

---

## Signal Generation

The composite score maps to actionable signals via configurable thresholds:

| Signal | Default Threshold | Override conditions |
|--------|------------------|-------------------|
| **BUY** | score ≥ 70 AND P&L > -10% | – |
| **HOLD** | score ≥ 50 | – |
| **SELL** | score < 35 OR P&L < -20% | Stop-loss hit, Target price hit |
| **WATCH** | everything else | – |

### Per-Stock Override Hierarchy

When a holding has a per-stock override configured, signals are determined in this priority order:

1. **Force HOLD / Force WATCH** — User-pinned signal. The stock always shows this signal regardless of score. (Stop-loss still takes priority.)
2. **Stop-Loss Hit** — If LTP ≤ stop_loss_price, signal = SELL with reason explaining the trigger.
3. **Target Price Hit** — If LTP ≥ target_price, signal = SELL with profit-booking suggestion.
4. **Hold-Until Date** — If the current date is before `hold_until`, SELL signals are converted to HOLD (except stop-loss).
5. **Normal Scoring** — Standard threshold-based signal generation.

### Strategy Presets

Strategy presets modify the scoring weights and signal thresholds. Examples:

- **Momentum Trader:** Higher momentum weight (45%), lower advisory weight (10%), tighter BUY threshold (75).
- **Value Investor:** Higher valuation weight (35%), wider HOLD band (40–75).
- **Conservative Income:** Lower momentum weight (20%), tighter SELL threshold (40), wider HOLD band.

Presets are selected in Settings → Investor Profile, or overridden per-stock.

---

## Profile Alignment Score

In addition to the composite score, each holding gets a **Profile Alignment** percentage (0–100) that measures how well it fits your investor profile:

```
alignment = sectorFit × 0.4 + sizingFit × 0.3 + riskFit × 0.3
```

- **Sector Fit (40%):** 100 if preferred sector, 0 if avoided, 60 if neutral.
- **Sizing Fit (30%):** 100 if position well-sized, 65 if acceptable, 30 if over/under-sized.
- **Risk Fit (30%):** 80 normally. Drops to 20 if the holding has lost >15% and you have a conservative risk tolerance.

This is displayed as supplementary information and helps you identify holdings that may not align with your overall strategy.

---

## Data Pipeline

### Real-Time Market Data
- **Source:** Upstox V3 API
- **Fields:** LTP (last traded price), day change, day change percentage, quantity, OHLCV candles
- **Sync:** On-demand via portfolio sync or scheduled cron job

### Technical Indicators Pipeline
1. **Fetch:** 180-day daily candles from Upstox V3 `/historical-candle` endpoint
2. **Compute:** RSI(14), MACD(12,26,9), Bollinger Bands(20, 2σ), ATR(14), SMA(20/50/200)
3. **Detect:** Candlestick patterns (hammer, engulfing, doji, morning/evening star, etc.)
4. **Bridge:** `build-technicals.ts` extracts RSI, MACD trend, and pattern counts for the scoring engine
5. **Fallback:** If no Upstox market data token is available, scoring falls back to P&L-based approximations

### Advisory Consensus Pipeline
1. **Aggregate:** SEBI-registered advisory recommendations (BUY/SELL/HOLD) per stock
2. **Weight:** By source reliability, recency, and track record
3. **Compute:** Weighted score (0–25) and consensus signal
4. **Store:** `advisory_consensus` table, updated daily via cron

---

## Investor Profile Factors

The following investor profile fields directly influence signal generation:

| Factor | Where it's used |
|--------|----------------|
| `investor_type` | Strategy preset selection, default weights |
| `risk_tolerance` | Position sizing band, risk alignment score |
| `max_single_stock_allocation_pct` | Ideal weight band for Position Score |
| `preferred_sectors` | +4 sector bonus in scoring |
| `avoided_sectors` | -6 sector penalty in scoring |
| `investment_horizon` | (Available for preset filtering) |
| `max_portfolio_drawdown_pct` | Health-check alerts |
| `decision_style` | Controls signal explanation tone |

### Per-Stock Override Fields

| Field | Effect on signals |
|-------|------------------|
| `target_price` | SELL signal when LTP ≥ target |
| `stop_loss_price` | SELL signal when LTP ≤ stop-loss |
| `trailing_stop_pct` | (Future: dynamic stop-loss from peak) |
| `goal` | Per-stock investment purpose (growth, income, swing, etc.) |
| `custom_signal_override` | Force HOLD or WATCH |
| `hold_until` | Convert SELL → HOLD until date |
| `max_allocation_pct` | Per-stock position sizing override |

---

## Signal Explanation Engine

Each signal is accompanied by a human-readable explanation generated by the Signal Explainer module (`lib/signals/explainer.ts`). Explanations include:

1. **Score breakdown** — which components drove the score up or down
2. **Technical context** — RSI zone, MACD trend, pattern detections
3. **Profile context** — how the signal relates to your investor type and goals
4. **Action suggestions** — what you might consider (not financial advice)

---

## Disclaimer

Portfolio Engine signals are generated by quantitative algorithms and technical analysis. They are **not financial advice**. The platform is designed to help you make informed decisions, but all investment decisions should be made based on your own research and risk tolerance. Past performance indicators (RSI, MACD, patterns) do not guarantee future results.
