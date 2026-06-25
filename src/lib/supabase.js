import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://rigoqxtyxlmidbkrppbo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZ29xeHR5eGxtaWRia3JwcGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1ODg2MjMsImV4cCI6MjA5NjE2NDYyM30.11Vct2Vu7UA5bdu3QeY5taXglG9Ys_jqVn3WtrKZksQ'
)
