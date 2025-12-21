# Exemples d'utilisation - Transactions Multi-Lignes

Ce document contient des exemples concrets et prêts à l'emploi pour utiliser le nouveau système de transactions multi-lignes.

## Configuration initiale

```typescript
import { multiLineTransactionService } from '@/lib/multiLineTransactions';
import { transactionBuilders } from '@/lib/transactionBuilders';
```

## Exemple 1: Dépôt virtuel complet

```typescript
async function exempleDepotVirtuel() {
  // Construction de la transaction
  const transaction = transactionBuilders.buildDepot({
    montant: 100,
    devise: 'USD',
    commission: 2,
    service_id: 'service-uuid-ici',
    type_portefeuille: 'virtuel',
    info_client: 'Jean Dupont - 0812345678',
  });

  console.log('Transaction construite:', {
    header: transaction.header,
    lignes: transaction.lines.length,
  });

  // Création en brouillon
  const { data, error } = await multiLineTransactionService.createTransaction(
    transaction.header,
    transaction.lines
  );

  if (error) {
    console.error('Erreur création:', error);
    return;
  }

  console.log('✓ Transaction créée:', data.header.reference);
  console.log('Statut:', data.header.statut);
  console.log('Lignes créées:', data.lines.length);

  // Afficher les lignes
  data.lines.forEach((line, index) => {
    console.log(`Ligne ${index + 1}:`, {
      type: line.type_portefeuille,
      devise: line.devise,
      sens: line.sens,
      montant: line.montant,
    });
  });

  // Validation de la transaction
  const { success, error: validateError } = await multiLineTransactionService.validateTransaction(
    data.header.id
  );

  if (validateError) {
    console.error('Erreur validation:', validateError);
    return;
  }

  console.log('✓ Transaction validée avec succès');

  // Récupérer la transaction validée
  const { data: transactionComplete } = await multiLineTransactionService.getTransaction(
    data.header.id
  );

  console.log('Transaction finale:', {
    reference: transactionComplete.header.reference,
    statut: transactionComplete.header.statut,
    validated_at: transactionComplete.header.validated_at,
  });
}
```

## Exemple 2: Retrait cash avec vérification

```typescript
async function exempleRetraitCash() {
  const montant = 50;
  const commission = 1;

  // Vérifier d'abord qu'on a assez de cash
  const { data: balances } = await supabase
    .from('global_balances')
    .select('cash_usd')
    .single();

  if (balances && balances.cash_usd < montant) {
    console.error('❌ Solde insuffisant en cash');
    return;
  }

  // Construction du retrait
  const transaction = transactionBuilders.buildRetrait({
    montant,
    devise: 'USD',
    commission,
    service_id: 'service-uuid-ici',
    type_portefeuille: 'virtuel',
    info_client: 'Marie Martin - 0823456789',
  });

  // Création et validation
  const { data, error } = await multiLineTransactionService.createTransaction(
    transaction.header,
    transaction.lines
  );

  if (error) {
    console.error('❌ Erreur:', error);
    return;
  }

  console.log('✓ Retrait créé:', data.header.reference);

  // Validation immédiate
  await multiLineTransactionService.validateTransaction(data.header.id);

  console.log('✓ Retrait validé - Cash à remettre:', montant - commission, 'USD');
}
```

## Exemple 3: Approvisionnement avec choix du type

```typescript
async function exempleApprovisionnement(
  type: 'entree' | 'sortie',
  typePortefeuille: 'cash' | 'virtuel'
) {
  const montant = 1000;
  const devise = 'USD';

  const params = {
    montant,
    devise,
    type_operation: type,
    type_portefeuille: typePortefeuille,
    description: `Approvisionnement ${type} ${typePortefeuille}`,
  };

  // Ajouter service_id si c'est un portefeuille virtuel
  if (typePortefeuille === 'virtuel') {
    params.service_id = 'service-uuid-ici';
  }

  const transaction = transactionBuilders.buildApprovisionnement(params);

  const { data, error } = await multiLineTransactionService.createTransaction(
    transaction.header,
    transaction.lines
  );

  if (error) {
    console.error('❌ Erreur:', error);
    return;
  }

  console.log('✓ Approvisionnement créé:', data.header.reference);

  await multiLineTransactionService.validateTransaction(data.header.id);

  console.log(`✓ ${type.toUpperCase()} de ${montant} ${devise} validée`);
}

// Utilisation
await exempleApprovisionnement('entree', 'cash');
await exempleApprovisionnement('sortie', 'virtuel');
```

## Exemple 4: Opération de change

