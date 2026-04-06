-- 004: Row Level Security policies (GDPR — users see only their own data)

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
