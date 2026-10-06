-- A profile's logo, cover photo and photo gallery. Each holds the id and sizes of WebP files that
-- the app writes under UPLOAD_DIR/profiles and serves from /media/profiles.

ALTER TABLE academies
  ADD COLUMN logo JSON NULL AFTER offerings,
  ADD COLUMN cover JSON NULL AFTER logo,
  ADD COLUMN photos JSON NULL AFTER cover;
