import { createClient } from '@supabase/supabase-js'

// !! Add your URL and Key
const supabaseUrl = 'https://bdaehtxseangctkbcpsy.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkYWVodHhzZWFuZ2N0a2JjcHN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NDE0NzksImV4cCI6MjA3NzIxNzQ3OX0.AX_heEAmrXfPPArzTKf3-YH3QaQ_hK1RsXggf1t0eok'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})