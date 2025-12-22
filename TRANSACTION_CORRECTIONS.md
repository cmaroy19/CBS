# Système de Correction des Transactions

## Vue d'ensemble

Le système de correction permet aux utilisateurs autorisés (Administrateur et Propriétaire) de corriger les erreurs dans les transactions validées. La correction se fait par annulation de la transaction originale et création d'une transaction inverse, sans jamais modifier ou supprimer les données existantes.

---

## Principes Fondamentaux

### 1. Immutabilité des Transactions
- **Aucune transaction validée ne peut être modifiée directement**
- Les transactions originales restent dans la base de données pour l'audit
- Les corrections sont tracées avec l'utilisateur, la date et la raison

### 2. Traçabilité Complète
- Chaque correction enregistre l'utilisateur qui l'a effectuée
- La date et l'heure de correction sont sauvegardées
- La raison de la correction est obligatoire et conservée
- Les liens entre transaction originale et correction sont maintenus

### 3. Sécurité
- Seuls les rôles **Administrateur** et **Propriétaire** peuvent corriger
- Les permissions sont vérifiées au niveau de l'interface et de la base de données
- Les RLS policies garantissent la sécurité des opérations

---

## Architecture de la Solution

### Schéma de Base de Données

#### Nouveaux Champs dans `transactions`

| Champ | Type | Description |
|-------|------|-------------|
| `annule` | boolean | Indique si la transaction est annulée (défaut: false) |
| `transaction_origine_id` | uuid | Référence à la transaction originale (pour les corrections) |
| `raison_correction` | text | Raison de la correction |
| `corrigee_par` | uuid | ID de l'utilisateur ayant effectué la correction |
| `corrigee_le` | timestamptz | Date et heure de la correction |

#### Index Ajoutés
- `idx_transactions_annule` : pour filtrer rapidement les transactions annulées
- `idx_transactions_origine` : pour retrouver les corrections d'une transaction

### Fonction Database : `creer_correction_transaction`

**Signature :**
```sql
creer_correction_transaction(
  p_transaction_id uuid,
  p_raison text,
  p_user_id uuid
) RETURNS jsonb
```

**Fonctionnement :**

1. **Validation** : Vérifie que la transaction existe et n'est pas déjà annulée
2. **Création de la transaction inverse** :
   - Si original = dépôt → correction = retrait
   - Si original = retrait → correction = dépôt
   - Même montant, devise, service
   - Référence à la transaction originale
3. **Marquage** : Marque la transaction originale comme annulée
4. **Mise à jour automatique** : Les triggers existants ajustent les soldes

**Avantages :**
- Opération atomique (tout ou rien)
- Garantit l'intégrité des données
- Les soldes sont automatiquement recalculés par les triggers

---

## Flux de Correction

### Étape 1 : Identification
L'utilisateur autorisé identifie une transaction erronée dans le tableau des transactions.

### Étape 2 : Initiation
- Clic sur le bouton "Corriger" dans la colonne "Actions"
- Le modal de correction s'ouvre avec les détails de la transaction

### Étape 3 : Justification
- L'utilisateur saisit obligatoirement la raison de la correction
- Exemple : "Montant erroné", "Mauvais service sélectionné", "Transaction en double"

### Étape 4 : Confirmation
- L'utilisateur visualise l'action qui sera effectuée
- Confirmation de la correction

### Étape 5 : Exécution
- Appel de la fonction `creer_correction_transaction`
- Création de la transaction inverse
- Marquage de la transaction originale
- Ajustement automatique des soldes par les triggers
- Enregistrement dans les logs d'audit

### Étape 6 : Résultat
- Message de succès
- Rafraîchissement de la liste des transactions
- Les deux transactions (originale et correction) sont visibles

---

## Interface Utilisateur

### Colonne "Actions" dans le Tableau

**Visible uniquement pour Administrateur et Propriétaire**

**États possibles :**

1. **Transaction normale** :
   - Bouton "Corriger" (icône AlertCircle, couleur ambre)
   - Cliquable pour ouvrir le modal

2. **Transaction annulée** :
   - Badge "Annulée" (icône Ban, gris)
   - Non cliquable

3. **Transaction de correction** :
   - Badge "Correction" (icône AlertCircle, bleu)
   - Indique que c'est une transaction créée pour corriger une autre

### Modal de Correction

**Sections :**

1. **Alerte d'avertissement** (fond ambre)
   - Explique l'action qui sera effectuée
   - Informe sur l'ajustement automatique des soldes

