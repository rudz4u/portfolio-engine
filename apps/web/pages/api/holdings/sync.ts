import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    // In production, you would retrieve the access_token from `user_settings`
    // and make a live `fetch` call to Upstox's /v2/portfolio/long-term-holdings

    // MOCK Fetch Execution
    const mockHoldings = [
        {
            instrument_key: 'NSE_EQ|INE002A01018',
            quantity: 50,
            avg_price: 2450.00,
            ltp: 2510.40,
            invested_amount: 122500.00,
            unrealized_pl: 3020.00,
            segment: 'EQ'
        },
        {
            instrument_key: 'NSE_EQ|INE062A01020',
            quantity: 120,
            avg_price: 1350.50,
            ltp: 1340.00,
            invested_amount: 162060.00,
            unrealized_pl: -1260.00,
            segment: 'EQ'
        },
        {
            instrument_key: 'NSE_EQ|INE018A01030',
            quantity: 25,
            avg_price: 3800.00,
            ltp: 4100.50,
            invested_amount: 95000.00,
            unrealized_pl: 7512.50,
            segment: 'EQ'
        }
    ]

    // In standard operation, map the response, fetch a portfolio_id matching the user's Upstox integration,
    // and run an upsert. Here we simulate success.

    return res.status(200).json({
        status: 'success',
        data: mockHoldings,
        message: 'Simulated holdings sync complete.'
    })
}
