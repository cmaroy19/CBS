/*
  # Système de Transactions Multi-Lignes

  ## Description
  Cette migration crée une structure de transaction à double entrée permettant
  de représenter les opérations financières de manière atomique et équilibrée.

  ## 1. Nouvelles Tables

  ### transaction_headers
  Table principale contenant les en-têtes de transactions
  - `id` (uuid, primary key) - Identifiant unique
  - `reference` (text, unique) - Référence unique auto-générée
  - `type_operation` (text) - Type d'opération (depot, retrait, approvisionnement, change, transfert)
  - `devise_reference` (text) - Devise de référence (USD, CDF)
  - `montant_total` (numeric) - Montant total de l'opération
  - `description` (text) - Description de l'opération
  - `info_client` (text) - Informations du client (optionnel)
  - `statut` (text) - Statut de la transaction (brouillon, validee, annulee)
  - `created_by` (uuid) - Utilisateur créateur
  - `validated_by` (uuid) - Utilisateur validateur
  - `validated_at` (timestamptz) - Date de validation
  - `created_at` (timestamptz) - Date de création
  - `updated_at` (timestamptz) - Date de mise à jour

  ### transaction_lines
  Table des lignes de transaction (écritures comptables)
  - `id` (uuid, primary key) - Identifiant unique
  - `header_id` (uuid, foreign key) - Référence à l'en-tête
  - `ligne_numero` (integer) - Numéro de ligne dans la transaction
  - `type_portefeuille` (text) - Type de portefeuille (cash, virtuel)
  - `service_id` (uuid, foreign key) - Référence au service (optionnel pour cash)
  - `devise` (text) - Devise de la ligne (USD, CDF)
  - `sens` (text) - Sens de l'opération (debit, credit)
  - `montant` (numeric) - Montant de la ligne
  - `description` (text) - Description de la ligne
  - `created_at` (timestamptz) - Date de création

  ## Pour appliquer cette migration:
  Utilisez la Supabase CLI ou le dashboard Supabase pour exécuter ce fichier SQL.
*/

-- Création de la table transaction_headers
CREATE TABLE IF NOT EXISTS transaction_headers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text UNIQUE NOT NULL,
  type_operation text NOT NULL CHECK (type_operation IN ('depot', 'retrait', 'approvisionnement', 'change', 'transfert')),
  devise_reference text NOT NULL CHECK (devise_reference IN ('USD', 'CDF')),
  montant_total numeric NOT NULL CHECK (montant_total > 0),
  description text,
  info_client text,
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
CREATE INDEX IF NOT EXISTS idx_transaction_headers_created_at ON transaction_headers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_headers_statut ON transaction_headers(statut);
CREATE INDEX IF NOT EXISTS idx_transaction_headers_type_operation ON transaction_headers(type_operation);
CREATE INDEX IF NOT EXISTS idx_transaction_headers_created_by ON transaction_headers(created_by);

CREATE INDEX IF NOT EXISTS idx_transaction_lines_header_id ON transaction_lines(header_id);
CREATE INDEX IF NOT EXISTS idx_transaction_lines_service_id ON transaction_lines(service_id);
CREATE INDEX IF NOT EXISTS idx_transaction_lines_devise ON transaction_lines(devise);
CREATE INDEX IF NOT EXISTS idx_transaction_lines_type_portefeuille ON transaction_lines(type_portefeuille);

-- Fonction pour générer une référence unique
CREATE OR REPLACE FUNCTION generate_transaction_reference()
RETURNS text AS $$
DECLARE
  new_reference text;
  counter integer := 0;
BEGIN
  LOOP
    new_reference := 'TRX-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');

    EXIT WHEN NOT EXISTS (SELECT 1 FROM transaction_headers WHERE reference = new_reference);

    counter := counter + 1;
    IF counter > 100 THEN
      RAISE EXCEPTION 'Unable to generate unique reference after 100 attempts';
    END IF;
  END LOOP;

  RETURN new_reference;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour générer automatiquement la référence si non fournie
CREATE OR REPLACE FUNCTION set_transaction_reference()
RETURNS trigger AS $$
BEGIN
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    NEW.reference := generate_transaction_reference();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_transaction_reference
  BEFORE INSERT ON transaction_headers
  FOR EACH ROW
  EXECUTE FUNCTION set_transaction_reference();

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_transaction_headers_updated_at
  BEFORE UPDATE ON transaction_headers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Fonction pour vérifier l'équilibre des lignes avant validation
CREATE OR REPLACE FUNCTION check_transaction_balance()
RETURNS trigger AS $$
DECLARE
  usd_debit numeric;
  usd_credit numeric;
  cdf_debit numeric;
  cdf_credit numeric;
  line_count integer;
