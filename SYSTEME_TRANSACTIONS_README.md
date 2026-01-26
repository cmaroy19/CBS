# Système de Transactions - Documentation Complète

## Vue d'ensemble

Ce système de gestion de transactions financières supporte deux types d'opérations :
1. **Transactions simples** : Opérations dans une seule devise (USD ou CDF)
2. **Paiements mixtes (Forex)** : Opérations impliquant deux devises avec conversion automatique

Le système utilise une architecture de **comptabilité double entrée** où chaque transaction est équilibrée : la somme des débits égale la somme des crédits dans chaque devise.

---

## Architecture de la Base de Données

### Tables Principales

#### 1. `transaction_headers`
Contient les informations principales de chaque transaction.

```sql
- id (uuid)
- type_operation (text) : 'depot', 'retrait', 'change'
- devise_reference (text) : 'USD' ou 'CDF'
- montant_total (numeric)
- taux_change (numeric) : Taux de change utilisé (NULL pour transactions simples)
- paire_devises (text) : 'USD/CDF' ou 'CDF/USD' (NULL pour transactions simples)
- statut (text) : 'brouillon', 'validee', 'annulee'
- description (text)
- info_client (text)
- is_correction (boolean)
- created_by (uuid)
- created_at (timestamp)
```

#### 2. `transaction_lines`
Contient les lignes de débit/crédit de chaque transaction.

```sql
- id (uuid)
- header_id (uuid) : Référence vers transaction_headers
- ligne_numero (integer) : Ordre des lignes
- type_portefeuille (text) : 'cash' ou 'virtuel'
- service_id (uuid) : Service concerné (NULL pour cash)
- devise (text) : 'USD' ou 'CDF'
- sens (text) : 'debit' ou 'credit'
- montant (numeric)
- description (text)
- is_conversion_line (boolean) : true pour les lignes techniques d'équilibrage
```

#### 3. `global_balances`
Contient les soldes globaux de la caisse.

```sql
- cash_usd (numeric) : Argent liquide en USD
- cash_cdf (numeric) : Argent liquide en CDF
```

#### 4. `services`
Contient les soldes virtuels de chaque service/agent.

```sql
- id (uuid)
- nom (text)
- solde_virtuel_usd (numeric) : Créances/dettes en USD
- solde_virtuel_cdf (numeric) : Créances/dettes en CDF
```

---

## Principes de Comptabilité

### Comptabilité Double Entrée

Chaque transaction doit respecter les règles suivantes :
- **Équilibre par devise** : Dans chaque devise (USD et CDF), la somme des débits doit égaler la somme des crédits
- **Validation automatique** : Le système vérifie automatiquement l'équilibre avant de valider une transaction

### Sens des Opérations

