// ═══════════════════════════════════════════════════════════
// SUPABASE CONNECTION CONFIG
// This is the ONLY file you need to edit to connect the site
// to your Supabase project.
//
// Where to find these values:
// Supabase Dashboard → Settings → API
//   - "Project URL"        → paste into SUPABASE_URL
//   - "anon" "public" key  → paste into SUPABASE_ANON_KEY
//
// The anon key is safe to expose in frontend code — it only
// allows what your Row Level Security policies permit (see
// schema.sql: public read on hostels/room_types, public insert
// on enquiries, nothing else).
// ═══════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://ubhbzmgtfknzedaxuqum.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViaGJ6bWd0ZmtuemVkYXh1cXVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0NDUxNzAsImV4cCI6MjEwMTAyMTE3MH0.rtmG8_6CcOdrZFCGZs7wTKaqgmHFQLE-A-EEIEU7tuc';

// Creates one shared client used by script.js.
// `supabase` here refers to the global from the CDN library
// (@supabase/supabase-js), loaded via <script> tag before this file.
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);