/*
  # Ajout du Choix du Taux de Change pour les Transactions Mixtes

  ## Objectif
  Permettre à l'utilisateur de choisir entre :
  - Taux automatique (taux actif par défaut)
  - Taux manuel (sélection d'un taux actif parmi la liste)

  ## Modifications
  1. Ajout de la colonne `exchange_rate_mode` ('AUTO' ou 'MANUAL')
  2. Ajout de la colonne `exchange_rate_id` (référence vers exchange_rates)

  ## Notes
  - Ces colonnes sont optionnelles (NULL autorisé)
  - Le champ `taux_change` existant continue de stocker la valeur du taux utilisé
  - `exchange_rate_id` n'est rempli que si mode = 'MANUAL'
*/

-- Ajout des colonnes pour le choix du taux de change
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transaction_headers'
    AND column_name = 'exchange_rate_mode'
  ) THEN
    ALTER TABLE transaction_headers
    ADD COLUMN exchange_rate_mode text CHECK (exchange_rate_mode IN ('AUTO', 'MANUAL'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transaction_headers'
    AND column_name = 'exchange_rate_id'
  ) THEN
    ALTER TABLE transaction_headers
    ADD COLUMN exchange_rate_id uuid REFERENCES exchange_rates(id);
  END IF;
END $$;

-- Commentaires explicatifs
COMMENT ON COLUMN transaction_headers.exchange_rate_mode IS 'Mode de sélection du taux : AUTO (taux actif par défaut) ou MANUAL (taux choisi manuellement)';
COMMENT ON COLUMN transaction_headers.exchange_rate_id IS 'ID du taux de change utilisé (rempli uniquement si exchange_rate_mode = MANUAL)';
