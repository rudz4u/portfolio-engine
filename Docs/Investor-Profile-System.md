# Investor Profile System

> How Portfolio Engine customises every signal, score, and recommendation based on who you are as an investor.

---

## Overview

The Investor Profile System is a multi-layered personalisation framework that ensures every signal and recommendation is tailored to the user's specific investment style, risk appetite, goals, and experience level.

```
┌───────────────────────────────────────────────────┐
│              Onboarding Wizard (9 steps)          │
│  Type → Horizon → Risk → Sectors → Goals →        │
│  Budget → Experience → Style → Review             │
└───────────────────────┬───────────────────────────┘
                        ▼
┌───────────────────────────────────────────────────┐
│            investor_profiles table                │
│  investor_type, risk_tolerance, risk_capacity,    │
│  preferred_sectors, avoided_sectors, goals,       │
│  investment_horizon, experience_level, etc.       │
└───────────────────────┬───────────────────────────┘
                        ▼
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
  ┌──────────┐   ┌───────────┐  ┌───────────┐
  │ Scoring  │   │ Strategy  │  │ Per-Stock │
  │ Engine   │   │ Presets   │  │ Overrides │
  │ (weights,│   │ (custom   │  │ (target,  │
  │  bands)  │   │  weights) │  │  stop-loss│
  └──────────┘   └───────────┘  └───────────┘
```

---

## Profile Fields

### Core Identity

| Field | Type | Options | Purpose |
|-------|------|---------|---------|
| `investor_type` | enum | `short_term_trader`, `swing_trader`, `medium_term`, `long_term`, `sector_specialist`, `value_investor`, `growth_investor`, `income_investor` | Primary trading style — determines default weights, horizon, and risk assumption |
| `experience_level` | enum | `beginner`, `intermediate`, `advanced`, `expert` | Controls signal explanation complexity and feature exposure |
| `decision_style` | enum | `data_driven`, `fundamental`, `technical`, `hybrid`, `advisory_dependent` | Influences which score components are emphasised in explanations |

### Risk Configuration

| Field | Type | Range | Purpose |
|-------|------|-------|---------|
| `risk_tolerance` | enum | `very_conservative` → `very_aggressive` | Controls position sizing bands and risk alignment scoring |
| `risk_capacity` | enum | `low`, `medium`, `high` | Financial capacity to absorb losses (distinct from willingness) |
| `max_portfolio_drawdown_pct` | number | 5–50% | Health-check alert threshold for portfolio-level drawdown |
| `max_single_stock_allocation_pct` | number | 2–25% | Ideal position sizing — drives the Position Score component |

### Investment Horizon

```typescript
{
  default_months: 24,   // Primary holding period
  min_months: 12,       // Shortest acceptable hold
  max_months: 60        // Longest typical hold
}
```

Horizon is used for:
- Strategy preset filtering (matching presets to your timeframe)
- Hold-until override duration suggestions
- Opportunity discovery (filtering stocks aligned with your horizon)

### Sector Preferences

- **Preferred Sectors:** Sectors you have expertise in or want to overweight. Stocks in these sectors get a **+4 scoring bonus**.
- **Avoided Sectors:** Sectors you want to minimise exposure to. Stocks in these sectors receive a **-6 scoring penalty**.

Available sectors: BFSI, IT, Pharma, Auto, FMCG, Energy, Green Energy, Defence, PSU, Metals, Cement, Chemical, Infrastructure, Telecom, Media, Real Estate, EV, Technology, Others.

### Goals & Budget

| Field | Options | Purpose |
|-------|---------|---------|
| `investment_goals` | wealth_building, regular_income, capital_preservation, retirement, tax_optimization, learning | Multi-select — shapes which opportunities are surfaced |
| `annual_investment_budget` | under_1L, 1L_5L, 5L_15L, 15L_50L, above_50L | Determines position sizing recommendations |
| `rebalance_frequency` | weekly, monthly, quarterly, semi_annual, annual, manual | When to review and adjust portfolio |

---

## Investor Type Defaults

When you select an investor type during onboarding, sensible defaults are pre-filled:

| Type | Default Horizon | Risk Tolerance | Max Drawdown | Max Allocation | Rebalance |
|------|----------------|----------------|-------------|---------------|-----------|
| Short-term Trader | 1 month (0–3) | Aggressive | 15% | 15% | Weekly |
| Swing Trader | 3 months (1–6) | Aggressive | 20% | 12% | Monthly |
| Medium-term | 12 months (6–24) | Moderate | 15% | 10% | Quarterly |
| Long-term | 60 months (24–120) | Moderate | 25% | 8% | Semi-annual |
| Sector Specialist | 12 months (3–36) | Aggressive | 20% | 20% | Monthly |
| Value Investor | 36 months (12–120) | Moderate | 20% | 10% | Quarterly |
| Growth Investor | 24 months (12–60) | Aggressive | 25% | 12% | Quarterly |
| Income Investor | 36 months (12–120) | Conservative | 10% | 8% | Semi-annual |

These are starting points — you can customise every field in Settings → Investor Profile.

---

## Strategy Presets

Strategy presets are pre-configured scoring weight sets + signal thresholds designed for specific trading approaches.

### Preset Structure

```typescript
{
  name: "Momentum Trader",
  scoring_weights: {
    momentum: 45,    // Emphasise momentum signals
    valuation: 15,   // De-emphasise cost-basis gap
    position: 15,    // Standard position sizing
    advisory: 25     // Keep advisory input
  },
  signal_thresholds: {
    strong_buy_min: 80,
    buy_min: 68,
    hold_min: 48,
    sell_max: 30,
    strong_sell_max: 18
  },
  investor_types: ["short_term_trader", "swing_trader"],
  horizon_filter_months: 6,
  volatility_tolerance: 1.5
}
```

