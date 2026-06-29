-- Exécuter dans SQL Editor de Neon
ALTER TABLE membres ADD COLUMN IF NOT EXISTS pole_jours JSONB DEFAULT '{}';

-- Ajouter la colonne niveaux_poles (niveau par pôle)
ALTER TABLE membres ADD COLUMN IF NOT EXISTS niveaux_poles JSONB DEFAULT '{}';
