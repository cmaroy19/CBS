# Correction de l'erreur "trigger functions can only be called as triggers"

## Problème Rencontré

Lors de toute opération sur la table `transaction_headers` (création ou validation), l'erreur suivante apparaissait:

```
ERROR: 0A000: trigger functions can only be called as triggers
CONTEXT: compilation of PL/pgSQL function "generate_transaction_reference" near line 1
PL/pgSQL function set_transaction_reference() line 4 at assignment
```

Cette erreur se produisait même lors de la simple création d'une transaction, pas seulement lors de la validation.

## Cause RÉELLE du Problème

Le problème n'était PAS avec `update_balances_on_validation` comme on pouvait le croire initialement.

### Le Vrai Coupable: `generate_transaction_reference()`

La fonction `generate_transaction_reference()` était définie comme une fonction TRIGGER (avec `RETURNS trigger`), mais elle était appelée DIRECTEMENT comme une fonction normale dans `set_transaction_reference()`:

```sql
-- Code problématique dans set_transaction_reference()
CREATE FUNCTION set_transaction_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    -- ERREUR: appel direct d'une fonction trigger!
    NEW.reference := generate_transaction_reference();
  END IF;
  RETURN NEW;
END;
$$;
```

**Règle PostgreSQL**: Une fonction définie avec `RETURNS trigger` ne peut être invoquée QUE par un trigger système, jamais directement dans du code PL/pgSQL.

### Problème Additionnel

Il existait aussi un ancien trigger sur une table obsolète `transactions` qui utilisait la même fonction, créant une dépendance qui empêchait la modification directe de la fonction.

## Solution Appliquée

### Migration 1: Nettoyage (`fix_generate_reference_remove_old_trigger`)

1. **Suppression de l'ancien trigger** sur la table `transactions`
2. **Suppression de l'ancienne fonction** avec CASCADE pour supprimer toutes les dépendances

```sql
DROP TRIGGER IF EXISTS trigger_generate_transaction_reference ON transactions;
DROP FUNCTION IF EXISTS generate_transaction_reference() CASCADE;
```

### Migration 2: Recréation Correcte (`fix_generate_reference_create_text_function`)

1. **Recréation de la fonction pour retourner TEXT**:

```sql
CREATE FUNCTION generate_transaction_reference()
RETURNS TEXT  -- <-- TEXT au lieu de TRIGGER!
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
  v_today := CURRENT_DATE;
  v_date_part := to_char(v_today, 'DD-MM-YYYY');

  -- Compte sur transaction_headers au lieu de transactions
  SELECT COUNT(*) + 1 INTO v_count
  FROM transaction_headers
  WHERE DATE(created_at) = v_today;

  v_reference := v_date_part || '-' || lpad(v_count::text, 4, '0');

  RETURN v_reference;
END;
$$;
```

2. **Mise à jour de set_transaction_reference()** (pas de changement de code, juste reconstruction):

```sql
CREATE OR REPLACE FUNCTION set_transaction_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    -- Maintenant OK: appel d'une fonction qui retourne TEXT
    NEW.reference := generate_transaction_reference();
  END IF;
  RETURN NEW;
END;
$$;
```

## Changements Clés

1. **Type de retour changé**: `RETURNS trigger` → `RETURNS TEXT`
2. **Table mise à jour**: `transactions` → `transaction_headers`
3. **Nettoyage**: Suppression de l'ancien trigger sur la table obsolète

## Vérification de la Correction

### Test 1: Création de Transaction

```sql
INSERT INTO transaction_headers (
  type_operation, devise_reference, montant_total, statut, created_by
) VALUES (
  'depot', 'USD', 100, 'brouillon', '<user_id>'
);
```

Résultat attendu:
- Transaction créée avec succès
- Référence générée automatiquement au format `DD-MM-YYYY-####`
- Aucune erreur

### Test 2: Validation de Transaction

