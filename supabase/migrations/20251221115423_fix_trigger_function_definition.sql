/*
  # Fix Trigger Function Definition
  
  ## Description
  Ensures the trigger function and trigger are correctly defined.
  This migration verifies that the trigger is properly attached to the function.
  
  ## Changes
  - Recreate the trigger to ensure proper configuration
  - No changes to function logic
  
  ## Security
  - No changes to RLS policies
*/

-- Ensure the trigger exists and is properly configured
DROP TRIGGER IF EXISTS trigger_update_balances_on_validation ON transaction_headers;

CREATE TRIGGER trigger_update_balances_on_validation
  BEFORE UPDATE ON transaction_headers
  FOR EACH ROW
  WHEN (NEW.statut = 'validee' AND (OLD.statut IS NULL OR OLD.statut != 'validee'))
  EXECUTE FUNCTION update_balances_on_validation();

COMMENT ON TRIGGER trigger_update_balances_on_validation ON transaction_headers IS 
  'Automatically updates balances when transaction status changes to validated';