```typescript
async function exempleChange() {
  const montantUSD = 100;
  const taux = 2700; // 1 USD = 2700 CDF
  const montantCDF = montantUSD * taux;
  const commission = 5; // Commission en USD

  const transaction = transactionBuilders.buildChange({
    montant_source: montantUSD,
    devise_source: 'USD',
    montant_destination: montantCDF,
    devise_destination: 'CDF',
    commission,
    taux,
  });

  const { data, error } = await multiLineTransactionService.createTransaction(
    transaction.header,
    transaction.lines
  );

  if (error) {
    console.error('❌ Erreur:', error);
    return;
  }

  console.log('✓ Change créé:', data.header.reference);
  console.log('Change:', `${montantUSD} USD → ${montantCDF} CDF`);
  console.log('Taux:', taux);
  console.log('Commission:', commission, 'USD');

  await multiLineTransactionService.validateTransaction(data.header.id);

  console.log('✓ Change validé');
}
```

## Exemple 5: Transfert entre services

```typescript
async function exempleTransfert() {
  const serviceSource = 'service-a-uuid';
  const serviceDestination = 'service-b-uuid';
  const montant = 200;
  const devise = 'USD';

  // Vérifier le solde du service source
  const { data: serviceA } = await supabase
    .from('services')
    .select('solde_virtuel_usd')
    .eq('id', serviceSource)
    .single();

  if (!serviceA || serviceA.solde_virtuel_usd < montant) {
    console.error('❌ Solde insuffisant sur le service source');
    return;
  }

  const transaction = transactionBuilders.buildTransfert({
    montant,
    devise,
    service_source_id: serviceSource,
    service_destination_id: serviceDestination,
    description: 'Réallocation de fonds entre services',
  });

  const { data, error } = await multiLineTransactionService.createTransaction(
    transaction.header,
    transaction.lines
  );

  if (error) {
    console.error('❌ Erreur:', error);
    return;
  }

  console.log('✓ Transfert créé:', data.header.reference);

  await multiLineTransactionService.validateTransaction(data.header.id);

  console.log(`✓ Transfert de ${montant} ${devise} validé`);
}
```

## Exemple 6: Lister et filtrer les transactions

```typescript
async function exempleListeTransactions() {
  // Toutes les transactions validées du mois
  const startDate = new Date();
  startDate.setDate(1);

  const { data, error } = await multiLineTransactionService.listTransactions({
    statut: 'validee',
    startDate: startDate.toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  if (error) {
    console.error('❌ Erreur:', error);
    return;
  }

  console.log(`✓ ${data.length} transactions trouvées`);

  // Grouper par type d'opération
  const groupes = data.reduce((acc, tx) => {
    acc[tx.type_operation] = (acc[tx.type_operation] || 0) + 1;
    return acc;
  }, {});

  console.log('Répartition:', groupes);

  // Afficher les 5 dernières
  data.slice(0, 5).forEach((tx) => {
    console.log(`- ${tx.reference}: ${tx.type_operation} ${tx.montant_total} ${tx.devise_reference}`);
  });
}
```

## Exemple 7: Transaction avec modification avant validation

```typescript
async function exempleModificationAvantValidation() {
  // Créer une transaction en brouillon
  const transaction = transactionBuilders.buildDepot({
    montant: 100,
    devise: 'USD',
    commission: 2,
    service_id: 'service-uuid',
    type_portefeuille: 'virtuel',
  });

  const { data, error } = await multiLineTransactionService.createTransaction(
    transaction.header,
    transaction.lines
  );

  if (error) {
    console.error('❌ Erreur:', error);
    return;
  }

  console.log('✓ Transaction en brouillon:', data.header.reference);

  // Modifier une ligne (tant que c'est en brouillon)
  const ligneAModifier = data.lines[0];

  const { data: ligneModifiee } = await multiLineTransactionService.updateLine(
    ligneAModifier.id,
    {
      description: 'Description mise à jour',
    }
  );

  console.log('✓ Ligne modifiée');

  // Ajouter une ligne supplémentaire (si besoin)
  const { data: nouvelleLigne } = await multiLineTransactionService.addLine(
    data.header.id,
    {
      ligne_numero: data.lines.length + 1,
      type_portefeuille: 'cash',
      devise: 'USD',
      sens: 'debit',
      montant: 0.5,
      description: 'Frais additionnels',
    }
  );

  console.log('✓ Ligne ajoutée');

  // Maintenant valider
  await multiLineTransactionService.validateTransaction(data.header.id);

  console.log('✓ Transaction validée après modifications');
}
```

