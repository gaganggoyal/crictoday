-- cricketmatch.today schema for MySQL 8.0.
-- Times are UTC. Rows mirror the app types in lib/domain/types.ts.

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) NOT NULL,
  email VARCHAR(254) NOT NULL,
  role ENUM('fan', 'academy_owner', 'organiser', 'moderator', 'admin') NOT NULL DEFAULT 'fan',
  display_name VARCHAR(120) NOT NULL,
  country_code VARCHAR(56) NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS magic_links (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  email VARCHAR(254) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (token_hash),
  KEY magic_links_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS matches (
  id VARCHAR(64) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  competition_name VARCHAR(160) NOT NULL,
  competition_slug VARCHAR(160) NOT NULL,
  kind ENUM('international', 'league', 'domestic', 'academy') NOT NULL,
  season_name VARCHAR(80) NULL,
  season_slug VARCHAR(80) NULL,
  home_name VARCHAR(120) NOT NULL,
  home_short VARCHAR(12) NOT NULL,
  home_slug VARCHAR(120) NOT NULL,
  away_name VARCHAR(120) NOT NULL,
  away_short VARCHAR(12) NOT NULL,
  away_slug VARCHAR(120) NOT NULL,
  venue_name VARCHAR(160) NOT NULL,
  venue_slug VARCHAR(160) NOT NULL,
  venue_address VARCHAR(300) NOT NULL,
  city_name VARCHAR(120) NOT NULL,
  city_slug VARCHAR(120) NOT NULL,
  country_name VARCHAR(120) NOT NULL,
  country_slug VARCHAR(120) NOT NULL,
  starts_at DATETIME(3) NOT NULL,
  ends_at DATETIME(3) NULL,
  timezone VARCHAR(64) NOT NULL,
  format ENUM('test', 'odi', 't20', 't10', 'hundred', 'other') NOT NULL,
  status ENUM('draft', 'pending', 'published', 'postponed', 'cancelled', 'completed') NOT NULL,
  attendance_type ENUM('ticketed', 'free', 'private', 'unknown') NOT NULL,
  source_type ENUM('api', 'organiser', 'academy', 'admin') NOT NULL,
  source_external_id VARCHAR(120) NULL,
  source_url VARCHAR(2048) NULL,
  source_label VARCHAR(120) NOT NULL,
  featured_rank INT NOT NULL DEFAULT 0,
  last_verified_at DATETIME(3) NULL,
  published_at DATETIME(3) NULL,
  entry_notes TEXT NULL,
  demo TINYINT(1) NOT NULL DEFAULT 0,
  academy_slug VARCHAR(160) NULL,
  submitted_by VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY matches_slug (slug),
  KEY matches_status_starts (status, starts_at),
  KEY matches_external (source_external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ticket_offers (
  id VARCHAR(64) NOT NULL,
  match_id VARCHAR(64) NOT NULL,
  seller_name VARCHAR(120) NOT NULL,
  seller_domain VARCHAR(253) NOT NULL,
  url VARCHAR(2048) NOT NULL,
  kind ENUM('official', 'authorised_partner', 'affiliate') NOT NULL,
  currency CHAR(3) NULL,
  price_from DECIMAL(10, 2) NULL,
  status ENUM('pending', 'active', 'sold_out', 'expired', 'rejected') NOT NULL,
  last_checked_at DATETIME(3) NULL,
  approved TINYINT(1) NOT NULL DEFAULT 0,
  approved_by VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY ticket_offers_match_status (match_id, status),
  CONSTRAINT ticket_offers_match FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS academies (
  id VARCHAR(64) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  name VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  address VARCHAR(300) NOT NULL,
  city_name VARCHAR(120) NOT NULL,
  city_slug VARCHAR(120) NOT NULL,
  country_name VARCHAR(120) NOT NULL,
  country_slug VARCHAR(120) NOT NULL,
  website VARCHAR(2048) NULL,
  phone VARCHAR(40) NULL,
  contact_email VARCHAR(254) NULL,
  age_groups JSON NOT NULL,
  facilities JSON NOT NULL,
  verification_status ENUM('unverified', 'pending', 'verified', 'rejected') NOT NULL,
  verification_label VARCHAR(80) NULL,
  last_verified_at DATETIME(3) NULL,
  owner_id VARCHAR(64) NULL,
  owner_email VARCHAR(254) NULL,
  demo TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY academies_slug (slug),
  KEY academies_verification (verification_status),
  KEY academies_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS submissions (
  id VARCHAR(64) NOT NULL,
  entity_type ENUM('match', 'academy', 'ticket_offer', 'correction') NOT NULL,
  payload JSON NOT NULL,
  submitter_id VARCHAR(64) NULL,
  submitter_email VARCHAR(254) NULL,
  status ENUM('pending', 'in_review', 'approved', 'rejected', 'changes_requested') NOT NULL,
  duplicate_of VARCHAR(160) NULL,
  reviewer_id VARCHAR(64) NULL,
  reviewer_email VARCHAR(254) NULL,
  reviewer_notes TEXT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY submissions_status_created (status, created_at),
  KEY submissions_submitter (submitter_id),
  KEY submissions_submitter_email (submitter_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ticket_requests (
  id VARCHAR(64) NOT NULL,
  match_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NULL,
  email_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  encrypted_email TEXT NOT NULL,
  quantity TINYINT UNSIGNED NOT NULL,
  country_code VARCHAR(56) NULL,
  notes VARCHAR(240) NULL,
  consent_at DATETIME(3) NOT NULL,
  verified_at DATETIME(3) NULL,
  status ENUM('pending_verification', 'active', 'notified', 'unsubscribed', 'expired') NOT NULL,
  verify_token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  unsub_token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL,
  -- One open alert per address and match. Closed requests leave the key NULL.
  open_key VARCHAR(140) GENERATED ALWAYS AS (
    CASE WHEN status IN ('pending_verification', 'active', 'notified')
      THEN CONCAT(match_id, ':', email_hash) END
  ) VIRTUAL,
  PRIMARY KEY (id),
  UNIQUE KEY ticket_requests_verify (verify_token_hash),
  UNIQUE KEY ticket_requests_unsub (unsub_token_hash),
  UNIQUE KEY ticket_requests_open (open_key),
  KEY ticket_requests_match_status (match_id, status),
  KEY ticket_requests_email (email_hash),
  KEY ticket_requests_user (user_id),
  CONSTRAINT ticket_requests_match FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id VARCHAR(64) NULL,
  actor_email VARCHAR(254) NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id VARCHAR(64) NULL,
  before_state JSON NULL,
  after_state JSON NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY audit_log_created (created_at),
  KEY audit_log_entity (entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS outbound_clicks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  match_id VARCHAR(64) NOT NULL,
  offer_id VARCHAR(64) NOT NULL,
  referrer VARCHAR(300) NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY outbound_clicks_offer (offer_id, created_at),
  CONSTRAINT outbound_clicks_match FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE CASCADE,
  CONSTRAINT outbound_clicks_offer FOREIGN KEY (offer_id) REFERENCES ticket_offers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS import_runs (
  id VARCHAR(64) NOT NULL,
  provider VARCHAR(40) NOT NULL,
  started_at DATETIME(3) NOT NULL,
  finished_at DATETIME(3) NULL,
  fetched_count INT NOT NULL DEFAULT 0,
  inserted_count INT NOT NULL DEFAULT 0,
  updated_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  status ENUM('running', 'succeeded', 'failed', 'skipped') NOT NULL,
  error_summary TEXT NULL,
  PRIMARY KEY (id),
  KEY import_runs_started (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS dead_letters (
  id VARCHAR(64) NOT NULL,
  provider VARCHAR(40) NOT NULL,
  reason TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY dead_letters_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS domain_rules (
  host VARCHAR(253) NOT NULL,
  decision ENUM('allow', 'deny') NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (host)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS rate_limits (
  key_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  hits INT UNSIGNED NOT NULL,
  reset_at DATETIME(3) NOT NULL,
  PRIMARY KEY (key_hash),
  KEY rate_limits_reset (reset_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