#### Pour les Comptes Virtuels (Services)
- **DÉBIT** = Augmentation de créance (le service doit nous rendre de l'argent)
- **CRÉDIT** = Diminution de créance / Augmentation de dette (on doit de l'argent au service)

#### Pour le Cash (Caisse)
- **DÉBIT** = Entrée d'argent (augmentation)
- **CRÉDIT** = Sortie d'argent (diminution)

### Lignes de Conversion

Les **lignes de conversion** (`is_conversion_line = true`) sont des lignes techniques qui :
- Servent uniquement à équilibrer la comptabilité double entrée
- Sont ignorées par les triggers de mise à jour des soldes
- Permettent de gérer les conversions de devises sans affecter les soldes intermédiaires

---

## Transactions Simples

### 1. Dépôt Simple (USD ou CDF)

Un client dépose de l'argent via un service.

**Exemple : Dépôt de 100 USD via Cash Express**

```sql
SELECT create_transaction_depot(
  service_id := (SELECT id FROM services WHERE nom = 'Cash Express'),
  montant := 100,
  devise := 'USD',
  info_client := 'Jean Dupont',
  notes := 'Dépôt mensuel'
);
```

**Lignes créées :**
```
1. Débit Cash USD         : +100 USD  (entrée d'argent en caisse)
2. Crédit Virtuel USD     : +100 USD  (dette envers le service)
```

**Impact sur les soldes :**
- Cash USD : +100
- Virtuel Cash Express USD : -100 (on doit 100 USD au service)

---

### 2. Retrait Simple (USD ou CDF)

Un client retire de l'argent via un service.

**Exemple : Retrait de 50 USD via Cash Express**

```sql
SELECT create_transaction_retrait(
  service_id := (SELECT id FROM services WHERE nom = 'Cash Express'),
  montant := 50,
  devise := 'USD',
  info_client := 'Marie Martin',
  notes := 'Retrait urgent'
);
```

**Lignes créées :**
```
1. Débit Virtuel USD      : +50 USD   (créance augmente)
2. Crédit Cash USD        : -50 USD   (sortie d'argent)
```

**Impact sur les soldes :**
- Cash USD : -50
- Virtuel Cash Express USD : +50 (le service nous doit 50 USD)

---

## Paiements Mixtes (Forex)

Les paiements mixtes permettent de payer ou recevoir de l'argent dans deux devises différentes avec conversion automatique basée sur le taux de change actif.

### Taux de Change

Les taux de change sont stockés dans la table `exchange_rates` et doivent être bidirectionnels :
- **USD → CDF** : Taux d'achat (ex: 1 USD = 2,300 CDF)
- **CDF → USD** : Taux de vente (ex: 1 CDF = 0.00043 USD)

**Fonction pour obtenir le taux actif :**
```sql
SELECT get_active_exchange_rate('USD', 'CDF'); -- Retourne 2300
SELECT get_active_exchange_rate('CDF', 'USD'); -- Retourne 0.00043
```

---

### 1. Retrait USD avec Paiement Mixte

Un client retire en USD mais est payé partiellement en CDF.

**Exemple : Retrait de 59 USD payé avec 50 USD + 20,700 CDF**

Taux actif : 1 USD = 2,300 CDF

```sql
SELECT create_transaction_mixte_retrait(
  service_id := (SELECT id FROM services WHERE nom = 'Cash Express'),
  montant_total_usd := 59,
  montant_paye_usd := 50,
  montant_paye_cdf := 20700,
  info_client := 'Client ABC',
  notes := 'Paiement mixte'
);
```

**Lignes créées :**
```
1. Débit Virtuel USD      : +59 USD          (créance)
2. Crédit Cash USD        : -50 USD          (paiement partiel)
3. Crédit Virtuel USD     : -9 USD           (conversion) [IGNORÉE]
4. Débit Virtuel CDF      : +20,700 CDF      (conversion) [IGNORÉE]
5. Crédit Cash CDF        : -20,700 CDF      (paiement en CDF)
```

**Impact réel sur les soldes :**
- Virtuel USD : +59 (seulement ligne 1)
- Cash USD : -50
- Cash CDF : -20,700
- Virtuel CDF : inchangé (lignes 3 et 4 ignorées)

**Équilibre comptable :**
- USD : Débits = 59 (L1) + 9 (L3) = 68 | Crédits = 50 (L2) + 9 (L3) = 59 ✓ (L3 s'annule)
- CDF : Débits = 20,700 (L4) | Crédits = 20,700 (L5) ✓

---

### 2. Dépôt USD avec Paiement Mixte

Un client dépose en USD mais paie partiellement en CDF.

**Exemple : Dépôt de 100 USD reçu comme 80 USD + 46,000 CDF**

Taux actif : 1 USD = 2,300 CDF

```sql
SELECT create_transaction_mixte_depot(
  service_id := (SELECT id FROM services WHERE nom = 'Cash Express'),
  montant_total_usd := 100,
  montant_recu_usd := 80,
  montant_recu_cdf := 46000,
  info_client := 'Client XYZ',
  notes := 'Dépôt mixte'
);
```

**Lignes créées :**
```
1. Débit Cash USD         : +80 USD          (entrée USD)
2. Débit Virtuel USD      : +20 USD          (conversion) [IGNORÉE]
3. Crédit Virtuel CDF     : -46,000 CDF      (conversion) [IGNORÉE]
4. Débit Cash CDF         : +46,000 CDF      (entrée CDF)
5. Crédit Virtuel USD     : -100 USD         (dette envers service)
```

**Impact réel sur les soldes :**
- Cash USD : +80
- Cash CDF : +46,000
- Virtuel USD : -100 (seulement ligne 5)
- Virtuel CDF : inchangé (lignes 2 et 3 ignorées)

---

### 3. Retrait CDF avec Paiement Mixte

Un client retire en CDF mais est payé partiellement en USD.

**Exemple : Retrait de 46,000 CDF payé avec 20 USD + 0 CDF**

Taux actif : 1 CDF = 0.00043 USD (soit 1 USD = 2,300 CDF)

```sql
SELECT create_transaction_mixte_retrait_cdf(
  service_id := (SELECT id FROM services WHERE nom = 'Cash Express'),
  montant_total_cdf := 46000,
  montant_paye_usd := 20,
  montant_paye_cdf := 0,
  info_client := 'Client DEF',
  notes := 'Paiement en USD'
);
```

**Lignes créées :**
```
1. Débit Virtuel CDF      : +46,000 CDF      (créance)
2. Crédit Virtuel CDF     : -46,000 CDF      (conversion) [IGNORÉE]
3. Débit Virtuel USD      : +20 USD          (conversion) [IGNORÉE]
4. Crédit Cash USD        : -20 USD          (paiement)
```

**Impact réel sur les soldes :**
- Virtuel CDF : +46,000 (seulement ligne 1)
- Cash USD : -20
- Virtuel USD : inchangé (ligne 3 ignorée)

---

### 4. Dépôt CDF avec Paiement Mixte

Un client dépose en CDF mais paie partiellement en USD.

**Exemple : Dépôt de 100,000 CDF reçu comme 40 USD + 8,000 CDF**

Taux actif : 1 CDF = 0.00043 USD

```sql
SELECT create_transaction_mixte_depot_cdf(
  service_id := (SELECT id FROM services WHERE nom = 'Cash Express'),
  montant_total_cdf := 100000,
  montant_recu_usd := 40,
  montant_recu_cdf := 8000,
  info_client := 'Client GHI',
  notes := 'Dépôt mixte CDF'
);
```

**Lignes créées :**
```
1. Débit Cash USD         : +40 USD          (entrée USD)
2. Débit Virtuel CDF      : +92,000 CDF      (conversion) [IGNORÉE]
3. Crédit Virtuel USD     : -40 USD          (conversion) [IGNORÉE]
4. Débit Cash CDF         : +8,000 CDF       (entrée CDF)
5. Crédit Virtuel CDF     : -100,000 CDF     (dette)
```

**Impact réel sur les soldes :**
- Cash USD : +40
- Cash CDF : +8,000
- Virtuel CDF : -100,000 (seulement ligne 5)
- Virtuel USD : inchangé (ligne 3 ignorée)

---

## Système de Validation

### Fonction `validate_transaction_balance`

Valide qu'une transaction est équilibrée avant sa finalisation.

**Vérifications effectuées :**
1. Calcul des débits et crédits par devise (USD et CDF)
2. Vérification que débits = crédits pour chaque devise
3. Exception si déséquilibre détecté

**Exemple d'erreur :**
```
Transaction non équilibrée pour USD: débits=100 USD, crédits=90 USD
```

### Fonction `valider_transaction`

Valide et finalise une transaction :
1. Vérifie l'équilibre via `validate_transaction_balance`
2. Change le statut de 'brouillon' à 'validee'
3. Génère une référence unique (ex: TRX-20240126-0001)

---

## Triggers Automatiques

### Trigger `update_balances_on_transaction_line`

Ce trigger s'exécute automatiquement après l'insertion d'une ligne de transaction validée.

**Comportement :**
- Ignore les lignes avec `is_conversion_line = true`
- Ignore les lignes de transactions annulées ou corrections
- Met à jour automatiquement :
  - `global_balances` pour les lignes de type 'cash'
  - `services` pour les lignes de type 'virtuel'

**Logique de mise à jour :**

```sql
-- Pour le CASH
Si sens = 'debit' → Cash augmente (+)
Si sens = 'credit' → Cash diminue (-)

-- Pour le VIRTUEL
Si sens = 'debit' → Solde virtuel augmente (+) [Créance]
Si sens = 'credit' → Solde virtuel diminue (-) [Dette]
```

---

## Système de Correction

### Annulation de Transaction

Pour annuler une transaction, le système crée une transaction inverse :

```sql
SELECT annuler_transaction(
  transaction_id := '123e4567-e89b-12d3-a456-426614174000',
  raison := 'Erreur de saisie',
  created_by := (SELECT id FROM users LIMIT 1)
);
```

**Processus :**
1. Crée une nouvelle transaction avec `is_correction = true`
2. Inverse tous les débits/crédits de la transaction originale
3. Les deux transactions restent dans l'historique
4. Les soldes sont rétablis à leur état avant la transaction

---

## Vues Utiles

### `unified_transactions_view`

Vue consolidée qui combine headers et lines pour un affichage simplifié.

```sql
SELECT * FROM unified_transactions_view
WHERE created_at >= CURRENT_DATE
ORDER BY created_at DESC;
```

### `service_balances_view`

Vue des soldes actuels de chaque service.

```sql
SELECT * FROM service_balances_view
ORDER BY solde_virtuel_usd DESC;
```

---

## Fonctions Principales

### Transactions Simples

- `create_transaction_depot(service_id, montant, devise, info_client, notes)`
- `create_transaction_retrait(service_id, montant, devise, info_client, notes)`

### Transactions Mixtes USD

- `create_transaction_mixte_depot(service_id, montant_total_usd, montant_recu_usd, montant_recu_cdf, ...)`
- `create_transaction_mixte_retrait(service_id, montant_total_usd, montant_paye_usd, montant_paye_cdf, ...)`

### Transactions Mixtes CDF

- `create_transaction_mixte_depot_cdf(service_id, montant_total_cdf, montant_recu_usd, montant_recu_cdf, ...)`
- `create_transaction_mixte_retrait_cdf(service_id, montant_total_cdf, montant_paye_usd, montant_paye_cdf, ...)`

### Utilitaires

- `get_active_exchange_rate(devise_source, devise_cible)` : Obtenir le taux actif
- `valider_transaction(header_id, user_id)` : Valider manuellement une transaction
- `annuler_transaction(header_id, raison, user_id)` : Annuler une transaction

---

## Règles Métier

### Contraintes

1. **Soldes positifs** : Le cash ne peut jamais être négatif
2. **Taux requis** : Un taux de change actif doit exister pour les transactions mixtes
3. **Équilibre** : Toute transaction doit être équilibrée avant validation
4. **Montants valides** : Tous les montants doivent être positifs

### Sécurité (RLS)

Toutes les tables ont des politiques RLS (Row Level Security) :
- Les utilisateurs authentifiés peuvent lire les transactions
- Les administrateurs et gérants peuvent créer/modifier
- Les caissiers peuvent créer mais pas modifier

---

## Exemples d'Utilisation Frontend

### Créer un Retrait Mixte

```typescript
const { data, error } = await supabase.rpc('create_transaction_mixte_retrait', {
  p_service_id: serviceId,
  p_montant_total_usd: 59,
  p_montant_paye_usd: 50,
  p_montant_paye_cdf: 20700,
  p_info_client: 'Jean Dupont',
  p_notes: 'Retrait urgent',
  p_created_by: userId
});

if (error) {
  console.error('Erreur:', error.message);
} else {
  console.log('Transaction créée avec ID:', data);
}
```

### Obtenir les Transactions du Jour

```typescript
const { data: transactions } = await supabase
  .from('unified_transactions_view')
  .select('*')
  .gte('created_at', new Date().toISOString().split('T')[0])
  .order('created_at', { ascending: false });
```

### Consulter les Soldes

```typescript
const { data: balances } = await supabase
  .from('global_balances')
  .select('cash_usd, cash_cdf')
  .single();

const { data: serviceBalances } = await supabase
  .from('service_balances_view')
  .select('*');
```

---

## Dépannage

### Erreur : "Transaction non équilibrée"

**Cause :** Les débits ne correspondent pas aux crédits dans une devise.

**Solution :** Vérifier que :
- Les montants en CDF correspondent bien au taux de change
- Tous les montants sont positifs
- Le calcul de conversion est correct

### Erreur : "Solde cash insuffisant"

**Cause :** Tentative de retrait avec cash insuffisant.

**Solution :**
- Vérifier les soldes disponibles
- Faire un approvisionnement si nécessaire

### Erreur : "Aucun taux de change actif"

**Cause :** Pas de taux défini ou aucun taux actif.

**Solution :** Créer un taux de change actif dans `exchange_rates`.

---

## Architecture Technique

### Avantages du Système

1. **Comptabilité rigoureuse** : Respect strict de la double entrée
2. **Traçabilité complète** : Chaque ligne est enregistrée avec sa description
3. **Flexibilité** : Support des transactions simples et mixtes
4. **Sécurité** : Validation automatique et RLS
5. **Auditabilité** : Les corrections créent de nouvelles transactions au lieu de modifier les existantes

### Points d'Attention

1. **Lignes de conversion** : Ne jamais oublier `is_conversion_line = true` pour les lignes techniques
2. **Ordre des lignes** : Respecter l'ordre logique pour la lisibilité
3. **Gestion des erreurs** : Toujours capturer et afficher les erreurs SQL
4. **Performance** : Les triggers sont optimisés pour éviter les doublons de mise à jour

---

## Évolutions Futures

### Fonctionnalités Possibles

1. Support de devises supplémentaires (EUR, etc.)
2. Gestion des commissions automatiques
3. Rapports et statistiques avancés
4. Export comptable vers logiciels tiers
5. API REST pour intégration externe

---

## Support

Pour toute question ou problème :
1. Consulter les logs de la base de données
2. Vérifier l'équilibre des transactions avec la vue `unified_transactions_view`
3. Utiliser les fonctions de validation manuelles si nécessaire

---

**Version :** 1.0
**Dernière mise à jour :** 26 janvier 2026
**Auteur :** Système de Gestion Financière Himaya
