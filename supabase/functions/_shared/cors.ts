// Shared CORS headers.
// Tighten Access-Control-Allow-Origin to your real domain before
// going live (e.g. "https://uewhostels.example.com") instead of "*".
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
