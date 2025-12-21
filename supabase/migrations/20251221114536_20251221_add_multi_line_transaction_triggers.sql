/*
  # Add Triggers for Multi-Line Transaction Balance Updates
  
  ## Description
  This migration creates triggers to automatically update balances (cash and service virtual)
  when multi-line transactions are validated.
  
  ## Changes
  1. Create function to update balances when transaction header is validated
  2. Create trigger to call this function on transaction_headers status change
  
  ## Security
  - Function runs with SECURITY DEFINER for reliability
  - No changes to RLS policies
*/

-- Function to update balances when a transaction is validated
CREATE OR REPLACE FUNCTION update_balances_on_validation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_line RECORD;
  v_global_balance RECORD;
BEGIN
  -- Only process when status changes to 'validee'
  IF NEW.statut = 'validee' AND (OLD.statut IS NULL OR OLD.statut != 'validee') THEN
    
    -- Get current global balances
    SELECT * INTO v_global_balance
    FROM global_balances
    LIMIT 1;
    
    -- If no global balance exists, create one
    IF v_global_balance IS NULL THEN
      INSERT INTO global_balances (cash_usd, cash_cdf)
      VALUES (0, 0)
      RETURNING * INTO v_global_balance;
    END IF;
    
    -- Process each transaction line
    FOR v_line IN 
      SELECT * FROM transaction_lines
      WHERE header_id = NEW.id
      ORDER BY ligne_numero
    LOOP
      -- Update based on wallet type
      IF v_line.type_portefeuille = 'cash' THEN
        -- Update global cash balances
        IF v_line.devise = 'USD' THEN
          IF v_line.sens = 'debit' THEN
            -- Debit = increase cash (money coming in)
            UPDATE global_balances
            SET cash_usd = cash_usd + v_line.montant,
                updated_at = now()
            WHERE id = v_global_balance.id;
          ELSE
            -- Credit = decrease cash (money going out)
            UPDATE global_balances
            SET cash_usd = cash_usd - v_line.montant,
                updated_at = now()
            WHERE id = v_global_balance.id;
          END IF;
        ELSIF v_line.devise = 'CDF' THEN
          IF v_line.sens = 'debit' THEN
            UPDATE global_balances
            SET cash_cdf = cash_cdf + v_line.montant,
                updated_at = now()
            WHERE id = v_global_balance.id;
          ELSE
            UPDATE global_balances
            SET cash_cdf = cash_cdf - v_line.montant,
                updated_at = now()
            WHERE id = v_global_balance.id;
          END IF;
        END IF;
        
      ELSIF v_line.type_portefeuille = 'virtuel' AND v_line.service_id IS NOT NULL THEN
        -- Update service virtual balances
        IF v_line.devise = 'USD' THEN
          IF v_line.sens = 'debit' THEN
            -- Debit = decrease virtual balance
            UPDATE services
            SET solde_virtuel_usd = solde_virtuel_usd - v_line.montant,
                updated_at = now()
            WHERE id = v_line.service_id;
          ELSE
            -- Credit = increase virtual balance
            UPDATE services
            SET solde_virtuel_usd = solde_virtuel_usd + v_line.montant,
                updated_at = now()
            WHERE id = v_line.service_id;
          END IF;
        ELSIF v_line.devise = 'CDF' THEN
          IF v_line.sens = 'debit' THEN
            UPDATE services
            SET solde_virtuel_cdf = solde_virtuel_cdf - v_line.montant,
                updated_at = now()
            WHERE id = v_line.service_id;
          ELSE
            UPDATE services
            SET solde_virtuel_cdf = solde_virtuel_cdf + v_line.montant,
                updated_at = now()
            WHERE id = v_line.service_id;
          END IF;
        END IF;
      END IF;
    END LOOP;
    
    -- Update validated_at timestamp
    NEW.validated_at := now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_update_balances_on_validation ON transaction_headers;

-- Create trigger
CREATE TRIGGER trigger_update_balances_on_validation
  BEFORE UPDATE ON transaction_headers
  FOR EACH ROW
  WHEN (NEW.statut = 'validee' AND (OLD.statut IS NULL OR OLD.statut != 'validee'))
  EXECUTE FUNCTION update_balances_on_validation();

COMMENT ON FUNCTION update_balances_on_validation IS 
  'Automatically updates cash and service balances when a multi-line transaction is validated';
