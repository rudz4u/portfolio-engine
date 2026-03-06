-- Seed: 20 SEBI-registered Advisory Sources
-- Run AFTER migration 010_advisory_system.sql
--
-- Tier assignment:
--   Tier 1 (0.85) — Premier full-service brokers (ICICI, HDFC, Kotak, Motilal)
--   Tier 2 (0.75) — Major mid-cap brokers (Axis, Angel One, Sharekhan, IIFL, Geojit)
--   Tier 3 (0.65) — Fintech research portals (5Paisa, Equitymaster, R&R, Trendlyne, Tickertape)
--   Tier 4 (0.55) — Independent / boutique RAs (CapitalVia, Screener, Rising Research)
--
-- scrape_mode:
--   'both'   — Tavily search + direct page fetch (premier sources with good HTML structure)
--   'tavily' — Tavily search only (harder-to-parse pages)

INSERT INTO advisory_sources
  (name, sebi_reg_no, website_url, tier, base_weight, scrape_mode)
VALUES

-- ── Tier 1: Premier full-service brokers ─────────────────────────────────
(
  'ICICI Securities',
  'INH000000990',
  'https://www.icicidirect.com/research/equity',
  1, 0.85, 'both'
),
(
  'HDFC Securities',
  'INH000000602',
  'https://www.hdfcsec.com/research/equity',
  1, 0.85, 'both'
),
(
  'Kotak Securities',
  'INH000000586',
  'https://www.kotaksecurities.com/fundamental-research-report/',
  -- Previously: /research/equity-research (404)
  1, 0.85, 'both'
),
(
  'Motilal Oswal',
  'INH000000412',
  'https://www.motilaloswal.com/stock-research',
  -- Previously: /research/equity-research (404)
  1, 0.85, 'both'
),

-- ── Tier 2: Major mid-cap brokers ─────────────────────────────────────────
(
  'Axis Securities',
  'INH000000297',
  'https://www.axisdirect.in/research/equity',
  2, 0.75, 'tavily'
),
(
  'Angel One',
  'INH000000164',
  'https://www.angelone.in/research/stocks',
  2, 0.75, 'tavily'
),
(
  'Sharekhan',
  'INH000000303',
  'https://www.sharekhan.com/research/equity',
  2, 0.75, 'tavily'
),
(
  'IIFL Securities',
  'INH000000248',
  'https://www.indiainfoline.com/research/equity',
  2, 0.75, 'tavily'
),
(
  'Geojit Financial',
  'INH000000303',
  'https://www.geojit.com/research-reports',
  2, 0.75, 'tavily'
),

-- ── Tier 3: Fintech research portals ──────────────────────────────────────
(
  '5Paisa',
  'INH000004474',
  'https://www.5paisa.com/research/stock-research',
  3, 0.65, 'tavily'
),
(
  'Equitymaster',
  'INH000000218',
  'https://equitymaster.com/stock-research',
  -- Previously: /research-it/bull-bear/ (403 on direct fetch — switched to tavily-only)
  3, 0.65, 'tavily'
),
(
  'Research & Ranking',
  'INA000003874',
  'https://researchandranking.com/buy-stocks/',
  3, 0.65, 'tavily'
),
(
  'Trendlyne',
  'INA300016738',
  'https://trendlyne.com/research-reports/all/',
  -- /all/ page is a structured table (Date|Company|Broker|Target|CMP|Upside%|Signal)
  -- aggregating 50+ brokers — far richer than the bare /research-reports/ root
  3, 0.65, 'both'
),
(
  'Tickertape',
  'INA200005323',
  'https://www.tickertape.in/screener',
  3, 0.65, 'tavily'
),

-- ── Tier 4: Independent / boutique Research Analysts ─────────────────────
(
  'CapitalVia',
  'INA200001512',
  'https://capitalvia.com/research-reports/',
  4, 0.55, 'tavily'
),
(
  'Screener.in',
  'INH000000115',
  'https://www.screener.in/',
  4, 0.55, 'tavily'
),
(
  'Rising Research Analyst',
  'INH000015686',
  'https://risingresearch.in/reports/',
  4, 0.55, 'tavily'
),

-- ── Tier 2 additions: Major institutional research houses ─────────────────
(
  'Emkay Global',
  'INH000000354',
  'https://www.emkayglobal.com/research/reports',
  -- Public research page updated regularly; Emkay is top-10 institutional research house
  2, 0.75, 'tavily'
),
(
  'Prabhudas Lilladher',
  'INH000000271',
  'https://www.plindia.com/research/',
  -- PL Capital research hub; SEBI RA INH000000271 (from plindia.com footer)
  2, 0.75, 'tavily'
),
(
  'Nirmal Bang',
  'INH000001766',
  'https://www.nirmalbang.com/nb-research/equity-research-report-india.aspx',
  -- Retail research desk; publishes regular equity research reports
  2, 0.75, 'tavily'
)

ON CONFLICT (name) DO UPDATE SET
  sebi_reg_no  = EXCLUDED.sebi_reg_no,
  website_url  = EXCLUDED.website_url,
  tier         = EXCLUDED.tier,
  base_weight  = EXCLUDED.base_weight,
  scrape_mode  = EXCLUDED.scrape_mode,
  updated_at   = now();
