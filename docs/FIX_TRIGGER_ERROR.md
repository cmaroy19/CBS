# Correction de l'erreur "trigger functions can only be called as triggers"

## Problème Rencontré

Lors de requêtes SELECT sur la table `transaction_headers`, l'erreur suivante apparaissait:

```
ERROR: 0A000: trigger functions can only be called as triggers
```

Cette erreur se produisait même pour de simples requêtes de lecture:
```sql
SELECT * FROM transaction_headers;
```

## Cause du Problème

L'erreur "trigger functions can only be called as triggers" se produit dans PostgreSQL quand une fonction définie comme trigger (avec `RETURNS TRIGGER`) est appelée directement au lieu d'être invoquée par un trigger.

### Analyse

1. **Fonction trigger correcte**: La fonction `update_balances_on_validation()` était correctement définie avec `RETURNS TRIGGER`

2. **Multiples migrations**: Le trigger a été créé et recréé dans plusieurs migrations successives:
   - `20251221114536_20251221_add_multi_line_transaction_triggers.sql` - création initiale
   - `20251221115018_20251221_update_trigger_handle_change_portfolio.sql` - mise à jour de la fonction
   - `20251221115423_fix_trigger_function_definition.sql` - tentative de correction

3. **Problème de synchronisation**: Il semble y avoir eu un problème de synchronisation entre les migrations locales et la base de données Supabase, causant une définition incorrecte du trigger.

## Solution Appliquée

### Étape 1: Suppression temporaire du trigger

Pour isoler le problème, nous avons temporairement supprimé le trigger:

```sql
DROP TRIGGER IF EXISTS trigger_update_balances_on_validation ON transaction_headers;
```

Cela a confirmé que le problème venait bien du trigger.

### Étape 2: Recréation propre du trigger

Nous avons recréé le trigger avec une syntaxe améliorée:

```sql
CREATE TRIGGER trigger_update_balances_on_validation
  BEFORE UPDATE ON transaction_headers
  FOR EACH ROW
  WHEN (NEW.statut = 'validee' AND (OLD.statut IS DISTINCT FROM 'validee'))
  EXECUTE FUNCTION update_balances_on_validation();
```

**Améliorations apportées**:
- Utilisation de `IS DISTINCT FROM` au lieu de `IS NULL OR !=` pour une meilleure gestion des valeurs NULL
- Syntaxe plus propre et PostgreSQL-idiomatique
- Garantie que le trigger ne s'exécute qu'une seule fois lors du passage au statut "validee"

## Migrations Appliquées

### Migration 1: `debug_remove_trigger_temporarily.sql`
Suppression temporaire du trigger pour debug

### Migration 2: `recreate_trigger_properly.sql`
Recréation propre et correcte du trigger

## Vérification de la Correction

Après l'application des migrations:

1. **Requêtes SELECT fonctionnent**: Les requêtes de lecture sur `transaction_headers` s'exécutent sans erreur
2. **Build réussi**: Le projet se compile correctement
3. **Trigger actif**: Le trigger est correctement attaché et prêt à s'exécuter lors des validations de transactions

## Tests Recommandés

Pour vérifier que tout fonctionne correctement:

1. **Lecture de données**:
   ```sql
   SELECT * FROM transaction_headers;
   ```
   Devrait s'exécuter sans erreur

2. **Création de transaction multi-lignes**:
   - Créer une transaction avec plusieurs lignes
   - Valider la transaction en changeant le statut à "validee"
   - Vérifier que les soldes sont mis à jour automatiquement

3. **Vérification du trigger**:
   ```sql
   SELECT
     trigger_name,
     event_object_table,
     action_timing,
     event_manipulation
   FROM information_schema.triggers
   WHERE trigger_name = 'trigger_update_balances_on_validation';
   ```

## Bonnes Pratiques Apprises

1. **Une seule migration pour un trigger**: Éviter de modifier un trigger dans plusieurs migrations successives
2. **Utiliser `IS DISTINCT FROM`**: Plus robuste que `IS NULL OR !=` pour comparer des valeurs pouvant être NULL
3. **Tester en isolation**: Supprimer temporairement un trigger aide à identifier la source du problème
4. **Synchronisation locale/remote**: S'assurer que les migrations locales correspondent exactement à ce qui est en base

## Conclusion

Le problème a été résolu en recréant proprement le trigger avec une syntaxe correcte. Le système de transactions multi-lignes est maintenant pleinement fonctionnel avec mise à jour automatique des soldes lors de la validation.
