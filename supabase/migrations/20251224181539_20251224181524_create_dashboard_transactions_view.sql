/*
  # Vue simplifiée pour les transactions récentes du dashboard

  1. Description
    - Crée une vue spécifique pour l'affichage des transactions récentes
    - Inclut le nom du service directement
    - Basée sur v_all_transactions
    - Utilisée uniquement pour le dashboard

  2. Colonnes
    - id
    - reference
    - type_transaction (renommé depuis type)
    - montant
    - devise
    - service_nom
    - info_client
    - created_at
*/

-- Vue pour le dashboard
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
WHERE t.annule = false OR t.annule IS NULL
ORDER BY t.created_at DESC;

COMMENT ON VIEW v_dashboard_recent_transactions IS 'Vue simplifiée des transactions récentes pour le dashboard avec noms de services';
