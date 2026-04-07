-- 001: users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'premium', 'corporate')),
  verification_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ  -- soft delete for GDPR
);

-- species lookup table (COâ‚‚ coefficients per IPCC Tier 1)
CREATE TABLE IF NOT EXISTS public.species (
  id SERIAL PRIMARY KEY,
  name_latin TEXT NOT NULL,
  name_common_en TEXT,
  name_common_ru TEXT,
  co2_kg_per_year_avg NUMERIC(8,2),
  co2_kg_per_year_min NUMERIC(8,2),
  co2_kg_per_year_max NUMERIC(8,2),
  rekognition_label TEXT  -- mapping to AWS Rekognition Custom Label name
);


-- 002: verifications table
CREATE TABLE IF NOT EXISTS public.verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  photo_url TEXT NOT NULL,
  photo_hash TEXT NOT NULL,          -- SHA256 for deduplication
  lat NUMERIC(8,4) NOT NULL,         -- rounded to ~10m precision
  lng NUMERIC(8,4) NOT NULL,
  gps_accuracy_m INTEGER,
  species_id INTEGER REFERENCES public.species(id),
  species_name TEXT NOT NULL,
  species_confidence NUMERIC(4,3),   -- 0.000â€“1.000
  species_source TEXT CHECK (species_source IN ('ai', 'user_selected')),
  co2_kg_year NUMERIC(8,2),
  co2_kg_year_min NUMERIC(8,2),
  co2_kg_year_max NUMERIC(8,2),
  antifrod_status TEXT DEFAULT 'passed' CHECK (antifrod_status IN ('passed','flagged','rejected')),
  antifrod_flags TEXT[],
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','refunded')),
  revenuecat_transaction_id TEXT,
  certificate_id UUID,
  event_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for GPS deduplication queries
CREATE INDEX IF NOT EXISTS idx_verifications_user_gps_time
  ON public.verifications(user_id, lat, lng, created_at);

-- Index for photo hash deduplication
CREATE INDEX IF NOT EXISTS idx_verifications_photo_hash
  ON public.verifications(photo_hash, user_id);


-- 003: certificates table
CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id UUID REFERENCES public.verifications(id) UNIQUE,
  user_id UUID REFERENCES public.users(id),
  pdf_url TEXT NOT NULL,
  qr_code_url TEXT NOT NULL,
  qr_verification_url TEXT NOT NULL,  -- public link for QR verification
  co2_methodology TEXT DEFAULT 'IPCC Tier 1',
  co2_methodology_version TEXT DEFAULT '1.0',
  issued_at TIMESTAMPTZ DEFAULT NOW()
);

-- GDPR right-to-deletion function
CREATE OR REPLACE FUNCTION delete_user_data(user_uuid UUID)
RETURNS void AS $$
BEGIN
  -- Wipe PII from verifications (keep record for audit)
  UPDATE public.verifications
  SET photo_url = '[DELETED]', antifrod_flags = '{}'
  WHERE user_id = user_uuid;

  -- Soft delete user
  UPDATE public.users
  SET email = '[DELETED]',
      display_name = NULL,
      deleted_at = NOW()
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 004: Row Level Security policies (GDPR â€” users see only their own data)

ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- verifications: users see only their own
CREATE POLICY "Users see own verifications"
  ON public.verifications FOR ALL
  USING (auth.uid() = user_id);

-- certificates: users see only their own
CREATE POLICY "Users see own certificates"
  ON public.certificates FOR ALL
  USING (auth.uid() = user_id);

-- users: users see/update only their own profile
CREATE POLICY "Users see own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- species: public read (lookup table, no sensitive data)
ALTER TABLE public.species ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Species public read"
  ON public.species FOR SELECT
  USING (true);


-- Seed data: common tree species with IPCC Tier 1 COâ‚‚ coefficients
INSERT INTO public.species (name_latin, name_common_en, name_common_ru, co2_kg_per_year_avg, co2_kg_per_year_min, co2_kg_per_year_max, rekognition_label)
VALUES
  ('Quercus robur',      'English Oak',       'Ð”ÑƒÐ± Ñ‡ÐµÑ€ÐµÑˆÑ‡Ð°Ñ‚Ñ‹Ð¹',  48.0, 22.0, 80.0, 'oak'),
  ('Betula pendula',     'Silver Birch',      'Ð‘ÐµÑ€Ñ‘Ð·Ð° Ð¿Ð¾Ð²Ð¸ÑÐ»Ð°Ñ', 22.0, 12.0, 35.0, 'birch'),
  ('Pinus sylvestris',   'Scots Pine',        'Ð¡Ð¾ÑÐ½Ð° Ð¾Ð±Ñ‹ÐºÐ½Ð¾Ð²ÐµÐ½Ð½Ð°Ñ', 30.0, 15.0, 50.0, 'pine'),
  ('Tilia cordata',      'Small-leaved Lime', 'Ð›Ð¸Ð¿Ð° ÑÐµÑ€Ð´Ñ†ÐµÐ»Ð¸ÑÑ‚Ð½Ð°Ñ', 25.0, 12.0, 40.0, 'linden'),
  ('Acer platanoides',   'Norway Maple',      'ÐšÐ»Ñ‘Ð½ Ð¾ÑÑ‚Ñ€Ð¾Ð»Ð¸ÑÑ‚Ð½Ñ‹Ð¹', 18.0, 9.0, 30.0, 'maple'),
  ('Populus tremula',    'Aspen',             'ÐžÑÐ¸Ð½Ð°',           35.0, 18.0, 60.0, 'aspen'),
  ('Picea abies',        'Norway Spruce',     'Ð•Ð»ÑŒ Ð¾Ð±Ñ‹ÐºÐ½Ð¾Ð²ÐµÐ½Ð½Ð°Ñ', 28.0, 14.0, 45.0, 'spruce'),
  ('Fraxinus excelsior', 'Common Ash',        'Ð¯ÑÐµÐ½ÑŒ Ð¾Ð±Ñ‹ÐºÐ½Ð¾Ð²ÐµÐ½Ð½Ñ‹Ð¹', 32.0, 16.0, 55.0, 'ash'),
  ('Alnus glutinosa',    'Common Alder',      'ÐžÐ»ÑŒÑ…Ð° Ñ‡Ñ‘Ñ€Ð½Ð°Ñ',   20.0, 10.0, 35.0, 'alder'),
  ('Robinia pseudoacacia','Black Locust',     'Ð Ð¾Ð±Ð¸Ð½Ð¸Ñ Ð»Ð¶ÐµÐ°ÐºÐ°Ñ†Ð¸Ñ', 40.0, 20.0, 65.0, 'locust');

