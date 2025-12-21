# Refactorisation - Transactions Multi-Lignes

## Résumé de la refactorisation

Le système a été refactorisé pour supporter des **transactions financières composées** basées sur le principe de la **comptabilité en partie double**.

## ✅ Ce qui a été implémenté

### 1. Base de données

**Migration appliquée** : `20251221_create_multi_line_transactions`

#### Tables créées

**`transaction_headers`** - En-têtes de transactions
- `id` : UUID unique
- `reference` : Référence auto-générée (TRX-YYYYMM-XXXX)
- `type_operation` : Type d'opération (depot, retrait, approvisionnement, change, transfert)
- `devise_reference` : Devise de référence (USD, CDF)
- `montant_total` : Montant total
- `description` : Description de la transaction
- `info_client` : Informations client
- `taux_change` : Taux de change figé (pour les opérations de change)
- `paire_devises` : Paire de devises (ex: "USD/CDF")
- `statut` : Statut (brouillon, validee, annulee)
- `created_by`, `validated_by`, `validated_at` : Traçabilité
- `created_at`, `updated_at` : Horodatage

**`transaction_lines`** - Lignes de transactions (écritures)
- `id` : UUID unique
- `header_id` : Référence vers transaction_headers
- `ligne_numero` : Numéro de ligne
- `type_portefeuille` : Type de portefeuille (cash, virtuel)
- `service_id` : Service concerné (si virtuel)
- `devise` : Devise (USD, CDF)
- `sens` : Sens de l'écriture (debit, credit)
- `montant` : Montant
- `description` : Description
- `created_at` : Horodatage

#### Fonctions SQL

- `generate_transaction_reference()` : Génère des références uniques
- `set_transaction_reference()` : Trigger auto-génération
- `validate_transaction_balance(header_id)` : Vérifie l'équilibrage
- `valider_transaction(header_id, validated_by)` : Valide une transaction

#### Vue

- `v_transactions_completes` : Vue joignant headers et lignes

#### Sécurité (RLS)

- Lecture : tous utilisateurs authentifiés
- Création : utilisateurs authentifiés actifs
- Modification : créateur uniquement, statut brouillon
- Validation : avec vérification d'équilibre

### 2. Types TypeScript

**Fichier** : `src/types/index.ts`
- Interface `TransactionHeader` (existait déjà, mise à jour)
- Interface `TransactionLine` (existait déjà, mise à jour)
- Interface `TransactionComplete`
- Interface `ExchangeRate`

**Fichier** : `src/types/database.ts`
- Types Supabase pour `transaction_headers`
- Types Supabase pour `transaction_lines`
- Types Supabase pour `v_transactions_completes`

### 3. Services

**Fichier** : `src/lib/multiLineTransactions.ts`
Service complet de gestion des transactions avec :
- `createTransaction()` : Créer une transaction avec validation d'équilibre
- `validateTransaction()` : Valider une transaction
- `cancelTransaction()` : Annuler une transaction
- `getTransaction()` : Récupérer une transaction complète
- `listTransactions()` : Lister avec filtres
- `validateBalance()` : Valider l'équilibre
- `addLine()`, `updateLine()`, `deleteLine()` : Gestion des lignes

**Fichier** : `src/lib/transactionBuilders.ts`
Fonctions builder pour chaque type d'opération :
- `buildDepot()` : Construire un dépôt
- `buildRetrait()` : Construire un retrait
- `buildApprovisionnement()` : Construire un approvisionnement
- `buildChange()` : Construire une opération de change (avec taux)
- `buildTransfert()` : Construire un transfert entre services

### 4. Documentation

**Fichier** : `docs/MULTI_LINE_TRANSACTIONS.md`
Documentation complète avec :
- Architecture du système
- Exemples d'utilisation pour chaque type d'opération
- Explications des transactions équilibrées
- Guide d'intégration

## Principe de fonctionnement

### Comptabilité en partie double

