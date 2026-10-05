-- cricketmatch.today catalog, submissions and row-level security.
-- Apply on Supabase with the hosted auth schema already present.
-- Public reads use the anon key. Privileged writes go through security-definer functions.

-- Core UUID helper. PGlite does not ship pgcrypto, so this does not call gen_random_uuid().
CREATE OR REPLACE FUNCTION public.uuidv4()
RETURNS uuid
LANGUAGE sql
VOLATILE
AS $$
  SELECT (
    substr(md5(random()::text || clock_timestamp()::text), 1, 8) || '-' ||
    substr(md5(random()::text || clock_timestamp()::text), 1, 4) || '-' ||
    '4' || substr(md5(random()::text || clock_timestamp()::text), 1, 3) || '-' ||
    substr('89ab', (floor(random() * 4)::int + 1), 1) || substr(md5(random()::text || clock_timestamp()::text), 1, 3) || '-' ||
    substr(md5(random()::text || clock_timestamp()::text), 1, 12)
  )::uuid;
$$;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_trgm unavailable: %', SQLERRM;
END
$$;

CREATE TYPE public.user_role AS ENUM ('fan', 'academy_owner', 'organiser', 'moderator', 'admin');
CREATE TYPE public.match_format AS ENUM ('test', 'odi', 't20', 't10', 'hundred', 'other');
CREATE TYPE public.match_status AS ENUM ('draft', 'pending', 'published', 'postponed', 'cancelled', 'completed');
CREATE TYPE public.attendance_type AS ENUM ('ticketed', 'free', 'private', 'unknown');
CREATE TYPE public.competition_kind AS ENUM ('international', 'league', 'domestic', 'academy');
CREATE TYPE public.source_type AS ENUM ('api', 'organiser', 'academy', 'admin');
CREATE TYPE public.ticket_kind AS ENUM ('official', 'authorised_partner', 'affiliate');
CREATE TYPE public.ticket_offer_status AS ENUM ('pending', 'active', 'sold_out', 'expired', 'rejected');
CREATE TYPE public.ticket_request_status AS ENUM ('pending_verification', 'active', 'notified', 'unsubscribed', 'expired');
CREATE TYPE public.verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
CREATE TYPE public.submission_entity AS ENUM ('match', 'academy', 'ticket_offer', 'correction');
CREATE TYPE public.submission_status AS ENUM ('pending', 'in_review', 'approved', 'rejected', 'changes_requested');
CREATE TYPE public.import_status AS ENUM ('running', 'succeeded', 'failed', 'skipped');
CREATE TYPE public.team_level AS ENUM ('international', 'domestic', 'league', 'club', 'academy');
CREATE TYPE public.team_gender AS ENUM ('men', 'women', 'mixed', 'unknown');

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'fan',
  display_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text,
  country_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.countries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  iso2 text NOT NULL UNIQUE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  timezone_default text NOT NULL,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.cities (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  country_id bigint NOT NULL REFERENCES public.countries (id),
  name text NOT NULL,
  slug text NOT NULL,
  lat numeric,
  lng numeric,
  UNIQUE (country_id, slug)
);

CREATE TABLE IF NOT EXISTS public.venues (
  id uuid PRIMARY KEY DEFAULT public.uuidv4(),
  city_id bigint NOT NULL REFERENCES public.cities (id),
  name text NOT NULL,
  slug text NOT NULL,
  address text NOT NULL DEFAULT '',
  lat numeric,
  lng numeric,
  capacity integer,
  source_url text,
  verification_status public.verification_status NOT NULL DEFAULT 'unverified',
  last_verified_at timestamptz,
  UNIQUE (city_id, slug)
);

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT public.uuidv4(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  short_name text NOT NULL,
  country_id bigint REFERENCES public.countries (id),
  gender public.team_gender NOT NULL DEFAULT 'unknown',
  level public.team_level NOT NULL DEFAULT 'domestic',
  logo_url text
);