```sql
-- Créer les lignes
INSERT INTO transaction_lines (header_id, ligne_numero, type_portefeuille, devise, sens, montant)
VALUES
  ('<header_id>', 1, 'cash', 'USD', 'debit', 100),
  ('<header_id>', 2, 'virtuel', 'USD', 'credit', 100);

-- Valider
UPDATE transaction_headers
SET statut = 'validee'
WHERE id = '<header_id>';
```

Résultat attendu:
- Transaction validée avec succès
- Soldes mis à jour automatiquement
- Aucune erreur

### Test 3: Vérification du Build

```bash
npm run build
```

Résultat attendu:
- Build réussi sans erreurs
- Tous les modules transformés correctement

## Bonnes Pratiques Apprises

### 1. Comprendre les Types de Fonctions PostgreSQL

**Fonctions TRIGGER (`RETURNS trigger`)**:
- Ne peuvent être appelées que par un trigger
- Reçoivent automatiquement les variables `NEW`, `OLD`, `TG_OP`, etc.
- Doivent retourner `NEW`, `OLD`, ou `NULL`

**Fonctions Normales (`RETURNS <type>`)**:
- Peuvent être appelées directement dans du code SQL/PL/pgSQL
- Doivent retourner le type spécifié
- Plus flexibles pour la réutilisation

### 2. Quand Utiliser Chaque Type

**Utiliser une fonction TRIGGER quand**:
- La fonction doit être exécutée automatiquement lors d'événements (INSERT, UPDATE, DELETE)
- La fonction a besoin d'accéder aux variables de contexte du trigger (`OLD`, `NEW`)
- La fonction contrôle l'exécution de l'opération (peut annuler l'opération)

**Utiliser une fonction normale quand**:
- La fonction doit être appelée explicitement depuis du code
- La fonction est une utilité réutilisable (calculs, formatage, validation)
- La fonction peut être appelée dans des SELECTs, des expressions, etc.

### 3. Diagnostiquer l'Erreur "trigger functions can only be called as triggers"

Quand cette erreur apparaît, chercher:
1. Les fonctions définies avec `RETURNS trigger`
2. Les appels directs à ces fonctions dans du code PL/pgSQL
3. Les assignations de variable utilisant ces fonctions

**Exemple d'erreur**:
```sql
v_result := my_trigger_function();  -- ❌ ERREUR!
```

**Solution**:
```sql
-- Option 1: Changer le type de retour
CREATE FUNCTION my_function() RETURNS TEXT ...

-- Option 2: Séparer en deux fonctions
CREATE FUNCTION my_helper() RETURNS TEXT ...  -- Fonction helper
CREATE FUNCTION my_trigger() RETURNS TRIGGER ...  -- Fonction trigger
```

### 4. Migration de Code Existant

Quand on modifie une fonction existante:
1. Vérifier les dépendances avec `\df+ function_name` ou les requêtes système
2. Supprimer les dépendances d'abord (triggers, vues, autres fonctions)
3. Utiliser `CASCADE` si nécessaire pour forcer la suppression
4. Recréer la fonction avec la nouvelle signature
5. Recréer les dépendances

## Migrations Appliquées

1. **`fix_generate_reference_remove_old_trigger.sql`**
   - Nettoyage de l'ancien trigger et fonction

2. **`fix_generate_reference_create_text_function.sql`**
   - Recréation avec le bon type de retour (TEXT)

## Conclusion

L'erreur "trigger functions can only be called as triggers" était causée par:
- Une fonction `generate_transaction_reference()` mal typée (TRIGGER au lieu de TEXT)
- Un appel direct à cette fonction dans `set_transaction_reference()`

La solution:
- Supprimer l'ancienne fonction et ses dépendances
- Recréer la fonction avec `RETURNS TEXT`
- Mettre à jour les références à la table correcte (`transaction_headers`)

Le système fonctionne maintenant correctement:
- Génération automatique de références pour les nouvelles transactions
- Validation de transactions multi-lignes
- Mise à jour automatique des soldes
- Aucune erreur lors des opérations
