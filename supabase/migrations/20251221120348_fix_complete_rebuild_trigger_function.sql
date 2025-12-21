/*
  # Reconstruction Complète de la Fonction et du Trigger de Validation
  
  ## Description
  Suppression complète et recréation propre de la fonction trigger et du trigger
  pour éliminer tout problème de définition ou de cache.
  
  ## Changes
  1. Suppression complète du trigger
  2. Suppression complète de la fonction
  3. Recréation propre de la fonction avec une logique claire
  4. Recréation propre du trigger
  
  ## Security
  - Fonction avec SECURITY DEFINER pour bypasser RLS
  - Aucun changement aux policies RLS
*/

-- 1. Supprimer le trigger
DROP TRIGGER IF EXISTS trigger_update_balances_on_validation ON transaction_headers;

-- 2. Supprimer la fonction
DROP FUNCTION IF EXISTS update_balances_on_validation();

-- 3. Recréer la fonction proprement
CREATE FUNCTION update_balances_on_validation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line RECORD;
  v_global_balance_id uuid;
BEGIN
  -- Ne traiter que le changement vers 'validee'
  IF NEW.statut = 'validee' AND (OLD.statut IS DISTINCT FROM 'validee') THEN
    
    -- Obtenir l'ID du global_balance (ou le créer s'il n'existe pas)
    SELECT id INTO v_global_balance_id
    FROM global_balances
    LIMIT 1;
    
    IF v_global_balance_id IS NULL THEN
      INSERT INTO global_balances (cash_usd, cash_cdf)
      VALUES (0, 0)
      RETURNING id INTO v_global_balance_id;
    END IF;
    
    -- Traiter chaque ligne de la transaction
    FOR v_line IN 
      SELECT * FROM transaction_lines
      WHERE header_id = NEW.id
      ORDER BY ligne_numero
    LOOP
      -- Ignorer les lignes de type 'change' (utilisées pour équilibrage)
      IF v_line.type_portefeuille = 'change' THEN
        CONTINUE;
      END IF;
      
      -- Mise à jour selon le type de portefeuille
      IF v_line.type_portefeuille = 'cash' THEN
        -- Mise à jour des soldes cash globaux
        IF v_line.devise = 'USD' THEN
          IF v_line.sens = 'debit' THEN
            -- Débit = augmentation du cash
            UPDATE global_balances
            SET cash_usd = cash_usd + v_line.montant
            WHERE id = v_global_balance_id;
          ELSE
            -- Crédit = diminution du cash
            UPDATE global_balances
            SET cash_usd = cash_usd - v_line.montant
            WHERE id = v_global_balance_id;
          END IF;
        ELSIF v_line.devise = 'CDF' THEN
          IF v_line.sens = 'debit' THEN
            UPDATE global_balances
            SET cash_cdf = cash_cdf + v_line.montant
            WHERE id = v_global_balance_id;
          ELSE
            UPDATE global_balances
            SET cash_cdf = cash_cdf - v_line.montant
            WHERE id = v_global_balance_id;
          END IF;
        END IF;
        
      ELSIF v_line.type_portefeuille = 'virtuel' AND v_line.service_id IS NOT NULL THEN
        -- Mise à jour des soldes virtuels des services
        IF v_line.devise = 'USD' THEN
          IF v_line.sens = 'debit' THEN
            -- Débit = diminution du virtuel
            UPDATE services
            SET solde_virtuel_usd = solde_virtuel_usd - v_line.montant
            WHERE id = v_line.service_id;
          ELSE
            -- Crédit = augmentation du virtuel
            UPDATE services
            SET solde_virtuel_usd = solde_virtuel_usd + v_line.montant
            WHERE id = v_line.service_id;
          END IF;
        ELSIF v_line.devise = 'CDF' THEN
          IF v_line.sens = 'debit' THEN
            UPDATE services
            SET solde_virtuel_cdf = solde_virtuel_cdf - v_line.montant
            WHERE id = v_line.service_id;
          ELSE
            UPDATE services
            SET solde_virtuel_cdf = solde_virtuel_cdf + v_line.montant
            WHERE id = v_line.service_id;
          END IF;
        END IF;
      END IF;
    END LOOP;
    
    -- Mettre à jour le timestamp de validation
    NEW.validated_at := now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Créer le trigger proprement
CREATE TRIGGER trigger_update_balances_on_validation
  BEFORE UPDATE ON transaction_headers
  FOR EACH ROW
  WHEN (NEW.statut = 'validee' AND (OLD.statut IS DISTINCT FROM 'validee'))
  EXECUTE FUNCTION update_balances_on_validation();

-- 5. Ajouter les commentaires
COMMENT ON FUNCTION update_balances_on_validation() IS 
  'Met à jour automatiquement les soldes cash et virtuels lors de la validation d''une transaction multi-lignes. Les lignes de type "change" sont ignorées (utilisées uniquement pour équilibrage comptable).';

COMMENT ON TRIGGER trigger_update_balances_on_validation ON transaction_headers IS 
  'Déclenché lors du passage d''une transaction au statut "validee" pour mettre à jour les soldes correspondants';
