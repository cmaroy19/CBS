# Plan de Tests : Système Achat/Vente Forex

## Objectif

Valider le bon fonctionnement de l'affichage automatique des taux d'achat/vente dans le formulaire de transaction mixte.

## Pré-requis

### Configuration Requise

Avant de commencer les tests, s'assurer que deux taux distincts sont configurés :

```sql
-- Vérifier les taux actifs
SELECT
  devise_source,
  devise_destination,
  taux,
  CASE
    WHEN devise_source = 'USD' THEN '1 USD = ' || taux || ' CDF'
    ELSE '1 CDF = ' || taux || ' USD (soit 1 USD = ' || ROUND(1.0/taux, 2) || ' CDF)'
  END as formule
FROM exchange_rates
WHERE actif = true;
```

**Résultat attendu :**

| devise_source | devise_destination | taux | formule |
|--------------|-------------------|------|---------|
| USD | CDF | 2300 | 1 USD = 2300 CDF |
| CDF | USD | 0.0004 | 1 CDF = 0.0004 USD (soit 1 USD = 2500 CDF) |

### Services de Test

Créer ou utiliser un service de test avec des soldes suffisants :
- Service : TEST_FOREX
- Solde virtuel USD : 1000 USD
- Solde virtuel CDF : 5,000,000 CDF
- Solde cash USD : 1000 USD
- Solde cash CDF : 5,000,000 CDF

## Catégories de Tests

### 1. Tests d'Affichage du Taux

#### Test 1.1 : Affichage initial (pas de montant saisi)

**Étapes :**
1. Ouvrir Transactions > Nouvelle transaction
2. Sélectionner l'onglet "Paiement mixte (Forex)"
3. Sélectionner Type : Retrait
4. Devise de référence : USD
5. Service : TEST_FOREX
6. Montant principal : 100 USD
7. Ne rien saisir dans les montants payés

**Résultat attendu :**
- Badge : 🟠 Amber "Vente USD"
- Libellé : "Taux de VENTE USD"
- Taux affiché : "1 USD = 2,300.00 CDF"
- Message : "La caisse donne des CDF au client"

#### Test 1.2 : Changement dynamique vers Achat USD

**Étapes (suite du Test 1.1) :**
1. Saisir 50 USD dans "Montant payé en USD"

**Résultat attendu :**
- Badge change vers : 🔵 Bleu "Achat USD"
- Libellé change vers : "Taux d'ACHAT USD"
- Taux affiché change vers : "1 USD = 2,500.00 CDF"
- Message change vers : "La caisse donne des USD au client"
- Montant CDF calculé automatiquement : 125,000 CDF (50 USD × 2,500)

#### Test 1.3 : Retour à Vente USD

**Étapes (suite du Test 1.2) :**
1. Mettre 0 dans "Montant payé en USD"

**Résultat attendu :**
- Badge revient à : 🟠 Amber "Vente USD"
- Libellé revient à : "Taux de VENTE USD"
- Taux affiché revient à : "1 USD = 2,300.00 CDF"
- Montant CDF recalculé : 230,000 CDF (100 USD × 2,300)

### 2. Tests de Calcul Automatique

#### Test 2.1 : Calcul CDF avec taux VENTE USD

**Étapes :**
1. Type : Retrait
2. Devise de référence : USD
3. Montant principal : 100 USD
4. Montant payé en USD : 0
5. Activer "Calcul auto"

**Résultat attendu :**
- Taux appliqué : VENTE USD (2,300)
- Montant CDF calculé : 230,000 CDF
- Détail du paiement affiche : "TAUX DE VENTE USD"

#### Test 2.2 : Calcul CDF avec taux ACHAT USD (paiement mixte)

**Étapes :**
1. Type : Retrait
2. Devise de référence : USD
3. Montant principal : 100 USD
4. Montant payé en USD : 40 USD
5. Activer "Calcul auto"

**Résultat attendu :**
- Taux appliqué : ACHAT USD (2,500)
- Reste à convertir : 60 USD
- Montant CDF calculé : 150,000 CDF (60 USD × 2,500)
- Détail du paiement affiche : "TAUX D'ACHAT USD"

#### Test 2.3 : Calcul USD avec taux ACHAT USD

**Étapes :**
1. Type : Retrait
2. Devise de référence : CDF
3. Montant principal : 250,000 CDF
4. Montant payé en CDF : 0
5. Activer "Calcul auto"

**Résultat attendu :**
- Taux appliqué : ACHAT USD (2,500)
- Montant USD calculé : 100 USD (250,000 / 2,500)
- Détail du paiement affiche : "TAUX D'ACHAT USD"

#### Test 2.4 : Calcul USD avec taux VENTE USD (paiement mixte)

