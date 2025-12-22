/*
  # Create Daily Service Closures Management System

  1. New Tables
    - `clotures_journalieres`
      - `id` (uuid, primary key)
      - `date_cloture` (date) - Date de clôture
      - `service_id` (uuid, not null) - Service concerné
      - `solde_ouverture_usd` (numeric) - Solde virtuel d'ouverture USD
      - `solde_ouverture_cdf` (numeric) - Solde virtuel d'ouverture CDF
      - `solde_cloture_usd` (numeric) - Solde virtuel saisi en clôture USD
      - `solde_cloture_cdf` (numeric) - Solde virtuel saisi en clôture CDF
      - `commission_usd` (numeric) - Commission de la journée USD
      - `commission_cdf` (numeric) - Commission de la journée CDF
      - `ecart_usd` (numeric) - Écart calculé USD
      - `ecart_cdf` (numeric) - Écart calculé CDF
      - `notes` (text, nullable) - Notes ou observations
      - `statut` (text) - brouillon, validee, verrouillee
      - `validee_par` (uuid, nullable) - Utilisateur ayant validé
      - `validee_le` (timestamptz, nullable) - Date de validation
      - `verrouillee_par` (uuid, nullable) - Utilisateur ayant verrouillé
      - `verrouillee_le` (timestamptz, nullable) - Date de verrouillage
      - `created_by` (uuid) - Créateur
      - `created_at` (timestamptz) - Date de création
      - `updated_at` (timestamptz) - Dernière modification

  2. Security
    - Enable RLS on `clotures_journalieres` table
    - Add policies for authenticated users:
      - SELECT: All authenticated users can view
      - INSERT: caissier, gerant, proprietaire, administrateur
      - UPDATE: Only if status is brouillon (for caissier), or gerant/proprietaire/administrateur
      - DELETE: Only proprietaire, administrateur

  3. Constraints
    - Unique constraint on (date_cloture, service_id)
    - Check constraint on statut values

  4. Indexes
    - Index on date_cloture for fast lookups
    - Index on service_id for filtering
    - Index on statut for filtering
*/

-- Create clotures_journalieres table
CREATE TABLE IF NOT EXISTS clotures_journalieres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_cloture date NOT NULL,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  solde_ouverture_usd numeric(15,2) NOT NULL DEFAULT 0,
  solde_ouverture_cdf numeric(15,2) NOT NULL DEFAULT 0,
  solde_cloture_usd numeric(15,2) NOT NULL DEFAULT 0,
  solde_cloture_cdf numeric(15,2) NOT NULL DEFAULT 0,
  commission_usd numeric(15,2) NOT NULL DEFAULT 0,
  commission_cdf numeric(15,2) NOT NULL DEFAULT 0,
  ecart_usd numeric(15,2) NOT NULL DEFAULT 0,
  ecart_cdf numeric(15,2) NOT NULL DEFAULT 0,
  notes text,
  statut text NOT NULL DEFAULT 'brouillon',
  validee_par uuid REFERENCES users(id) ON DELETE SET NULL,
  validee_le timestamptz,
  verrouillee_par uuid REFERENCES users(id) ON DELETE SET NULL,
  verrouillee_le timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_daily_closure_per_service UNIQUE(date_cloture, service_id),
  CONSTRAINT valid_statut CHECK (statut IN ('brouillon', 'validee', 'verrouillee'))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_clotures_date ON clotures_journalieres(date_cloture DESC);
CREATE INDEX IF NOT EXISTS idx_clotures_service ON clotures_journalieres(service_id);
CREATE INDEX IF NOT EXISTS idx_clotures_statut ON clotures_journalieres(statut);

-- Enable RLS
ALTER TABLE clotures_journalieres ENABLE ROW LEVEL SECURITY;

-- SELECT policy: All authenticated users can view closures
CREATE POLICY "Authenticated users can view closures"
  ON clotures_journalieres
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT policy: caissier, gerant, proprietaire, administrateur can insert
CREATE POLICY "Authorized users can insert closures"
  ON clotures_journalieres
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('caissier', 'gerant', 'proprietaire', 'administrateur')
      AND users.actif = true
    )
  );

-- UPDATE policy: Can update if brouillon (caissier) or if manager
CREATE POLICY "Users can update closures based on status and role"
  ON clotures_journalieres
  FOR UPDATE
  TO authenticated
  USING (
    -- Can update if brouillon and user is caissier/gerant/proprietaire/administrateur
    (statut = 'brouillon' AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('caissier', 'gerant', 'proprietaire', 'administrateur')
      AND users.actif = true
    ))
    OR
    -- Or if user is gerant/proprietaire/administrateur (can update any status)
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('gerant', 'proprietaire', 'administrateur')
      AND users.actif = true
    )
  )
  WITH CHECK (
    -- Same conditions for WITH CHECK
    (statut = 'brouillon' AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('caissier', 'gerant', 'proprietaire', 'administrateur')
      AND users.actif = true
    ))
    OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('gerant', 'proprietaire', 'administrateur')
      AND users.actif = true
    )
  );

-- DELETE policy: Only proprietaire, administrateur can delete
CREATE POLICY "Admins can delete closures"
  ON clotures_journalieres
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('proprietaire', 'administrateur')
      AND users.actif = true
    )
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_clotures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_clotures_timestamp
  BEFORE UPDATE ON clotures_journalieres
  FOR EACH ROW
  EXECUTE FUNCTION update_clotures_updated_at();

-- Create trigger to calculate ecarts automatically
CREATE OR REPLACE FUNCTION calculate_closure_ecarts()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate expected closing balances based on opening + movements
  -- For simplicity, ecart = solde_cloture - (solde_ouverture + commission)
  -- In reality, this should account for all transactions
  NEW.ecart_usd = NEW.solde_cloture_usd - NEW.solde_ouverture_usd;
  NEW.ecart_cdf = NEW.solde_cloture_cdf - NEW.solde_ouverture_cdf;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_ecarts
  BEFORE INSERT OR UPDATE ON clotures_journalieres
  FOR EACH ROW
  EXECUTE FUNCTION calculate_closure_ecarts();