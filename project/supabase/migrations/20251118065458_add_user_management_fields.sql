/*
  # Ajouter les champs de gestion des utilisateurs

  1. Changements
    - Ajouter le champ `age` (integer, nullable) à la table users
    - Ajouter le champ `last_login_at` (timestamptz, nullable) à la table users
    - Ajouter le champ `suspended` (boolean, default false) à la table users
    - Ajouter le champ `suspended_at` (timestamptz, nullable) à la table users
    - Ajouter le champ `suspended_by` (uuid, nullable, FK vers users) à la table users
    
  2. Sécurité
    - Maintenir les politiques RLS existantes
*/

-- Ajouter le champ age
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'age'
  ) THEN
    ALTER TABLE users ADD COLUMN age integer;
  END IF;
END $$;

-- Ajouter le champ last_login_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'last_login_at'
  ) THEN
    ALTER TABLE users ADD COLUMN last_login_at timestamptz;
  END IF;
END $$;

-- Ajouter le champ suspended
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'suspended'
  ) THEN
    ALTER TABLE users ADD COLUMN suspended boolean DEFAULT false;
  END IF;
END $$;

-- Ajouter le champ suspended_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'suspended_at'
  ) THEN
    ALTER TABLE users ADD COLUMN suspended_at timestamptz;
  END IF;
END $$;

-- Ajouter le champ suspended_by
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'suspended_by'
  ) THEN
    ALTER TABLE users ADD COLUMN suspended_by uuid REFERENCES users(id);
  END IF;
END $$;

-- Créer un bucket pour les photos de profil si non existant
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Politique de stockage pour les avatars
DO $$
BEGIN
  DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
  CREATE POLICY "Avatars are publicly accessible"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
  CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
  CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
  CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
END $$;
