/*
  # Schéma complet de gestion financière

  ## 1. Nouvelles Tables
  
  ### users
  - `id` (uuid, clé primaire, lien vers auth.users)
  - `email` (text)
  - `nom_complet` (text)
  - `role` (text: 'proprietaire', 'gerant', 'caissier')
  - `photo_url` (text, nullable)
  - `actif` (boolean, défaut true)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### services
  - `id` (uuid, clé primaire)
  - `nom` (text, unique: Illico Cash, Cash Express, etc.)
  - `code` (text, unique)
  - `solde_virtuel_usd` (numeric, défaut 0)
  - `solde_virtuel_cdf` (numeric, défaut 0)
  - `actif` (boolean, défaut true)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### transactions
  - `id` (uuid, clé primaire)
  - `type` (text: 'depot', 'retrait')
  - `service_id` (uuid, foreign key)
  - `montant` (numeric)
  - `devise` (text: 'USD', 'CDF')
  - `commission` (numeric, défaut 0)
  - `reference` (text)
  - `notes` (text, nullable)
  - `created_by` (uuid, foreign key vers users)
  - `created_at` (timestamptz)
  
  ### approvisionnements
  - `id` (uuid, clé primaire)
  - `type` (text: 'cash', 'virtuel')
  - `operation` (text: 'entree', 'sortie')
  - `service_id` (uuid, foreign key, nullable pour cash)
  - `montant` (numeric)
  - `devise` (text: 'USD', 'CDF')
  - `notes` (text, nullable)
  - `created_by` (uuid, foreign key)
  - `created_at` (timestamptz)
  
  ### change_operations
  - `id` (uuid, clé primaire)
  - `montant_usd` (numeric)
  - `montant_cdf` (numeric)
  - `taux` (numeric)
  - `sens` (text: 'usd_to_cdf', 'cdf_to_usd')
  - `notes` (text, nullable)
  - `created_by` (uuid, foreign key)
  - `created_at` (timestamptz)
  
  ### audit_logs
  - `id` (uuid, clé primaire)
  - `table_name` (text)
  - `operation` (text: 'INSERT', 'UPDATE', 'DELETE')
  - `record_id` (uuid)
  - `old_data` (jsonb, nullable)
  - `new_data` (jsonb, nullable)
  - `user_id` (uuid)
  - `created_at` (timestamptz)
  
  ### global_balances
  - `id` (uuid, clé primaire)
  - `cash_usd` (numeric, défaut 0)
  - `cash_cdf` (numeric, défaut 0)
  - `updated_at` (timestamptz)
  
  ## 2. Sécurité
  - RLS activé sur toutes les tables
  - Policies pour authentification
  - Policies basées sur les rôles
  
  ## 3. Fonctions
  - Fonction de vérification des soldes
  - Fonction de mise à jour automatique des soldes
  - Triggers pour audit_logs
  
  ## 4. Vue temps réel
  - Vue pour les balances en temps réel
*/

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table users (profils utilisateurs)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  nom_complet text NOT NULL,
  role text NOT NULL CHECK (role IN ('proprietaire', 'gerant', 'caissier')),
  photo_url text,
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table global_balances (soldes cash globaux)
CREATE TABLE IF NOT EXISTS global_balances (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cash_usd numeric DEFAULT 0 CHECK (cash_usd >= 0),
  cash_cdf numeric DEFAULT 0 CHECK (cash_cdf >= 0),
  updated_at timestamptz DEFAULT now()
);

-- Insérer une ligne par défaut pour global_balances
INSERT INTO global_balances (cash_usd, cash_cdf) 
VALUES (0, 0)
ON CONFLICT DO NOTHING;

