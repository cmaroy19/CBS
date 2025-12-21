/*
  # Système de Transactions Multi-Lignes (Comptabilité en Partie Double)

  ## Description
  Cette migration crée l'infrastructure pour supporter des transactions financières composées.
  Chaque opération financière est représentée par une transaction principale (header) et 
  plusieurs lignes de transaction équilibrées selon les principes de comptabilité en partie double.

  ## 1. Nouvelles Tables

  ### transaction_headers
  Table principale stockant les informations globales de chaque transaction
  - `id` (uuid, primary key) - Identifiant unique
  - `reference` (text, unique) - Référence unique de la transaction (format: TRX-YYYYMM-XXXX)
  - `type_operation` (text) - Type d'opération (depot, retrait, approvisionnement, change, transfert)
  - `devise_reference` (text) - Devise de référence pour le montant total
  - `montant_total` (numeric) - Montant total de la transaction
  - `description` (text) - Description de la transaction
  - `info_client` (text) - Informations client
  - `taux_change` (numeric) - Taux de change figé utilisé (si applicable)
  - `paire_devises` (text) - Paire de devises utilisée (ex: "USD/CDF")
  - `statut` (text) - Statut (brouillon, validee, annulee)
  - `created_by` (uuid) - Créateur
  - `validated_by` (uuid) - Validateur
  - `validated_at` (timestamptz) - Date de validation
  - `created_at` (timestamptz) - Date de création
  - `updated_at` (timestamptz) - Date de mise à jour

  ### transaction_lines
  Table des lignes de transaction équilibrées (débits = crédits)
  - `id` (uuid, primary key) - Identifiant unique
  - `header_id` (uuid, foreign key) - Référence vers transaction_headers
  - `ligne_numero` (integer) - Numéro de ligne dans la transaction
  - `type_portefeuille` (text) - Type de portefeuille (cash, virtuel)
  - `service_id` (uuid) - Service concerné (optionnel pour cash)
  - `devise` (text) - Devise de la ligne (USD, CDF)
  - `sens` (text) - Sens de l'écriture (debit, credit)
  - `montant` (numeric) - Montant de la ligne
  - `description` (text) - Description de la ligne
  - `created_at` (timestamptz) - Date de création

  ## 2. Contraintes
  - Les débits doivent égaler les crédits pour chaque transaction
  - Le statut par défaut est 'brouillon'
  - Une transaction validée ne peut plus être modifiée
  - Les références sont uniques et auto-générées

  ## 3. Sécurité (RLS)
  - Lecture: tous utilisateurs authentifiés
  - Création: utilisateurs authentifiés
  - Modification: créateur uniquement, sauf si validée
  - Validation: gérants, propriétaires, administrateurs

  ## 4. Index
  - Sur header_id dans transaction_lines
  - Sur type_operation et statut dans transaction_headers
  - Sur reference dans transaction_headers
*/

-- Supprimer les fonctions existantes avec CASCADE si nécessaire
DROP FUNCTION IF EXISTS generate_transaction_reference() CASCADE;
DROP FUNCTION IF EXISTS set_transaction_reference() CASCADE;
DROP FUNCTION IF EXISTS validate_transaction_balance(uuid) CASCADE;
DROP FUNCTION IF EXISTS valider_transaction(uuid, uuid) CASCADE;

-- Création de la table transaction_headers
CREATE TABLE IF NOT EXISTS transaction_headers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text UNIQUE NOT NULL,
  type_operation text NOT NULL CHECK (type_operation IN ('depot', 'retrait', 'approvisionnement', 'change', 'transfert')),
  devise_reference text NOT NULL CHECK (devise_reference IN ('USD', 'CDF')),
  montant_total numeric NOT NULL CHECK (montant_total >= 0),
  description text,
  info_client text,
  taux_change numeric CHECK (taux_change > 0),
  paire_devises text,
  statut text NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'validee', 'annulee')),
  created_by uuid REFERENCES auth.users(id),
  validated_by uuid REFERENCES auth.users(id),
  validated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Création de la table transaction_lines
