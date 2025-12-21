# Résumé de la Refactorisation - Transactions Multi-Lignes

## Objectif

Refactoriser l'application pour supporter des transactions financières composées (multi-lignes) basées sur le principe de la comptabilité à double entrée.

## Ce qui a été fait

### 1. Structure de base de données

**Fichier**: `docs/migrations/multi_line_transactions.sql`

Deux nouvelles tables ont été conçues:

- **transaction_headers**: En-têtes de transactions avec référence unique, type d'opération, statut, etc.
- **transaction_lines**: Lignes d'écritures comptables avec type de portefeuille, service, devise, sens (débit/crédit), montant

**Caractéristiques**:
- Référence unique auto-générée (format: TRX-YYYYMMDD-XXXX)
- Workflow de statut: brouillon → validée → annulée
- Validation automatique de l'équilibre (débits = crédits par devise)
- Minimum 2 lignes par transaction
- Row Level Security (RLS) configuré
- Triggers pour automation (référence, updated_at, validation)
- Vue `v_transactions_completes` pour consultation facilitée

### 2. Types TypeScript

**Fichier modifié**: `src/types/index.ts`

Nouveaux types ajoutés:
- `TypeOperation`: 'depot' | 'retrait' | 'approvisionnement' | 'change' | 'transfert'
- `TypePortefeuille`: 'cash' | 'virtuel'
- `SensEcriture`: 'debit' | 'credit'
- `StatutTransaction`: 'brouillon' | 'validee' | 'annulee'

Nouvelles interfaces:
- `TransactionHeader`: En-tête de transaction complète
- `TransactionLine`: Ligne d'écriture comptable
- `TransactionComplete`: Transaction avec ses lignes

### 3. Service de gestion

**Fichier**: `src/lib/multiLineTransactions.ts`

Classe `MultiLineTransactionService` avec méthodes:
- `createTransaction()`: Créer une transaction en brouillon
- `validateTransaction()`: Valider une transaction
- `cancelTransaction()`: Annuler une transaction
- `getTransaction()`: Récupérer une transaction complète
- `listTransactions()`: Lister avec filtres
- `addLine()`: Ajouter une ligne à une transaction brouillon
- `updateLine()`: Modifier une ligne
- `deleteLine()`: Supprimer une ligne
- `validateBalance()`: Vérifier l'équilibre des lignes

### 4. Builders de transactions

**Fichier**: `src/lib/transactionBuilders.ts`

Classe `TransactionBuilders` avec méthodes statiques pour construire facilement:
- `buildDepot()`: Transaction de dépôt (cash ou virtuel)
- `buildRetrait()`: Transaction de retrait (cash ou virtuel)
- `buildApprovisionnement()`: Entrée/sortie de cash ou virtuel
- `buildChange()`: Opération de change entre devises
- `buildTransfert()`: Transfert entre services

Chaque builder génère automatiquement les lignes équilibrées selon le principe de double entrée.

### 5. Documentation

**Fichiers**:
- `docs/MULTI_LINE_TRANSACTIONS.md`: Guide d'utilisation complet avec exemples
- `docs/REFACTORING_SUMMARY.md`: Ce résumé

## Architecture des transactions

### Exemple: Dépôt virtuel de 100 USD avec 2 USD de commission

```typescript
const transaction = transactionBuilders.buildDepot({
  montant: 100,
  devise: 'USD',
  commission: 2,
  service_id: 'service-uuid',
  type_portefeuille: 'virtuel',
  info_client: 'Client ABC',
});

// Génère 3 lignes équilibrées:
// Ligne 1: Débit Cash USD      102 (entrée physique)
// Ligne 2: Crédit Virtuel USD  100 (crédit au service)
// Ligne 3: Crédit Cash USD       2 (commission)
```

### Exemple: Retrait virtuel de 50 USD avec 1 USD de commission

