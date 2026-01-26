/*
  # Ajout d'un Flag pour les Lignes de Conversion

  ## Problème
  Le trigger update_balances_on_validation applique toutes les lignes,
  y compris les lignes de conversion qui servent uniquement à équilibrer
  la comptabilité en partie double mais ne doivent pas affecter les soldes réels.

  ## Solution
  Ajouter un champ `is_conversion_line` pour marquer les lignes de conversion,
  et modifier le trigger pour ignorer ces lignes lors de la mise à jour des soldes.
*/

-- Ajouter le champ is_conversion_line
ALTER TABLE transaction_lines 
ADD COLUMN IF NOT EXISTS is_conversion_line boolean DEFAULT false;

-- Modifier le trigger pour ignorer les lignes de conversion
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
  IF NEW.statut = 'validee' AND (OLD.statut IS NULL OR OLD.statut != 'validee') THEN
    
    SELECT * INTO v_global_balance
    FROM global_balances
    LIMIT 1;
    
    IF v_global_balance IS NULL THEN
      INSERT INTO global_balances (cash_usd, cash_cdf)
      VALUES (0, 0)
      RETURNING * INTO v_global_balance;
    END IF;
    
    FOR v_line IN 
      SELECT * FROM transaction_lines
      WHERE header_id = NEW.id
      AND (is_conversion_line IS NULL OR is_conversion_line = false)
      ORDER BY ligne_numero
    LOOP
      IF v_line.type_portefeuille = 'cash' THEN
        IF v_line.devise = 'USD' THEN
          IF v_line.sens = 'debit' THEN
            UPDATE global_balances
            SET cash_usd = cash_usd + v_line.montant,
                updated_at = now()
            WHERE id = v_global_balance.id;
          ELSE
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
        IF v_line.devise = 'USD' THEN
          IF v_line.sens = 'debit' THEN
            UPDATE services
            SET solde_virtuel_usd = solde_virtuel_usd + v_line.montant,
                updated_at = now()
            WHERE id = v_line.service_id;
          ELSE
            UPDATE services
            SET solde_virtuel_usd = solde_virtuel_usd - v_line.montant,
                updated_at = now()
            WHERE id = v_line.service_id;
          END IF;
        ELSIF v_line.devise = 'CDF' THEN
          IF v_line.sens = 'debit' THEN
            UPDATE services
            SET solde_virtuel_cdf = solde_virtuel_cdf + v_line.montant,
                updated_at = now()
            WHERE id = v_line.service_id;
          ELSE
            UPDATE services
            SET solde_virtuel_cdf = solde_virtuel_cdf - v_line.montant,
                updated_at = now()
            WHERE id = v_line.service_id;
          END IF;
        END IF;
      END IF;
    END LOOP;
    
    NEW.validated_at := now();
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_balances_on_validation IS 
  'Met à jour les soldes cash et virtuels en ignorant les lignes de conversion (is_conversion_line = true)';

COMMENT ON COLUMN transaction_lines.is_conversion_line IS
  'Indique si cette ligne est une ligne de conversion utilisée uniquement pour équilibrer la comptabilité en partie double';
