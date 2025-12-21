# Retrait Mixte USD/CDF - Système de Correspondant Bancaire

## Vue d'ensemble

Le retrait mixte permet à un client de retirer des USD même lorsque la caisse USD est insuffisante. Dans ce cas, le système distribue automatiquement :
- Les USD disponibles en caisse
- Le reste en CDF selon le taux de change figé

## Principe de fonctionnement

### Scénario

Un client veut retirer **100 USD** de son portefeuille virtuel.

**Situation de la caisse :**
- Cash USD disponible : **30 USD**
- Cash CDF disponible : **Suffisant**
- Taux de change USD/CDF : **2700**
- Commission : **2 USD**

### Répartition

Le client reçoit :
- **30 USD** (tout le cash USD disponible)
- **189,000 CDF** (équivalent de 70 USD au taux 2700)

**Total pour le client : 100 USD** (ou son équivalent mixte)

## Écritures comptables

### Ligne 1 : Crédit Virtuel USD
```
Type : Virtuel
Devise : USD
Sens : Crédit
Montant : 100 USD
Description : Crédit virtuel USD (retrait client)
```

Le service est crédité de 100 USD car il a effectué une opération de retrait pour le client.

### Ligne 2 : Sortie Cash USD
```
Type : Cash
Devise : USD
Sens : Crédit
Montant : 30 USD
Description : Sortie Cash USD (30 USD disponibles)
```

Sortie physique des 30 USD disponibles en caisse.

### Ligne 3 : Sortie Cash CDF
```
Type : Cash
Devise : CDF
Sens : Crédit
Montant : 189,000 CDF
Description : Sortie Cash CDF (équiv. 70 USD au taux 2700)
```

Sortie physique de 189,000 CDF (équivalent de 70 USD).

### Ligne 4 : Contrepartie USD
```
Type : Cash
Devise : USD
Sens : Débit
Montant : 102 USD (100 + 2 commission)
Description : Contrepartie équilibrage USD
```

Écriture comptable pour équilibrer les USD.

### Ligne 5 : Contrepartie CDF
```
Type : Cash
Devise : CDF
Sens : Débit
Montant : 189,000 CDF
Description : Contrepartie équilibrage CDF
```

Écriture comptable pour équilibrer les CDF.

### Ligne 6 : Commission
```
Type : Cash
Devise : USD
Sens : Crédit
Montant : 2 USD
Description : Commission retrait
```

Commission perçue sur l'opération.

## Vérification d'équilibre

### USD
- **Crédits** : 100 (virtuel) + 30 (sortie) + 2 (commission) = **132 USD**
- **Débits** : 102 (contrepartie) = **102 USD**
- **Net** : -30 USD (sortie nette de cash)

### CDF
- **Crédits** : 189,000 CDF (sortie)
- **Débits** : 189,000 CDF (contrepartie)
- **Net** : 0 CDF (équilibré)

## Utilisation

### Exemple de code

```typescript
import { multiLineTransactionService, transactionBuilders } from '@/lib';
import { getActiveExchangeRate } from '@/lib/exchangeRates';

async function effectuerRetraitMixte() {
  const montant_demande = 100;
  const cash_usd_disponible = 30;
  const commission = 2;
  const service_id = 'service-uuid';
  const taux = await getActiveExchangeRate('USD', 'CDF');

  if (!taux) {
    throw new Error('Aucun taux de change actif trouvé');
  }

  const transaction = transactionBuilders.buildRetraitMixte({
    montant_total_usd: montant_demande,
    cash_usd_disponible,
    taux_usd_cdf: taux.taux,
    commission,
    service_id,
    info_client: 'Client: Jean Dupont',
  });

  const { data, error } = await multiLineTransactionService.createTransaction(
    transaction.header,
    transaction.lines
  );

  if (error) {
    console.error('Erreur:', error);
    return;
  }

  console.log('Transaction créée:', data.header.reference);
  console.log('Description:', data.header.description);

  const { success } = await multiLineTransactionService.validateTransaction(
    data.header.id
  );

  if (success) {
    console.log('Transaction validée avec succès');
  }
}
```

### Calcul automatique

La fonction `buildRetraitMixte` calcule automatiquement :

1. **Montant USD restant** : `montant_total_usd - cash_usd_disponible`
2. **Montant CDF équivalent** : `montant_restant * taux_usd_cdf`
3. **Génération des lignes** : Création automatique des écritures équilibrées

### Cas particulier : Assez d'USD

Si `cash_usd_disponible >= montant_total_usd`, la transaction devient un retrait USD simple sans conversion CDF.

```typescript
const transaction = transactionBuilders.buildRetraitMixte({
  montant_total_usd: 50,
  cash_usd_disponible: 100,
  taux_usd_cdf: 2700,
  commission: 2,
  service_id: 'service-uuid',
});
```

Dans ce cas, seuls les USD sont utilisés (pas de conversion CDF).

## Intégration avec le système de taux de change

Le taux de change utilisé est **figé** au moment de la transaction et enregistré dans :
- `transaction_headers.taux_change`
- `transaction_headers.paire_devises` (ex: "USD/CDF")

Cela garantit que le taux reste constant même si les taux changent après la transaction.

