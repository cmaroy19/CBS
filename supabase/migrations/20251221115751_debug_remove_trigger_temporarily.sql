/*
  # Debug: Temporarily Remove Trigger
  
  ## Description
  Temporarily removes the trigger to isolate the error source.
  This is a debugging migration to identify if the trigger is causing the issue.
  
  ## Changes
  - Drop the trigger (function remains)
  
  ## Security
  - No changes to RLS policies
*/

-- Temporarily drop the trigger to debug
DROP TRIGGER IF EXISTS trigger_update_balances_on_validation ON transaction_headers;

COMMENT ON FUNCTION update_balances_on_validation IS 
  'TRIGGER DISABLED FOR DEBUGGING - Automatically updates cash and service balances when a multi-line transaction is validated';
