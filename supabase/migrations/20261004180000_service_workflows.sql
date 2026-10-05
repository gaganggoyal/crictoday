-- Service-role workflows. The Next.js server checks the session, then calls these
-- functions with the secret key. anon and authenticated cannot execute them.
-- Run this after 20261004120000_init.sql. Do not run supabase/tests/bootstrap.sql
-- on a hosted project.

CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claim text;
BEGIN
  claim := nullif(current_setting('request.jwt.claim.role', true), '');
  IF claim IS NULL THEN
    BEGIN
      claim := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
    EXCEPTION WHEN OTHERS THEN
      claim := NULL;
    END;
  END IF;
  RETURN claim = 'service_role';
END;
$$;

CREATE OR REPLACE FUNCTION public.slugify(value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  slug text := lower(coalesce(value, ''));
BEGIN
  slug := translate(slug, 'àáâãäåèéêëìíîïòóôõöùúûüýñç', 'aaaaaaeeeeiiiiooooouuuuync');
  slug := replace(slug, '&', ' and ');
  slug := regexp_replace(slug, '[^a-z0-9]+', '-', 'g');
  slug := trim(BOTH '-' FROM slug);
  slug := left(slug, 90);
  IF slug = '' THEN
    RETURN 'item';
  END IF;
  RETURN slug;
END;
$$;

CREATE OR REPLACE FUNCTION public.https_url(value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  trimmed text := btrim(coalesce(value, ''));
  host text;
  rest text;
BEGIN
  IF trimmed !~* '^https://' THEN
    RETURN NULL;
  END IF;
  IF trimmed ~ '://[^/]*@' THEN
    RETURN NULL;
  END IF;
  rest := regexp_replace(trimmed, '^https://', '');
  host := lower(split_part(split_part(rest, '/', 1), ':', 1));
  host := regexp_replace(host, '^www\.', '');
  IF host = '' OR host = 'localhost' OR host LIKE '%.local' OR host LIKE '%.localhost' THEN
    RETURN NULL;
  END IF;
  IF host IN (
    'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'cutt.ly',
    'rb.gy', 'shorturl.at', 'tiny.cc', 'buff.ly', 'rebrand.ly'
  ) THEN
    RETURN NULL;
  END IF;
  RETURN trimmed;
END;
$$;

CREATE OR REPLACE FUNCTION public.url_host(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(
    lower(split_part(split_part(regexp_replace(public.https_url(value), '^https://', ''), '/', 1), ':', 1)),
    '^www\.',
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.domain_denied(host text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.domain_rules
    WHERE decision = 'deny'
      AND (
        lower(host) = lower(domain_rules.host)
        OR lower(host) LIKE '%.' || lower(domain_rules.host)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.unique_academy_slug(p_base text)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  root text := public.slugify(p_base);
  candidate text := root;
  n integer := 2;
BEGIN
  WHILE EXISTS (SELECT 1 FROM public.academies AS academy WHERE academy.slug = candidate) LOOP
    candidate := root || '-' || n;
    n := n + 1;
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_profile_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.unique_match_slug(p_base text)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  root text := public.slugify(p_base);
  candidate text := root;
  n integer := 2;
BEGIN
  WHILE EXISTS (SELECT 1 FROM public.matches AS fixture WHERE fixture.slug = candidate) LOOP
    candidate := root || '-' || n;
    n := n + 1;
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_country(p_name text, p_timezone text)
RETURNS bigint
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_slug text := public.slugify(p_name);
  v_id bigint;
  v_iso text;
  v_n integer := 0;
BEGIN
  IF btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Enter the country.';
  END IF;
  SELECT id INTO v_id FROM public.countries WHERE slug = v_slug;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;
  v_iso := upper(substr(regexp_replace(v_slug, '[^a-z]', '', 'g'), 1, 2));
  IF length(v_iso) < 2 THEN
    v_iso := 'ZZ';
  END IF;
  WHILE EXISTS (SELECT 1 FROM public.countries WHERE iso2 = v_iso) LOOP
    v_n := v_n + 1;
    v_iso := upper(substr(md5(v_slug || v_n::text), 1, 2));
    IF v_n > 8 THEN
      v_iso := 'X' || substr(md5(v_slug || v_n::text), 1, 6);
      EXIT;
    END IF;
  END LOOP;
  BEGIN
    INSERT INTO public.countries (iso2, name, slug, timezone_default)
    VALUES (v_iso, btrim(p_name), v_slug, coalesce(nullif(btrim(p_timezone), ''), 'UTC'))
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_id FROM public.countries WHERE slug = v_slug;
  END;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Could not save the country.';
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_city(p_country bigint, p_name text)
RETURNS bigint
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_slug text := public.slugify(p_name);
  v_id bigint;
BEGIN
  IF btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Enter the city.';
  END IF;
  SELECT id INTO v_id FROM public.cities WHERE country_id = p_country AND slug = v_slug;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;
  BEGIN
    INSERT INTO public.cities (country_id, name, slug)
    VALUES (p_country, btrim(p_name), v_slug)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_id FROM public.cities WHERE country_id = p_country AND slug = v_slug;
  END;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Could not save the city.';
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_venue(p_city bigint, p_name text, p_city_name text)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_slug text := public.slugify(p_name);
  v_id uuid;
BEGIN
  IF btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Enter the venue.';
  END IF;
  SELECT id INTO v_id FROM public.venues WHERE city_id = p_city AND slug = v_slug;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;
  BEGIN
    INSERT INTO public.venues (city_id, name, slug, address, verification_status)
    VALUES (p_city, btrim(p_name), v_slug, btrim(p_name) || ', ' || coalesce(p_city_name, ''), 'unverified')
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_id FROM public.venues WHERE city_id = p_city AND slug = v_slug;
  END;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Could not save the venue.';
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_team(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_slug text := public.slugify(p_name);
  v_id uuid;
  v_short text;
BEGIN
  IF btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Enter the team.';
  END IF;
  SELECT id INTO v_id FROM public.teams WHERE slug = v_slug;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;
  v_short := upper(substr(regexp_replace(p_name, '[^A-Za-z0-9]', '', 'g'), 1, 3));
  IF length(v_short) < 2 THEN
    v_short := 'TM';
  END IF;
  BEGIN
    INSERT INTO public.teams (name, slug, short_name)
    VALUES (btrim(p_name), v_slug, v_short)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_id FROM public.teams WHERE slug = v_slug;
  END;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Could not save the team.';
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_competition(p_name text, p_kind text)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_slug text := public.slugify(p_name);
  v_id uuid;
  v_kind public.competition_kind;
BEGIN
  IF btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Enter the competition name.';
  END IF;
  SELECT id INTO v_id FROM public.competitions WHERE slug = v_slug;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;
  v_kind := CASE
    WHEN p_kind IN ('international', 'league', 'domestic', 'academy') THEN p_kind::public.competition_kind
    ELSE 'domestic'::public.competition_kind
  END;
  BEGIN
    INSERT INTO public.competitions (name, slug, kind)
    VALUES (btrim(p_name), v_slug, v_kind)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_id FROM public.competitions WHERE slug = v_slug;
  END;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Could not save the competition.';
  END IF;
  RETURN v_id;
END;
$$;

DROP FUNCTION IF EXISTS public.create_submission(public.submission_entity, jsonb);

CREATE OR REPLACE FUNCTION public.create_submission(
  p_entity_type public.submission_entity,
  p_payload jsonb,
  p_submitter_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid := public.uuidv4();
  actor uuid := auth.uid();
  email text;
BEGIN
  IF actor IS NULL THEN
    IF NOT public.is_service_role() THEN
      RAISE EXCEPTION 'authentication required';
    END IF;
    actor := p_submitter_id;
  END IF;
  IF actor IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = actor) THEN
    RAISE EXCEPTION 'submitter not found';
  END IF;
  IF octet_length(coalesce(p_payload, '{}'::jsonb)::text) > 20000 THEN
    RAISE EXCEPTION 'submission is too large';
  END IF;
  email := nullif(lower(btrim(coalesce(p_payload->>'contactEmail', p_payload->>'email', ''))), '');
  INSERT INTO public.submissions (id, entity_type, payload, submitter_id, submitter_email, status)
  VALUES (new_id, p_entity_type, coalesce(p_payload, '{}'::jsonb), actor, email, 'pending');
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_submission(
  p_id uuid,
  p_action text,
  p_reason text,
  p_merge_target text,
  p_actor uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.submissions%ROWTYPE;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_status public.submission_status;
  v_target uuid;
  v_payload jsonb;
  v_source text;
  v_ticket text;
  v_host text;
  v_home uuid;
  v_away uuid;
  v_country bigint;
  v_city bigint;
  v_venue uuid;
  v_comp uuid;
  v_kind text;
  v_source_type public.source_type;
  v_slug text;
  v_match uuid;
  v_owner uuid;
  v_academy uuid;
  v_claim text;
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_actor AND role IN ('moderator', 'admin')
  ) THEN
    RAISE EXCEPTION 'Moderator access is required.';
  END IF;
  SELECT * INTO v_sub FROM public.submissions WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found.';
  END IF;
  IF v_sub.status IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'This submission has already been closed.';
  END IF;
  IF p_action NOT IN ('approve', 'reject', 'changes', 'merge') THEN
    RAISE EXCEPTION 'Choose a decision.';
  END IF;
  IF p_action IN ('reject', 'changes') AND length(v_reason) < 3 THEN
    RAISE EXCEPTION 'A reason is required.';
  END IF;

  IF p_action = 'merge' THEN
    SELECT id INTO v_target FROM public.matches WHERE slug = btrim(coalesce(p_merge_target, ''));
    IF v_target IS NULL THEN
      RAISE EXCEPTION 'Choose the canonical match to merge into.';
    END IF;
    UPDATE public.submissions
    SET status = 'approved', duplicate_of = v_target, reviewer_id = p_actor,
        reviewer_notes = nullif(v_reason, ''), updated_at = now()
    WHERE id = p_id;
    INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, before, after)
    VALUES (p_actor, 'submission.merge', 'submission', p_id,
      jsonb_build_object('status', v_sub.status),
      jsonb_build_object('status', 'approved', 'mergeTarget', v_target));
    RETURN jsonb_build_object('id', p_id);
  END IF;

  IF p_action IN ('reject', 'changes') THEN
    v_status := CASE WHEN p_action = 'reject' THEN 'rejected' ELSE 'changes_requested' END;
    UPDATE public.submissions
    SET status = v_status, reviewer_id = p_actor, reviewer_notes = v_reason, updated_at = now()
    WHERE id = p_id;
    INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, before, after)
    VALUES (p_actor, 'submission.' || p_action, 'submission', p_id,
      jsonb_build_object('status', v_sub.status),
      jsonb_build_object('status', v_status, 'reason', v_reason));
    RETURN jsonb_build_object('id', p_id);
  END IF;

  v_payload := v_sub.payload;
  IF v_sub.entity_type = 'match' THEN
    v_source := public.https_url(v_payload->>'sourceUrl');
    IF v_source IS NULL THEN
      RAISE EXCEPTION 'A source URL is required before publication.';
    END IF;
    IF coalesce(v_payload->>'format', '') NOT IN ('test', 'odi', 't20', 't10', 'hundred', 'other') THEN
      RAISE EXCEPTION 'Choose a format.';
    END IF;
    IF coalesce(v_payload->>'attendanceType', '') NOT IN ('ticketed', 'free', 'private', 'unknown') THEN
      RAISE EXCEPTION 'Choose how people attend.';
    END IF;
    v_home := public.ensure_team(v_payload->>'homeTeam');
    v_away := public.ensure_team(v_payload->>'awayTeam');
    IF v_home = v_away THEN
      RAISE EXCEPTION 'Home and away sides must be different.';
    END IF;
    v_country := public.ensure_country(v_payload->>'country', v_payload->>'timezone');
    v_city := public.ensure_city(v_country, v_payload->>'city');
    v_venue := public.ensure_venue(v_city, v_payload->>'venue', v_payload->>'city');
    v_kind := CASE
      WHEN v_payload->>'organiserType' = 'academy' THEN 'academy'
      WHEN v_payload->>'organiserType' = 'league' THEN 'league'
      ELSE 'domestic'
    END;
    v_source_type := CASE
      WHEN v_payload->>'organiserType' = 'academy' THEN 'academy'::public.source_type
      ELSE 'organiser'::public.source_type
    END;
    v_comp := public.ensure_competition(v_payload->>'competition', v_kind);
    v_slug := public.unique_match_slug(
      coalesce(v_payload->>'homeTeam', '') || '-' || coalesce(v_payload->>'awayTeam', '') || '-' ||
      coalesce(v_payload->>'city', '') || '-' || left(coalesce(v_payload->>'startsAt', ''), 10)
    );
    INSERT INTO public.matches (
      slug, competition_id, home_team_id, away_team_id, venue_id, starts_at, source_timezone,
      format, status, attendance_type, source_type, source_url, source_label, submitted_by,
      last_verified_at, published_at, entry_notes
    ) VALUES (
      v_slug, v_comp, v_home, v_away, v_venue,
      coalesce(v_payload->>'startsAtUtc', v_payload->>'startsAt')::timestamptz,
      coalesce(nullif(v_payload->>'timezone', ''), 'UTC'),
      (v_payload->>'format')::public.match_format,
      'published',
      (v_payload->>'attendanceType')::public.attendance_type,
      v_source_type, v_source, 'Organiser submission', v_sub.submitter_id,
      now(), now(), nullif(btrim(coalesce(v_payload->>'entryNotes', '')), '')
    ) RETURNING id INTO v_match;

    IF coalesce(v_payload->>'attendanceType', '') = 'ticketed'
      AND nullif(btrim(coalesce(v_payload->>'ticketUrl', '')), '') IS NOT NULL THEN
      v_ticket := public.https_url(v_payload->>'ticketUrl');
      IF v_ticket IS NULL THEN
        RAISE EXCEPTION 'The ticket URL failed the HTTPS check.';
      END IF;
      v_host := public.url_host(v_ticket);
      IF public.domain_denied(v_host) THEN
        RAISE EXCEPTION 'That ticket domain is blocked.';
      END IF;
      INSERT INTO public.ticket_offers (match_id, seller_name, seller_domain, url, kind, status, approved_by)
      VALUES (
        v_match,
        coalesce(nullif(btrim(coalesce(v_payload->>'ticketSeller', '')), ''), v_host),
        v_host, v_ticket, 'official', 'pending', NULL
      );
    END IF;

    UPDATE public.submissions
    SET status = 'approved', reviewer_id = p_actor, reviewer_notes = nullif(v_reason, ''), updated_at = now()
    WHERE id = p_id;
    INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, before, after)
    VALUES (p_actor, 'submission.approve', 'submission', p_id, NULL,
      jsonb_build_object('slug', v_slug, 'sourceUrl', v_source, 'matchId', v_match));
    RETURN jsonb_build_object('id', p_id);
  END IF;

  IF v_sub.entity_type = 'academy' THEN
    v_claim := nullif(btrim(coalesce(v_payload->>'claimSlug', '')), '');
    IF v_claim IS NOT NULL THEN
      v_slug := public.slugify(v_claim);
    ELSE
      v_slug := public.unique_academy_slug(v_payload->>'name');
    END IF;
    IF nullif(btrim(coalesce(v_payload->>'website', '')), '') IS NOT NULL
      AND public.https_url(v_payload->>'website') IS NULL THEN
      RAISE EXCEPTION 'Website must be an HTTPS URL.';
    END IF;
    v_country := public.ensure_country(v_payload->>'country', 'UTC');
    v_city := public.ensure_city(v_country, v_payload->>'city');
    SELECT id INTO v_owner FROM public.profiles WHERE id = v_sub.submitter_id;
    IF v_owner IS NULL THEN
      SELECT id INTO v_owner FROM public.profiles
      WHERE lower(email) = lower(coalesce(v_payload->>'contactEmail', ''))
      LIMIT 1;
    END IF;
    SELECT id INTO v_academy FROM public.academies WHERE slug = v_slug;
    IF v_academy IS NULL THEN
      INSERT INTO public.academies (
        owner_id, city_id, name, slug, description, address, contact_email, phone, website,
        age_groups, facilities, verification_status, verification_label, last_verified_at
      ) VALUES (
        v_owner, v_city, btrim(v_payload->>'name'), v_slug,
        coalesce(v_payload->>'description', ''), coalesce(v_payload->>'address', ''),
        nullif(lower(btrim(coalesce(v_payload->>'contactEmail', ''))), ''),
        nullif(btrim(coalesce(v_payload->>'phone', '')), ''),
        public.https_url(v_payload->>'website'),
        coalesce((SELECT array_agg(value) FROM jsonb_array_elements_text(coalesce(v_payload->'ageGroups', '[]'::jsonb))), '{}'),
        coalesce((SELECT array_agg(value) FROM jsonb_array_elements_text(coalesce(v_payload->'facilities', '[]'::jsonb))), '{}'),
        'verified', 'Contact verified', now()
      ) RETURNING id INTO v_academy;
    ELSE
      UPDATE public.academies
      SET owner_id = coalesce(v_owner, owner_id),
          verification_status = 'verified',
          verification_label = 'Contact verified',
          last_verified_at = now(),
          description = coalesce(nullif(v_payload->>'description', ''), description),
          address = coalesce(nullif(v_payload->>'address', ''), address)
      WHERE id = v_academy;
    END IF;
    UPDATE public.submissions
    SET status = 'approved', reviewer_id = p_actor, reviewer_notes = nullif(v_reason, ''), updated_at = now()
    WHERE id = p_id;
    INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, before, after)
    VALUES (p_actor, 'submission.approve', 'submission', p_id, NULL,
      jsonb_build_object('slug', v_slug, 'verificationLabel', 'Contact verified'));
    RETURN jsonb_build_object('id', p_id);
  END IF;

  UPDATE public.submissions
  SET status = 'approved', reviewer_id = p_actor,
      reviewer_notes = coalesce(nullif(v_reason, ''), 'Recorded. Fixture fields were not changed automatically.'),
      updated_at = now()
  WHERE id = p_id;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, before, after)
  VALUES (p_actor, 'submission.approve', 'submission', p_id,
    jsonb_build_object('status', v_sub.status),
    jsonb_build_object('status', 'approved'));
  RETURN jsonb_build_object('id', p_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_role(target uuid, next_role public.user_role, p_actor uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  previous public.user_role;
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_actor AND role IN ('moderator', 'admin')
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  IF target IS NULL OR target = p_actor THEN
    RAISE EXCEPTION 'Choose another account.';
  END IF;
  SELECT role INTO previous FROM public.profiles WHERE id = target;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That person has not signed in yet.';
  END IF;
  UPDATE public.profiles SET role = next_role WHERE id = target;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, before, after)
  VALUES (
    p_actor, 'profile.role', 'profile', target,
    jsonb_build_object('role', previous), jsonb_build_object('role', next_role)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_role_for_account(
  p_account text,
  p_role public.user_role,
  p_actor uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target uuid;
BEGIN
  IF p_account ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT id INTO v_target FROM public.profiles WHERE id = p_account::uuid;
  ELSE
    SELECT id INTO v_target FROM public.profiles WHERE lower(email) = lower(btrim(p_account));
  END IF;
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'That person has not signed in yet.';
  END IF;
  PERFORM public.set_user_role(v_target, p_role, p_actor);
END;
$$;

ALTER TABLE public.ticket_requests
  ADD COLUMN IF NOT EXISTS verify_token_hash text,
  ADD COLUMN IF NOT EXISTS unsub_token_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS ticket_requests_open_email_idx
  ON public.ticket_requests (match_id, email_hash)
  WHERE status IN ('pending_verification', 'active', 'notified');

CREATE UNIQUE INDEX IF NOT EXISTS ticket_requests_verify_hash_idx
  ON public.ticket_requests (verify_token_hash)
  WHERE verify_token_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ticket_requests_unsub_hash_idx
  ON public.ticket_requests (unsub_token_hash)
  WHERE unsub_token_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_ticket_request(
  p_match_slug text,
  p_email_hash text,
  p_encrypted_email text,
  p_quantity integer,
  p_country_code text,
  p_notes text,
  p_verify_hash text,
  p_unsub_hash text,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
  v_existing uuid;
  v_id uuid;
  v_user uuid;
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  IF p_quantity < 1 OR p_quantity > 10 THEN
    RAISE EXCEPTION 'Quantity must be between 1 and 10.';
  END IF;
  IF length(coalesce(p_verify_hash, '')) < 32 OR length(coalesce(p_unsub_hash, '')) < 32 THEN
    RAISE EXCEPTION 'Alert token is missing.';
  END IF;
  SELECT * INTO v_match FROM public.matches WHERE slug = p_match_slug;
  IF NOT FOUND OR v_match.source_url IS NULL OR v_match.status IN ('cancelled', 'completed', 'draft', 'pending') THEN
    RAISE EXCEPTION 'Alerts are closed for this match.';
  END IF;
  SELECT id INTO v_existing
  FROM public.ticket_requests
  WHERE match_id = v_match.id
    AND email_hash = p_email_hash
    AND status IN ('pending_verification', 'active', 'notified')
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('id', v_existing, 'already', true);
  END IF;
  v_user := p_user_id;
  IF v_user IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user) THEN
    v_user := NULL;
  END IF;
  INSERT INTO public.ticket_requests (
    match_id, user_id, email_hash, encrypted_email, quantity, country_code, notes,
    consent_at, status, verify_token_hash, unsub_token_hash
  ) VALUES (
    v_match.id, v_user, p_email_hash, p_encrypted_email, p_quantity,
    nullif(btrim(coalesce(p_country_code, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''),
    now(), 'pending_verification', p_verify_hash, p_unsub_hash
  ) RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'already', false);
EXCEPTION WHEN unique_violation THEN
  SELECT id INTO v_existing
  FROM public.ticket_requests
  WHERE match_id = v_match.id AND email_hash = p_email_hash
    AND status IN ('pending_verification', 'active', 'notified')
  LIMIT 1;
  RETURN jsonb_build_object('id', v_existing, 'already', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.open_ticket_request(p_token_hash text, p_intent text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.ticket_requests%ROWTYPE;
  v_match public.matches%ROWTYPE;
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  IF p_intent = 'unsubscribe' THEN
    SELECT * INTO v_req FROM public.ticket_requests
    WHERE unsub_token_hash = p_token_hash OR verify_token_hash = p_token_hash
    LIMIT 1;
  ELSE
    SELECT * INTO v_req FROM public.ticket_requests WHERE verify_token_hash = p_token_hash LIMIT 1;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This confirmation link is not valid.';
  END IF;
  SELECT * INTO v_match FROM public.matches WHERE id = v_req.match_id;
  IF p_intent = 'unsubscribe' THEN
    UPDATE public.ticket_requests SET status = 'unsubscribed' WHERE id = v_req.id;
    INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, before, after)
    VALUES (NULL, 'ticket_request.unsubscribed', 'ticket_request', v_req.id,
      jsonb_build_object('status', v_req.status), jsonb_build_object('status', 'unsubscribed'));
    RETURN jsonb_build_object('match_slug', v_match.slug, 'intent', 'unsubscribe');
  END IF;
  IF v_req.status = 'unsubscribed' THEN
    RAISE EXCEPTION 'This alert was unsubscribed.';
  END IF;
  IF v_match.id IS NULL OR v_match.starts_at <= now() OR v_match.status = 'cancelled' THEN
    UPDATE public.ticket_requests SET status = 'expired' WHERE id = v_req.id;
    RAISE EXCEPTION 'This match has started or been cancelled, so the alert was not activated.';
  END IF;
  IF v_req.status IN ('active', 'notified') THEN
    RETURN jsonb_build_object('match_slug', v_match.slug, 'intent', 'verify');
  END IF;
  UPDATE public.ticket_requests
  SET status = 'active', verified_at = now()
  WHERE id = v_req.id;
  RETURN jsonb_build_object('match_slug', v_match.slug, 'intent', 'verify');
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_ticket_offer(
  p_offer_id uuid,
  p_match_slug text,
  p_actor uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.ticket_offers%ROWTYPE;
  v_match public.matches%ROWTYPE;
  v_home text;
  v_away text;
  v_venue text;
  v_city text;
  v_host text;
  v_emails jsonb := '[]'::jsonb;
  v_req record;
  v_count integer := 0;
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_actor AND role IN ('moderator', 'admin')
  ) THEN
    RAISE EXCEPTION 'Moderator access is required.';
  END IF;
  SELECT * INTO v_offer FROM public.ticket_offers WHERE id = p_offer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offer not found.';
  END IF;
  SELECT * INTO v_match FROM public.matches WHERE id = v_offer.match_id;
  IF NOT FOUND OR v_match.slug <> p_match_slug THEN
    RAISE EXCEPTION 'Offer not found.';
  END IF;
  IF v_offer.status <> 'pending' THEN
    RAISE EXCEPTION 'That ticket link is no longer waiting for review.';
  END IF;
  IF public.https_url(v_offer.url) IS NULL THEN
    RAISE EXCEPTION 'The offer URL is not an acceptable HTTPS link.';
  END IF;
  v_host := public.url_host(v_offer.url);
  IF public.domain_denied(v_host) THEN
    RAISE EXCEPTION 'That seller domain is blocked.';
  END IF;
  UPDATE public.ticket_offers
  SET status = 'active', approved_by = p_actor, last_checked_at = now(), updated_at = now()
  WHERE id = v_offer.id;
  INSERT INTO public.domain_rules (host, decision)
  VALUES (v_host, 'allow')
  ON CONFLICT (host) DO NOTHING;

  SELECT home.name, away.name, coalesce(v.name, ''), coalesce(city.name, '')
  INTO v_home, v_away, v_venue, v_city
  FROM public.matches m
  JOIN public.teams home ON home.id = m.home_team_id
  JOIN public.teams away ON away.id = m.away_team_id
  LEFT JOIN public.venues v ON v.id = m.venue_id
  LEFT JOIN public.cities city ON city.id = v.city_id
  WHERE m.id = v_match.id;

  FOR v_req IN
    SELECT id, encrypted_email FROM public.ticket_requests
    WHERE match_id = v_match.id AND status = 'active'
  LOOP
    v_emails := v_emails || jsonb_build_array(jsonb_build_object(
      'to', v_req.encrypted_email,
      'subject', 'Ticket alert: ' || v_home || ' vs ' || v_away,
      'text', concat_ws(E'\n',
        v_home || ' vs ' || v_away,
        v_venue || ', ' || v_city,
        'Seller: ' || v_offer.seller_name,
        'Domain: ' || v_offer.seller_domain,
        'Link: ' || v_offer.url,
        'This alert does not reserve a ticket.'
      )
    ));
    UPDATE public.ticket_requests SET status = 'notified' WHERE id = v_req.id;
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, before, after)
  VALUES (p_actor, 'ticket_offer.approve', 'ticket_offer', v_offer.id,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'active', 'domain', v_offer.seller_domain));
  RETURN jsonb_build_object('notified', v_count, 'emails', v_emails);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_match_verified(p_slug text, p_actor uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_actor AND role IN ('moderator', 'admin')
  ) THEN
    RAISE EXCEPTION 'Moderator access is required.';
  END IF;
  SELECT * INTO v_match FROM public.matches WHERE slug = p_slug;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found.';
  END IF;
  UPDATE public.matches SET last_verified_at = now() WHERE id = v_match.id;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, before, after)
  VALUES (p_actor, 'match.verify', 'match', v_match.id,
    jsonb_build_object('lastVerifiedAt', v_match.last_verified_at),
    jsonb_build_object('lastVerifiedAt', now()));
END;
$$;

CREATE OR REPLACE FUNCTION public.record_outbound_click(p_offer_id uuid, p_referrer text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.ticket_offers%ROWTYPE;
  v_slug text;
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  SELECT * INTO v_offer FROM public.ticket_offers WHERE id = p_offer_id;
  IF NOT FOUND OR v_offer.approved_by IS NULL OR v_offer.status <> 'active' THEN
    RAISE EXCEPTION 'That ticket link is not available.';
  END IF;
  SELECT slug INTO v_slug FROM public.matches WHERE id = v_offer.match_id;
  INSERT INTO public.outbound_clicks (match_id, ticket_offer_id, referrer)
  VALUES (v_offer.match_id, v_offer.id, left(p_referrer, 300));
  RETURN jsonb_build_object(
    'url', v_offer.url,
    'sellerName', v_offer.seller_name,
    'sellerDomain', v_offer.seller_domain,
    'matchSlug', v_slug
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.begin_import_run(p_provider text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  UPDATE public.import_runs
  SET status = 'failed', finished_at = now(), error_summary = 'The previous import did not finish.'
  WHERE status = 'running' AND started_at <= now() - interval '10 minutes';
  IF EXISTS (SELECT 1 FROM public.import_runs WHERE status = 'running') THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.import_runs (provider, status)
  VALUES (coalesce(nullif(btrim(p_provider), ''), 'manual'), 'running')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_import_run(
  p_id uuid,
  p_status public.import_status,
  p_fetched integer,
  p_inserted integer,
  p_updated integer,
  p_failed integer,
  p_error text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  UPDATE public.import_runs
  SET status = p_status,
      finished_at = now(),
      fetched_count = greatest(coalesce(p_fetched, 0), 0),
      inserted_count = greatest(coalesce(p_inserted, 0), 0),
      updated_count = greatest(coalesce(p_updated, 0), 0),
      failed_count = greatest(coalesce(p_failed, 0), 0),
      error_summary = nullif(left(coalesce(p_error, ''), 500), '')
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_dead_letter(p_provider text, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  INSERT INTO public.dead_letters (provider, reason)
  VALUES (coalesce(nullif(btrim(p_provider), ''), 'unknown'), left(coalesce(p_reason, 'Unknown failure.'), 500));
END;
$$;

CREATE OR REPLACE FUNCTION public.provider_match_index()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', m.id,
      'sourceExternalId', m.source_external_id,
      'sourceType', m.source_type,
      'home', home.name,
      'away', away.name,
      'venue', coalesce(v.name, ''),
      'competition', c.name,
      'startsAt', m.starts_at
    ))
    FROM public.matches m
    JOIN public.teams home ON home.id = m.home_team_id
    JOIN public.teams away ON away.id = m.away_team_id
    JOIN public.competitions c ON c.id = m.competition_id
    LEFT JOIN public.venues v ON v.id = m.venue_id
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_provider_plan(p_inserts jsonb, p_updates jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  fixture jsonb;
  v_existing public.matches%ROWTYPE;
  v_home uuid;
  v_away uuid;
  v_country bigint;
  v_city bigint;
  v_venue uuid;
  v_comp uuid;
  v_slug text;
  v_source text;
  v_status public.match_status;
  v_format public.match_format;
  v_start timestamptz;
  inserted integer := 0;
  updated integer := 0;
  skipped integer := 0;
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'service role required';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_inserts, '[]'::jsonb))
  LOOP
    BEGIN
      IF nullif(item->>'externalId', '') IS NULL THEN
        RAISE EXCEPTION 'invalid fixture';
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.matches
        WHERE source_external_id = item->>'externalId'
      ) THEN
        skipped := skipped + 1;
        CONTINUE;
      END IF;
      v_start := (item->>'startsAt')::timestamptz;
      IF EXISTS (
        SELECT 1
        FROM public.matches m
        JOIN public.teams h ON h.id = m.home_team_id
        JOIN public.teams a ON a.id = m.away_team_id
        WHERE m.starts_at BETWEEN v_start - interval '12 hours' AND v_start + interval '12 hours'
          AND (
            (public.slugify(h.name) = public.slugify(item->>'home') AND public.slugify(a.name) = public.slugify(item->>'away'))
            OR (public.slugify(h.name) = public.slugify(item->>'away') AND public.slugify(a.name) = public.slugify(item->>'home'))
          )
      ) THEN
        INSERT INTO public.dead_letters (provider, reason)
        VALUES ('sportmonks', 'Same teams within 12 hours of an existing fixture. Left for moderation.');
        skipped := skipped + 1;
        CONTINUE;
      END IF;
      IF coalesce(item->>'format', '') NOT IN ('test', 'odi', 't20', 't10', 'hundred', 'other') THEN
        RAISE EXCEPTION 'invalid fixture';
      END IF;
      IF coalesce(item->>'status', '') NOT IN ('draft', 'pending', 'published', 'postponed', 'cancelled', 'completed') THEN
        RAISE EXCEPTION 'invalid fixture';
      END IF;
      v_format := (item->>'format')::public.match_format;
      v_status := (item->>'status')::public.match_status;
      v_source := public.https_url(item->>'sourceUrl');
      IF v_source IS NULL OR v_status = 'draft' THEN
        v_status := 'pending';
      END IF;
      v_home := public.ensure_team(item->>'home');
      v_away := public.ensure_team(item->>'away');
      IF v_home = v_away THEN
        RAISE EXCEPTION 'invalid fixture';
      END IF;
      v_country := public.ensure_country(coalesce(item->>'country', 'Unknown'), coalesce(item->>'timezone', 'UTC'));
      v_city := public.ensure_city(v_country, coalesce(item->>'city', 'City to be confirmed'));
      v_venue := public.ensure_venue(v_city, coalesce(item->>'venue', 'Venue to be confirmed'), coalesce(item->>'city', ''));
      v_comp := public.ensure_competition(coalesce(item->>'competition', 'Cricket'), 'domestic');
      v_slug := public.unique_match_slug(
        coalesce(item->>'home', '') || '-' || coalesce(item->>'away', '') || '-' ||
        coalesce(item->>'venue', '') || '-' || left(coalesce(item->>'startsAt', ''), 10)
      );
      INSERT INTO public.matches (
        slug, competition_id, home_team_id, away_team_id, venue_id, starts_at, source_timezone,
        format, status, attendance_type, source_type, source_external_id, source_url, source_label,
        last_verified_at, published_at
      ) VALUES (
        v_slug, v_comp, v_home, v_away, v_venue, v_start,
        coalesce(nullif(item->>'timezone', ''), 'UTC'),
        v_format, v_status, 'unknown', 'api', item->>'externalId', v_source, 'SportMonks',
        now(),
        CASE WHEN v_status IN ('published', 'postponed', 'cancelled', 'completed') AND v_source IS NOT NULL THEN now() ELSE NULL END
      );
      inserted := inserted + 1;
    EXCEPTION WHEN OTHERS THEN
      skipped := skipped + 1;
      INSERT INTO public.dead_letters (provider, reason)
      VALUES ('sportmonks', left(SQLERRM, 500));
    END;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_updates, '[]'::jsonb))
  LOOP
    BEGIN
      fixture := item->'match';
      SELECT * INTO v_existing FROM public.matches WHERE id = (item->>'id')::uuid;
      IF NOT FOUND OR v_existing.source_type IN ('organiser', 'academy') THEN
        skipped := skipped + 1;
        CONTINUE;
      END IF;
      v_start := (fixture->>'startsAt')::timestamptz;
      v_status := (fixture->>'status')::public.match_status;
      v_format := (fixture->>'format')::public.match_format;
      v_source := coalesce(public.https_url(fixture->>'sourceUrl'), v_existing.source_url);
      IF v_status = 'published' AND v_source IS NULL THEN
        v_status := 'pending';
      END IF;
      v_country := public.ensure_country(coalesce(fixture->>'country', 'Unknown'), coalesce(fixture->>'timezone', v_existing.source_timezone));
      v_city := public.ensure_city(v_country, coalesce(fixture->>'city', 'City to be confirmed'));
      v_venue := public.ensure_venue(v_city, coalesce(fixture->>'venue', 'Venue to be confirmed'), coalesce(fixture->>'city', ''));
      UPDATE public.matches
      SET starts_at = v_start,
          status = v_status,
          format = v_format,
          source_timezone = coalesce(nullif(fixture->>'timezone', ''), source_timezone),
          venue_id = v_venue,
          source_external_id = coalesce(fixture->>'externalId', source_external_id),
          source_url = v_source,
          last_verified_at = now(),
          published_at = CASE
            WHEN v_status IN ('published', 'postponed', 'cancelled', 'completed') AND v_source IS NOT NULL
              THEN coalesce(published_at, now())
            ELSE published_at
          END
      WHERE id = v_existing.id;
      updated := updated + 1;
    EXCEPTION WHEN OTHERS THEN
      skipped := skipped + 1;
      INSERT INTO public.dead_letters (provider, reason)
      VALUES ('sportmonks', left(SQLERRM, 500));
    END;
  END LOOP;

  RETURN jsonb_build_object('inserted', inserted, 'updated', updated, 'skipped', skipped);
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_pending_offers(p_external_id text, p_offers jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match uuid;
  offer jsonb;
  v_url text;
  v_host text;
  v_count integer := 0;
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  SELECT id INTO v_match
  FROM public.matches
  WHERE source_type = 'api' AND source_external_id = p_external_id;
  IF v_match IS NULL THEN
    RETURN 0;
  END IF;
  FOR offer IN SELECT value FROM jsonb_array_elements(coalesce(p_offers, '[]'::jsonb))
  LOOP
    v_url := public.https_url(offer->>'url');
    IF v_url IS NULL THEN
      CONTINUE;
    END IF;
    v_host := public.url_host(v_url);
    IF v_host IS NULL OR public.domain_denied(v_host) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.ticket_offers (
      match_id, seller_name, seller_domain, url, kind, currency, price_from, status, last_checked_at, approved_by
    ) VALUES (
      v_match,
      coalesce(nullif(offer->>'sellerName', ''), v_host),
      v_host,
      v_url,
      CASE
        WHEN offer->>'kind' IN ('official', 'authorised_partner', 'affiliate') THEN (offer->>'kind')::public.ticket_kind
        ELSE 'authorised_partner'::public.ticket_kind
      END,
      nullif(offer->>'currency', ''),
      CASE WHEN coalesce(offer->>'priceFrom', '') ~ '^[0-9]+(\.[0-9]+)?$' THEN (offer->>'priceFrom')::numeric ELSE NULL END,
      'pending',
      now(),
      NULL
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text PRIMARY KEY CHECK (key ~ '^[a-f0-9]{64}$'),
  count integer NOT NULL,
  reset_at timestamptz NOT NULL
);

CREATE OR REPLACE FUNCTION public.rate_limit_hit(p_key text, p_limit integer, p_window_ms integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_reset timestamptz;
  v_window interval;
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  IF p_key !~ '^[a-f0-9]{64}$' OR p_limit < 1 OR p_limit > 1000 OR p_window_ms < 1000 OR p_window_ms > 86400000 THEN
    RAISE EXCEPTION 'invalid rate limit';
  END IF;
  DELETE FROM public.rate_limits
  WHERE key IN (
    SELECT key FROM public.rate_limits WHERE reset_at < now() - interval '1 day' LIMIT 20
  );
  v_window := (p_window_ms || ' milliseconds')::interval;
  INSERT INTO public.rate_limits AS rl (key, count, reset_at)
  VALUES (p_key, 1, now() + v_window)
  ON CONFLICT (key) DO UPDATE
  SET count = CASE WHEN rl.reset_at <= now() THEN 1 ELSE rl.count + 1 END,
      reset_at = CASE WHEN rl.reset_at <= now() THEN now() + v_window ELSE rl.reset_at END
  RETURNING rl.count, rl.reset_at INTO v_count, v_reset;
  RETURN jsonb_build_object(
    'ok', v_count <= p_limit,
    'retry_after_ms', greatest(0, floor(extract(epoch FROM (v_reset - now())) * 1000))::integer
  );
END;
$$;

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS submissions_read ON public.submissions;
CREATE POLICY submissions_read ON public.submissions
FOR SELECT TO authenticated
USING (
  public.is_staff()
  OR submitter_id = auth.uid()
  OR (
    submitter_email IS NOT NULL
    AND lower(submitter_email) = lower((SELECT email FROM public.profiles WHERE id = auth.uid()))
  )
);

DROP POLICY IF EXISTS academies_read ON public.academies;
CREATE POLICY academies_read ON public.academies
FOR SELECT TO anon, authenticated
USING (
  verification_status = 'verified'
  OR owner_id = auth.uid()
  OR public.is_staff()
  OR (
    contact_email IS NOT NULL
    AND lower(contact_email) = lower(public.current_profile_email())
  )
);

CREATE OR REPLACE VIEW public.moderation_submissions
WITH (security_invoker = true) AS
SELECT
  s.id,
  s.entity_type::text AS entity_type,
  s.payload,
  s.submitter_id,
  s.submitter_email,
  s.status::text AS status,
  s.duplicate_of::text AS duplicate_of,
  reviewer.email AS reviewer_email,
  s.reviewer_notes,
  s.created_at,
  s.updated_at
FROM public.submissions s
LEFT JOIN public.profiles reviewer ON reviewer.id = s.reviewer_id;

CREATE OR REPLACE VIEW public.moderation_offers
WITH (security_invoker = true) AS
SELECT
  o.id,
  o.status::text AS status,
  o.seller_name,
  o.seller_domain,
  o.url,
  o.kind::text AS kind,
  o.currency,
  o.price_from,
  o.last_checked_at,
  o.approved_by IS NOT NULL AS approved,
  m.slug AS match_slug,
  home.name AS home_name,
  away.name AS away_name,
  home.short_name AS home_short,
  away.short_name AS away_short
FROM public.ticket_offers o
JOIN public.matches m ON m.id = o.match_id
JOIN public.teams home ON home.id = m.home_team_id
JOIN public.teams away ON away.id = m.away_team_id;

CREATE OR REPLACE VIEW public.moderation_audit
WITH (security_invoker = true) AS
SELECT
  a.id::text AS id,
  a.action,
  a.entity_type,
  a.entity_id::text AS entity_id,
  a.before,
  a.after,
  a.created_at,
  p.email AS actor_email
FROM public.audit_log a
LEFT JOIN public.profiles p ON p.id = a.actor_id;

REVOKE ALL ON public.moderation_submissions FROM PUBLIC, anon;
REVOKE ALL ON public.moderation_offers FROM PUBLIC, anon;
REVOKE ALL ON public.moderation_audit FROM PUBLIC, anon;
GRANT SELECT ON public.moderation_submissions TO authenticated;
GRANT SELECT ON public.moderation_offers TO authenticated;
GRANT SELECT ON public.moderation_audit TO authenticated;

REVOKE ALL ON FUNCTION public.is_service_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_service_role() TO service_role;

REVOKE ALL ON FUNCTION public.create_submission(public.submission_entity, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_submission(public.submission_entity, jsonb, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.review_submission(uuid, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_submission(uuid, text, text, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.set_user_role(uuid, public.user_role, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, public.user_role, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.set_user_role_for_account(text, public.user_role, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_role_for_account(text, public.user_role, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.create_ticket_request(text, text, text, integer, text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_ticket_request(text, text, text, integer, text, text, text, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.open_ticket_request(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_ticket_request(text, text) TO service_role;

REVOKE ALL ON FUNCTION public.approve_ticket_offer(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_ticket_offer(uuid, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mark_match_verified(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_match_verified(text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.record_outbound_click(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_outbound_click(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.begin_import_run(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_import_run(text) TO service_role;

REVOKE ALL ON FUNCTION public.finish_import_run(uuid, public.import_status, integer, integer, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finish_import_run(uuid, public.import_status, integer, integer, integer, integer, text) TO service_role;

REVOKE ALL ON FUNCTION public.record_dead_letter(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_dead_letter(text, text) TO service_role;

REVOKE ALL ON FUNCTION public.provider_match_index() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provider_match_index() TO service_role;

REVOKE ALL ON FUNCTION public.apply_provider_plan(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_provider_plan(jsonb, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.attach_pending_offers(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_pending_offers(text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.rate_limit_hit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.slugify(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.https_url(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.url_host(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.domain_denied(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unique_match_slug(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unique_academy_slug(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_profile_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_profile_email() TO anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_country(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_city(bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_venue(bigint, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_team(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_competition(text, text) FROM PUBLIC;
