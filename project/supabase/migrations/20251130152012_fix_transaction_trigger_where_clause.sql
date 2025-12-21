/*
  # Fix Transaction Trigger - Add WHERE Clause

  1. Changes
    - Add WHERE clause to UPDATE global_balances statement
    - Ensures single row update instead of full table update
    - Fixes "UPDATE requires a WHERE clause" error

  2. Security
    - Maintains SECURITY DEFINER privilege
    - No changes to RLS policies
*/

-- Recréer la fonction avec la clause WHERE corrigée
CREATE OR REPLACE FUNCTION update_soldes_on_transaction()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_solde_key text;
  v_cash_key text;
  v_current_service_solde numeric;
  v_current_cash numeric;
  v_new_service_solde numeric;
  v_new_cash numeric;
  v_global_balance_id uuid;
BEGIN
  -- Déterminer les clés de colonnes selon la devise
  IF NEW.devise = 'USD' THEN
    v_solde_key := 'solde_virtuel_usd';
    v_cash_key := 'cash_usd';
  ELSE
    v_solde_key := 'solde_virtuel_cdf';
    v_cash_key := 'cash_cdf';
  END IF;

  -- Récupérer le solde actuel du service
  EXECUTE format('SELECT %I FROM services WHERE id = $1', v_solde_key)
    INTO v_current_service_solde
    USING NEW.service_id;

  -- Récupérer le cash global actuel et l'ID
  EXECUTE format('SELECT id, %I FROM global_balances LIMIT 1', v_cash_key)
    INTO v_global_balance_id, v_current_cash;

  -- Calculer les nouveaux soldes selon le type de transaction
  IF NEW.type = 'depot' THEN
    -- DEPOT: client dépose → cash augmente, virtuel service diminue
    v_new_cash := v_current_cash + NEW.montant;
    v_new_service_solde := v_current_service_solde - NEW.montant;
  ELSE
    -- RETRAIT: client retire → cash diminue, virtuel service augmente
    v_new_cash := v_current_cash - NEW.montant;
    v_new_service_solde := v_current_service_solde + NEW.montant;
  END IF;

  -- Mettre à jour le solde du service
  EXECUTE format('UPDATE services SET %I = $1 WHERE id = $2', v_solde_key)
    USING v_new_service_solde, NEW.service_id;

  -- Mettre à jour le cash global avec WHERE clause
  EXECUTE format('UPDATE global_balances SET %I = $1 WHERE id = $2', v_cash_key)
    USING v_new_cash, v_global_balance_id;

  RETURN NEW;
END;
$$;

-- Commentaire pour documentation
COMMENT ON FUNCTION update_soldes_on_transaction() IS
  'Met à jour automatiquement les soldes du service et du cash global après création d''une transaction';
