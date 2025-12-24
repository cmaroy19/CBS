/*
  # Correction de la vue dashboard_stats_fast
  
  1. Modifications
    - Exclut les transactions annulées (annule = true)
    - Exclut les transactions de correction (transaction_origine_id IS NOT NULL)
    - Utilise v_all_transactions au lieu de transaction_headers pour les statistiques
    
  2. Impact
    - Les statistiques du dashboard refléteront uniquement les transactions valides
    - Les corrections et annulations ne seront plus comptabilisées
*/

CREATE OR REPLACE VIEW dashboard_stats_fast AS
SELECT 
  -- Soldes Cash (Global)
  COALESCE((SELECT cash_usd FROM global_balances LIMIT 1), 0) AS cash_usd,
  COALESCE((SELECT cash_cdf FROM global_balances LIMIT 1), 0) AS cash_cdf,
  
  -- Soldes Virtuels (Services)
  COALESCE((SELECT SUM(solde_virtuel_usd) FROM services WHERE actif = true), 0) AS virtual_usd,
  COALESCE((SELECT SUM(solde_virtuel_cdf) FROM services WHERE actif = true), 0) AS virtual_cdf,
  
  -- Trésorerie Totale
  COALESCE((SELECT cash_usd FROM global_balances LIMIT 1), 0) + 
  COALESCE((SELECT SUM(solde_virtuel_usd) FROM services WHERE actif = true), 0) AS total_tresorerie_usd,
  
  COALESCE((SELECT cash_cdf FROM global_balances LIMIT 1), 0) + 
  COALESCE((SELECT SUM(solde_virtuel_cdf) FROM services WHERE actif = true), 0) AS total_tresorerie_cdf,
  
  -- Transactions aujourd'hui (exclut annulées et corrections)
  COALESCE((
    SELECT COUNT(*)::integer 
    FROM v_all_transactions 
    WHERE created_at::date = CURRENT_DATE 
      AND annule = false 
      AND transaction_origine_id IS NULL
  ), 0) AS transactions_today,
  
  -- Approvisionnements aujourd'hui
  COALESCE((
    SELECT COUNT(*)::integer 
    FROM approvisionnements 
    WHERE created_at::date = CURRENT_DATE
  ), 0) AS approvisionnements_today,
  
  -- Opérations de change aujourd'hui
  COALESCE((
    SELECT COUNT(*)::integer 
    FROM change_operations 
    WHERE created_at::date = CURRENT_DATE
  ), 0) AS change_operations_today,
  
  -- Volume USD aujourd'hui (exclut annulées et corrections)
  COALESCE((
    SELECT SUM(montant) 
    FROM v_all_transactions 
    WHERE created_at::date = CURRENT_DATE 
      AND annule = false 
      AND transaction_origine_id IS NULL
      AND devise = 'USD'
  ), 0) AS volume_today_usd,
  
  -- Volume CDF aujourd'hui (exclut annulées et corrections)
  COALESCE((
    SELECT SUM(montant) 
    FROM v_all_transactions 
    WHERE created_at::date = CURRENT_DATE 
      AND annule = false 
      AND transaction_origine_id IS NULL
      AND devise = 'CDF'
  ), 0) AS volume_today_cdf,
  
  -- Services actifs
  COALESCE((SELECT COUNT(*)::integer FROM services WHERE actif = true), 0) AS services_actifs,
  
  -- Utilisateurs actifs
  COALESCE((SELECT COUNT(*)::integer FROM users WHERE actif = true), 0) AS users_actifs,
  
  NOW() AS updated_at;
