const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

function loadEnv(envPath) {
  const content = fs.readFileSync(envPath, 'utf8')
  const lines = content.split(/\r?\n/)
  const env = {}
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/i)
    if (!m) continue
    let [, key, val] = m
    val = val.replace(/^"|"$/g, '')
    env[key] = val
  }
  return env
}

async function main() {
  const pwd = process.argv[2]
  if (!pwd) {
    console.error('Usage: node test_signin.js <password>')
    process.exit(1)
  }

  const repoRoot = path.resolve(__dirname, '..', '..', '..')
  const envPath = path.join(repoRoot, '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('.env.local not found at', envPath)
    process.exit(1)
  }

  const env = loadEnv(envPath)
  const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    console.error('Supabase URL or anon key missing in .env.local')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
  const email = 'r.ni.das@gmail.com'

  console.log('Signing in', email)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd })
  if (error) {
    console.error('Sign-in error:', error.message || error)
    process.exit(2)
  }
  console.log('Signed in, session received')

  // set session for subsequent requests
  if (data && data.session) {
    await supabase.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })
  }

  console.log('Fetching holdings...')
  const res = await supabase.from('holdings').select('*')
  if (res.error) {
    console.error('Error fetching holdings:', res.error.message || res.error)
    process.exit(3)
  }
  console.log('holdings count:', (res.data || []).length)
  console.log(JSON.stringify(res.data || [], null, 2))
}

main().catch(e => { console.error(e); process.exit(99) })
