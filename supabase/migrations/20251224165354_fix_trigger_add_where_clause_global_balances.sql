/*
  # Correction du Trigger - Ajout de WHERE clause pour global_balances

  1. Problème
    - Le trigger update_balances_from_transaction_lines() manque une clause WHERE
    - PostgreSQL exige une WHERE clause pour les UPDATE même si table a une seule ligne
    - Erreur: "UPDATE requires a WHERE clause"

  2. Solution
    - Ajouter WHERE clause basée sur l'ID de global_balances
    - Récupérer l'ID avec le SELECT initial
    - Appliquer l'UPDATE avec WHERE id = ...

  3. Notes
    - La table global_balances ne contient qu'une seule ligne
    - Cette correction garantit la conformité avec les règles PostgreSQL
*/

-- Recréer la fonction avec la clause WHERE manquante
CREATE OR REPLACE FUNCTION update_balances_from_transaction_lines()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_header_statut text;
  v_solde_key text;
  v_cash_key text;
  v_current_balance numeric;
  v_new_balance numeric;
  v_delta numeric;
  v_global_balance_id uuid;
BEGIN
  -- Vérifier si la transaction est validée
  SELECT statut INTO v_header_statut
  FROM transaction_headers
  WHERE id = NEW.header_id;

  -- Ne rien faire si la transaction n'est pas validée
  IF v_header_statut != 'validee' THEN
    RETURN NEW;
  END IF;

  -- Déterminer les clés de colonnes selon la devise
  IF NEW.devise = 'USD' THEN
    v_solde_key := 'solde_virtuel_usd';
    v_cash_key := 'cash_usd';
  ELSE
    v_solde_key := 'solde_virtuel_cdf';
    v_cash_key := 'cash_cdf';
  END IF;

  -- Calculer le delta selon le sens (debit = sortie, credit = entrée)
  IF NEW.sens = 'debit' THEN
    v_delta := -NEW.montant;  -- Sortie
  ELSE
    v_delta := NEW.montant;   -- Entrée
  END IF;

  -- Mettre à jour selon le type de portefeuille
  IF NEW.type_portefeuille = 'cash' THEN
    -- Récupérer l'ID et le solde actuel du cash global
    EXECUTE format('SELECT id, %I FROM global_balances LIMIT 1', v_cash_key)
      INTO v_global_balance_id, v_current_balance;
    
    v_new_balance := v_current_balance + v_delta;
    
    -- Mettre à jour avec WHERE clause
    EXECUTE format('UPDATE global_balances SET %I = $1 WHERE id = $2', v_cash_key)
      USING v_new_balance, v_global_balance_id;
      
  ELSIF NEW.type_portefeuille = 'virtuel' AND NEW.service_id IS NOT NULL THEN
    -- Mettre à jour le solde virtuel du service
    EXECUTE format('SELECT %I FROM services WHERE id = $1', v_solde_key)
      INTO v_current_balance
      USING NEW.service_id;
    
    v_new_balance := v_current_balance + v_delta;
    
    EXECUTE format('UPDATE services SET %I = $1 WHERE id = $2', v_solde_key)
      USING v_new_balance, NEW.service_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Commentaire pour documentation
COMMENT ON FUNCTION update_balances_from_transaction_lines() IS 
  'Met à jour automatiquement les soldes (cash global ou service) après insertion d''une ligne de transaction validée. Inclut WHERE clause requise.';