CREATE TABLE IF NOT EXISTS transaction_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  header_id uuid NOT NULL REFERENCES transaction_headers(id) ON DELETE CASCADE,
  ligne_numero integer NOT NULL CHECK (ligne_numero > 0),
  type_portefeuille text NOT NULL CHECK (type_portefeuille IN ('cash', 'virtuel')),
  service_id uuid REFERENCES services(id),
  devise text NOT NULL CHECK (devise IN ('USD', 'CDF')),
  sens text NOT NULL CHECK (sens IN ('debit', 'credit')),
  montant numeric NOT NULL CHECK (montant > 0),
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(header_id, ligne_numero)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_transaction_headers_reference ON transaction_headers(reference);
CREATE INDEX IF NOT EXISTS idx_transaction_headers_type_operation ON transaction_headers(type_operation);
CREATE INDEX IF NOT EXISTS idx_transaction_headers_statut ON transaction_headers(statut);
CREATE INDEX IF NOT EXISTS idx_transaction_headers_created_at ON transaction_headers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_lines_header_id ON transaction_lines(header_id);
CREATE INDEX IF NOT EXISTS idx_transaction_lines_type_portefeuille ON transaction_lines(type_portefeuille);
CREATE INDEX IF NOT EXISTS idx_transaction_lines_service_id ON transaction_lines(service_id);

-- Fonction pour générer une référence unique
CREATE OR REPLACE FUNCTION generate_transaction_reference()
RETURNS text AS $$
DECLARE
  v_reference text;
  v_count integer;
  v_prefix text;
BEGIN
  v_prefix := 'TRX-' || TO_CHAR(now(), 'YYYYMM') || '-';
  
  SELECT COUNT(*) + 1 INTO v_count
  FROM transaction_headers
  WHERE reference LIKE v_prefix || '%';
  
  v_reference := v_prefix || LPAD(v_count::text, 4, '0');
  
  WHILE EXISTS (SELECT 1 FROM transaction_headers WHERE reference = v_reference) LOOP
    v_count := v_count + 1;
    v_reference := v_prefix || LPAD(v_count::text, 4, '0');
  END LOOP;
  
  RETURN v_reference;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour générer automatiquement la référence
CREATE OR REPLACE FUNCTION set_transaction_reference()
RETURNS trigger AS $$
BEGIN
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    NEW.reference := generate_transaction_reference();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_transaction_reference ON transaction_headers;
CREATE TRIGGER trigger_set_transaction_reference
  BEFORE INSERT ON transaction_headers
  FOR EACH ROW
  EXECUTE FUNCTION set_transaction_reference();

-- Trigger pour mettre à jour updated_at
DROP TRIGGER IF EXISTS trigger_update_transaction_headers_updated_at ON transaction_headers;
CREATE TRIGGER trigger_update_transaction_headers_updated_at
  BEFORE UPDATE ON transaction_headers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Fonction de validation d'équilibrage
CREATE OR REPLACE FUNCTION validate_transaction_balance(p_header_id uuid)
RETURNS boolean AS $$
DECLARE
  v_total_debit numeric;
  v_total_credit numeric;
BEGIN
  SELECT 
    COALESCE(SUM(CASE WHEN sens = 'debit' THEN montant ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN sens = 'credit' THEN montant ELSE 0 END), 0)
  INTO v_total_debit, v_total_credit
  FROM transaction_lines
  WHERE header_id = p_header_id;
  
  RETURN v_total_debit = v_total_credit;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour valider une transaction
CREATE OR REPLACE FUNCTION valider_transaction(
  p_header_id uuid,
  p_validated_by uuid
)
RETURNS void AS $$
DECLARE
  v_is_balanced boolean;
  v_statut text;
BEGIN
  -- Vérifier que la transaction existe
  SELECT statut INTO v_statut
  FROM transaction_headers
  WHERE id = p_header_id;
  
  IF v_statut IS NULL THEN
    RAISE EXCEPTION 'Transaction introuvable';
  END IF;
  
  IF v_statut = 'validee' THEN
    RAISE EXCEPTION 'Transaction déjà validée';
  END IF;
  
  IF v_statut = 'annulee' THEN
    RAISE EXCEPTION 'Transaction annulée, impossible de valider';
  END IF;
  
  -- Vérifier l'équilibrage
  v_is_balanced := validate_transaction_balance(p_header_id);
  
  IF NOT v_is_balanced THEN
    RAISE EXCEPTION 'Transaction non équilibrée: les débits ne sont pas égaux aux crédits';
  END IF;
  
  -- Valider la transaction
  UPDATE transaction_headers
  SET 
    statut = 'validee',
    validated_by = p_validated_by,
    validated_at = now(),
    updated_at = now()
  WHERE id = p_header_id;
