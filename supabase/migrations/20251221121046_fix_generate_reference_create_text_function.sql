/*
  # Correction de l'erreur "trigger functions can only be called as triggers" - Partie 2
  
  ## Solution - Partie 2: Recréation
  Créer une nouvelle fonction `generate_transaction_reference()` qui retourne TEXT
  au lieu de TRIGGER, permettant son appel direct depuis d'autres fonctions.
  
  ## Changes
  1. Créer `generate_transaction_reference()` qui retourne TEXT
  2. Mettre à jour `set_transaction_reference()` pour l'utiliser correctement
*/

-- 1. Créer la nouvelle fonction qui retourne TEXT
CREATE FUNCTION generate_transaction_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_part text;
  v_count int;
  v_reference text;
  v_today date;
BEGIN
  -- Obtenir la date actuelle
  v_today := CURRENT_DATE;
  
  -- Formater la date en DD-MM-YYYY
  v_date_part := to_char(v_today, 'DD-MM-YYYY');
  
  -- Compter les transactions existantes pour aujourd'hui pour obtenir le prochain numéro de séquence
  SELECT COUNT(*) + 1 INTO v_count
  FROM transaction_headers
  WHERE DATE(created_at) = v_today;
  
  -- Format: DD-MM-YYYY-#### (ex: 21-12-2025-0001)
  v_reference := v_date_part || '-' || lpad(v_count::text, 4, '0');
  
  RETURN v_reference;
END;
$$;

-- 2. Mettre à jour set_transaction_reference pour utiliser correctement la fonction
CREATE OR REPLACE FUNCTION set_transaction_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Générer une référence si elle est vide ou NULL
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    NEW.reference := generate_transaction_reference();
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Ajouter les commentaires
COMMENT ON FUNCTION generate_transaction_reference() IS 
  'Génère une référence unique pour une transaction au format DD-MM-YYYY-#### (ex: 21-12-2025-0001). Retourne TEXT pour permettre l''appel direct depuis d''autres fonctions.';

COMMENT ON FUNCTION set_transaction_reference() IS 
  'Fonction trigger qui génère automatiquement une référence pour les nouvelles transactions si aucune référence n''est fournie.';
