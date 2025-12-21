# Système de Transactions Multi-Lignes

## Vue d'ensemble

Le système de transactions multi-lignes permet de représenter toutes les opérations financières de manière atomique et équilibrée en utilisant le principe de la comptabilité à double entrée.

## Architecture

### Tables principales

#### `transaction_headers`
Contient les en-têtes de transactions avec:
- Référence unique auto-générée
- Type d'opération (dépôt, retrait, approvisionnement, change, transfert)
- Montant total et devise de référence
- Statut (brouillon, validée, annulée)
- Informations de création et validation

#### `transaction_lines`
Contient les lignes de transaction (écritures comptables) avec:
- Type de portefeuille (cash, virtuel)
- Service associé (pour les portefeuilles virtuels)
- Devise
- Sens (débit, crédit)
- Montant

### Contraintes importantes

1. **Équilibre obligatoire**: Pour chaque devise, la somme des débits doit égaler la somme des crédits
2. **Minimum 2 lignes**: Une transaction doit avoir au moins 2 lignes
3. **Validation atomique**: L'équilibre est vérifié automatiquement lors de la validation
4. **Immuabilité**: Une fois validée, une transaction ne peut plus être modifiée (seulement annulée)

## Utilisation

### 1. Créer une transaction de dépôt

```typescript
import { multiLineTransactionService } from '@/lib/multiLineTransactions';
import { transactionBuilders } from '@/lib/transactionBuilders';

// Construire la transaction
const transaction = transactionBuilders.buildDepot({
  montant: 100,
  devise: 'USD',
  commission: 2,
  service_id: 'service-uuid',
  type_portefeuille: 'virtuel',
  info_client: 'Client ABC',
});

// Créer la transaction (en brouillon)
const { data, error } = await multiLineTransactionService.createTransaction(
  transaction.header,
  transaction.lines
);

if (error) {
  console.error('Erreur:', error);
  return;
}

console.log('Transaction créée:', data.header.reference);

// Valider la transaction
const { success, error: validateError } = await multiLineTransactionService.validateTransaction(
  data.header.id
);
```

### 2. Créer une transaction de retrait

```typescript
const transaction = transactionBuilders.buildRetrait({
  montant: 50,
  devise: 'CDF',
  commission: 1,
  service_id: 'service-uuid',
  type_portefeuille: 'virtuel',
  info_client: 'Client XYZ',
});

const { data, error } = await multiLineTransactionService.createTransaction(
  transaction.header,
  transaction.lines
);
```

### 3. Créer un approvisionnement

```typescript
// Entrée de cash
const transaction = transactionBuilders.buildApprovisionnement({
  montant: 1000,
  devise: 'USD',
  type_operation: 'entree',
  type_portefeuille: 'cash',
  description: 'Approvisionnement caisse',
});

// Entrée virtuelle pour un service
const transactionVirtuel = transactionBuilders.buildApprovisionnement({
  montant: 500,
  devise: 'USD',
  type_operation: 'entree',
  type_portefeuille: 'virtuel',
  service_id: 'service-uuid',
  description: 'Recharge service',
});
```

### 4. Créer une opération de change

```typescript
const transaction = transactionBuilders.buildChange({
  montant_source: 100,
  devise_source: 'USD',
  montant_destination: 270000,
  devise_destination: 'CDF',
  commission: 5,
  taux: 2700,
});
```

### 5. Créer un transfert entre services

```typescript
const transaction = transactionBuilders.buildTransfert({
  montant: 200,
  devise: 'USD',
  service_source_id: 'service-a-uuid',
  service_destination_id: 'service-b-uuid',
  description: 'Transfert inter-services',
});
```

### 6. Lister les transactions

```typescript
const { data, error } = await multiLineTransactionService.listTransactions({
  statut: 'validee',
  type_operation: 'depot',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
});
```

### 7. Récupérer une transaction complète

```typescript
const { data, error } = await multiLineTransactionService.getTransaction(headerId);

if (data) {
  console.log('En-tête:', data.header);
  console.log('Lignes:', data.lines);
}
```

### 8. Annuler une transaction

```typescript
const { success, error } = await multiLineTransactionService.cancelTransaction(headerId);
```

## Exemples de transactions

### Dépôt virtuel de 100 USD avec 2 USD de commission

```
Ligne 1: Débit Cash USD      102 (entrée physique)
Ligne 2: Crédit Virtuel USD  100 (crédit au service)
Ligne 3: Crédit Cash USD       2 (commission gagnée)
```

### Retrait virtuel de 50 USD avec 1 USD de commission

```
Ligne 1: Débit Virtuel USD   50 (débit du service)
Ligne 2: Crédit Cash USD     49 (sortie physique)
Ligne 3: Débit Cash USD       1 (commission gagnée)
```

### Change 100 USD → 270000 CDF (taux 2700) avec 5 USD commission

```
Ligne 1: Débit Cash USD     100 (sortie USD)
Ligne 2: Crédit Cash CDF 269865 (entrée CDF - commission)
Ligne 3: Crédit Cash USD      5 (commission en USD)
```

### Approvisionnement cash de 1000 USD

```
Ligne 1: Débit Cash USD    1000 (entrée physique)
Ligne 2: Crédit Cash USD   1000 (ajustement comptable)
```

### Transfert 200 USD entre services

```
Ligne 1: Débit Virtuel USD Service A  200
Ligne 2: Crédit Virtuel USD Service B 200
```

## Migration progressive

Le nouveau système coexiste avec l'ancien système de transactions:

- Les tables `transactions`, `approvisionnements`, `change_operations` restent inchangées
- Les nouvelles tables `transaction_headers` et `transaction_lines` sont créées
- L'application peut utiliser les deux systèmes en parallèle
- La migration vers le nouveau système peut se faire progressivement

## Avantages

1. **Traçabilité complète**: Chaque mouvement financier est enregistré
2. **Intégrité des données**: L'équilibre est garanti par la base de données
3. **Flexibilité**: Supporte des transactions complexes multi-devises
4. **Audit**: Historique complet avec créateur et validateur
5. **Sécurité**: RLS et workflow de validation (brouillon → validée)

## Prochaines étapes

Pour intégrer complètement ce système:

1. Appliquer la migration SQL (voir `docs/migrations/multi_line_transactions.sql`)
2. Créer les composants UI pour la création/visualisation des transactions
3. Migrer progressivement les fonctionnalités existantes
4. Ajouter des rapports basés sur les nouvelles tables
5. Implémenter la synchronisation des soldes basée sur les écritures
