/*
  # Système de Gestion des Taux de Change

  ## Description
  Cette migration ajoute un système complet de gestion des taux de change pour les transactions.
  Le taux peut être configuré globalement et sera figé au moment de chaque transaction.

  ## 1. Nouvelle Table

  ### exchange_rates
  Table des taux de change configurés
  - `id` (uuid, primary key) - Identifiant unique
  - `devise_source` (text) - Devise source (USD, CDF)
  - `devise_destination` (text) - Devise destination (USD, CDF)
  - `taux` (numeric) - Taux de change (ex: 1 USD = 2700 CDF, donc taux = 2700)
  - `actif` (boolean) - Si ce taux est actif (un seul taux actif par paire)
  - `date_debut` (timestamptz) - Date de début de validité
  - `date_fin` (timestamptz) - Date de fin de validité (optionnel)
  - `notes` (text) - Notes/commentaires
  - `created_by` (uuid) - Utilisateur créateur
  - `created_at` (timestamptz) - Date de création
  - `updated_at` (timestamptz) - Date de mise à jour

  ## 2. Contraintes
  - Un seul taux actif par paire de devises à un moment donné
  - Le taux doit être positif
  - Les devises source et destination doivent être différentes

  ## 3. Sécurité (RLS)
  - Lecture publique pour les utilisateurs authentifiés
  - Modification restreinte aux gérants, propriétaires et administrateurs uniquement

  ## 4. Note
  Les champs taux_change et paire_devises seront ajoutés aux tables de transactions
  lors du déploiement du système de transactions multi-lignes.
*/

-- Fonction utilitaire pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Création de la table exchange_rates
CREATE TABLE IF NOT EXISTS exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devise_source text NOT NULL CHECK (devise_source IN ('USD', 'CDF')),
  devise_destination text NOT NULL CHECK (devise_destination IN ('USD', 'CDF')),
  taux numeric NOT NULL CHECK (taux > 0),
  actif boolean NOT NULL DEFAULT true,
  date_debut timestamptz NOT NULL DEFAULT now(),
  date_fin timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (devise_source != devise_destination),
  CHECK (date_fin IS NULL OR date_fin > date_debut)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_exchange_rates_actif ON exchange_rates(actif) WHERE actif = true;
CREATE INDEX IF NOT EXISTS idx_exchange_rates_paire ON exchange_rates(devise_source, devise_destination);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_date_debut ON exchange_rates(date_debut DESC);

-- Fonction pour s'assurer qu'un seul taux est actif par paire
CREATE OR REPLACE FUNCTION ensure_single_active_rate()
RETURNS trigger AS $$
BEGIN
  IF NEW.actif = true THEN
    -- Désactiver tous les autres taux actifs pour cette paire
    UPDATE exchange_rates
    SET actif = false, updated_at = now()
    WHERE devise_source = NEW.devise_source
    AND devise_destination = NEW.devise_destination
    AND actif = true
    AND id != NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ensure_single_active_rate ON exchange_rates;
CREATE TRIGGER trigger_ensure_single_active_rate
  BEFORE INSERT OR UPDATE ON exchange_rates
  FOR EACH ROW
  WHEN (NEW.actif = true)
  EXECUTE FUNCTION ensure_single_active_rate();

-- Trigger pour mettre à jour updated_at
DROP TRIGGER IF EXISTS trigger_update_exchange_rates_updated_at ON exchange_rates;
CREATE TRIGGER trigger_update_exchange_rates_updated_at
  BEFORE UPDATE ON exchange_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Fonction pour obtenir le taux actif pour une paire de devises
CREATE OR REPLACE FUNCTION get_active_exchange_rate(
  p_devise_source text,
  p_devise_destination text
)
RETURNS numeric AS $$
DECLARE
  v_taux numeric;
BEGIN
  SELECT taux INTO v_taux
  FROM exchange_rates
  WHERE devise_source = p_devise_source
  AND devise_destination = p_devise_destination
  AND actif = true
  AND date_debut <= now()
  AND (date_fin IS NULL OR date_fin > now())
  LIMIT 1;

  -- Si aucun taux trouvé dans le sens demandé, chercher l'inverse
  IF v_taux IS NULL THEN
    SELECT (1.0 / taux) INTO v_taux
    FROM exchange_rates
    WHERE devise_source = p_devise_destination
    AND devise_destination = p_devise_source
    AND actif = true
    AND date_debut <= now()
    AND (date_fin IS NULL OR date_fin > now())
    LIMIT 1;
  END IF;

  RETURN v_taux;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- Policies pour exchange_rates
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent lire les taux de change" ON exchange_rates;
CREATE POLICY "Utilisateurs authentifiés peuvent lire les taux de change"
  ON exchange_rates
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Gérants et propriétaires peuvent insérer des taux de change" ON exchange_rates;
CREATE POLICY "Gérants et propriétaires peuvent insérer des taux de change"
  ON exchange_rates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.actif = true
      AND users.role IN ('gerant', 'proprietaire', 'administrateur')
    )
  );

DROP POLICY IF EXISTS "Gérants et propriétaires peuvent modifier des taux de change" ON exchange_rates;
CREATE POLICY "Gérants et propriétaires peuvent modifier des taux de change"
  ON exchange_rates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.actif = true
      AND users.role IN ('gerant', 'proprietaire', 'administrateur')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.actif = true
      AND users.role IN ('gerant', 'proprietaire', 'administrateur')
    )
  );

-- Vue pour faciliter la consultation des taux actifs
CREATE OR REPLACE VIEW v_active_exchange_rates AS
SELECT
  id,
  devise_source,
  devise_destination,
  taux,
  date_debut,
  date_fin,
  notes,
  created_by,
  created_at
FROM exchange_rates
WHERE actif = true
AND date_debut <= now()
AND (date_fin IS NULL OR date_fin > now())
ORDER BY devise_source, devise_destination;

-- Insertion du taux par défaut
INSERT INTO exchange_rates (devise_source, devise_destination, taux, actif, notes)
VALUES
  ('USD', 'CDF', 2700, true, 'Taux de change initial USD vers CDF')
ON CONFLICT DO NOTHING;

-- Commentaires sur la table et colonnes
COMMENT ON TABLE exchange_rates IS 'Table des taux de change configurables pour les transactions';
COMMENT ON COLUMN exchange_rates.taux IS 'Taux de change: 1 unité de devise_source = taux unités de devise_destination';
COMMENT ON COLUMN exchange_rates.actif IS 'Un seul taux actif par paire à la fois';
COMMENT ON COLUMN exchange_rates.devise_source IS 'Devise source (USD ou CDF)';
COMMENT ON COLUMN exchange_rates.devise_destination IS 'Devise de destination (USD ou CDF)';
COMMENT ON COLUMN exchange_rates.date_debut IS 'Date de début de validité du taux';
COMMENT ON COLUMN exchange_rates.date_fin IS 'Date de fin de validité du taux (NULL = indéfini)';