**Étapes :**
1. Type : Retrait
2. Devise de référence : CDF
3. Montant principal : 250,000 CDF
4. Montant payé en CDF : 100,000 CDF
5. Activer "Calcul auto"

**Résultat attendu :**
- Taux appliqué : VENTE USD (2,300)
- Reste à convertir : 150,000 CDF
- Montant USD calculé : 65.22 USD (150,000 / 2,300)
- Détail du paiement affiche : "TAUX DE VENTE USD"

### 3. Tests de Validation

#### Test 3.1 : Validation montant correct (VENTE USD)

**Étapes :**
1. Type : Retrait
2. Devise de référence : USD
3. Montant principal : 100 USD
4. Montant payé en USD : 0
5. Désactiver "Calcul auto"
6. Saisir manuellement : 230,000 CDF
7. Soumettre

**Résultat attendu :**
- ✅ Transaction acceptée
- Aucune erreur de validation

#### Test 3.2 : Validation montant incorrect (VENTE USD)

**Étapes :**
1. Type : Retrait
2. Devise de référence : USD
3. Montant principal : 100 USD
4. Montant payé en USD : 0
5. Désactiver "Calcul auto"
6. Saisir manuellement : 250,000 CDF (mauvais montant)
7. Soumettre

**Résultat attendu :**
- ❌ Erreur affichée
- Message : "Montant CDF incorrect. Pour 100.00 USD au taux 2300.00, le montant attendu est 230000.00 CDF"

#### Test 3.3 : Validation montant correct (ACHAT USD)

**Étapes :**
1. Type : Retrait
2. Devise de référence : USD
3. Montant principal : 100 USD
4. Montant payé en USD : 50 USD
5. Désactiver "Calcul auto"
6. Saisir manuellement : 125,000 CDF
7. Soumettre

**Résultat attendu :**
- ✅ Transaction acceptée
- Taux appliqué : ACHAT USD (2,500)

#### Test 3.4 : Validation montant incorrect (ACHAT USD)

**Étapes :**
1. Type : Retrait
2. Devise de référence : USD
3. Montant principal : 100 USD
4. Montant payé en USD : 50 USD
5. Désactiver "Calcul auto"
6. Saisir manuellement : 115,000 CDF (mauvais montant)
7. Soumettre

**Résultat attendu :**
- ❌ Erreur affichée
- Message : "Montant CDF incorrect. Pour 50.00 USD au taux 2500.00, le montant attendu est 125000.00 CDF"

### 4. Tests Dépôt vs Retrait

#### Test 4.1 : Dépôt en USD avec réception CDF

**Étapes :**
1. Type : **Dépôt**
2. Devise de référence : USD
3. Montant principal : 100 USD
4. Montant reçu en USD : 0
5. Montant reçu en CDF : (calculé auto)

**Résultat attendu :**
- Taux appliqué : VENTE USD (2,300)
- Montant CDF : 230,000 CDF
- Impact virtuel : -100 USD (créance diminue)

#### Test 4.2 : Dépôt en USD avec réception USD

**Étapes :**
1. Type : **Dépôt**
2. Devise de référence : USD
3. Montant principal : 100 USD
4. Montant reçu en USD : 100 USD
5. Montant reçu en CDF : 0

**Résultat attendu :**
- Taux appliqué : ACHAT USD (2,500)
- Impact virtuel : -100 USD (créance diminue)

### 5. Tests de Cas Limites

#### Test 5.1 : Montant total = 0

**Étapes :**
1. Type : Retrait
2. Devise de référence : USD
3. Montant principal : 0
4. Soumettre

**Résultat attendu :**
- ❌ Erreur : "Le montant total doit être supérieur à zéro"

#### Test 5.2 : Montants négatifs

**Étapes :**
1. Type : Retrait
2. Devise de référence : USD
3. Montant principal : 100 USD
4. Montant payé en USD : -50 USD
5. Soumettre

**Résultat attendu :**
- ❌ Erreur : "Les montants ne peuvent pas être négatifs"

#### Test 5.3 : Aucun montant saisi

**Étapes :**
1. Type : Retrait
2. Devise de référence : USD
3. Montant principal : 100 USD
4. Montant payé en USD : 0
5. Montant payé en CDF : 0 (effacer le calcul auto)
6. Soumettre

**Résultat attendu :**
- ❌ Erreur : "Au moins un montant doit être renseigné"

#### Test 5.4 : Taux non configuré

**Étapes :**
1. Désactiver temporairement le taux USD → CDF
2. Essayer de créer une transaction

**Résultat attendu :**
- Alerte affichée : "Aucun taux de change actif configuré"
- Bouton "Créer la transaction" désactivé

### 6. Tests de Changement de Devise de Référence

#### Test 6.1 : Basculer de USD à CDF

**Étapes :**
1. Devise de référence : USD
2. Montant principal : 100 USD
3. Observer le taux affiché
4. Changer Devise de référence : CDF
5. Observer le taux