2. **Détails de la transaction** (fond gris clair)
   - Type, Service, Montant, Devise
   - Référence, Date
   - Info client (si présente)

3. **Champ "Raison de la correction"** (obligatoire)
   - Textarea pour saisir l'explication
   - Placeholder informatif
   - Texte d'aide sur l'enregistrement

4. **Résumé de l'action**
   - Liste des opérations qui seront effectuées
   - Type de transaction inverse qui sera créée
   - Mention de l'ajustement des soldes

5. **Boutons d'action**
   - "Annuler" : ferme le modal sans rien faire
   - "Confirmer la correction" : lance la correction (désactivé si raison vide)

---

## Exemples d'Usage

### Exemple 1 : Dépôt Erroné

**Transaction originale :**
- Type : Dépôt
- Service : Orange Money
- Montant : 100 USD
- Erreur : Montant incorrect (devait être 50 USD)

**Correction :**
1. Clic sur "Corriger"
2. Raison : "Montant erroné - devait être 50 USD au lieu de 100 USD"
3. Confirmation
4. **Résultat** :
   - Transaction de retrait de 100 USD créée
   - Transaction originale marquée comme annulée
   - Soldes ajustés automatiquement
   - L'utilisateur peut ensuite créer un nouveau dépôt de 50 USD

### Exemple 2 : Mauvais Service

**Transaction originale :**
- Type : Retrait
- Service : Airtel Money
- Montant : 200 USD
- Erreur : Devait être sur M-Pesa

**Correction :**
1. Clic sur "Corriger"
2. Raison : "Service incorrect - devait être M-Pesa"
3. Confirmation
4. **Résultat** :
   - Transaction de dépôt de 200 USD sur Airtel Money créée
   - Transaction originale marquée comme annulée
   - L'utilisateur peut créer un retrait de 200 USD sur M-Pesa

### Exemple 3 : Transaction en Double

**Transaction originale :**
- Type : Dépôt
- Montant : 150 USD
- Erreur : Transaction saisie deux fois par erreur

**Correction :**
1. Clic sur "Corriger" sur l'une des deux transactions
2. Raison : "Transaction en double - saisie par erreur"
3. Confirmation
4. **Résultat** :
   - Transaction inverse créée
   - Transaction annulée
   - Une seule transaction de dépôt reste valide

---

## Impact sur les Soldes

### Soldes Virtuels des Services

Les corrections impactent automatiquement les soldes virtuels grâce aux triggers existants :

**Pour un dépôt annulé (correction = retrait) :**
- Le retrait de correction augmente le solde virtuel du service

**Pour un retrait annulé (correction = dépôt) :**
- Le dépôt de correction diminue le solde virtuel du service

### Soldes Cash Globaux

**Pour un dépôt annulé (correction = retrait) :**
- Le retrait de correction diminue le cash global

**Pour un retrait annulé (correction = dépôt) :**
- Le dépôt de correction augmente le cash global

**Important :** Les soldes sont toujours cohérents car les triggers database garantissent l'atomicité des opérations.

---

## Audit et Traçabilité

### Logs d'Audit

Chaque correction génère une entrée dans `audit_logs` :

```json
{
  "table_name": "transactions",
  "operation": "CORRECTION",
  "record_id": "uuid-transaction-originale",
  "new_data": {
    "raison": "Raison de la correction",
    "correction_id": "uuid-transaction-correction"
  },
  "user_id": "uuid-utilisateur"
}
```

### Historique Complet

Pour retrouver l'historique complet d'une correction :

1. **Transaction originale** :
   - `annule = true`
   - `corrigee_par` contient l'ID de l'utilisateur
   - `corrigee_le` contient la date/heure

2. **Transaction de correction** :
   - `transaction_origine_id` pointe vers la transaction originale
   - `raison_correction` contient l'explication
   - `notes` commence par "CORRECTION - "

3. **Log d'audit** :
   - Enregistrement de l'opération CORRECTION
   - Lien entre les deux transactions

---

## Sécurité et Permissions

### Contrôle d'Accès

**Interface (Frontend) :**
```typescript
const canCorrect = user?.role === 'Administrateur' || user?.role === 'Proprietaire';
```

**Base de données (Backend) :**
- RLS policies sur la table `transactions`
- Fonction `creer_correction_transaction` avec `SECURITY DEFINER`
- Vérifications dans la fonction avant toute opération

### Règles de Sécurité

