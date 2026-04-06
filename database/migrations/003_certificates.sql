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
