-- Exécuter dans SQL Editor de Neon

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO settings (key, value) VALUES ('admin_password', 'rocher2026') ON CONFLICT DO NOTHING;
INSERT INTO settings (key, value) VALUES ('membre_password', 'technique2026') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS membres (
  id TEXT PRIMARY KEY,
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  poles TEXT[] NOT NULL DEFAULT '{}',
  fait_mercredi BOOLEAN NOT NULL DEFAULT false,
  niveau TEXT NOT NULL DEFAULT 'intermediaire',
  est_referent_poles TEXT[] NOT NULL DEFAULT '{}',
  est_occasionnel BOOLEAN NOT NULL DEFAULT false,
  autre_service TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS autre_service_dates (
  id SERIAL PRIMARY KEY,
  membre_id TEXT REFERENCES membres(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  UNIQUE(membre_id, date)
);

CREATE TABLE IF NOT EXISTS liens (
  id SERIAL PRIMARY KEY,
  membre_id TEXT REFERENCES membres(id) ON DELETE CASCADE,
  ext_nom TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS indispos (
  id SERIAL PRIMARY KEY,
  membre_id TEXT REFERENCES membres(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  UNIQUE(membre_id, date)
);

CREATE TABLE IF NOT EXISTS ext_planning (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  noms TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS planning (
  id SERIAL PRIMARY KEY,
  periode TEXT NOT NULL,
  date TEXT NOT NULL,
  pole TEXT NOT NULL,
  valeur TEXT NOT NULL,
  UNIQUE(periode, date, pole)
);

-- Nettoyage auto indispos > 4 mois (à appeler manuellement ou via cron)
-- DELETE FROM indispos WHERE date < NOW() - INTERVAL '4 months';
