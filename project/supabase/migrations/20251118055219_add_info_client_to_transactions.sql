/*
  # Ajouter le champ info_client à la table transactions

  1. Changements
    - Ajouter la colonne `info_client` (text, nullable) à la table transactions
    - Permet de stocker des informations sur le client (nom, téléphone, etc.)
*/

-- Ajouter le champ info_client
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'info_client'
  ) THEN
    ALTER TABLE transactions ADD COLUMN info_client text;
  END IF;
END $$;