BEGIN
  IF NEW.statut = 'validee' AND OLD.statut != 'validee' THEN
    -- Compter le nombre de lignes
    SELECT COUNT(*) INTO line_count
    FROM transaction_lines
    WHERE header_id = NEW.id;

    IF line_count < 2 THEN
      RAISE EXCEPTION 'Une transaction doit avoir au moins 2 lignes';
    END IF;

    -- Calculer les totaux USD
    SELECT
      COALESCE(SUM(CASE WHEN sens = 'debit' THEN montant ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN sens = 'credit' THEN montant ELSE 0 END), 0)
    INTO usd_debit, usd_credit
    FROM transaction_lines
    WHERE header_id = NEW.id AND devise = 'USD';

    -- Calculer les totaux CDF
    SELECT
      COALESCE(SUM(CASE WHEN sens = 'debit' THEN montant ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN sens = 'credit' THEN montant ELSE 0 END), 0)
    INTO cdf_debit, cdf_credit
    FROM transaction_lines
    WHERE header_id = NEW.id AND devise = 'CDF';

    -- Vérifier l'équilibre pour USD
    IF usd_debit != usd_credit THEN
      RAISE EXCEPTION 'Transaction non équilibrée pour USD: débit = %, crédit = %', usd_debit, usd_credit;
    END IF;

    -- Vérifier l'équilibre pour CDF
    IF cdf_debit != cdf_credit THEN
      RAISE EXCEPTION 'Transaction non équilibrée pour CDF: débit = %, crédit = %', cdf_debit, cdf_credit;
    END IF;

    -- Mettre à jour validated_at et validated_by
    NEW.validated_at := now();
    IF NEW.validated_by IS NULL THEN
      NEW.validated_by := auth.uid();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_transaction_balance
  BEFORE UPDATE ON transaction_headers
  FOR EACH ROW
  EXECUTE FUNCTION check_transaction_balance();

-- Enable RLS
ALTER TABLE transaction_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_lines ENABLE ROW LEVEL SECURITY;

-- Policies pour transaction_headers
CREATE POLICY "Utilisateurs authentifiés peuvent lire les transaction_headers"
  ON transaction_headers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Gérants et propriétaires peuvent insérer des transaction_headers"
  ON transaction_headers
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

CREATE POLICY "Gérants et propriétaires peuvent modifier des transaction_headers en brouillon"
  ON transaction_headers
  FOR UPDATE
  TO authenticated
  USING (
    statut = 'brouillon' AND
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

-- Policies pour transaction_lines
CREATE POLICY "Utilisateurs authentifiés peuvent lire les transaction_lines"
  ON transaction_lines
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Gérants et propriétaires peuvent insérer des transaction_lines"
  ON transaction_lines
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM transaction_headers th
      JOIN users u ON u.id = auth.uid()
      WHERE th.id = header_id
      AND th.statut = 'brouillon'
      AND u.actif = true
      AND u.role IN ('gerant', 'proprietaire', 'administrateur')
    )
  );

CREATE POLICY "Gérants et propriétaires peuvent modifier des transaction_lines en brouillon"
  ON transaction_lines
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM transaction_headers th
      JOIN users u ON u.id = auth.uid()
      WHERE th.id = header_id
      AND th.statut = 'brouillon'
      AND u.actif = true
      AND u.role IN ('gerant', 'proprietaire', 'administrateur')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM transaction_headers th
      JOIN users u ON u.id = auth.uid()
      WHERE th.id = header_id
      AND th.statut = 'brouillon'
      AND u.actif = true
      AND u.role IN ('gerant', 'proprietaire', 'administrateur')
    )
  );

CREATE POLICY "Gérants et propriétaires peuvent supprimer des transaction_lines en brouillon"
  ON transaction_lines
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM transaction_headers th
      JOIN users u ON u.id = auth.uid()
      WHERE th.id = header_id
      AND th.statut = 'brouillon'
      AND u.actif = true
      AND u.role IN ('gerant', 'proprietaire', 'administrateur')
    )
  );

-- Vue pour faciliter la consultation des transactions avec leurs lignes
CREATE OR REPLACE VIEW v_transactions_completes AS
SELECT
  th.id AS header_id,
  th.reference,
  th.type_operation,
  th.devise_reference,
  th.montant_total,
  th.description AS header_description,
  th.info_client,
  th.statut,
  th.created_by,
  th.validated_by,
  th.validated_at,
  th.created_at,
  th.updated_at,
  json_agg(
    json_build_object(
      'id', tl.id,
      'ligne_numero', tl.ligne_numero,
      'type_portefeuille', tl.type_portefeuille,
      'service_id', tl.service_id,
      'devise', tl.devise,
      'sens', tl.sens,
      'montant', tl.montant,
      'description', tl.description
    ) ORDER BY tl.ligne_numero
  ) AS lignes
FROM transaction_headers th
LEFT JOIN transaction_lines tl ON th.id = tl.header_id
GROUP BY th.id, th.reference, th.type_operation, th.devise_reference,
         th.montant_total, th.description, th.info_client, th.statut,
         th.created_by, th.validated_by, th.validated_at,
         th.created_at, th.updated_at;