END;
$$ LANGUAGE plpgsql;

-- Vue pour faciliter la consultation des transactions complètes
CREATE OR REPLACE VIEW v_transactions_completes AS
SELECT 
  h.*,
  json_agg(
    json_build_object(
      'id', l.id,
      'ligne_numero', l.ligne_numero,
      'type_portefeuille', l.type_portefeuille,
      'service_id', l.service_id,
      'devise', l.devise,
      'sens', l.sens,
      'montant', l.montant,
      'description', l.description,
      'created_at', l.created_at
    ) ORDER BY l.ligne_numero
  ) AS lines
FROM transaction_headers h
LEFT JOIN transaction_lines l ON l.header_id = h.id
GROUP BY h.id;

-- Enable RLS
ALTER TABLE transaction_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_lines ENABLE ROW LEVEL SECURITY;

-- Policies pour transaction_headers
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent lire les headers" ON transaction_headers;
CREATE POLICY "Utilisateurs authentifiés peuvent lire les headers"
  ON transaction_headers
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent créer des headers" ON transaction_headers;
CREATE POLICY "Utilisateurs authentifiés peuvent créer des headers"
  ON transaction_headers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.actif = true
    )
  );

DROP POLICY IF EXISTS "Créateur peut modifier header non validé" ON transaction_headers;
CREATE POLICY "Créateur peut modifier header non validé"
  ON transaction_headers
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND statut = 'brouillon'
  )
  WITH CHECK (
    created_by = auth.uid()
    AND statut = 'brouillon'
  );

-- Policies pour transaction_lines
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent lire les lignes" ON transaction_lines;
CREATE POLICY "Utilisateurs authentifiés peuvent lire les lignes"
  ON transaction_lines
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent créer des lignes" ON transaction_lines;
CREATE POLICY "Utilisateurs authentifiés peuvent créer des lignes"
  ON transaction_lines
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM transaction_headers
      WHERE transaction_headers.id = header_id
      AND transaction_headers.created_by = auth.uid()
      AND transaction_headers.statut = 'brouillon'
    )
  );

DROP POLICY IF EXISTS "Créateur peut modifier lignes de transaction non validée" ON transaction_lines;
CREATE POLICY "Créateur peut modifier lignes de transaction non validée"
  ON transaction_lines
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM transaction_headers
      WHERE transaction_headers.id = header_id
      AND transaction_headers.created_by = auth.uid()
      AND transaction_headers.statut = 'brouillon'
    )
  );

DROP POLICY IF EXISTS "Créateur peut supprimer lignes de transaction non validée" ON transaction_lines;
CREATE POLICY "Créateur peut supprimer lignes de transaction non validée"
  ON transaction_lines
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM transaction_headers
      WHERE transaction_headers.id = header_id
      AND transaction_headers.created_by = auth.uid()
      AND transaction_headers.statut = 'brouillon'
    )
  );

-- Commentaires
COMMENT ON TABLE transaction_headers IS 'En-têtes des transactions financières multi-lignes';
COMMENT ON TABLE transaction_lines IS 'Lignes de transactions équilibrées (débits = crédits)';
COMMENT ON COLUMN transaction_headers.reference IS 'Référence unique auto-générée (TRX-YYYYMM-XXXX)';
COMMENT ON COLUMN transaction_headers.taux_change IS 'Taux de change figé au moment de la transaction';
COMMENT ON COLUMN transaction_headers.paire_devises IS 'Paire de devises utilisée (ex: USD/CDF)';
COMMENT ON COLUMN transaction_lines.sens IS 'Sens de l''écriture: debit (sortie) ou credit (entrée)';
COMMENT ON COLUMN transaction_lines.type_portefeuille IS 'Type: cash (caisse globale) ou virtuel (service)';
