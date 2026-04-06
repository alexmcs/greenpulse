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

-- species lookup table (CO₂ coefficients per IPCC Tier 1)
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
