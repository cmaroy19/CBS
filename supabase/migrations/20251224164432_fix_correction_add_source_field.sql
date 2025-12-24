/*
  # Ajouter le champ table_source à la vue v_all_transactions

  1. Modifications
    - Ajout du champ `table_source` pour identifier l'origine de la transaction
    - Valeurs: 'transactions' ou 'transaction_headers'
    - Permet de filtrer les transactions qui peuvent être corrigées

  2. Notes
    - Seules les transactions de la table 'transactions' peuvent être corrigées pour le moment
    - Les transactions mixtes (transaction_headers) nécessitent une logique plus complexe
*/

-- Recréer la vue avec le champ table_source
CREATE OR REPLACE VIEW v_all_transactions AS
-- Anciennes transactions simples
SELECT 
  t.id,
  t.reference,
  t.type,
  t.service_id,
  t.montant,
  t.devise,
  t.info_client,
  t.notes as notes,
  t.created_by,
  t.created_at,
  false as is_mixed,
  NULL::numeric as taux_change,
  NULL::text as description,
  t.annule,
  t.transaction_origine_id,
  t.raison_correction,
  t.corrigee_par,
  t.corrigee_le,
  'transactions'::text as table_source
FROM transactions t
WHERE t.annule = false OR t.annule IS NULL

UNION ALL

-- Nouvelles transactions multi-lignes
SELECT 
  h.id,
  h.reference,
  h.type_operation as type,
  -- Extraire le service_id de la première ligne avec un service
  (SELECT l.service_id 
   FROM transaction_lines l 
   WHERE l.header_id = h.id AND l.service_id IS NOT NULL 
   LIMIT 1) as service_id,
  h.montant_total as montant,
  h.devise_reference as devise,
  h.info_client,
  h.description as notes,
  h.created_by,
  h.created_at,
  CASE WHEN h.taux_change IS NOT NULL THEN true ELSE false END as is_mixed,
  h.taux_change,
  h.description,
  false as annule,
  NULL::uuid as transaction_origine_id,
  NULL::text as raison_correction,
  NULL::uuid as corrigee_par,
  NULL::timestamptz as corrigee_le,
  'transaction_headers'::text as table_source
FROM transaction_headers h
WHERE h.statut = 'validee'

ORDER BY created_at DESC;

COMMENT ON VIEW v_all_transactions IS 'Vue unifiée de toutes les transactions (simples et mixtes) avec champ table_source';