**Résultat attendu :**
- Le taux est recalculé automatiquement
- L'affichage s'adapte à la nouvelle devise

#### Test 6.2 : Basculer de CDF à USD

**Étapes :**
1. Devise de référence : CDF
2. Montant principal : 230,000 CDF
3. Observer le taux affiché
4. Changer Devise de référence : USD
5. Observer le taux

**Résultat attendu :**
- Le taux est recalculé automatiquement
- L'affichage s'adapte à la nouvelle devise

### 7. Tests d'Intégration

#### Test 7.1 : Vérification des soldes après transaction VENTE USD

**Étapes :**
1. Noter les soldes initiaux du service TEST_FOREX
2. Créer un retrait :
   - Montant : 100 USD
   - Payé en CDF : 230,000 CDF
   - Taux : VENTE USD (2,300)
3. Vérifier les soldes finaux

**Résultat attendu :**
- Virtuel USD : +100 USD (créance augmente)
- Cash CDF : -230,000 CDF (sort de la caisse)
- Transaction enregistrée avec le bon taux dans audit_logs

#### Test 7.2 : Vérification des soldes après transaction ACHAT USD

**Étapes :**
1. Noter les soldes initiaux du service TEST_FOREX
2. Créer un retrait :
   - Montant : 100 USD
   - Payé en USD : 100 USD
   - Taux : ACHAT USD (2,500)
3. Vérifier les soldes finaux

**Résultat attendu :**
- Virtuel USD : +100 USD (créance augmente)
- Cash USD : -100 USD (sort de la caisse)
- Transaction enregistrée avec le bon taux dans audit_logs

#### Test 7.3 : Transaction mixte complexe

**Étapes :**
1. Noter les soldes initiaux
2. Créer un retrait :
   - Montant : 100 USD
   - Payé en USD : 40 USD
   - Payé en CDF : (calculé auto = 150,000 CDF avec taux 2,500)
3. Vérifier les soldes finaux

**Résultat attendu :**
- Virtuel USD : +100 USD
- Cash USD : -40 USD
- Cash CDF : -150,000 CDF
- Taux enregistré : ACHAT USD (2,500)

### 8. Tests de Performance

#### Test 8.1 : Changement rapide de montants

**Étapes :**
1. Saisir rapidement différents montants en USD
2. Observer le changement de taux

**Résultat attendu :**
- Le taux change sans délai perceptible
- Aucune erreur JavaScript dans la console

#### Test 8.2 : Désactivation/Activation du calcul auto

**Étapes :**
1. Activer/désactiver rapidement le calcul auto plusieurs fois
2. Vérifier que les calculs restent corrects

**Résultat attendu :**
- Le comportement reste cohérent
- Pas de valeurs incohérentes

## Checklist de Validation

### Affichage
- [ ] Le badge de couleur s'affiche correctement
- [ ] Le libellé ACHAT/VENTE est clair
- [ ] Le taux est toujours en format "1 USD = X CDF"
- [ ] Le message explique quelle devise sort de la caisse

### Calculs
- [ ] Le calcul automatique utilise le bon taux
- [ ] Les conversions sont exactes
- [ ] Les arrondis sont corrects

### Validation
- [ ] Les montants corrects sont acceptés
- [ ] Les montants incorrects sont rejetés
- [ ] Les messages d'erreur sont clairs

### Intégration
- [ ] Les soldes sont mis à jour correctement
- [ ] L'audit log contient le bon contexte
- [ ] Les transactions apparaissent dans l'historique

### UX
- [ ] Le changement de taux est fluide
- [ ] Les informations sont visibles
- [ ] Le formulaire reste utilisable

## Rapport de Test

À remplir après chaque test :

```markdown
### Test [Numéro] : [Nom du test]

**Date :**
**Testeur :**
**Environnement :**

**Résultat :** ✅ Réussi / ❌ Échoué

**Observations :**

**Captures d'écran :** (si applicable)

**Actions correctives :** (si échec)
```

## Critères de Succès

Le système est considéré comme validé si :

1. **100% des tests d'affichage** passent
2. **100% des tests de calcul** passent
3. **100% des tests de validation** passent
4. **100% des tests d'intégration** passent
5. Aucune régression sur les transactions simples
6. Aucune erreur JavaScript dans la console
7. Performance acceptable (< 100ms pour changement de taux)

## Rollback

En cas de problème critique :

1. Identifier le commit précédent :
   ```bash
   git log --oneline src/components/transactions/TransactionMixteForm.tsx
   ```

2. Revenir à la version précédente :
   ```bash
   git revert [hash_du_commit]
   ```

3. Rebuilder et redéployer

---

**Version :** 1.0
**Date :** 26 janvier 2026
**Responsable :** Équipe technique
