# Architecture Overview

Summary:
- Frontend: Next.js (TypeScript) + Tailwind CSS + Shadcn UI. Hosted on Netlify.
- Backend: Supabase (Postgres, Auth, Edge Functions, Cron). Edge functions for quant engine and Upstox sync.
- Brokerage Integration: Upstox OpenAPI (OAuth 2.0, holdings, orders).
- AI Layer: LLM routing layer to Gemini/OpenAI/Anthropic; multi-agent stack (Research, Analysis, Execution).
- Research Source: Tavily (or equivalent) for web market data and news.

Key Components:
- Quantitative Engine: TypeScript microservice (edge) that calculates indicators (RSI, SMA, EMA, MACD, ATR, Beta) and composite scores.
- Agents:
  - Research Agent: collects news/sentiment for targets.
  - Analysis Agent: fuses quantitative & qualitative signals to form recommendations.
  - Execution/Assistant: conversational agent that prompts users and triggers order execution on confirmation.

Data Flow:
1. Daily cron triggers Upstox holdings sync and market-data pulls.
2. Quant Engine computes indicators and composite scores.
3. Research Agent augments with news/sentiment.
4. Analysis Agent generates recommendations aligned with user preferences.
5. Chat Assistant presents recommendations and requests confirmation before executing orders.