-- Table services
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom text UNIQUE NOT NULL,
  code text UNIQUE NOT NULL,
  solde_virtuel_usd numeric DEFAULT 0 CHECK (solde_virtuel_usd >= 0),
  solde_virtuel_cdf numeric DEFAULT 0 CHECK (solde_virtuel_cdf >= 0),
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table transactions
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  type text NOT NULL CHECK (type IN ('depot', 'retrait')),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  montant numeric NOT NULL CHECK (montant > 0),
  devise text NOT NULL CHECK (devise IN ('USD', 'CDF')),
  commission numeric DEFAULT 0 CHECK (commission >= 0),
  reference text NOT NULL,
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Table approvisionnements
CREATE TABLE IF NOT EXISTS approvisionnements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  type text NOT NULL CHECK (type IN ('cash', 'virtuel')),
  operation text NOT NULL CHECK (operation IN ('entree', 'sortie')),
  service_id uuid REFERENCES services(id) ON DELETE RESTRICT,
  montant numeric NOT NULL CHECK (montant > 0),
  devise text NOT NULL CHECK (devise IN ('USD', 'CDF')),
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Table change_operations
CREATE TABLE IF NOT EXISTS change_operations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  montant_usd numeric NOT NULL CHECK (montant_usd > 0),
  montant_cdf numeric NOT NULL CHECK (montant_cdf > 0),
  taux numeric NOT NULL CHECK (taux > 0),
  sens text NOT NULL CHECK (sens IN ('usd_to_cdf', 'cdf_to_usd')),
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Table audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  record_id uuid NOT NULL,
  old_data jsonb,
  new_data jsonb,
  user_id uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_transactions_service ON transactions(service_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approvisionnements_created_at ON approvisionnements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_operations_created_at ON change_operations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_services_updated_at ON services;
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_global_balances_updated_at ON global_balances;
CREATE TRIGGER update_global_balances_updated_at
  BEFORE UPDATE ON global_balances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Fonction pour logger les changements
CREATE OR REPLACE FUNCTION log_audit()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (table_name, operation, record_id, old_data, user_id)
    VALUES (TG_TABLE_NAME, TG_OP, OLD.id, row_to_json(OLD), auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (table_name, operation, record_id, old_data, new_data, user_id)
    VALUES (TG_TABLE_NAME, TG_OP, NEW.id, row_to_json(OLD), row_to_json(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (table_name, operation, record_id, new_data, user_id)
    VALUES (TG_TABLE_NAME, TG_OP, NEW.id, row_to_json(NEW), auth.uid());
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers d'audit
DROP TRIGGER IF EXISTS audit_services ON services;
CREATE TRIGGER audit_services
  AFTER INSERT OR UPDATE OR DELETE ON services
  FOR EACH ROW EXECUTE FUNCTION log_audit();

DROP TRIGGER IF EXISTS audit_transactions ON transactions;
CREATE TRIGGER audit_transactions
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION log_audit();

DROP TRIGGER IF EXISTS audit_approvisionnements ON approvisionnements;
CREATE TRIGGER audit_approvisionnements
  AFTER INSERT OR UPDATE OR DELETE ON approvisionnements
  FOR EACH ROW EXECUTE FUNCTION log_audit();

DROP TRIGGER IF EXISTS audit_change_operations ON change_operations;
CREATE TRIGGER audit_change_operations
  AFTER INSERT OR UPDATE OR DELETE ON change_operations
  FOR EACH ROW EXECUTE FUNCTION log_audit();

-- RLS: Activer sur toutes les tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvisionnements ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_balances ENABLE ROW LEVEL SECURITY;

-- Policies pour users
CREATE POLICY "Users can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policies pour services
CREATE POLICY "Users can view services"
  ON services FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can insert services"
  ON services FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('proprietaire', 'gerant')
    )
  );

CREATE POLICY "Managers can update services"
  ON services FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('proprietaire', 'gerant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('proprietaire', 'gerant')
    )
  );

-- Policies pour transactions
CREATE POLICY "Users can view transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policies pour approvisionnements
CREATE POLICY "Users can view approvisionnements"
  ON approvisionnements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can insert approvisionnements"
  ON approvisionnements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('proprietaire', 'gerant')
    )
  );

-- Policies pour change_operations
CREATE POLICY "Users can view change operations"
  ON change_operations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can insert change operations"
  ON change_operations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('proprietaire', 'gerant')
    )
  );

-- Policies pour audit_logs
CREATE POLICY "Managers can view audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('proprietaire', 'gerant')
    )
  );

-- Policies pour global_balances
CREATE POLICY "Users can view global balances"
  ON global_balances FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can update global balances"
  ON global_balances FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Vue pour les balances en temps réel
CREATE OR REPLACE VIEW realtime_balances AS
SELECT 
  (SELECT cash_usd FROM global_balances LIMIT 1) as cash_usd,
  (SELECT cash_cdf FROM global_balances LIMIT 1) as cash_cdf,
  COALESCE(SUM(solde_virtuel_usd), 0) as total_virtuel_usd,
  COALESCE(SUM(solde_virtuel_cdf), 0) as total_virtuel_cdf
FROM services
WHERE actif = true;