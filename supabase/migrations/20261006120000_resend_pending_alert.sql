-- A ticket alert whose confirmation email never arrived can be requested again. While it waits
-- for confirmation, a new request for the same address and match replaces its links, and the
-- caller sends the confirmation again. Confirmed alerts still answer "already".

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
  v_existing public.ticket_requests%ROWTYPE;
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
  SELECT * INTO v_existing
  FROM public.ticket_requests
  WHERE match_id = v_match.id
    AND email_hash = p_email_hash
    AND status IN ('pending_verification', 'active', 'notified')
  LIMIT 1
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.status = 'pending_verification' THEN
      UPDATE public.ticket_requests
      SET verify_token_hash = p_verify_hash,
          unsub_token_hash = p_unsub_hash,
          quantity = p_quantity,
          country_code = nullif(btrim(coalesce(p_country_code, '')), ''),
          notes = nullif(btrim(coalesce(p_notes, '')), '')
      WHERE id = v_existing.id;
      RETURN jsonb_build_object('id', v_existing.id, 'already', false, 'resent', true);
    END IF;
    RETURN jsonb_build_object('id', v_existing.id, 'already', true);
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
  SELECT * INTO v_existing
  FROM public.ticket_requests
  WHERE match_id = v_match.id AND email_hash = p_email_hash
    AND status IN ('pending_verification', 'active', 'notified')
  LIMIT 1;
  RETURN jsonb_build_object('id', v_existing.id, 'already', true);
END;
$$;
