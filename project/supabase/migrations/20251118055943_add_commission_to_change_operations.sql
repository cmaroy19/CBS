/*
  # Ajouter le champ commission à la table change_operations

  1. Changements
    - Ajouter la colonne `commission` (numeric, nullable, default 0) à la table change_operations
    - Permet de gérer les frais de commission sur les opérations de change
*/

-- Ajouter le champ commission
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'change_operations' AND column_name = 'commission'
  ) THEN
    ALTER TABLE change_operations ADD COLUMN commission numeric DEFAULT 0;
  END IF;
END $$;
