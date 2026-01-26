/*
  # Suppression des Anciennes Fonctions Transaction Mixte

  ## Objectif
  Supprimer les anciennes versions des fonctions de transaction mixte
  pour pouvoir les recréer avec les nouveaux paramètres.

  ## Fonctions supprimées
  - create_transaction_mixte_retrait (avec ancienne signature)
  - create_transaction_mixte_depot (avec ancienne signature)
  - create_transaction_mixte_retrait_cdf (avec ancienne signature)
  - create_transaction_mixte_depot_cdf (avec ancienne signature)
*/

-- Supprimer les fonctions avec leurs signatures actuelles
DROP FUNCTION IF EXISTS create_transaction_mixte_retrait(uuid, numeric, numeric, numeric, text, text, uuid);
DROP FUNCTION IF EXISTS create_transaction_mixte_depot(uuid, numeric, numeric, numeric, text, text, uuid);
DROP FUNCTION IF EXISTS create_transaction_mixte_retrait_cdf(uuid, numeric, numeric, numeric, text, text, uuid);
DROP FUNCTION IF EXISTS create_transaction_mixte_depot_cdf(uuid, numeric, numeric, numeric, text, text, uuid);
