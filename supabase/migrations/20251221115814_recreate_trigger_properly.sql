/*
  # Recreate Trigger Properly
  
  ## Description
  Properly recreates the trigger after debugging.
  Ensures the trigger is correctly attached to the function with proper configuration.
  
  ## Changes
  - Recreate the trigger with correct syntax
  - Ensure BEFORE UPDATE timing
  - Ensure FOR EACH ROW scope
  - Ensure WHEN clause is correct
  
  ## Security
  - No changes to RLS policies
  - Function already has SECURITY DEFINER
*/

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_update_balances_on_validation ON transaction_headers;

-- Recreate the trigger properly
CREATE TRIGGER trigger_update_balances_on_validation
  BEFORE UPDATE ON transaction_headers
  FOR EACH ROW
  WHEN (NEW.statut = 'validee' AND (OLD.statut IS DISTINCT FROM 'validee'))
  EXECUTE FUNCTION update_balances_on_validation();

COMMENT ON FUNCTION update_balances_on_validation IS 
  'Automatically updates cash and service balances when a multi-line transaction is validated. Skips change portfolio entries used for currency conversion balancing.';