CREATE TABLE IF NOT EXISTS public.competitions (
  id uuid PRIMARY KEY DEFAULT public.uuidv4(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  kind public.competition_kind NOT NULL,
  country_id bigint REFERENCES public.countries (id),
  gender public.team_gender NOT NULL DEFAULT 'unknown',
  format public.match_format,
  official_url text,
  featured_rank integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.seasons (
  id uuid PRIMARY KEY DEFAULT public.uuidv4(),
  competition_id uuid NOT NULL REFERENCES public.competitions (id),
  name text NOT NULL,
  slug text NOT NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  UNIQUE (competition_id, slug)
);

CREATE TABLE IF NOT EXISTS public.matches (
  id uuid PRIMARY KEY DEFAULT public.uuidv4(),
  slug text NOT NULL UNIQUE,
  season_id uuid REFERENCES public.seasons (id),
  competition_id uuid NOT NULL REFERENCES public.competitions (id),
  home_team_id uuid NOT NULL REFERENCES public.teams (id),
  away_team_id uuid NOT NULL REFERENCES public.teams (id),
  venue_id uuid REFERENCES public.venues (id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  source_timezone text NOT NULL,
  format public.match_format NOT NULL,
  status public.match_status NOT NULL DEFAULT 'draft',
  attendance_type public.attendance_type NOT NULL DEFAULT 'unknown',
  source_type public.source_type NOT NULL,
  source_external_id text,
  source_url text,
  source_label text NOT NULL DEFAULT 'Listed source',
  submitted_by uuid REFERENCES public.profiles (id),
  featured_rank integer NOT NULL DEFAULT 0,
  last_verified_at timestamptz,
  published_at timestamptz,
  entry_notes text,
  CHECK (home_team_id <> away_team_id),
  UNIQUE (source_type, source_external_id)
);

CREATE TABLE IF NOT EXISTS public.ticket_offers (
  id uuid PRIMARY KEY DEFAULT public.uuidv4(),
  match_id uuid NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE,
  seller_name text NOT NULL,
  seller_domain text NOT NULL,
  url text NOT NULL,
  kind public.ticket_kind NOT NULL,
  currency text,
  price_from numeric,
  status public.ticket_offer_status NOT NULL DEFAULT 'pending',
  last_checked_at timestamptz,
  approved_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ticket_requests (
  id uuid PRIMARY KEY DEFAULT public.uuidv4(),
  match_id uuid NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles (id),
  email_hash text NOT NULL,
  encrypted_email text NOT NULL,
  quantity smallint NOT NULL CHECK (quantity BETWEEN 1 AND 10),
  country_code text,
  notes text,
  consent_at timestamptz NOT NULL,
  verified_at timestamptz,
  status public.ticket_request_status NOT NULL DEFAULT 'pending_verification',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.academies (
  id uuid PRIMARY KEY DEFAULT public.uuidv4(),
  owner_id uuid REFERENCES public.profiles (id),
  venue_id uuid REFERENCES public.venues (id),
  city_id bigint REFERENCES public.cities (id),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  contact_email text,
  phone text,
  website text,
  age_groups text[] NOT NULL DEFAULT '{}',
  facilities text[] NOT NULL DEFAULT '{}',
  verification_status public.verification_status NOT NULL DEFAULT 'unverified',
  verification_label text,
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.academy_matches (
  match_id uuid PRIMARY KEY REFERENCES public.matches (id) ON DELETE CASCADE,
  academy_id uuid NOT NULL REFERENCES public.academies (id),
  age_group text,
  entry_notes text
);

CREATE TABLE IF NOT EXISTS public.submissions (
  id uuid PRIMARY KEY DEFAULT public.uuidv4(),
  entity_type public.submission_entity NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitter_id uuid REFERENCES public.profiles (id),
  submitter_email text,
  status public.submission_status NOT NULL DEFAULT 'pending',
  duplicate_of uuid,
  reviewer_id uuid REFERENCES public.profiles (id),
  reviewer_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.outbound_clicks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.matches (id),
  ticket_offer_id uuid NOT NULL REFERENCES public.ticket_offers (id),
  referrer text,
  country_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.import_runs (
  id uuid PRIMARY KEY DEFAULT public.uuidv4(),
  provider text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  fetched_count integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  status public.import_status NOT NULL DEFAULT 'running',
  error_summary text
);

CREATE TABLE IF NOT EXISTS public.domain_rules (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  host text NOT NULL UNIQUE,
  decision text NOT NULL CHECK (decision IN ('allow', 'deny')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dead_letters (
  id uuid PRIMARY KEY DEFAULT public.uuidv4(),
  provider text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS matches_status_starts_idx ON public.matches (status, starts_at);
CREATE INDEX IF NOT EXISTS matches_competition_starts_idx ON public.matches (competition_id, starts_at);
CREATE INDEX IF NOT EXISTS matches_venue_starts_idx ON public.matches (venue_id, starts_at);
CREATE INDEX IF NOT EXISTS ticket_offers_match_status_idx ON public.ticket_offers (match_id, status);
CREATE INDEX IF NOT EXISTS ticket_requests_match_status_idx ON public.ticket_requests (match_id, status);
CREATE INDEX IF NOT EXISTS ticket_requests_user_idx ON public.ticket_requests (user_id);
CREATE INDEX IF NOT EXISTS academies_verification_idx ON public.academies (verification_status);
CREATE INDEX IF NOT EXISTS academies_owner_idx ON public.academies (owner_id);
CREATE INDEX IF NOT EXISTS submissions_status_created_idx ON public.submissions (status, created_at);
CREATE INDEX IF NOT EXISTS submissions_submitter_idx ON public.submissions (submitter_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS teams_name_trgm_idx ON public.teams USING gin (name gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS competitions_name_trgm_idx ON public.competitions USING gin (name gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS venues_name_trgm_idx ON public.venues USING gin (name gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS academies_name_trgm_idx ON public.academies USING gin (name gin_trgm_ops)';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('moderator', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- A null auth.uid() is the database owner or service path, used to bootstrap staff.
  -- A signed-in non-staff account cannot change role or email.
  IF auth.uid() IS NOT NULL AND NOT public.is_staff() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'role cannot be changed by this account';
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'email cannot be changed by this account';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_academy_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_staff() AND (
    NEW.verification_status IS DISTINCT FROM OLD.verification_status
    OR NEW.verification_label IS DISTINCT FROM OLD.verification_label
    OR NEW.last_verified_at IS DISTINCT FROM OLD.last_verified_at
    OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
    OR NEW.slug IS DISTINCT FROM OLD.slug
  ) THEN
    RAISE EXCEPTION 'verification fields cannot be changed by this account';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, display_name, email)
  VALUES (
    NEW.id,
    'fan',
    split_part(COALESCE(NEW.email, 'fan'), '@', 1),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS profiles_touch ON public.profiles;
CREATE TRIGGER profiles_touch
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS profiles_protect ON public.profiles;
CREATE TRIGGER profiles_protect
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_privileges();

DROP TRIGGER IF EXISTS academies_protect ON public.academies;
CREATE TRIGGER academies_protect
BEFORE UPDATE ON public.academies
FOR EACH ROW
EXECUTE FUNCTION public.protect_academy_verification();

DROP TRIGGER IF EXISTS academies_touch ON public.academies;
CREATE TRIGGER academies_touch
BEFORE UPDATE ON public.academies
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.create_submission(p_entity_type public.submission_entity, p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid := public.uuidv4();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  INSERT INTO public.submissions (id, entity_type, payload, submitter_id, status)
  VALUES (new_id, p_entity_type, COALESCE(p_payload, '{}'::jsonb), auth.uid(), 'pending');
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_role(target uuid, next_role public.user_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  UPDATE public.profiles
  SET role = next_role
  WHERE id = target;
END;
$$;

CREATE OR REPLACE FUNCTION public.write_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_before jsonb,
  p_after jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, before, after)
  VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, p_before, p_after);
END;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dead_letters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.matches FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_offers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.academies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.submissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_clicks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.import_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.domain_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dead_letters FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_update_staff ON public.profiles;
CREATE POLICY profiles_update_staff ON public.profiles
FOR UPDATE TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS countries_read ON public.countries;
CREATE POLICY countries_read ON public.countries
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS cities_read ON public.cities;
CREATE POLICY cities_read ON public.cities
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS venues_read ON public.venues;
CREATE POLICY venues_read ON public.venues
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS teams_read ON public.teams;
CREATE POLICY teams_read ON public.teams
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS competitions_read ON public.competitions;
CREATE POLICY competitions_read ON public.competitions
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS seasons_read ON public.seasons;
CREATE POLICY seasons_read ON public.seasons
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS matches_public_read ON public.matches;
CREATE POLICY matches_public_read ON public.matches
FOR SELECT TO anon, authenticated
USING (
  public.is_staff()
  OR (
    status IN ('published', 'postponed', 'cancelled', 'completed')
    AND source_url IS NOT NULL
  )
);

DROP POLICY IF EXISTS matches_staff_write ON public.matches;
CREATE POLICY matches_staff_write ON public.matches
FOR ALL TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS offers_public_read ON public.ticket_offers;
CREATE POLICY offers_public_read ON public.ticket_offers
FOR SELECT TO anon, authenticated
USING (
  public.is_staff()
  OR (approved_by IS NOT NULL AND status IN ('active', 'sold_out', 'expired'))
);

DROP POLICY IF EXISTS offers_staff_write ON public.ticket_offers;
CREATE POLICY offers_staff_write ON public.ticket_offers
FOR ALL TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS requests_owner_read ON public.ticket_requests;
CREATE POLICY requests_owner_read ON public.ticket_requests
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS academies_read ON public.academies;
CREATE POLICY academies_read ON public.academies
FOR SELECT TO anon, authenticated
USING (
  verification_status = 'verified'
  OR owner_id = auth.uid()
  OR public.is_staff()
);

DROP POLICY IF EXISTS academies_owner_update ON public.academies;
CREATE POLICY academies_owner_update ON public.academies
FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR public.is_staff())
WITH CHECK (owner_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS academy_matches_read ON public.academy_matches;
CREATE POLICY academy_matches_read ON public.academy_matches
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS submissions_read ON public.submissions;
CREATE POLICY submissions_read ON public.submissions
FOR SELECT TO authenticated
USING (submitter_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS submissions_staff_update ON public.submissions;
CREATE POLICY submissions_staff_update ON public.submissions
FOR UPDATE TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS audit_staff_read ON public.audit_log;
CREATE POLICY audit_staff_read ON public.audit_log
FOR SELECT TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS clicks_staff_read ON public.outbound_clicks;
CREATE POLICY clicks_staff_read ON public.outbound_clicks
FOR SELECT TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS imports_staff_read ON public.import_runs;
CREATE POLICY imports_staff_read ON public.import_runs
FOR SELECT TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS imports_staff_write ON public.import_runs;
CREATE POLICY imports_staff_write ON public.import_runs
FOR ALL TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS domains_staff ON public.domain_rules;
CREATE POLICY domains_staff ON public.domain_rules
FOR ALL TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS dead_letters_staff ON public.dead_letters;
CREATE POLICY dead_letters_staff ON public.dead_letters
FOR SELECT TO authenticated
USING (public.is_staff());

REVOKE ALL ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, role, display_name, email, phone, country_code, created_at, updated_at) ON public.profiles TO authenticated;
GRANT UPDATE (display_name, phone, country_code) ON public.profiles TO authenticated;

REVOKE ALL ON public.matches FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.matches TO anon, authenticated;

REVOKE ALL ON public.ticket_offers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ticket_offers TO anon, authenticated;

REVOKE ALL ON public.ticket_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ticket_requests TO authenticated;

REVOKE ALL ON public.academies FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.academies TO anon, authenticated;
GRANT UPDATE (name, description, address, contact_email, phone, website, age_groups, facilities) ON public.academies TO authenticated;

REVOKE ALL ON public.submissions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.submissions TO authenticated;

REVOKE ALL ON public.audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.audit_log TO authenticated;

REVOKE ALL ON public.outbound_clicks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.outbound_clicks TO authenticated;

REVOKE ALL ON public.import_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.import_runs TO authenticated;

REVOKE ALL ON public.domain_rules FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.dead_letters FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.dead_letters TO authenticated;

GRANT SELECT ON public.countries, public.cities, public.venues, public.teams, public.competitions, public.seasons, public.academy_matches TO anon, authenticated;

REVOKE ALL ON FUNCTION public.create_submission(public.submission_entity, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_submission(public.submission_entity, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.set_user_role(uuid, public.user_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, public.user_role) TO authenticated;

REVOKE ALL ON FUNCTION public.write_audit(text, text, uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.write_audit(text, text, uuid, jsonb, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO anon, authenticated;

CREATE OR REPLACE VIEW public.match_directory
WITH (security_invoker = true) AS
SELECT
  m.id,
  m.slug,
  c.name AS competition_name,
  c.slug AS competition_slug,
  c.kind,
  s.name AS season_name,
  s.slug AS season_slug,
  home.name AS home_name,
  home.short_name AS home_short,
  home.slug AS home_slug,
  away.name AS away_name,
  away.short_name AS away_short,
  away.slug AS away_slug,
  v.name AS venue_name,
  v.slug AS venue_slug,
  COALESCE(v.address, '') AS venue_address,
  city.name AS city_name,
  city.slug AS city_slug,
  country.name AS country_name,
  country.slug AS country_slug,
  m.starts_at,
  m.ends_at,
  m.source_timezone,
  m.format,
  m.status,
  m.attendance_type,
  m.source_type,
  m.source_external_id,
  m.source_url,
  m.source_label,
  m.featured_rank,
  m.last_verified_at,
  m.published_at,
  m.entry_notes,
  (
    SELECT a.slug
    FROM public.academy_matches am
    JOIN public.academies a ON a.id = am.academy_id
    WHERE am.match_id = m.id
    LIMIT 1
  ) AS academy_slug,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'sellerName', o.seller_name,
        'sellerDomain', o.seller_domain,
        'url', o.url,
        'kind', o.kind,
        'currency', o.currency,
        'priceFrom', o.price_from,
        'status', o.status,
        'lastCheckedAt', o.last_checked_at,
        'approved', o.approved_by IS NOT NULL
      )
    )
    FROM public.ticket_offers o
    WHERE o.match_id = m.id
      AND o.approved_by IS NOT NULL
      AND o.status IN ('active', 'sold_out', 'expired')
  ), '[]'::jsonb) AS offers
FROM public.matches m
JOIN public.competitions c ON c.id = m.competition_id
JOIN public.teams home ON home.id = m.home_team_id
JOIN public.teams away ON away.id = m.away_team_id
LEFT JOIN public.seasons s ON s.id = m.season_id
LEFT JOIN public.venues v ON v.id = m.venue_id
LEFT JOIN public.cities city ON city.id = v.city_id
LEFT JOIN public.countries country ON country.id = city.country_id
WHERE m.status IN ('published', 'postponed', 'cancelled', 'completed')
  AND m.source_url IS NOT NULL;

CREATE OR REPLACE VIEW public.academy_directory
WITH (security_invoker = true) AS
SELECT
  a.id,
  a.slug,
  a.name,
  a.description,
  a.address,
  city.name AS city_name,
  city.slug AS city_slug,
  country.name AS country_name,
  country.slug AS country_slug,
  a.website,
  a.phone,
  a.contact_email,
  a.age_groups,
  a.facilities,
  a.verification_status,
  a.verification_label,
  a.last_verified_at
FROM public.academies a
LEFT JOIN public.cities city ON city.id = a.city_id
LEFT JOIN public.countries country ON country.id = city.country_id
WHERE a.verification_status = 'verified';

GRANT SELECT ON public.match_directory, public.academy_directory TO anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    EXECUTE 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY';
  END IF;
END
$$;