## Exemple 8: Annuler une transaction

```typescript
async function exempleAnnulation() {
  // Récupérer une transaction à annuler
  const { data: transactions } = await multiLineTransactionService.listTransactions({
    statut: 'validee',
  });

  if (!transactions || transactions.length === 0) {
    console.log('Aucune transaction à annuler');
    return;
  }

  const transactionAnnuler = transactions[0];

  console.log('Transaction à annuler:', transactionAnnuler.reference);

  const { success, error } = await multiLineTransactionService.cancelTransaction(
    transactionAnnuler.id
  );

  if (error) {
    console.error('❌ Erreur annulation:', error);
    return;
  }

  console.log('✓ Transaction annulée');

  // Vérifier le nouveau statut
  const { data } = await multiLineTransactionService.getTransaction(transactionAnnuler.id);

  console.log('Nouveau statut:', data.header.statut);
}
```

## Exemple 9: Rapport détaillé d'une journée

```typescript
async function exempleRapportJournee(date: string) {
  const { data: transactions } = await multiLineTransactionService.listTransactions({
    statut: 'validee',
    startDate: date,
    endDate: date,
  });

  if (!transactions || transactions.length === 0) {
    console.log('Aucune transaction pour cette date');
    return;
  }

  console.log(`\n=== Rapport du ${date} ===\n`);
  console.log(`Total: ${transactions.length} transactions\n`);

  // Statistiques par type
  const stats = transactions.reduce((acc, tx) => {
    if (!acc[tx.type_operation]) {
      acc[tx.type_operation] = {
        count: 0,
        usd: 0,
        cdf: 0,
      };
    }
    acc[tx.type_operation].count++;
    if (tx.devise_reference === 'USD') {
      acc[tx.type_operation].usd += tx.montant_total;
    } else {
      acc[tx.type_operation].cdf += tx.montant_total;
    }
    return acc;
  }, {});

  Object.entries(stats).forEach(([type, data]) => {
    console.log(`${type.toUpperCase()}:`);
    console.log(`  - Nombre: ${data.count}`);
    if (data.usd > 0) console.log(`  - USD: ${data.usd.toFixed(2)}`);
    if (data.cdf > 0) console.log(`  - CDF: ${data.cdf.toFixed(2)}`);
    console.log('');
  });
}

// Utilisation
await exempleRapportJournee('2024-12-21');
```

## Exemple 10: Validation d'équilibre avant création

```typescript
function exempleValidationManuelle() {
  const lines = [
    {
      ligne_numero: 1,
      type_portefeuille: 'cash',
      devise: 'USD',
      sens: 'debit',
      montant: 100,
    },
    {
      ligne_numero: 2,
      type_portefeuille: 'virtuel',
      service_id: 'service-uuid',
      devise: 'USD',
      sens: 'credit',
      montant: 98,
    },
    {
      ligne_numero: 3,
      type_portefeuille: 'cash',
      devise: 'USD',
      sens: 'credit',
      montant: 2,
    },
  ];

  // Valider l'équilibre avant de créer
  const error = MultiLineTransactionService.validateBalance(lines);

  if (error) {
    console.error('❌ Transaction non équilibrée:', error.message);
    return false;
  }

  console.log('✓ Transaction équilibrée');
  return true;
}
```

## Exemple 11: Retrait mixte USD/CDF

