require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function create() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'testagent@rudz.in',
    password: 'password123',
    email_confirm: true
  });
  if (error) console.error(error);
  else console.log('Created user:', data.user.email);
}
create();
