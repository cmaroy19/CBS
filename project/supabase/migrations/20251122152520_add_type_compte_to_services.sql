/*
  # Ajouter type de compte aux services

  1. Changement
    - Ajouter colonne `type_compte` à la table `services`
    - Valeurs possibles: 'cash' ou 'virtuel'
    - Par défaut: 'virtuel' (comportement actuel)
    
  2. But
    - Un service avec type_compte='cash' → les approvisionnements impactent le cash global
    - Un service avec type_compte='virtuel' → les approvisionnements impactent le solde virtuel du service
    
  3. Migration des données
    - Tous les services existants → 'virtuel' par défaut
*/

-- Ajouter la colonne type_compte
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS type_compte text DEFAULT 'virtuel' CHECK (type_compte IN ('cash', 'virtuel'));

-- Mettre à jour les services existants (tous en virtuel par défaut)
UPDATE services 
SET type_compte = 'virtuel'
WHERE type_compte IS NULL;

-- Rendre la colonne NOT NULL maintenant qu'elle est remplie
ALTER TABLE services 
ALTER COLUMN type_compte SET NOT NULL;

-- Créer un index pour les requêtes
CREATE INDEX IF NOT EXISTS idx_services_type_compte ON services(type_compte);

-- Commentaire
COMMENT ON COLUMN services.type_compte IS 
  'Type de compte du service: cash (impact cash global) ou virtuel (impact solde virtuel du service)';