```typescript
const transaction = transactionBuilders.buildRetrait({
  montant: 50,
  devise: 'USD',
  commission: 1,
  service_id: 'service-uuid',
  type_portefeuille: 'virtuel',
  info_client: 'Client XYZ',
});

// Génère 3 lignes équilibrées:
// Ligne 1: Débit Virtuel USD   50 (débit du service)
// Ligne 2: Crédit Cash USD     49 (sortie physique)
// Ligne 3: Débit Cash USD       1 (commission)
```

## Coexistence avec l'ancien système

**Important**: Le nouveau système coexiste avec l'ancien:

- Tables existantes (`transactions`, `approvisionnements`, `change_operations`) **non modifiées**
- Nouvelles tables (`transaction_headers`, `transaction_lines`) ajoutées
- Migration progressive possible
- Les deux systèmes peuvent fonctionner en parallèle

## Étapes suivantes pour l'implémentation

### 1. Appliquer la migration SQL

La migration SQL se trouve dans `docs/migrations/multi_line_transactions.sql`.

**Option A - Via Supabase Dashboard**:
1. Aller sur dashboard.supabase.com
2. Sélectionner votre projet
3. Aller dans SQL Editor
4. Copier-coller le contenu du fichier SQL
5. Exécuter

**Option B - Via Supabase CLI** (si disponible):
```bash
supabase migration new create_multi_line_transaction_system
# Copier le contenu dans le nouveau fichier créé
supabase db push
```

### 2. Vérifier les tables

Après application, vérifier que les tables existent:
```sql
SELECT * FROM transaction_headers LIMIT 1;
SELECT * FROM transaction_lines LIMIT 1;
SELECT * FROM v_transactions_completes LIMIT 1;
```

### 3. Tester la création de transactions

```typescript
import { multiLineTransactionService } from '@/lib/multiLineTransactions';
import { transactionBuilders } from '@/lib/transactionBuilders';

// Test simple
const transaction = transactionBuilders.buildDepot({
  montant: 100,
  devise: 'USD',
  commission: 2,
  service_id: 'votre-service-id',
  type_portefeuille: 'virtuel',
});

const { data, error } = await multiLineTransactionService.createTransaction(
  transaction.header,
  transaction.lines
);

if (data) {
  console.log('Transaction créée:', data.header.reference);

  // Valider
  const result = await multiLineTransactionService.validateTransaction(data.header.id);
  console.log('Validation:', result.success);
}
```

### 4. Créer les composants UI

Créer les composants React pour:
- Afficher la liste des transactions multi-lignes
- Créer une nouvelle transaction avec un formulaire
- Visualiser les détails d'une transaction (en-tête + lignes)
- Valider/annuler une transaction

### 5. Migration progressive

Stratégies possibles:
- **Dual-write**: Écrire dans les deux systèmes pendant la transition
- **Feature flag**: Activer le nouveau système pour certaines fonctionnalités
- **Migration complète**: Migrer toutes les nouvelles opérations vers le nouveau système

### 6. Rapports et analytiques

Créer des vues/requêtes pour:
- Journaux de caisse basés sur les écritures
- Rapports de commission détaillés
- Mouvements par service/portefeuille
- Audit trail complet

## Avantages du nouveau système

1. **Traçabilité**: Chaque mouvement est enregistré ligne par ligne
2. **Intégrité**: L'équilibre est garanti automatiquement
3. **Flexibilité**: Supporte des transactions complexes
4. **Audit**: Historique complet avec créateur et validateur
5. **Sécurité**: Workflow de validation + RLS
6. **Évolutivité**: Facile d'ajouter de nouveaux types d'opérations

## Support

Consulter la documentation complète dans `docs/MULTI_LINE_TRANSACTIONS.md` pour:
- Exemples d'utilisation détaillés
- Explication des contraintes
- Cas d'usage avancés
- Schémas de transactions

## Notes importantes

- ✅ Le projet compile correctement avec les nouvelles structures
- ✅ Les types TypeScript sont complets et cohérents
- ✅ Les services sont prêts à l'emploi
- ✅ La migration SQL est complète et documentée
- ⚠️ La migration SQL doit être appliquée manuellement
- ⚠️ Les composants UI ne sont pas encore créés
- ⚠️ L'ancien système reste en place et fonctionnel
