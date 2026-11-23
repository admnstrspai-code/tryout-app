import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = 'https://wccumuxlvxfabypeadhh.supabase.co'
const supabaseKey = 'sb_publishable_EC7BF3U8QCU8FUGTBHecZQ_Q-qEfjdc'

export const supabase = createBrowserClient(supabaseUrl, supabaseKey)