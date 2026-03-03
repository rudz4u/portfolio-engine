/**
 * @deprecated Use `import { createClient } from '@/lib/supabase/client'` instead.
 * This file is kept for backward compatibility during migration.
 */
import { createClient } from './supabase/client'

export const supabase = createClient()
