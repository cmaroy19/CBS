/*
  # Ajout du système de correction pour transaction_headers

  1. Nouvelles colonnes
    - `transaction_origine_id` (uuid, nullable) - Référence à la transaction originale si c'est une correction
    - `raison_correction` (text, nullable) - Raison de la correction
    - `corrigee_par` (uuid, nullable) - Utilisateur qui a fait la correction
    - `corrigee_le` (timestamptz, nullable) - Date de la correction

  2. Notes
    - Les transactions annulées gardent leur historique complet
    - Les corrections sont tracées avec l'utilisateur et la date
*/

-- Ajouter les colonnes de correction à transaction_headers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transaction_headers' AND column_name = 'transaction_origine_id'
  ) THEN
    ALTER TABLE transaction_headers ADD COLUMN transaction_origine_id uuid REFERENCES transaction_headers(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transaction_headers' AND column_name = 'raison_correction'
  ) THEN
    ALTER TABLE transaction_headers ADD COLUMN raison_correction text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transaction_headers' AND column_name = 'corrigee_par'
  ) THEN
    ALTER TABLE transaction_headers ADD COLUMN corrigee_par uuid REFERENCES users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transaction_headers' AND column_name = 'corrigee_le'
  ) THEN
    ALTER TABLE transaction_headers ADD COLUMN corrigee_le timestamptz;
  END IF;
END $$;

-- Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_transaction_headers_annulee ON transaction_headers(transaction_origine_id) WHERE transaction_origine_id IS NOT NULL;

-- Fonction pour corriger une transaction multi-lignes
CREATE OR REPLACE FUNCTION creer_correction_transaction_mixte(
  p_header_id uuid,
  p_raison text,
  p_user_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_header record;
  v_correction_header_id uuid;
  v_line record;
  v_inverse_sens text;
BEGIN
  -- Récupérer la transaction originale
  SELECT * INTO v_header
  FROM transaction_headers
  WHERE id = p_header_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction non trouvée';
  END IF;

  IF v_header.statut = 'annulee' THEN
    RAISE EXCEPTION 'Cette transaction a déjà été annulée';
  END IF;

  -- Créer le header de correction (inverse)
  INSERT INTO transaction_headers (
    type_operation,
    devise_reference,
    montant_total,
    description,
    info_client,
    taux_change,
    paire_devises,
    statut,
    created_by,
    validated_by,
    validated_at,
    transaction_origine_id,
    raison_correction
  ) VALUES (
    v_header.type_operation,
    v_header.devise_reference,
    v_header.montant_total,
    'CORRECTION - ' || COALESCE(v_header.description, ''),
    v_header.info_client,
    v_header.taux_change,
    v_header.paire_devises,
    'validee',
    p_user_id,
    p_user_id,
    now(),
    p_header_id,
    p_raison
  ) RETURNING id INTO v_correction_header_id;

  -- Copier les lignes en inversant le sens (débit <-> crédit)
  FOR v_line IN 
    SELECT * FROM transaction_lines 
    WHERE header_id = p_header_id
    ORDER BY ligne_numero
  LOOP
    -- Inverser le sens
    IF v_line.sens = 'debit' THEN
      v_inverse_sens := 'credit';
    ELSE
      v_inverse_sens := 'debit';
    END IF;

    -- Insérer la ligne inversée
    INSERT INTO transaction_lines (
      header_id,
      ligne_numero,
      type_portefeuille,
      service_id,
      devise,
      sens,
      montant,
      description
    ) VALUES (
      v_correction_header_id,
      v_line.ligne_numero,
      v_line.type_portefeuille,
      v_line.service_id,
      v_line.devise,
      v_inverse_sens,
      v_line.montant,
      'CORRECTION - ' || COALESCE(v_line.description, '')
    );
  END LOOP;

  -- Marquer la transaction originale comme annulée
  UPDATE transaction_headers
  SET 
    statut = 'annulee',
    corrigee_par = p_user_id,
    corrigee_le = now()
  WHERE id = p_header_id;

  -- Retourner le résultat
  RETURN jsonb_build_object(
    'success', true,
    'correction_id', v_correction_header_id,
    'transaction_origine_id', p_header_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Accorder les permissions
GRANT EXECUTE ON FUNCTION creer_correction_transaction_mixte TO authenticated;

-- Commentaires
COMMENT ON FUNCTION creer_correction_transaction_mixte IS 'Crée une correction pour une transaction multi-lignes en inversant tous les débits/crédits';
