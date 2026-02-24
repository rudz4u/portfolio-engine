#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PARSED = ROOT / 'Docs' / 'parsed_portfolio.json'
OUT_SQL = ROOT / 'infrastructure' / 'seeds' / 'seed_rudranildas.sql'

OUT_SQL.parent.mkdir(parents=True, exist_ok=True)

def clean_num(v):
    if v is None:
        return 'NULL'
    s = str(v).strip()
    if s == '' or s == '#N/A':
        return 'NULL'
    # remove commas
    s = s.replace(',', '')
    try:
        float(s)
        return s
    except:
        return "'" + s.replace("'", "''") + "'"

def sql_string(v):
    if v is None:
        return 'NULL'
    s = str(v).strip()
    return "'" + s.replace("'", "''") + "'"

def main():
    data = json.loads(PARSED.read_text(encoding='utf-8'))
    portfolio = data.get('Portfolio', [])
    lines = []
    lines.append('-- Seed for user rudranildas')
    lines.append("BEGIN;")
    # insert user
    lines.append("INSERT INTO users (id, username, email, phone, created_at) VALUES (gen_random_uuid(), 'rudranildas', 'r.ni.das@gmail.com', '+918013785503', now()) ON CONFLICT (email) DO NOTHING;")
    # create portfolio row
    lines.append("INSERT INTO portfolios (id, user_id, source, meta, fetched_at) VALUES (gen_random_uuid(), (SELECT id FROM users WHERE email='r.ni.das@gmail.com'), 'upstox', '{}'::jsonb, now());")
    # find portfolio id via subselect when inserting holdings
    for row in portfolio:
        symbol = row.get('Symbol') or row.get('Scrip Code') or row.get('Scrip Name')
        if not symbol:
            continue
        instrument_key = row.get('Symbol') if row.get('Symbol') else symbol
        qty = clean_num(row.get('Qty') or row.get('Qty '))
        avg = clean_num(row.get('Avg Buy Price') or row.get('Avg Buy Price '))
        ltp = clean_num(row.get('C.M.P') or row.get('C.M.P '))
        invested = clean_num(row.get('Total Invested'))
        unreal = clean_num(row.get('P&L'))
        segment = sql_string(row.get('Segment'))
        moving = row.get('Moving/Non Moving')
        moving_bool = 'true' if str(moving).strip().lower()=='moving' else 'false'
        # upsert instrument
        lines.append("INSERT INTO instruments (instrument_key, trading_symbol, name, exchange, isin, metadata) VALUES (" +
                 "'" + str(instrument_key).replace("'", "''") + "', " +
                 sql_string(row.get('Symbol')) + ", " +
                 sql_string(row.get('Scrip Name')) + ", NULL, " +
                 sql_string(row.get('ISIN')) + ", '{}'::jsonb) ON CONFLICT (instrument_key) DO NOTHING;")
        # insert holding
        lines.append("INSERT INTO holdings (id, portfolio_id, instrument_key, quantity, avg_price, invested_amount, ltp, unrealized_pl, segment, moving, raw) VALUES (gen_random_uuid(), (SELECT id FROM portfolios WHERE user_id=(SELECT id FROM users WHERE email='r.ni.das@gmail.com') LIMIT 1), '" + instrument_key + "', " + qty + ", " + avg + ", " + invested + ", " + ltp + ", " + unreal + ", " + segment + ", " + moving_bool + ", '{}'::jsonb);")

    lines.append('COMMIT;')
    OUT_SQL.write_text('\n'.join(lines), encoding='utf-8')
    print('Wrote', OUT_SQL)

if __name__ == '__main__':
    main()
