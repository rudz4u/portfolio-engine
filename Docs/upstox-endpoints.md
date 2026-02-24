# Upstox Endpoints — Extracted Summary

This document summarizes the Upstox endpoints and important integration notes extracted from https://upstox.com/developer/api-documentation/.

Authentication
- Authorization (user login dialog): `https://api.upstox.com/v2/login/authorization/dialog`
- Token exchange (server-to-server): `https://api.upstox.com/v2/login/authorization/token` (POST, form-encoded; params: code, client_id, client_secret, redirect_uri, grant_type=authorization_code)
- Semi-automated flow: Access Token Request API (noted in docs) and notifier URL for callbacks.
- Extended tokens: 1-year read-only tokens available for certain apps.

Sandbox
- Create a sandbox app at Upstox Developer Apps and `Generate` a sandbox access token (valid ~30 days).
- Sandbox-enabled endpoints include: Place Order, Place Order V3, Place Multi Order, Modify Order, Cancel Order, Cancel Order V3, etc.

Instruments & Market Data
- BOD JSON files (daily refresh ~6 AM):
  - `https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz`
  - `https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz`
  - `https://assets.upstox.com/market-quote/instruments/exchange/BSE.json.gz`
- Recommended unique id: `instrument_key` (use over `exchange_token`).
- Each instrument object contains fields: `segment`, `name`, `exchange`, `isin`, `instrument_type`, `instrument_key`, `lot_size`, `exchange_token`, `tick_size`, `trading_symbol`, `short_name`, `security_type`.

Portfolio / User
- Get Profile: `/v2/user/profile` (docs link)
- Get Funds & Margin: endpoints for user funds/margin info (see `Get Fund And Margin` docs)
- Get Holdings and Get Positions: endpoints referenced under `Authentication -> Supported APIs` (use sandbox tokens for testing).

Orders & Execution
- Place Order (V2/V3) endpoints for single and multi-order placement.
- Modify Order, Cancel Order, Get Order Details, Get Order History, Get Order Book, Get Trades.
- Order lifecycle and error codes described in Orders docs — implement idempotency and retry/backoff per rate limits.

Historical / Market Data
- Historical OHLC endpoints exist (see API structure pages). Use them for indicator calculation (SMA/EMA/MACD/ATR/Beta).

Websockets / Streams
- Upstox provides websocket market feeds; authentication method and subscribe message schemas are in docs (inspect using DevTools during sandbox sessions).

Rate Limits & Operational Notes
- Docs include rate-limiting guidance per endpoint; implement exponential backoff and respect limits.
- Prefer instruments JSON files for bulk instrument metadata rather than per-request lookups.

Next Actions (Integration Tester)
1. Create a sandbox app and generate a token.
2. Use Playwright to run through the OAuth dialog (authorization code flow) and capture token exchange request/response.
3. Call `Get Holdings`, `Get Positions`, `Place Order (sandbox)` to capture representative JSON responses and save under `Docs/mocks/upstox/`.
