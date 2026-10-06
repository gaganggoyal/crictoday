-- Self-serve profiles for academies, clubs, committees and grounds, with what they offer, and
-- the Indian state of each profile and match so the site can be browsed by state and city.

ALTER TABLE academies
  ADD COLUMN kind ENUM('academy', 'club', 'committee', 'ground') NOT NULL DEFAULT 'academy' AFTER slug,
  ADD COLUMN state_name VARCHAR(120) NULL AFTER city_slug,
  ADD COLUMN state_slug VARCHAR(120) NULL AFTER state_name,
  ADD COLUMN timezone VARCHAR(64) NULL AFTER country_slug,
  ADD COLUMN whatsapp VARCHAR(40) NULL AFTER phone,
  ADD COLUMN links JSON NULL AFTER contact_email,
  ADD COLUMN offerings JSON NULL AFTER facilities,
  ADD COLUMN review_notes VARCHAR(500) NULL AFTER verification_label,
  ADD KEY academies_place (country_slug, state_slug, city_slug);

ALTER TABLE matches
  MODIFY kind ENUM('international', 'league', 'domestic', 'academy', 'local') NOT NULL,
  ADD COLUMN state_name VARCHAR(120) NULL AFTER city_slug,
  ADD COLUMN state_slug VARCHAR(120) NULL AFTER state_name,
  ADD KEY matches_place (country_slug, state_slug, city_slug),
  ADD KEY matches_academy (academy_slug);
