-- ═══════════════════════════════════════════════════════════
-- UEW HOSTEL FINDER — DATABASE SCHEMA
-- Run this once in Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ── HOSTELS ──────────────────────────────────────────────────
create table hostels (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,              -- e.g. 'guest-hall'
  name text not null,                     -- e.g. 'Guest Hall'
  type_label text,                        -- e.g. 'On-Campus · Mixed'
  description text,
  badge_text text default 'Available',    -- shown top-right of card
  badge_style text default 'default',     -- 'default' or 'limited' (orange)
  main_image_url text,                    -- card photo (Supabase Storage URL)
  features jsonb default '[]'::jsonb,     -- e.g. ["🛏 Single & Shared", "🔒 24/7 Security"]
  sort_order int default 0,               -- controls display order
  created_at timestamptz default now()
);

-- ── ROOM TYPES (belongs to a hostel) ────────────────────────
create table room_types (
  id uuid primary key default uuid_generate_v4(),
  hostel_id uuid references hostels(id) on delete cascade,
  name text not null,                     -- e.g. 'Single Room'
  capacity int not null,                  -- 1, 2, 3, 4...
  price numeric not null,                 -- e.g. 1500.00
  price_period text default '/ semester', -- e.g. '/ year'
  availability_status text default 'available', -- available | limited | full
  description text,
  amenities jsonb default '[]'::jsonb,    -- e.g. ["Private room", "Study desk"]
  main_image_url text,                    -- Storage URL
  thumb_images jsonb default '[]'::jsonb, -- e.g. ["url1", "url2"]
  video_url text,                         -- Storage URL, nullable
  sort_order int default 0,
  created_at timestamptz default now()
);

-- ── ENQUIRIES (contact form submissions) ────────────────────
create table enquiries (
  id uuid primary key default uuid_generate_v4(),
  first_name text,
  last_name text,
  email text,
  phone text,
  preferred_hostel text,
  message text,
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- Hostels & rooms: anyone can read (it's public marketing data)
-- Enquiries: anyone can insert (submit a form), nobody can read
-- via the public API — you view them from the Supabase dashboard
-- or an authenticated admin view later.
-- ═══════════════════════════════════════════════════════════

alter table hostels enable row level security;
alter table room_types enable row level security;
alter table enquiries enable row level security;

create policy "Public can read hostels"
  on hostels for select
  using (true);

create policy "Public can read room_types"
  on room_types for select
  using (true);

create policy "Public can submit enquiries"
  on enquiries for insert
  with check (true);

-- ═══════════════════════════════════════════════════════════
-- SEED DATA — your current 3 hostels + 4 room types each,
-- so the site looks identical to before once you connect it.
-- Replace image/video URLs with your real Supabase Storage
-- URLs once uploaded (see the note at the bottom).
-- ═══════════════════════════════════════════════════════════

insert into hostels (slug, name, type_label, description, badge_text, badge_style, main_image_url, features, sort_order) values
('guest-hall', 'Guest Hall', 'On-Campus · Mixed',
 'A well-established hostel at the heart of campus with easy access to lecture halls, the library, and the cafeteria.',
 'Available', 'default', 'images/Guess hall.jpg',
 '["🛏 Single & Shared", "🔒 24/7 Security", "💧 Running Water", "💡 Electricity"]', 1),

('ssnit', 'SSNIT Hostel', 'On-Campus · Premium',
 'One of the most sought-after hostels on campus with modern facilities and spacious rooms for serious students.',
 'Available', 'default', 'images/ssnit hostel.jpg',
 '["🏠 Ensuite Options", "📶 Wi-Fi Ready", "🚿 Modern Bathrooms", "🔒 Gated Entry"]', 2),

('finess', 'Finess Hostel', 'On-Campus · Budget-Friendly',
 'Affordable, cozy, and community-focused. Ideal for students who want great value without sacrificing safety.',
 'Limited', 'limited', 'images/finess hostel.jpg',
 '["💰 Affordable", "👥 Community Vibe", "🛡 Secure Compound", "🍳 Shared Kitchen"]', 3);

-- Room types for Guest Hall (repeat similar inserts for ssnit / finess with
-- their own real prices once you have them — this seed just gets you started)
insert into room_types (hostel_id, name, capacity, price, price_period, availability_status, description, amenities, main_image_url, thumb_images, video_url, sort_order)
select id, 'Single Room', 1, 1500, '/ semester', 'available',
  'Maximum privacy — your own space to study, sleep, and decompress. Comes with a personal desk, wardrobe, and single bed.',
  '["Private room", "Study desk & chair", "Wardrobe / storage", "Single bed & mattress", "Natural window light", "Shared bathroom"]',
  'images/one in a room.jpg',
  '["images/room-single-2.jpg", "images/room-single-3.jpg"]',
  null, 1
from hostels where slug = 'guest-hall';

insert into room_types (hostel_id, name, capacity, price, price_period, availability_status, description, amenities, main_image_url, thumb_images, video_url, sort_order)
select id, 'Double Room', 2, 3000, '/ year', 'available',
  'Shared with one other student — a great balance of privacy and companionship. Each occupant has their own bed, desk, and wardrobe space.',
  '["2 single beds", "2 study desks", "2 wardrobes", "Spacious floor area", "Natural ventilation", "Shared bathroom"]',
  'images/two in a room 3.jpg',
  '["images/Twin room pic 2.jpg", "images/room-double-3.jpg"]',
  null, 2
from hostels where slug = 'guest-hall';

insert into room_types (hostel_id, name, capacity, price, price_period, availability_status, description, amenities, main_image_url, thumb_images, video_url, sort_order)
select id, 'Triple Room', 3, 750, '/ semester per person', 'limited',
  'A popular, social option shared among three students with enough space for everyone''s belongings and individual study corners.',
  '["3 single beds", "3 study desks", "Storage per person", "Good floor space", "Ceiling fan", "Shared bathroom"]',
  'images/two in a room 3.jpg',
  '["images/room-triple-2.jpg", "images/room-triple-3.jpg"]',
  null, 3
from hostels where slug = 'guest-hall';

insert into room_types (hostel_id, name, capacity, price, price_period, availability_status, description, amenities, main_image_url, thumb_images, video_url, sort_order)
select id, 'Quad Room', 4, 600, '/ semester per person', 'available',
  'The most budget-friendly option — great for students who enjoy a lively, communal atmosphere. Each occupant has a dedicated bed and storage unit.',
  '["4 single beds", "4 storage units", "Shared study table", "Large floor area", "Active community feel", "Shared bathroom"]',
  'images/four in a room.jpg',
  '["images/four in a room 2.jpg", "images/four in a room.jpg"]',
  null, 4
from hostels where slug = 'guest-hall';

-- NOTE: SSNIT and Finess have no room_types rows yet — add their real
-- room types + prices the same way (copy a block above, change the
-- `where slug = ...` and the details) once you have that info.
