-- Migration : Tracking UTM / Acquisition
-- À exécuter dans Supabase → SQL Editor

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS utm_source   TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium   TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_content  TEXT;

-- Index pour accélérer les requêtes analytics
CREATE INDEX IF NOT EXISTS idx_users_utm_source ON users(utm_source);

-- Vue pratique pour l'admin (inscriptions par source)
CREATE OR REPLACE VIEW acquisition_stats AS
SELECT
  COALESCE(utm_source, 'direct') AS source,
  COALESCE(utm_medium, 'direct') AS medium,
  utm_campaign,
  COUNT(*) AS inscriptions,
  DATE_TRUNC('day', MIN(created_at)) AS premiere_inscription,
  DATE_TRUNC('day', MAX(created_at)) AS derniere_inscription
FROM users
GROUP BY utm_source, utm_medium, utm_campaign
ORDER BY inscriptions DESC;
