/*
  # Créer un trigger pour synchroniser auth.users avec users

  1. Changements
    - Créer une fonction qui s'exécute automatiquement quand un utilisateur s'inscrit
    - Le trigger insère automatiquement l'utilisateur dans la table users
    - Utilise les metadata de auth pour définir le rôle
    
  2. Sécurité
    - Le trigger s'exécute avec les privilèges du système
    - Garantit que chaque utilisateur auth a une entrée dans users
*/

-- Fonction pour synchroniser les nouveaux utilisateurs
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, nom_complet, role, actif, suspended)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom_complet', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'caissier')::text,
    true,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Supprimer le trigger existant s'il existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Créer le trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Donner les permissions nécessaires
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON public.users TO supabase_auth_admin;
