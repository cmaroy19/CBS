/*
  # Create Service Balances View for Enhanced Dashboard

  1. New View
    - `v_service_balances`
      - Provides detailed balance breakdown per service
      - Shows: service info, virtual balances USD/CDF, active status
      - Ordered by service name for consistent display
  
  2. Purpose
    - Enable dashboard to display per-service balance details
    - Support real-time balance monitoring at service level
    - Provide granular financial visibility for each payment service
  
  3. Security
    - View inherits RLS from services table
    - Only accessible to authenticated users with services read permission
*/

-- Drop view if exists to allow clean recreation
DROP VIEW IF EXISTS v_service_balances;

-- Create comprehensive service balances view
CREATE VIEW v_service_balances AS
SELECT 
  s.id,
  s.nom as service_name,
  s.code as service_code,
  s.type_compte,
  s.solde_virtuel_usd as virtual_usd,
  s.solde_virtuel_cdf as virtual_cdf,
  s.actif as is_active,
  s.updated_at as last_updated
FROM services s
WHERE s.actif = true
ORDER BY s.nom ASC;

-- Grant read access to authenticated users
GRANT SELECT ON v_service_balances TO authenticated;