1. **Un administrateur peut corriger toutes les transactions**
2. **Un propriétaire peut corriger toutes les transactions**
3. **Les autres rôles ne voient pas la colonne "Actions"**
4. **Une transaction déjà annulée ne peut pas être corrigée à nouveau**
5. **Une transaction de correction ne peut pas être corrigée** (car c'est déjà une correction)

---

## Limitations et Considérations

### Limitations

1. **Pas de modification partielle** : Une correction annule complètement la transaction originale
2. **Pas d'annulation de correction** : Une fois corrigée, il faut créer une nouvelle transaction
3. **Pas de correction en chaîne** : Les transactions de correction ne peuvent pas être corrigées

### Bonnes Pratiques

1. **Vérifier deux fois avant de créer une transaction** pour minimiser les corrections
2. **Être précis dans la raison de correction** pour faciliter l'audit
3. **Former les utilisateurs** sur l'impact des corrections sur les soldes
4. **Réviser régulièrement** les transactions annulées pour détecter les problèmes récurrents

### Workflow Recommandé

Pour corriger avec un nouveau montant :
1. Corriger la transaction erronée
2. Créer une nouvelle transaction avec les bonnes valeurs
3. Documenter le lien dans les notes de la nouvelle transaction

---

## Structure des Fichiers

### Composants Créés

1. **`src/components/transactions/TransactionCorrectionModal.tsx`**
   - Modal de correction avec formulaire
   - Validation et gestion des erreurs
   - Interface utilisateur claire et informative

### Composants Modifiés

1. **`src/components/transactions/TransactionsTable.tsx`**
   - Ajout colonne "Actions" conditionnelle
   - Bouton "Corriger" pour transactions valides
   - Badges "Annulée" et "Correction"
   - Logique de permissions

2. **`src/pages/Transactions.tsx`**
   - État pour le modal de correction
   - Handlers pour ouverture/fermeture
   - Intégration du modal de correction
   - Rafraîchissement après correction

3. **`src/types/index.ts`**
   - Ajout champs de correction au type `Transaction`

### Migrations

1. **`20251222_add_transaction_corrections.sql`**
   - Ajout des colonnes de correction
   - Création des index
   - Fonction `creer_correction_transaction`
   - Mise à jour des RLS policies

---

## Tests et Validation

### Scénarios de Test

1. **Test des permissions** :
   - ✅ Administrateur voit la colonne "Actions"
   - ✅ Propriétaire voit la colonne "Actions"
   - ✅ Caissier/Gérant ne voit pas la colonne "Actions"

2. **Test de correction** :
   - ✅ Correction d'un dépôt crée un retrait
   - ✅ Correction d'un retrait crée un dépôt
   - ✅ Transaction originale marquée comme annulée
   - ✅ Soldes ajustés correctement

3. **Test des validations** :
   - ✅ Raison obligatoire
   - ✅ Transaction déjà annulée non corrigeable
   - ✅ Messages d'erreur appropriés

4. **Test d'audit** :
   - ✅ Logs créés correctement
   - ✅ Traçabilité complète
   - ✅ Liens entre transactions préservés

---

## Maintenance

### Requêtes Utiles

**Lister toutes les transactions annulées :**
```sql
SELECT * FROM transactions WHERE annule = true ORDER BY corrigee_le DESC;
```

**Trouver les corrections d'une transaction :**
```sql
SELECT * FROM transactions WHERE transaction_origine_id = 'uuid-transaction';
```

**Statistiques des corrections par utilisateur :**
```sql
SELECT
  u.nom_complet,
  COUNT(*) as nombre_corrections
FROM transactions t
JOIN users u ON t.corrigee_par = u.id
WHERE t.annule = true
GROUP BY u.nom_complet
ORDER BY nombre_corrections DESC;
```

**Raisons de correction les plus fréquentes :**
```sql
SELECT
  raison_correction,
  COUNT(*) as occurrences
FROM transactions
WHERE transaction_origine_id IS NOT NULL
GROUP BY raison_correction
ORDER BY occurrences DESC;
```

---

## Conclusion

Le système de correction des transactions fournit une solution sécurisée et traçable pour gérer les erreurs tout en préservant l'intégrité des données. L'approche par annulation et création de transaction inverse garantit que :

- ✅ Aucune donnée historique n'est perdue
- ✅ Tous les changements sont tracés
- ✅ Les soldes restent cohérents
- ✅ L'audit est complet et fiable
- ✅ Les permissions sont respectées

**Date :** 2025-12-22
**Version :** 1.0
**Status :** ✅ Déployé et testé