Chaque transaction est composée de :
- **1 header** : informations globales
- **N lignes** (minimum 2) : écritures comptables

**Règle d'or** : Pour chaque devise, le total des débits doit égaler le total des crédits.

```
∑ Débits(USD) = ∑ Crédits(USD)
∑ Débits(CDF) = ∑ Crédits(CDF)
```

### Types de portefeuille

- **Cash** : Caisse globale de l'entreprise
- **Virtuel** : Solde virtuel d'un service

### Sens des écritures

- **Débit** : Sortie / Diminution du portefeuille
- **Crédit** : Entrée / Augmentation du portefeuille

### Exemple simple : Dépôt de 100 USD avec 2 USD de commission

```
Ligne 1: Débit Cash USD      102  (L'entreprise reçoit 102 USD)
Ligne 2: Crédit Virtuel USD  100  (Le service client est crédité de 100 USD)
Ligne 3: Crédit Cash USD       2  (Commission pour l'entreprise)

Vérification :
- Débits USD  : 102
- Crédits USD : 100 + 2 = 102
✅ Équilibré
```

## Utilisation pratique

### Créer un dépôt

```typescript
import { multiLineTransactionService } from '@/lib/multiLineTransactions';
import { transactionBuilders } from '@/lib/transactionBuilders';

// 1. Construire la transaction
const transaction = transactionBuilders.buildDepot({
  montant: 100,
  devise: 'USD',
  commission: 2,
  service_id: 'service-uuid',
  type_portefeuille: 'virtuel',
  info_client: 'Client ABC'
});

// 2. Créer (statut = brouillon)
const { data, error } = await multiLineTransactionService.createTransaction(
  transaction.header,
  transaction.lines
);

// 3. Valider (statut = validee)
if (data) {
  await multiLineTransactionService.validateTransaction(data.header.id);
}
```

### Créer un change avec taux figé

```typescript
// Le taux est automatiquement capturé
const transaction = transactionBuilders.buildChange({
  montant_source: 100,
  devise_source: 'USD',
  montant_destination: 270000,
  devise_destination: 'CDF',
  commission: 5,
  taux: 2700  // Ce taux sera enregistré dans transaction_headers
});

const { data, error } = await multiLineTransactionService.createTransaction(
  transaction.header,
  transaction.lines
);
```

### Lister les transactions

```typescript
const { data, error } = await multiLineTransactionService.listTransactions({
  statut: 'validee',
  type_operation: 'depot',
  startDate: '2025-01-01',
  endDate: '2025-12-31'
});
```

## Structure des fichiers

```
src/
├── lib/
│   ├── multiLineTransactions.ts    # Service principal
│   ├── transactionBuilders.ts      # Builders pour chaque opération
│   └── exchangeRates.ts            # Service de taux de change
├── types/
│   ├── index.ts                    # Interfaces métier
│   └── database.ts                 # Types Supabase
└── pages/
    └── TauxChange.tsx               # Interface de gestion des taux

supabase/migrations/
├── 20251221_add_exchange_rates_system.sql
└── 20251221_create_multi_line_transactions.sql

docs/
└── MULTI_LINE_TRANSACTIONS.md      # Documentation complète
```

## Avantages de cette architecture

### 1. Intégrité mathématique
- Impossible de créer ou perdre de l'argent
- Équilibrage vérifié automatiquement
- Validation stricte avant enregistrement

### 2. Traçabilité complète
- Chaque mouvement est enregistré avec précision
- Références uniques auto-générées
- Historique des créateurs et validateurs

### 3. Flexibilité
- Support de toutes les opérations financières
- Extensible pour de nouveaux types
- Multi-devises natif

### 4. Sécurité
- RLS actif sur toutes les tables
- Workflow de validation (brouillon → validée)
- Transactions validées immuables

### 5. Audit et conformité
- Piste d'audit complète
- Respect des normes comptables
- Rapports facilités

