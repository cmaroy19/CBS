/*
  # Remove Automatic Commissions from Dashboard Stats

  1. Changes
    - Drop and recreate `dashboard_stats_fast` view without automatic commission calculation
    - Commissions are now handled manually via `commissions_journalieres` table

  2. Impact
    - Dashboard will no longer show automatic commission calculations
    - Users must manually enter commissions in the Commissions page
*/

-- Drop existing view
DROP VIEW IF EXISTS dashboard_stats_fast;

-- Recreate view without commissions_today_usd column
CREATE VIEW dashboard_stats_fast AS
SELECT
  -- Cash balances
  COALESCE((SELECT cash_usd FROM global_balances LIMIT 1), 0) AS cash_usd,
  COALESCE((SELECT cash_cdf FROM global_balances LIMIT 1), 0) AS cash_cdf,
  
  -- Virtual balances
  COALESCE((SELECT SUM(solde_virtuel_usd) FROM services WHERE actif = true), 0) AS virtual_usd,
  COALESCE((SELECT SUM(solde_virtuel_cdf) FROM services WHERE actif = true), 0) AS virtual_cdf,
  
  -- Total treasury
  COALESCE((SELECT cash_usd FROM global_balances LIMIT 1), 0) + 
    COALESCE((SELECT SUM(solde_virtuel_usd) FROM services WHERE actif = true), 0) AS total_tresorerie_usd,
  COALESCE((SELECT cash_cdf FROM global_balances LIMIT 1), 0) + 
    COALESCE((SELECT SUM(solde_virtuel_cdf) FROM services WHERE actif = true), 0) AS total_tresorerie_cdf,
  
  -- Today's activity
  COALESCE((
    SELECT COUNT(*)::integer 
    FROM transaction_headers 
    WHERE created_at::date = CURRENT_DATE 
    AND statut = 'validee'
  ), 0) AS transactions_today,
  
  COALESCE((
    SELECT COUNT(*)::integer 
    FROM approvisionnements 
    WHERE created_at::date = CURRENT_DATE
  ), 0) AS approvisionnements_today,
  
  COALESCE((
    SELECT COUNT(*)::integer 
    FROM change_operations 
    WHERE created_at::date = CURRENT_DATE
  ), 0) AS change_operations_today,
  
  -- Today's volume
  COALESCE((
    SELECT SUM(montant_total) 
    FROM transaction_headers 
    WHERE created_at::date = CURRENT_DATE 
    AND statut = 'validee'
    AND devise_reference = 'USD'
  ), 0) AS volume_today_usd,
  
  COALESCE((
    SELECT SUM(montant_total) 
    FROM transaction_headers 
    WHERE created_at::date = CURRENT_DATE 
    AND statut = 'validee'
    AND devise_reference = 'CDF'
  ), 0) AS volume_today_cdf,
  
  -- System stats
  COALESCE((SELECT COUNT(*)::integer FROM services WHERE actif = true), 0) AS services_actifs,
  COALESCE((SELECT COUNT(*)::integer FROM users WHERE actif = true), 0) AS users_actifs,
  
  -- Timestamp
  NOW() AS updated_at;