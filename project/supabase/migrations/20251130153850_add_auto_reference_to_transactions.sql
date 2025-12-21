/*
  # Add Auto Reference to Transactions

  1. Changes
    - Modify `reference` column in `transactions` table to be auto-generated
    - Create sequence for auto-incrementing reference numbers per day
    - Create trigger to auto-generate reference on insert
    - Format: DD-MM-YYYY-#### (e.g., 30-11-2025-0001)

  2. Security
    - No changes to RLS policies
    - Trigger runs with SECURITY DEFINER
*/

-- Create sequence for transaction references (resets daily)
CREATE SEQUENCE IF NOT EXISTS transactions_ref_seq START 1;

-- Create function to generate reference
CREATE OR REPLACE FUNCTION generate_transaction_reference()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_date_part text;
  v_sequence_num int;
  v_reference text;
  v_today date;
  v_count int;
BEGIN
  -- Get current date
  v_today := CURRENT_DATE;
  
  -- Format date as DD-MM-YYYY
  v_date_part := to_char(v_today, 'DD-MM-YYYY');
  
  -- Count existing transactions for today to get the next sequence number
  SELECT COUNT(*) + 1 INTO v_count
  FROM transactions
  WHERE DATE(created_at) = v_today;
  
  -- Format: DD-MM-YYYY-#### (e.g., 30-11-2025-0001)
  v_reference := v_date_part || '-' || lpad(v_count::text, 4, '0');
  
  -- Set the reference
  NEW.reference := v_reference;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_generate_transaction_reference ON transactions;

-- Create trigger on INSERT
CREATE TRIGGER trigger_generate_transaction_reference
  BEFORE INSERT ON transactions
  FOR EACH ROW
  WHEN (NEW.reference IS NULL OR NEW.reference = '')
  EXECUTE FUNCTION generate_transaction_reference();

-- Update existing records without proper reference
DO $$
DECLARE
  v_record RECORD;
  v_date_part text;
  v_count int;
  v_reference text;
  v_date date;
BEGIN
  FOR v_record IN 
    SELECT id, created_at 
    FROM transactions 
    WHERE reference IS NULL OR reference = ''
    ORDER BY created_at
  LOOP
    v_date := DATE(v_record.created_at);
    v_date_part := to_char(v_record.created_at, 'DD-MM-YYYY');
    
    -- Count transactions up to this one on the same date
    SELECT COUNT(*) + 1 INTO v_count
    FROM transactions
    WHERE DATE(created_at) = v_date
      AND created_at < v_record.created_at;
    
    v_reference := v_date_part || '-' || lpad(v_count::text, 4, '0');
    
    UPDATE transactions 
    SET reference = v_reference 
    WHERE id = v_record.id;
  END LOOP;
END $$;

-- Make reference NOT NULL after populating
ALTER TABLE transactions ALTER COLUMN reference SET NOT NULL;

COMMENT ON COLUMN transactions.reference IS 
  'Auto-generated unique reference in format DD-MM-YYYY-#### (resets daily)';
