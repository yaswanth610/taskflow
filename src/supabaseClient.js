import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zwuowwodyrsbozgripat.supabase.co'
const supabasePublishableKey = 'sb_publishable_zHvbvoBwspesFlJRFXGfJw_Yc8JCO8F'

export const supabase = createClient(
supabaseUrl,
supabasePublishableKey,
{
auth: {
flowType: 'pkce',
detectSessionInUrl: true,
persistSession: true,
autoRefreshToken: true,
},
}
)
