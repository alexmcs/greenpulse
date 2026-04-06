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
  species_confidence NUMERIC(4,3),   -- 0.000–1.000
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
