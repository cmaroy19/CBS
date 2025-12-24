/*
  # Exclure les transactions annulées et corrections du dashboard

  1. Modifications
    - Exclut les transactions avec annule = true
    - Exclut les transactions de correction (transaction_origine_id IS NOT NULL)
    - Garde uniquement les transactions valides et normales

  2. Filtres appliqués
    - annule IS NULL OR annule = false
    - transaction_origine_id IS NULL (pas une correction)
*/

-- Recréer la vue avec les filtres appropriés
CREATE OR REPLACE VIEW v_dashboard_recent_transactions AS
SELECT
  t.id,
  t.reference,
  t.type as type_transaction,
  t.montant,
  t.devise,
  s.nom as service_nom,
  t.info_client,
  t.created_at,
  t.is_mixed
FROM v_all_transactions t
LEFT JOIN services s ON t.service_id = s.id
WHERE 
  (t.annule = false OR t.annule IS NULL)
  AND t.transaction_origine_id IS NULL
ORDER BY t.created_at DESC;

COMMENT ON VIEW v_dashboard_recent_transactions IS 'Vue simplifiée des transactions récentes pour le dashboard (exclut annulations et corrections)';
