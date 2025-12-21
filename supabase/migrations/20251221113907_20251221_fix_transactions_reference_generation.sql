/*
  # Fix Auto-Reference Generation for Transactions Table
  
  ## Description
  This migration ensures the transactions table has automatic reference generation.
  
  ## Changes
  1. Drop existing functions if they exist with CASCADE
  2. Create function to generate unique references in format DD-MM-YYYY-####
  3. Create trigger to auto-generate reference on INSERT when NULL or empty
  4. Update existing records without proper reference
  
  ## Security
  - No changes to RLS policies
  - Trigger runs with SECURITY DEFINER for reliability
*/

-- Drop existing functions if they exist (with CASCADE to drop dependent triggers)
DROP FUNCTION IF EXISTS generate_transaction_reference() CASCADE;

-- Create function to generate reference
CREATE OR REPLACE FUNCTION generate_transaction_reference()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_date_part text;
  v_count int;
  v_reference text;
  v_today date;
BEGIN
  -- Get current date
  v_today := CURRENT_DATE;
  
  -- Format date as DD-MM-YYYY
  v_date_part := to_char(v_today, 'DD-MM-YYYY');
  
  -- Count existing transactions for today to get the next sequence number
  SELECT COUNT(*) + 1 INTO v_count
  FROM transactions
  WHERE DATE(created_at) = v_today;
  
  -- Format: DD-MM-YYYY-#### (e.g., 21-12-2025-0001)
  v_reference := v_date_part || '-' || lpad(v_count::text, 4, '0');
  
  -- Set the reference
  NEW.reference := v_reference;
  
  RETURN NEW;
END;
$$;

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

-- Ensure reference column is NOT NULL (it may already be, this is idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' 
    AND column_name = 'reference' 
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE transactions ALTER COLUMN reference SET NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN transactions.reference IS 
  'Auto-generated unique reference in format DD-MM-YYYY-#### (resets daily)';