```typescript
import { getActiveExchangeRate } from '@/lib/exchangeRates';

const taux = await getActiveExchangeRate('USD', 'CDF');

if (!taux) {
  throw new Error('Aucun taux de change actif');
}
```

## Avantages

### 1. Flexibilité opérationnelle
- Permet de servir les clients même avec un cash USD limité
- Utilisation optimale des ressources disponibles
- Pas de refus de service

### 2. Transparence
- Taux de change figé et enregistré
- Répartition claire USD/CDF dans la description
- Traçabilité complète

### 3. Équilibre comptable
- Transaction toujours équilibrée
- Respect de la partie double
- Audit facilité

### 4. Expérience client
- Le client reçoit toujours le montant demandé (ou équivalent)
- Conversion automatique transparente
- Pas d'intervention manuelle requise

## Flux de travail recommandé

### 1. Vérification des soldes

```typescript
const { data: balance } = await supabase
  .from('realtime_balances')
  .select('cash_usd, cash_cdf')
  .single();

const cash_usd_disponible = balance.cash_usd || 0;
```

### 2. Récupération du taux actif

```typescript
const taux = await getActiveExchangeRate('USD', 'CDF');
```

### 3. Création de la transaction

```typescript
const transaction = transactionBuilders.buildRetraitMixte({
  montant_total_usd,
  cash_usd_disponible,
  taux_usd_cdf: taux.taux,
  commission,
  service_id,
  info_client,
});
```

### 4. Validation

```typescript
const { data } = await multiLineTransactionService.createTransaction(
  transaction.header,
  transaction.lines
);

await multiLineTransactionService.validateTransaction(data.header.id);
```

## Points d'attention

### ⚠️ Vérifications importantes

1. **Cash CDF suffisant** : Vérifier que le cash CDF est suffisant pour couvrir la conversion
2. **Taux actif** : S'assurer qu'un taux de change actif existe
3. **Limites** : Implémenter des limites de retrait si nécessaire
4. **Commission** : La commission est en USD

### 🔒 Sécurité

- La transaction est créée en statut **brouillon**
- Validation requise pour appliquer les changements
- Transaction immuable après validation
- RLS actif sur toutes les opérations

## Rapport et suivi

### Requête pour lister les retraits mixtes

```sql
SELECT
  h.*,
  l.lines
FROM v_transactions_completes h
WHERE type_operation = 'retrait'
  AND taux_change IS NOT NULL
  AND paire_devises = 'USD/CDF'
ORDER BY created_at DESC;
```

### Statistiques

```sql
SELECT
  COUNT(*) as total_retraits_mixtes,
  SUM(montant_total) as total_usd_retires,
  AVG(taux_change) as taux_moyen
FROM transaction_headers
WHERE type_operation = 'retrait'
  AND paire_devises = 'USD/CDF'
  AND statut = 'validee';
```

## Exemple complet

Voici un exemple complet d'intégration dans une interface React :

```typescript
import { useState } from 'react';
import { multiLineTransactionService, transactionBuilders } from '@/lib';
import { getActiveExchangeRate } from '@/lib/exchangeRates';
import { supabase } from '@/lib/supabase';

export function RetraitMixteForm({ serviceId }: { serviceId: string }) {
  const [montant, setMontant] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const handleRetrait = async () => {
    setLoading(true);

    try {
      const { data: balance } = await supabase
        .from('realtime_balances')
        .select('cash_usd, cash_cdf')
        .single();

      const cash_usd = balance?.cash_usd || 0;
      const cash_cdf = balance?.cash_cdf || 0;

      const taux = await getActiveExchangeRate('USD', 'CDF');

      if (!taux) {
        alert('Aucun taux de change actif');
        return;
      }

      const montant_cdf_requis = Math.max(0, montant - cash_usd) * taux.taux;

      if (montant_cdf_requis > cash_cdf) {
        alert('Cash CDF insuffisant pour cette opération');
        return;
      }

      const transaction = transactionBuilders.buildRetraitMixte({
        montant_total_usd: montant,
        cash_usd_disponible: Math.min(cash_usd, montant),
        taux_usd_cdf: taux.taux,
        commission: 2,
        service_id: serviceId,
      });

      const { data, error } = await multiLineTransactionService.createTransaction(
        transaction.header,
        transaction.lines
      );

      if (error) {
        alert('Erreur: ' + error.message);
        return;
      }

      await multiLineTransactionService.validateTransaction(data.header.id);

      alert(`Retrait effectué: ${data.header.reference}`);
    } catch (error) {
      console.error(error);
      alert('Erreur lors du retrait');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="number"
        value={montant}
        onChange={(e) => setMontant(Number(e.target.value))}
        placeholder="Montant USD"
      />
      <button onClick={handleRetrait} disabled={loading}>
        {loading ? 'En cours...' : 'Effectuer le retrait'}
      </button>
    </div>
  );
}
```

## Conclusion

Le système de retrait mixte offre une solution flexible et robuste pour gérer les retraits dans un contexte de correspondant bancaire où la liquidité en USD peut être limitée. La conversion automatique en CDF permet de maintenir un service continu tout en préservant l'intégrité comptable.