### System-Provided Presets

Seeded via `infrastructure/seeds/` and available to all users:

1. **Conservative Income** — Low momentum weight, wide HOLD band, strict SELL threshold
2. **Balanced Growth** — Default weights, moderate thresholds (the baseline)
3. **Momentum Trader** — High momentum weight, tight BUY threshold
4. **Value Hunter** — High valuation weight, patient HOLD band
5. **Aggressive Swing** — High momentum + position weights, tight thresholds

Users can select a preset in Settings → Investor Profile. The active preset overrides all scoring weights and signal thresholds.

---

## Per-Stock Holding Overrides

In addition to portfolio-level settings, each individual stock can have its own strategy configuration:

### Available Override Fields

| Field | Purpose | Signal impact |
|-------|---------|--------------|
| `goal` | Per-stock investment purpose | Informational — helps you track why you hold each stock |
| `target_price` | Your price target for this stock | Triggers SELL when LTP ≥ target |
| `stop_loss_price` | Stop-loss trigger price | Triggers SELL when LTP ≤ stop-loss |
| `trailing_stop_pct` | Dynamic trailing stop-loss % | (Future: auto-adjusts stop-loss from peak) |
| `custom_signal_override` | Force HOLD or WATCH | Overrides computed signal (stop-loss still applies) |
| `hold_until` | Date-based hold protection | Converts SELL → HOLD until this date |
| `min_hold_months` | Minimum holding period | Informational guidance |
| `max_allocation_pct` | Per-stock max portfolio weight | Adjusts Position Score calculation |
| `risk_note` | Free-form risk notes | Personal documentation |

### Override Priority

Per-stock overrides take **highest priority** in signal generation:

```
1. custom_signal_override (force_hold / force_watch)
2. stop_loss_price (SELL if LTP ≤ stop-loss)
3. target_price (SELL if LTP ≥ target)
4. hold_until (SELL → HOLD if before date)
5. Normal score-based signal
```

### Accessing Overrides

- **Portfolio → Stock Detail page** — Each stock has a "Stock Strategy" card with all override fields
- **API:** `GET/POST/DELETE /api/holdings/overrides`

---

## Onboarding Flow

New users are guided through a **9-step wizard** that collects their profile:

1. **Investor Type** — Grid selection with icons and descriptions
2. **Investment Horizon** — Slider for default/min/max months
3. **Risk Tolerance** — 5-level scale with explanations
4. **Risk Capacity** — 3-level scale (financial capacity vs. willingness)
5. **Sector Preferences** — Multi-select preferred + avoided sectors
6. **Investment Goals** — Multi-select from 6 goal types
7. **Budget Range** — Annual investment budget selection
8. **Experience & Style** — Experience level + decision-making style
9. **Review & Confirm** — Summary of all selections with edit capability

### Existing Users

Users who haven't completed onboarding see a **banner nudge** on the dashboard prompting them to set up their profile. The system works without a profile — signals default to "moderate" assumptions — but personalisation significantly improves signal relevance.

---

## Settings Pages

### Investor Profile Settings (`/settings/investor-profile`)

Full CRUD for all profile fields:
- Investor type selection with visual cards
- All risk/horizon/sector/goal/budget fields
- Strategy preset selection from available presets
- AI-powered "Recommend Preset" button that suggests the best preset based on your profile

### Per-Stock Settings (`/portfolio/[symbol]`)

Available on each stock's detail page:
- Investment goal selection
- Target price and stop-loss with real-time upside/downside % display
- Signal override toggle
- Holding period and allocation limits
- Risk notes

---

## How Profile Affects Each Feature

| Feature | Profile influence |
|---------|-----------------|
| **Score calculation** | Weights, position sizing bands, sector bonus |
| **Signal thresholds** | Preset-defined BUY/HOLD/SELL cutoffs |
| **Signal explanations** | Tailored language based on investor type and experience |
| **Opportunity discovery** | Filtered by preferred sectors and investment goals |
| **Health check** | Drawdown alerts based on max_portfolio_drawdown_pct |
| **AI Assistant** | Profile context injected for personalised responses |
| **Dashboard widget** | Shows profile alignment and signal distribution |
| **Per-stock overrides** | Target prices, stop-losses, holding period protection |

---

## Database Schema

### `investor_profiles` table

```sql
id, user_id (unique), investor_type, investment_horizon (jsonb),
risk_tolerance, risk_capacity, max_portfolio_drawdown_pct,
max_single_stock_allocation_pct, preferred_sectors, avoided_sectors,
investment_goals, annual_investment_budget, experience_level,
decision_style, rebalance_frequency, active_strategy_preset_id,
custom_overrides (jsonb), created_at, updated_at
```

### `strategy_presets` table

```sql
id, name, description, investor_types, scoring_weights (jsonb),
signal_thresholds (jsonb), horizon_filter_months, volatility_tolerance,
is_system, created_at
```

### `holding_overrides` table

```sql
id, user_id, instrument_key, trading_symbol,
goal, goal_notes, target_price, stop_loss_price, trailing_stop_pct,
strategy_preset_id, custom_signal_override, max_allocation_pct,
risk_note, hold_until, min_hold_months, created_at, updated_at
UNIQUE(user_id, instrument_key)
```

All tables have RLS policies ensuring users can only access their own data.
