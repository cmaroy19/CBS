/*
  # Corriger la policy d'insertion pour la table users

  1. Changements
    - Ajouter une policy pour permettre l'insertion lors de l'inscription
    - Permettre aux utilisateurs de créer leur propre profil après inscription
*/

-- Policy pour permettre l'insertion du profil lors de l'inscription
CREATE POLICY "Users can insert own profile on signup"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
