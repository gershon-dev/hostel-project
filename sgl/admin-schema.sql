-- ═══════════════════════════════════════════════════════════
-- UEW HOSTEL FINDER — ADMIN SETUP
-- Run this AFTER schema.sql, once, in Supabase Dashboard →
-- SQL Editor → New Query.
--
-- This adds:
--   1. Write policies so a LOGGED-IN admin (via Supabase Auth)
--      can insert/update/delete hostels, room_types, enquiries.
--   2. A storage bucket ("hostel-media") for images/videos,
--      publicly readable, only writable when logged in.
--
-- IMPORTANT — creating your admin login:
-- Supabase Dashboard → Authentication → Users → "Add user"
-- → enter an email + password → set "Auto Confirm User" ON.
-- That's the only account that should exist — there is no
-- public sign-up form in the admin panel, on purpose.
-- ═══════════════════════════════════════════════════════════

-- ── Hostels: allow authenticated write ──
create policy "Authenticated can insert hostels"
  on hostels for insert to authenticated with check (true);
create policy "Authenticated can update hostels"
  on hostels for update to authenticated using (true);
create policy "Authenticated can delete hostels"
  on hostels for delete to authenticated using (true);

-- ── Room types: allow authenticated write ──
create policy "Authenticated can insert room_types"
  on room_types for insert to authenticated with check (true);
create policy "Authenticated can update room_types"
  on room_types for update to authenticated using (true);
create policy "Authenticated can delete room_types"
  on room_types for delete to authenticated using (true);

-- ── Enquiries: public can insert (already exists from schema.sql),
--    only authenticated admin can read/delete ──
create policy "Authenticated can read enquiries"
  on enquiries for select to authenticated using (true);
create policy "Authenticated can delete enquiries"
  on enquiries for delete to authenticated using (true);

-- ═══════════════════════════════════════════════════════════
-- STORAGE — bucket for hostel/room images + videos
-- ═══════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('hostel-media', 'hostel-media', true)
on conflict (id) do nothing;

create policy "Public can view hostel media"
  on storage.objects for select
  using (bucket_id = 'hostel-media');

create policy "Authenticated can upload hostel media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'hostel-media');

create policy "Authenticated can update hostel media"
  on storage.objects for update to authenticated
  using (bucket_id = 'hostel-media');

create policy "Authenticated can delete hostel media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'hostel-media');
