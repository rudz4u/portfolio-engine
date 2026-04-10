-- Seed: System Strategy Presets
--
-- 8 system-defined strategy presets that map to different investor archetypes.
-- These are read-only for users (is_system = true) and applied via investor_profiles.
--
-- ON CONFLICT: update existing system presets by name to keep them current.

INSERT INTO strategy_presets (name, description, investor_types, scoring_weights, signal_thresholds, horizon_filter_months, volatility_tolerance, is_system)
VALUES
  (
    'Short-term Momentum',
    'Prioritises price momentum and intraday signals. High weight on technical indicators, minimal valuation bias. Ideal for traders holding days to weeks.',
    ARRAY['short_term_trader', 'swing_trader'],
    '{"momentum":45,"valuation":10,"position":20,"advisory":25}',
    '{"strong_buy_min":78,"buy_min":62,"hold_min":42,"sell_max":32,"strong_sell_max":18}',
    3,
    1.8,
    true
  ),
  (
    'Swing Trading',
    'Balanced momentum and valuation for capturing medium swings over 1–3 months. Advisory consensus adds conviction.',
    ARRAY['swing_trader', 'medium_term'],
    '{"momentum":35,"valuation":20,"position":20,"advisory":25}',
    '{"strong_buy_min":78,"buy_min":64,"hold_min":44,"sell_max":34,"strong_sell_max":20}',
    6,
    1.5,
    true
  ),
  (
    'Balanced Growth',
    'Equal emphasis on growth momentum and valuation fundamentals. Suitable for medium-term investors seeking steady compounding.',
    ARRAY['medium_term', 'growth_investor'],
    '{"momentum":28,"valuation":28,"position":20,"advisory":24}',
    '{"strong_buy_min":80,"buy_min":65,"hold_min":45,"sell_max":35,"strong_sell_max":20}',
    18,
    1.0,
    true
  ),
  (
    'Long-term Value',
    'Heavy valuation focus for patient capital. Tolerates short-term drawdowns for long-term compounding. Low momentum sensitivity.',
    ARRAY['long_term', 'value_investor'],
    '{"momentum":15,"valuation":40,"position":20,"advisory":25}',
    '{"strong_buy_min":82,"buy_min":68,"hold_min":48,"sell_max":30,"strong_sell_max":15}',
    36,
    0.7,
    true
  ),
  (
    'Capital Preservation',
    'Conservative strategy minimising downside risk. Tight stop-loss thresholds and low volatility tolerance. For very conservative investors.',
    ARRAY['long_term', 'income_investor'],
    '{"momentum":20,"valuation":30,"position":25,"advisory":25}',
    '{"strong_buy_min":85,"buy_min":72,"hold_min":52,"sell_max":40,"strong_sell_max":25}',
    NULL,
    0.5,
    true
  ),
  (
    'Income & Dividends',
    'Focuses on stable, income-generating positions. Higher position sizing discipline and valuation sensitivity.',
    ARRAY['income_investor', 'value_investor'],
    '{"momentum":15,"valuation":35,"position":25,"advisory":25}',
    '{"strong_buy_min":82,"buy_min":68,"hold_min":50,"sell_max":35,"strong_sell_max":20}',
    NULL,
    0.6,
    true
  ),
  (
    'Sector Rotation',
    'Momentum-driven with sector emphasis. Designed for specialists who rotate between high-performing industries.',
    ARRAY['sector_specialist', 'swing_trader', 'growth_investor'],
    '{"momentum":40,"valuation":15,"position":20,"advisory":25}',
    '{"strong_buy_min":78,"buy_min":63,"hold_min":43,"sell_max":33,"strong_sell_max":18}',
    12,
    1.5,
    true
  ),
  (
    'Aggressive Growth',
    'Maximum growth orientation. High conviction bets with wider drawdown tolerance. For experienced investors comfortable with volatility.',
    ARRAY['growth_investor', 'short_term_trader', 'sector_specialist'],
    '{"momentum":38,"valuation":18,"position":16,"advisory":28}',
    '{"strong_buy_min":75,"buy_min":60,"hold_min":40,"sell_max":30,"strong_sell_max":15}',
    12,
    2.0,
    true
  )
ON CONFLICT (name) WHERE is_system = true
DO UPDATE SET
  description = EXCLUDED.description,
  investor_types = EXCLUDED.investor_types,
  scoring_weights = EXCLUDED.scoring_weights,
  signal_thresholds = EXCLUDED.signal_thresholds,
  horizon_filter_months = EXCLUDED.horizon_filter_months,
  volatility_tolerance = EXCLUDED.volatility_tolerance;