```typescript
import { getActiveExchangeRate } from '@/lib/exchangeRates';

async function exempleRetraitMixte() {
  const montantDemande = 100;
  const commission = 2;
  const serviceId = 'service-uuid';

  // 1. Vérifier les soldes disponibles
  const { data: balances } = await supabase
    .from('realtime_balances')
    .select('cash_usd, cash_cdf')
    .single();

  const cashUsdDisponible = balances?.cash_usd || 0;
  const cashCdfDisponible = balances?.cash_cdf || 0;

  console.log('Soldes disponibles:', {
    usd: cashUsdDisponible,
    cdf: cashCdfDisponible,
  });

  // 2. Récupérer le taux de change actif
  const taux = await getActiveExchangeRate('USD', 'CDF');

  if (!taux) {
    console.error('❌ Aucun taux de change actif trouvé');
    return;
  }

  console.log('Taux actif:', taux.taux);

  // 3. Calculer le montant CDF nécessaire si USD insuffisant
  const montantRestantUSD = Math.max(0, montantDemande - cashUsdDisponible);
  const montantCdfNecessaire = montantRestantUSD * taux.taux;

  if (montantRestantUSD > 0) {
    console.log('USD insuffisant, conversion nécessaire:');
    console.log(`- ${montantRestantUSD} USD → ${montantCdfNecessaire} CDF`);

    if (cashCdfDisponible < montantCdfNecessaire) {
      console.error('❌ Cash CDF insuffisant pour cette opération');
      return;
    }
  }

  // 4. Construire la transaction
  const transaction = transactionBuilders.buildRetraitMixte({
    montant_total_usd: montantDemande,
    cash_usd_disponible: Math.min(cashUsdDisponible, montantDemande),
    taux_usd_cdf: taux.taux,
    commission,
    service_id: serviceId,
    info_client: 'Client: Paul Durand',
  });

  console.log('Transaction construite:', transaction.header.description);

  // 5. Créer la transaction
  const { data, error } = await multiLineTransactionService.createTransaction(
    transaction.header,
    transaction.lines
  );

  if (error) {
    console.error('❌ Erreur création:', error);
    return;
  }

  console.log('✓ Transaction créée:', data.header.reference);

  // Afficher les détails des lignes
  console.log('\nDétails des lignes:');
  data.lines.forEach((line, index) => {
    console.log(`Ligne ${index + 1}:`, {
      type: line.type_portefeuille,
      devise: line.devise,
      sens: line.sens,
      montant: line.montant,
      description: line.description,
    });
  });

  // 6. Valider la transaction
  const { success, error: validateError } = await multiLineTransactionService.validateTransaction(
    data.header.id
  );

  if (validateError) {
    console.error('❌ Erreur validation:', validateError);
    return;
  }

  console.log('\n✓ Transaction validée avec succès');
  console.log(`Client reçoit: ${Math.min(cashUsdDisponible, montantDemande)} USD`);
  if (montantRestantUSD > 0) {
    console.log(`          + ${montantCdfNecessaire.toFixed(0)} CDF`);
  }
}

// Exemple avec différents scénarios
async function exemplesScenariosRetraitMixte() {
  const serviceId = 'service-uuid';
  const taux = 2700;

  // Scénario 1: Assez d'USD
  console.log('\n=== Scénario 1: Cash USD suffisant ===');
  const tx1 = transactionBuilders.buildRetraitMixte({
    montant_total_usd: 50,
    cash_usd_disponible: 100,
    taux_usd_cdf: taux,
    commission: 2,
    service_id: serviceId,
  });
  console.log('Description:', tx1.header.description);
  console.log('Lignes:', tx1.lines.length);

  // Scénario 2: USD insuffisant, utilisation de CDF
  console.log('\n=== Scénario 2: Cash USD insuffisant ===');
  const tx2 = transactionBuilders.buildRetraitMixte({
    montant_total_usd: 100,
    cash_usd_disponible: 30,
    taux_usd_cdf: taux,
    commission: 2,
    service_id: serviceId,
  });
  console.log('Description:', tx2.header.description);
  console.log('Client reçoit: 30 USD + 189,000 CDF');
  console.log('Lignes:', tx2.lines.length);

  // Scénario 3: Aucun USD, tout en CDF
  console.log('\n=== Scénario 3: Aucun USD disponible ===');
  const tx3 = transactionBuilders.buildRetraitMixte({
    montant_total_usd: 100,
    cash_usd_disponible: 0,
    taux_usd_cdf: taux,
    commission: 2,
    service_id: serviceId,
  });
  console.log('Description:', tx3.header.description);
  console.log('Client reçoit: 0 USD + 270,000 CDF');
  console.log('Lignes:', tx3.lines.length);
}
```

## Notes d'utilisation

### Gestion des erreurs

Toujours vérifier les erreurs retournées:

```typescript
const { data, error } = await multiLineTransactionService.createTransaction(
  header,
  lines
);

if (error) {
  // Gérer l'erreur selon le contexte
  console.error('Erreur:', error.message);
  // Afficher un message à l'utilisateur
  // Logger l'erreur
  // Rollback si nécessaire
  return;
}

// Continuer avec data
```

### Transactions atomiques

Les transactions sont créées de manière atomique:
- Si l'en-tête échoue, rien n'est créé
- Si les lignes échouent, l'en-tête est supprimé automatiquement
- La validation vérifie l'équilibre avant de changer le statut

### Workflow recommandé

1. Créer en brouillon
2. Vérifier/modifier si nécessaire
3. Valider quand tout est correct
4. Annuler si erreur détectée

### Performance

Pour de grandes quantités de transactions:
- Utiliser des filtres appropriés dans `listTransactions()`
- Considérer la pagination
- Utiliser des index sur les dates et statuts
