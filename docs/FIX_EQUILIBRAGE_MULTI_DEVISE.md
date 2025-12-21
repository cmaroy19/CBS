# Correction de l'Équilibrage des Transactions Multi-Devises

## Problème Initial

Lors de la création de transactions mixtes (paiement en deux devises), l'erreur suivante apparaissait :
```
Transaction non équilibrée pour USD: débit = 17, crédit = 10
```

### Cause du Problème

La structure initiale des lignes de transaction ne permettait pas d'équilibrer correctement chaque devise séparément.

**Structure problématique** (Retrait de 17 USD avec 10 USD + 7 USD en CDF):
```
Ligne 1: Débit virtuel USD - 17 USD
Ligne 2: Crédit cash USD - 10 USD
Ligne 3: Crédit cash CDF - 17500 CDF
```

**Résultat**:
- USD: Débit 17 ≠ Crédit 10 ❌
- CDF: Débit 0 ≠ Crédit 17500 ❌

Dans un système de comptabilité à double entrée, **chaque devise doit être équilibrée indépendamment** (total débits = total crédits).

## Solution Implémentée

### Ajout du Type de Portefeuille "Change"

Nous avons introduit des lignes intermédiaires de type `"change"` qui représentent la conversion entre devises. Ces lignes permettent d'équilibrer chaque devise séparément sans affecter les soldes réels.

### Nouvelle Structure (5 lignes au lieu de 3)

**Retrait de 17 USD avec 10 USD cash + 7 USD en CDF (17500 CDF)**:

**Lignes en USD** (équilibrées):
```
Ligne 1: Débit virtuel - 17 USD
Ligne 2: Crédit cash - 10 USD
Ligne 3: Crédit change (sortant) - 7 USD
Total: Débit 17 = Crédit (10 + 7) ✓
```

**Lignes en CDF** (équilibrées):
```
Ligne 4: Débit change (entrant) - 17500 CDF
Ligne 5: Crédit cash - 17500 CDF
Total: Débit 17500 = Crédit 17500 ✓
```

### Principe Comptable

Les lignes de "change" créent un pont entre les deux devises :
1. En USD, on "sort" 7 USD vers le change (crédit)
2. En CDF, on "entre" 17500 CDF depuis le change (débit)

Ces lignes s'annulent conceptuellement (elles représentent la même valeur dans deux devises différentes) mais permettent d'équilibrer la comptabilité de chaque devise indépendamment.

## Modifications Techniques

### 1. Fichier `TransactionsForm.tsx`

Modification de la fonction `createMixedTransaction()` pour créer 5 lignes au lieu de 3.

**Dépôt mixte**:
```typescript
// Lignes en devise principale
Ligne 1: Débit cash (devise principale)
Ligne 2: Débit change (devise principale)
Ligne 3: Crédit service virtuel

// Lignes en devise secondaire
Ligne 4: Débit cash (devise secondaire)
Ligne 5: Crédit change (devise secondaire)
```

**Retrait mixte**:
```typescript
// Lignes en devise principale
Ligne 1: Débit service virtuel
Ligne 2: Crédit cash (devise principale)
Ligne 3: Crédit change (devise principale)

// Lignes en devise secondaire
Ligne 4: Débit change (devise secondaire)
Ligne 5: Crédit cash (devise secondaire)
```

### 2. Migration `20251221_update_trigger_handle_change_portfolio.sql`

Mise à jour du trigger `update_balances_on_validation()` pour :
- **Ignorer** les lignes de type "change" lors de la mise à jour des soldes
- Ces lignes servent uniquement à l'équilibrage comptable
- Seules les lignes de type "cash" et "virtuel" mettent à jour les soldes réels

```sql
-- Skip 'change' portfolio type (used only for balancing)
IF v_line.type_portefeuille = 'change' THEN
  CONTINUE;
END IF;
```

## Impact sur les Soldes

### Exemple Concret : Retrait de 17 USD (10 USD + 7 USD en CDF = 17500 CDF)

**Avant validation** :
- Service virtuel USD: 100 USD
- Cash USD: 50 USD
- Cash CDF: 100000 CDF

**Lignes créées** :
1. Débit virtuel 17 USD → Solde service: 100 - 17 = 83 USD
2. Crédit cash 10 USD → Cash USD: 50 - 10 = 40 USD
3. Crédit change 7 USD → **Ignoré**
4. Débit change 17500 CDF → **Ignoré**
5. Crédit cash 17500 CDF → Cash CDF: 100000 - 17500 = 82500 CDF

**Après validation** :
- Service virtuel USD: 83 USD ✓
- Cash USD: 40 USD ✓
- Cash CDF: 82500 CDF ✓

## Avantages de cette Approche

1. **Conformité comptable** : Respect strict de la comptabilité à double entrée
2. **Traçabilité** : Les opérations de change sont visibles dans les lignes de transaction
3. **Simplicité** : Les lignes de change sont automatiquement ignorées lors des mises à jour
4. **Flexibilité** : Structure extensible pour d'autres types d'opérations multi-devises
5. **Validation automatique** : Le système vérifie l'équilibre avant d'accepter la transaction

## Tests de Validation

Pour vérifier que le système fonctionne correctement, testez :

1. **Retrait mixte** :
   - Créer un retrait de 13 USD
   - Choisir "Paiement mixte"
   - Spécifier 10 USD en cash
   - Vérifier que le système accepte la transaction
   - Vérifier les soldes après validation

2. **Dépôt mixte** :
   - Créer un dépôt de 25 USD
   - Choisir "Paiement mixte"
   - Spécifier 20 USD en cash
   - Vérifier que le système accepte la transaction
   - Vérifier les soldes après validation

3. **Équilibre des lignes** :
   - Consulter les lignes de transaction dans `transaction_lines`
   - Vérifier que pour chaque devise : total débits = total crédits

## Documentation Mise à Jour

- `docs/PAIEMENT_MIXTE.md` : Guide complet du système de paiement mixte
- `docs/FIX_EQUILIBRAGE_MULTI_DEVISE.md` : Ce document de correction

## Conclusion

Le problème d'équilibrage a été résolu en introduisant des lignes comptables intermédiaires de type "change". Cette approche respecte les principes de la comptabilité à double entrée tout en permettant des opérations multi-devises flexibles.