## Coexistence avec l'ancien système

### ✅ Tables conservées (ancien système)
- `transactions`
- `approvisionnements`
- `change_operations`
- `global_balances`

### ✨ Nouvelles tables (nouveau système)
- `transaction_headers`
- `transaction_lines`
- `exchange_rates`

### 🔄 Migration progressive

Les deux systèmes coexistent, permettant une migration en douceur :
1. Les anciennes fonctionnalités continuent de fonctionner
2. Les nouvelles fonctionnalités utilisent le nouveau système
3. La migration peut se faire module par module
4. Pas de rupture de service

## Règles métier

### Création
- Minimum 2 lignes par transaction
- Doit être équilibrée pour chaque devise
- Statut initial : `brouillon`
- Référence auto-générée

### Validation
- Vérification d'équilibre automatique
- Transition vers statut `validee`
- Immuable après validation
- Enregistrement du validateur et date

### Modification
- Possible uniquement en statut `brouillon`
- Par le créateur uniquement
- Ré-validation d'équilibre requise

### Annulation
- Possible sur n'importe quel statut
- Transition vers statut `annulee`
- Immuable après annulation

## Tests effectués

### ✅ Migration SQL
- Tables `transaction_headers` et `transaction_lines` créées
- Fonctions SQL opérationnelles
- Vue `v_transactions_completes` accessible
- RLS et policies configurés
- Triggers fonctionnels

### ✅ Compilation TypeScript
- Projet compile sans erreur
- Tous les types correctement définis
- Imports résolus

### ✅ Services
- `multiLineTransactionService` fonctionnel
- `transactionBuilders` opérationnels
- Validation d'équilibre implémentée
- Intégration avec taux de change

## Prochaines étapes recommandées

### 1. Interface utilisateur
- Créer les composants de création de transactions
- Ajouter la visualisation des transactions multi-lignes
- Implémenter le workflow brouillon → validation

### 2. Migration des fonctionnalités existantes
- Migrer progressivement les formulaires existants
- Adapter les rapports au nouveau système
- Synchroniser les soldes avec les nouvelles écritures

### 3. Rapports avancés
- Balance par devise
- Grand livre
- Journal des transactions
- Rapports d'audit

### 4. Optimisations
- Index supplémentaires si nécessaire
- Caching des soldes calculés
- Agrégations pour les rapports

## Points d'attention

### ⚠️ Important

1. **Équilibrage strict** : Chaque devise doit être équilibrée indépendamment
2. **Validation irréversible** : Une fois validée, une transaction ne peut plus être modifiée
3. **Commissions** : Doivent être correctement représentées dans les lignes
4. **Services virtuels** : Requièrent un `service_id` valide

### 🚧 Limitations connues

1. Pas de support pour les transactions partiellement validées
2. Pas de mécanisme de rollback en cas d'erreur partielle
3. Les opérations de change multi-devises nécessitent attention

## État du système

🟢 **Opérationnel**

- ✅ Base de données configurée
- ✅ Services implémentés
- ✅ Types TypeScript complets
- ✅ Validation d'équilibre fonctionnelle
- ✅ Builders pour tous les types d'opérations
- ✅ Intégration avec taux de change
- ✅ Documentation complète
- ✅ Compilation réussie

Le système est prêt pour l'intégration dans l'interface utilisateur.

## Support

Pour plus de détails :
- Documentation technique : `docs/MULTI_LINE_TRANSACTIONS.md`
- Code source du service : `src/lib/multiLineTransactions.ts`
- Builders : `src/lib/transactionBuilders.ts`
- Types : `src/types/index.ts`

## Conclusion

La refactorisation introduit une architecture solide et professionnelle basée sur les principes de comptabilité en partie double. Cette approche garantit l'intégrité des données, facilite l'audit et permet une traçabilité complète de toutes les opérations financières.

Le système coexiste avec l'ancien, permettant une migration progressive sans interruption de service.
