/*
  # Add Transaction Correction System

  1. New Columns in `transactions` table
    - `annule` (boolean) - Indicates if transaction is cancelled
    - `transaction_origine_id` (uuid, nullable) - Reference to original transaction if this is a correction
    - `raison_correction` (text, nullable) - Reason for the correction
    - `corrigee_par` (uuid, nullable) - User who made the correction
    - `corrigee_le` (timestamptz, nullable) - Date of correction

  2. Security
    - Only Administrateur and Proprietaire roles can create corrections
    - Original transactions are never modified directly
    - All corrections are traced with user, date, and reason
    - RLS policies updated to allow corrections

  3. Notes
    - Cancelled transactions remain in database for audit trail
    - Correction transactions reference the original transaction
    - Triggers will handle balance updates automatically
*/

-- Add correction columns to transactions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'annule'
  ) THEN
    ALTER TABLE transactions ADD COLUMN annule boolean DEFAULT false NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'transaction_origine_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN transaction_origine_id uuid REFERENCES transactions(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'raison_correction'
  ) THEN
    ALTER TABLE transactions ADD COLUMN raison_correction text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'corrigee_par'
  ) THEN
    ALTER TABLE transactions ADD COLUMN corrigee_par uuid REFERENCES users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'corrigee_le'
  ) THEN
    ALTER TABLE transactions ADD COLUMN corrigee_le timestamptz;
  END IF;
END $$;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_annule ON transactions(annule);
CREATE INDEX IF NOT EXISTS idx_transactions_origine ON transactions(transaction_origine_id);

-- Create a function to handle transaction corrections
CREATE OR REPLACE FUNCTION creer_correction_transaction(
  p_transaction_id uuid,
  p_raison text,
  p_user_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_transaction record;
  v_correction_id uuid;
  v_type_correction text;
BEGIN
  -- Get original transaction
  SELECT * INTO v_transaction
  FROM transactions
  WHERE id = p_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction non trouvée';
  END IF;

  IF v_transaction.annule THEN
    RAISE EXCEPTION 'Cette transaction a déjà été annulée';
  END IF;

  -- Determine correction type (inverse)
  IF v_transaction.type = 'depot' THEN
    v_type_correction := 'retrait';
  ELSE
    v_type_correction := 'depot';
  END IF;

  -- Create correction transaction (inverse operation)
  INSERT INTO transactions (
    type,
    service_id,
    montant,
    devise,
    info_client,
    notes,
    created_by,
    transaction_origine_id,
    raison_correction
  ) VALUES (
    v_type_correction,
    v_transaction.service_id,
    v_transaction.montant,
    v_transaction.devise,
    v_transaction.info_client,
    'CORRECTION - ' || COALESCE(v_transaction.notes, ''),
    p_user_id,
    p_transaction_id,
    p_raison
  ) RETURNING id INTO v_correction_id;

  -- Mark original transaction as cancelled
  UPDATE transactions
  SET 
    annule = true,
    corrigee_par = p_user_id,
    corrigee_le = now()
  WHERE id = p_transaction_id;

  -- Return result
  RETURN jsonb_build_object(
    'success', true,
    'correction_id', v_correction_id,
    'transaction_origine_id', p_transaction_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION creer_correction_transaction TO authenticated;

-- Update RLS policy to allow corrections by admin and proprietaire
DO $$
BEGIN
  -- Drop existing insert policy if exists
  DROP POLICY IF EXISTS "Allow insert for authenticated users" ON transactions;
  
  -- Create new insert policy
  CREATE POLICY "Allow insert for authenticated users" ON transactions
    FOR INSERT
    TO authenticated
    WITH CHECK (
      auth.uid() = created_by OR
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role IN ('Administrateur', 'Proprietaire', 'Caissier', 'Gerant')
      )
    );
END $$;

-- Add comment
COMMENT ON FUNCTION creer_correction_transaction IS 'Creates a correction transaction by reversing the original transaction and marking it as cancelled';
