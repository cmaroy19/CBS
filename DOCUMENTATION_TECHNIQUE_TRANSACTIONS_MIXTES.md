# Documentation Technique - Module Transaction Mixte (Forex)

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture](#architecture)
3. [Base de données](#base-de-données)
4. [Fonctions stockées](#fonctions-stockées)
5. [Interface utilisateur](#interface-utilisateur)
6. [Flux de données](#flux-de-données)
7. [Règles métier](#règles-métier)
8. [Gestion des erreurs](#gestion-des-erreurs)
9. [Exemples d'utilisation](#exemples-dutilisation)
10. [Tests et validation](#tests-et-validation)

---

## Vue d'ensemble

Le module de transaction mixte (forex) permet d'effectuer des opérations bancaires (dépôts et retraits) avec un paiement combiné en plusieurs devises (USD et CDF), en utilisant un taux de change configuré dynamiquement.

### Problématique

Dans les opérations bancaires quotidiennes, il arrive fréquemment que :
- Le client souhaite retirer 100 USD mais la caisse ne dispose que de 80 USD
- Le client dépose un montant en CDF mais son compte est en USD
- La trésorerie doit optimiser la répartition entre devises

### Solution

Le système de transaction mixte permet de :
1. **Effectuer des paiements partiels dans différentes devises**
2. **Utiliser un taux de change actif pour les conversions**
3. **Maintenir l'équilibre comptable en temps réel**
4. **Tracer toutes les opérations pour l'audit**

### Types de transactions supportées

1. **Transaction mixte USD** : Montant total en USD, payé/reçu en USD + CDF
2. **Transaction mixte CDF** : Montant total en CDF, payé/reçu en CDF + USD

Chaque type supporte deux opérations :
- **Dépôt** : Le client apporte de l'argent
- **Retrait** : Le client reçoit de l'argent

---

## Architecture

### Composants principaux

```
┌─────────────────────────────────────────────────────────────┐
│                    Interface Utilisateur                     │
│                  (TransactionMixteForm.tsx)                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ API Call (RPC)
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   Fonctions Stockées                         │
│  - create_transaction_mixte_retrait                          │
│  - create_transaction_mixte_depot                            │
│  - create_transaction_mixte_retrait_cdf                      │
│  - create_transaction_mixte_depot_cdf                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Write/Update
                         │
┌────────────────────────▼────────────────────────────────────┐
│                      Base de données                         │
│  Tables:                                                     │
│  - transaction_headers                                       │
│  - transaction_lines                                         │
│  - exchange_rates                                            │
│  - services                                                  │
│  - global_balances                                           │
│                                                              │
│  Vues:                                                       │
│  - unified_transactions_view                                 │
│  - dashboard_transactions_view                               │
└──────────────────────────────────────────────────────────────┘
```

### Principes de conception

1. **Comptabilité en partie double** : Chaque transaction crée des écritures équilibrées (débit = crédit)
2. **Atomicité** : Une transaction réussit complètement ou échoue complètement
3. **Traçabilité** : Chaque opération est enregistrée avec son contexte complet
4. **Validation** : Les soldes sont vérifiés avant chaque opération
5. **Immutabilité** : Les transactions validées ne peuvent être modifiées, seulement corrigées

---

## Base de données

### Table: `exchange_rates`

Stocke les taux de change configurés.

```sql
CREATE TABLE exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devise_source text NOT NULL,        -- 'USD'
  devise_destination text NOT NULL,    -- 'CDF'
  taux numeric(10,2) NOT NULL,        -- Ex: 2700.00
  actif boolean DEFAULT true,          -- Un seul taux actif par paire
  date_debut timestamptz,              -- Date d'application
  date_fin timestamptz,                -- Date d'expiration (optionnel)
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Contraintes** :
- Un seul taux peut être actif par paire de devises à la fois
- Le taux doit être > 0
- `devise_source` et `devise_destination` doivent être différents

**Index** :
```sql
CREATE INDEX idx_exchange_rates_active
  ON exchange_rates(devise_source, devise_destination, actif)
  WHERE actif = true;
```

### Table: `transaction_headers`

En-tête de chaque transaction.

```sql
CREATE TABLE transaction_headers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text UNIQUE NOT NULL,      -- Généré automatiquement
  type_operation text NOT NULL,        -- 'depot' | 'retrait'
  devise_reference text NOT NULL,      -- 'USD' | 'CDF'
  montant_total numeric(15,2) NOT NULL,
  description text,
  info_client text,
  taux_change numeric(10,2),           -- Taux figé au moment de la transaction
  paire_devises text,                  -- 'USD/CDF'
  statut text DEFAULT 'brouillon',     -- 'brouillon' | 'validee' | 'annulee'
  est_correction boolean DEFAULT false,
  transaction_source_id uuid,          -- Référence vers transaction corrigée
  raison_correction text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  validated_at timestamptz,
  validated_by uuid
);
```

**Champs importants** :
- `reference` : Format `TXN-YYYYMMDD-NNNNN` (ex: TXN-20250121-00001)
- `taux_change` : Taux figé pour garantir la traçabilité
- `est_correction` : Indique si c'est une transaction de correction
- `transaction_source_id` : Lie une correction à sa transaction originale

### Table: `transaction_lines`

Lignes de détail de chaque transaction (écritures comptables).

```sql
CREATE TABLE transaction_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  header_id uuid REFERENCES transaction_headers(id) ON DELETE CASCADE,
  ligne_numero integer NOT NULL,
  type_portefeuille text NOT NULL,    -- 'cash' | 'virtuel' | 'change'
  service_id uuid,                    -- Référence au service (NULL pour cash global)
  devise text NOT NULL,               -- 'USD' | 'CDF'
  sens text NOT NULL,                 -- 'debit' | 'credit'
  montant numeric(15,2) NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);
```

**Règle d'équilibre** :
Pour chaque `header_id`, la somme des débits (convertis en devise de référence) doit égaler la somme des crédits.

### Table: `services`

Services financiers (agents, points de vente, etc.).

```sql
CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  type_compte text NOT NULL,          -- 'cash' | 'virtuel'
  solde_virtuel_usd numeric(15,2) DEFAULT 0,
  solde_virtuel_cdf numeric(15,2) DEFAULT 0,
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Soldes virtuels** :
- Représentent le crédit du service envers la banque
- Mis à jour automatiquement par les transactions
- Ne peuvent être négatifs (vérification avant transaction)

### Table: `global_balances`

Soldes globaux de la trésorerie (une seule ligne).

```sql
CREATE TABLE global_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_usd numeric(15,2) DEFAULT 0,
  cash_cdf numeric(15,2) DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);
```

**Utilisation** :
- Une seule ligne dans cette table
- Représente le cash disponible physiquement
- Mis à jour à chaque transaction de retrait/dépôt

### Vue: `unified_transactions_view`

Vue qui joint les headers et lines pour faciliter les requêtes.

```sql
CREATE VIEW unified_transactions_view AS
SELECT
  h.id,
  h.reference,
  h.type_operation,
  h.devise_reference,
  h.montant_total,
  h.description,
  h.info_client,
  h.taux_change,
  h.paire_devises,
  h.statut,
  h.est_correction,
  h.transaction_source_id,
  h.raison_correction,
  h.created_at,
  h.created_by,
  json_agg(
    json_build_object(
      'ligne_numero', l.ligne_numero,
      'type_portefeuille', l.type_portefeuille,
      'service_id', l.service_id,
      'devise', l.devise,
      'sens', l.sens,
      'montant', l.montant,
      'description', l.description
    ) ORDER BY l.ligne_numero
  ) as lignes
FROM transaction_headers h
LEFT JOIN transaction_lines l ON l.header_id = h.id
GROUP BY h.id;
```

---

## Fonctions stockées

### 1. `get_active_exchange_rate(p_source, p_destination)`

Récupère le taux de change actif pour une paire de devises.

```sql
CREATE FUNCTION get_active_exchange_rate(
  p_source text,
  p_destination text
)
RETURNS numeric AS $$
DECLARE
  v_taux numeric;
BEGIN
  SELECT taux INTO v_taux
  FROM exchange_rates
  WHERE devise_source = p_source
    AND devise_destination = p_destination
    AND actif = true
    AND (date_debut IS NULL OR date_debut <= now())
    AND (date_fin IS NULL OR date_fin >= now())
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN v_taux;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Retour** :
- Le taux si trouvé
- `NULL` si aucun taux actif

### 2. `create_transaction_mixte_retrait(params)`

Crée une transaction de retrait avec paiement mixte USD/CDF.

**Paramètres** :
```sql
p_service_id uuid,              -- ID du service
p_montant_total_usd numeric,    -- Montant total du retrait en USD
p_montant_paye_usd numeric,     -- Partie payée en USD
p_montant_paye_cdf numeric,     -- Partie payée en CDF
p_info_client text,             -- Info client (optionnel)
p_notes text,                   -- Notes (optionnel)
p_created_by uuid               -- ID utilisateur
```

**Processus** :

```
1. Validation des paramètres
   ├─ montant_total_usd > 0
   ├─ montant_paye_usd >= 0
   ├─ montant_paye_cdf >= 0
   └─ Au moins un montant > 0

2. Vérification des soldes
   ├─ Solde virtuel service >= montant_total_usd
   ├─ Cash USD global >= montant_paye_usd
   └─ Cash CDF global >= montant_paye_cdf

3. Récupération du taux de change actif
   └─ Erreur si aucun taux actif

4. Validation de la conversion
   ├─ Calcul: reste_usd = montant_total - montant_paye_usd
   ├─ Calcul: cdf_attendu = reste_usd * taux
   └─ Vérification: |cdf_attendu - montant_paye_cdf| <= 0.01

5. Création du transaction_header
   └─ Statut: 'brouillon'

6. Création des transaction_lines
   ├─ Ligne 1: Débit service virtuel USD (montant_total)
   ├─ Ligne 2: Crédit cash USD (montant_paye_usd) [si > 0]
   └─ Ligne 3: Crédit cash CDF (montant_paye_cdf) [si > 0]

7. Validation de la transaction
   └─ Changement statut: 'brouillon' → 'validee'

8. Mise à jour des soldes
   ├─ services.solde_virtuel_usd -= montant_total_usd
   ├─ global_balances.cash_usd += montant_paye_usd
   └─ global_balances.cash_cdf += montant_paye_cdf

9. Retour de l'ID du header
```

**Retour** :
- `uuid` : ID du transaction_header créé

**Exceptions** :
- `'Le montant total doit être supérieur à zéro'`
- `'Les montants payés ne peuvent pas être négatifs'`
- `'Au moins un montant de paiement doit être supérieur à zéro'`
- `'Service introuvable'`
- `'Solde virtuel insuffisant. Disponible: X USD'`
- `'Solde cash USD insuffisant. Disponible: X USD'`
- `'Solde cash CDF insuffisant. Disponible: X CDF'`
- `'Aucun taux de change actif trouvé pour USD/CDF'`
- `'Montant CDF incorrect. Attendu: X CDF pour Y USD au taux Z'`

### 3. `create_transaction_mixte_depot(params)`

Crée une transaction de dépôt avec réception mixte USD/CDF.

**Paramètres** :
```sql
p_service_id uuid,
p_montant_total_usd numeric,
p_montant_recu_usd numeric,     -- Partie reçue en USD
p_montant_recu_cdf numeric,     -- Partie reçue en CDF
p_info_client text,
p_notes text,
p_created_by uuid
```

**Processus** : Similaire au retrait mais avec les sens inversés :

```
Écritures comptables:
├─ Ligne 1: Débit cash USD (montant_recu_usd) [si > 0]
├─ Ligne 2: Débit cash CDF (montant_recu_cdf) [si > 0]
└─ Ligne 3: Crédit service virtuel USD (montant_total)

Mise à jour des soldes:
├─ services.solde_virtuel_usd += montant_total_usd
├─ global_balances.cash_usd -= montant_recu_usd
└─ global_balances.cash_cdf -= montant_recu_cdf
```

### 4. `create_transaction_mixte_retrait_cdf(params)`

Similaire à `create_transaction_mixte_retrait` mais avec montant total en CDF.

**Différence clé** :
```sql
-- Calcul du montant total en USD
v_montant_total_usd := p_montant_total_cdf / v_taux_change;

-- Mise à jour du solde virtuel CDF (et non USD)
UPDATE services
SET solde_virtuel_cdf = solde_virtuel_cdf - p_montant_total_cdf
WHERE id = p_service_id;
```

### 5. `create_transaction_mixte_depot_cdf(params)`

Similaire à `create_transaction_mixte_depot` mais avec montant total en CDF.

### 6. `valider_transaction(header_id, user_id)`

Valide une transaction et change son statut.

```sql
CREATE FUNCTION valider_transaction(
  p_header_id uuid,
  p_user_id uuid
)
RETURNS void AS $$
BEGIN
  UPDATE transaction_headers
  SET
    statut = 'validee',
    validated_at = now(),
    validated_by = p_user_id
  WHERE id = p_header_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Interface utilisateur

### Composant: `TransactionMixteForm.tsx`

Formulaire de création de transaction mixte.

**État du composant** :
```typescript
interface FormData {
  type: 'depot' | 'retrait';
  service_id: string;
  montant_total_usd: number;
  montant_usd: number;
  montant_cdf: number;
  info_client: string;
  notes: string;
}
```

**Fonctionnalités** :

1. **Chargement du taux actif**
```typescript
useEffect(() => {
  loadExchangeRate();
}, []);

const loadExchangeRate = async () => {
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('*')
    .eq('devise_source', 'USD')
    .eq('devise_destination', 'CDF')
    .eq('actif', true)
    .maybeSingle();

  setExchangeRate(data);
};
```

2. **Calcul automatique**
```typescript
useEffect(() => {
  if (autoCalculate && exchangeRate && formData.montant_total_usd > 0) {
    const resteUsd = formData.montant_total_usd - formData.montant_usd;
    if (resteUsd >= 0) {
      const montantCdfCalcule = resteUsd * exchangeRate.taux;
      setFormData(prev => ({
        ...prev,
        montant_cdf: Math.round(montantCdfCalcule * 100) / 100
      }));
    }
  }
}, [formData.montant_total_usd, formData.montant_usd, exchangeRate, autoCalculate]);
```

3. **Soumission**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  // Validation côté client
  if (!exchangeRate) {
    throw new Error('Aucun taux de change actif');
  }

  // Déterminer la fonction à appeler
  const functionName = formData.type === 'retrait'
    ? 'create_transaction_mixte_retrait'
    : 'create_transaction_mixte_depot';

  // Préparer les paramètres
  const params = formData.type === 'retrait' ? {
    p_service_id: formData.service_id,
    p_montant_total_usd: formData.montant_total_usd,
    p_montant_paye_usd: formData.montant_usd,
    p_montant_paye_cdf: formData.montant_cdf,
    p_info_client: formData.info_client || null,
    p_notes: formData.notes || null,
    p_created_by: user?.id,
  } : {
    p_service_id: formData.service_id,
    p_montant_total_usd: formData.montant_total_usd,
    p_montant_recu_usd: formData.montant_usd,
    p_montant_recu_cdf: formData.montant_cdf,
    p_info_client: formData.info_client || null,
    p_notes: formData.notes || null,
    p_created_by: user?.id,
  };

  // Appel RPC
  const { data, error } = await supabase.rpc(functionName, params);

  if (error) throw error;

  // Enregistrement dans l'audit log
  await supabase.from('audit_logs').insert({
    table_name: 'transaction_headers',
    operation: 'INSERT',
    record_id: data,
    new_data: { type: formData.type, service, montant: formData.montant_total_usd },
    user_id: user?.id,
  });

  onSuccess();
};
```

**Interface utilisateur** :

```
┌──────────────────────────────────────────────────────────┐
│ Nouvelle Transaction Mixte (Forex)                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ [i] Taux actif: 1 USD = 2,700 CDF                       │
│                                                          │
│ Type:            [Retrait ▼]                             │
│                                                          │
│ Service:         [Illico Cash ▼]                         │
│                                                          │
│ Montant total:   [58.00] USD                             │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Répartition du paiement      [✓] Calcul auto      │  │
│ ├────────────────────────────────────────────────────┤  │
│ │                                                    │  │
│ │ Montant en USD:  [50.00]                          │  │
│ │ Montant en CDF:  [21,600.00]                      │  │
│ │                                                    │  │
│ │ Récapitulatif:                                     │  │
│ │ • Montant USD:        50.00 USD                    │  │
│ │ • Reste à convertir:   8.00 USD                    │  │
│ │ • Équivalent CDF:  21,600.00 CDF                   │  │
│ │ ─────────────────────────────────                  │  │
│ │ • Total:              58.00 USD                    │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ Info client:     [Jean Dupont]                          │
│                                                          │
│ Notes:           [_____________________________]         │
│                                                          │
│ [Annuler]                    [Créer la transaction]     │
└──────────────────────────────────────────────────────────┘
```

---

## Flux de données

### Cas d'usage 1: Retrait de 58 USD avec 50 USD + 21,600 CDF

**État initial** :
```
Service "Illico Cash":
  - solde_virtuel_usd: 150 USD

Global Balances:
  - cash_usd: 200 USD
  - cash_cdf: 500,000 CDF

Taux actif: 1 USD = 2,700 CDF
```

**Étape 1** : Utilisateur remplit le formulaire
```
type: 'retrait'
service_id: 'uuid-illico'
montant_total_usd: 58
montant_usd: 50
montant_cdf: 21,600
```

**Étape 2** : Validation côté client
```javascript
// Calcul du reste
const resteUsd = 58 - 50 = 8 USD

// Calcul CDF attendu
const cdfAttendu = 8 * 2700 = 21,600 CDF

// Vérification
Math.abs(21600 - 21600) <= 0.01 ✓
```

**Étape 3** : Appel RPC
```sql
SELECT create_transaction_mixte_retrait(
  'uuid-illico',      -- p_service_id
  58,                 -- p_montant_total_usd
  50,                 -- p_montant_paye_usd
  21600,              -- p_montant_paye_cdf
  'Jean Dupont',      -- p_info_client
  NULL,               -- p_notes
  'uuid-user'         -- p_created_by
);
```

**Étape 4** : Vérifications côté serveur
```sql
-- Vérifier solde service
SELECT solde_virtuel_usd FROM services WHERE id = 'uuid-illico';
-- Résultat: 150 USD >= 58 USD ✓

-- Vérifier cash USD
SELECT cash_usd FROM global_balances LIMIT 1;
-- Résultat: 200 USD >= 50 USD ✓

-- Vérifier cash CDF
SELECT cash_cdf FROM global_balances LIMIT 1;
-- Résultat: 500,000 CDF >= 21,600 CDF ✓

-- Vérifier taux
SELECT get_active_exchange_rate('USD', 'CDF');
-- Résultat: 2700 ✓

-- Vérifier conversion
-- reste = 58 - 50 = 8 USD
-- cdf_attendu = 8 * 2700 = 21,600 CDF
-- |21600 - 21600| = 0 <= 0.01 ✓
```

**Étape 5** : Création du header
```sql
INSERT INTO transaction_headers (
  type_operation, devise_reference, montant_total,
  description, info_client, taux_change, paire_devises,
  statut, created_by
) VALUES (
  'retrait', 'USD', 58,
  'Retrait mixte: 50 USD + 21600 CDF',
  'Jean Dupont', 2700, 'USD/CDF',
  'brouillon', 'uuid-user'
) RETURNING id;
-- Résultat: 'uuid-header-001'
```

**Étape 6** : Création des lignes
```sql
-- Ligne 1: Débit service virtuel
INSERT INTO transaction_lines (
  header_id, ligne_numero, type_portefeuille, service_id,
  devise, sens, montant, description
) VALUES (
  'uuid-header-001', 1, 'virtuel', 'uuid-illico',
  'USD', 'debit', 58, 'Débit service virtuel USD'
);

-- Ligne 2: Crédit cash USD
INSERT INTO transaction_lines (
  header_id, ligne_numero, type_portefeuille, service_id,
  devise, sens, montant, description
) VALUES (
  'uuid-header-001', 2, 'cash', NULL,
  'USD', 'credit', 50, 'Crédit cash USD'
);

-- Ligne 3: Crédit cash CDF
INSERT INTO transaction_lines (
  header_id, ligne_numero, type_portefeuille, service_id,
  devise, sens, montant, description
) VALUES (
  'uuid-header-001', 3, 'cash', NULL,
  'CDF', 'credit', 21600, 'Crédit cash CDF (équivalent 8 USD)'
);
```

**Étape 7** : Validation
```sql
-- Marquer la transaction comme validée
UPDATE transaction_headers
SET
  statut = 'validee',
  validated_at = now(),
  validated_by = 'uuid-user'
WHERE id = 'uuid-header-001';
```

**Étape 8** : Mise à jour des soldes
```sql
-- Déduire du solde virtuel du service
UPDATE services
SET
  solde_virtuel_usd = solde_virtuel_usd - 58,
  updated_at = now()
WHERE id = 'uuid-illico';
-- Nouveau solde: 150 - 58 = 92 USD

-- Ajouter au cash global
UPDATE global_balances
SET
  cash_usd = cash_usd + 50,
  cash_cdf = cash_cdf + 21600
WHERE id = (SELECT id FROM global_balances LIMIT 1);
-- Nouveaux soldes: cash_usd = 250 USD, cash_cdf = 521,600 CDF
```

**État final** :
```
Service "Illico Cash":
  - solde_virtuel_usd: 92 USD (150 - 58)

Global Balances:
  - cash_usd: 250 USD (200 + 50)
  - cash_cdf: 521,600 CDF (500,000 + 21,600)

Transaction créée:
  - Reference: TXN-20250121-00001
  - Type: retrait
  - Montant: 58 USD
  - Statut: validee
  - Taux: 2,700 CDF/USD (figé)
```

### Cas d'usage 2: Dépôt de 100 USD en CDF (270,000 CDF)

**État initial** :
```
Service "Mobile Money":
  - solde_virtuel_usd: 50 USD

Global Balances:
  - cash_usd: 250 USD
  - cash_cdf: 521,600 CDF

Taux actif: 1 USD = 2,700 CDF
```

**Formulaire** :
```
type: 'depot'
service_id: 'uuid-mobile'
montant_total_usd: 100
montant_usd: 0      (tout en CDF)
montant_cdf: 270,000
```

**Écritures créées** :
```
Ligne 1: Débit cash CDF 270,000 (client donne)
Ligne 2: Crédit service virtuel USD 100 (service reçoit)
```

**Mise à jour des soldes** :
```
services.solde_virtuel_usd: 50 + 100 = 150 USD
global_balances.cash_cdf: 521,600 - 270,000 = 251,600 CDF
```

---

## Règles métier

### Règle 1: Unicité du taux actif

**Énoncé** : Pour chaque paire de devises, un seul taux peut être actif à la fois.

**Implémentation** :
```sql
-- Contrainte unique conditionnelle
CREATE UNIQUE INDEX idx_unique_active_rate
  ON exchange_rates(devise_source, devise_destination)
  WHERE actif = true;
```

**Comportement** :
- Lors de l'activation d'un nouveau taux, désactiver automatiquement l'ancien
- L'historique des taux est conservé

### Règle 2: Équilibre comptable

**Énoncé** : Pour chaque transaction, la somme des débits doit égaler la somme des crédits (en devise de référence).

**Validation** :
```sql
CREATE OR REPLACE FUNCTION check_transaction_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_total_debit numeric;
  v_total_credit numeric;
  v_taux numeric;
  v_devise_ref text;
BEGIN
  -- Récupérer la devise de référence et le taux
  SELECT devise_reference, taux_change
  INTO v_devise_ref, v_taux
  FROM transaction_headers
  WHERE id = NEW.header_id;

  -- Calculer les totaux (convertis en devise de référence)
  SELECT
    SUM(CASE
      WHEN sens = 'debit' THEN
        CASE
          WHEN devise = v_devise_ref THEN montant
          ELSE montant / v_taux
        END
      ELSE 0
    END) as total_debit,
    SUM(CASE
      WHEN sens = 'credit' THEN
        CASE
          WHEN devise = v_devise_ref THEN montant
          ELSE montant / v_taux
        END
      ELSE 0
    END) as total_credit
  INTO v_total_debit, v_total_credit
  FROM transaction_lines
  WHERE header_id = NEW.header_id;

  -- Vérifier l'équilibre
  IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
    RAISE EXCEPTION 'Transaction déséquilibrée: débit=% credit=%',
      v_total_debit, v_total_credit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger sur INSERT de transaction_lines
CREATE TRIGGER check_balance_after_line_insert
AFTER INSERT ON transaction_lines
FOR EACH ROW
EXECUTE FUNCTION check_transaction_balance();
```

### Règle 3: Validation des soldes

**Énoncé** : Avant chaque transaction, vérifier que les soldes sont suffisants.

**Pour un retrait** :
1. Solde virtuel du service >= montant total
2. Cash USD >= montant payé en USD
3. Cash CDF >= montant payé en CDF

**Pour un dépôt** :
- Aucune vérification de solde minimum (le client apporte de l'argent)

### Règle 4: Précision des conversions

**Énoncé** : Les montants convertis doivent correspondre avec une tolérance de 0.01.

**Exemple** :
```sql
-- Montant attendu en CDF
v_montant_cdf_equivalent := (p_montant_total_usd - p_montant_paye_usd) * v_taux_change;

-- Validation
IF ABS(v_montant_cdf_equivalent - p_montant_paye_cdf) > 0.01 THEN
  RAISE EXCEPTION 'Montant CDF incorrect';
END IF;
```

Cette tolérance permet d'absorber les arrondis tout en garantissant la précision.

### Règle 5: Immutabilité des transactions validées

**Énoncé** : Une transaction validée ne peut être modifiée. Pour corriger, créer une transaction inverse.

**Implémentation** :
- Aucune fonction UPDATE sur `transaction_headers` ou `transaction_lines` exposée
- Système de correction qui crée une nouvelle transaction avec `est_correction = true`

### Règle 6: Traçabilité complète

**Énoncé** : Chaque transaction doit enregistrer :
- Le taux de change utilisé (figé)
- L'utilisateur qui l'a créée
- L'utilisateur qui l'a validée
- Les informations client
- La date et l'heure exactes

**Champs obligatoires** :
```sql
created_by uuid NOT NULL,
created_at timestamptz DEFAULT now(),
taux_change numeric,    -- Figé au moment de la transaction
paire_devises text
```

---

## Gestion des erreurs

### Erreurs de validation

| Code d'erreur | Message | Cause | Solution |
|---------------|---------|-------|----------|
| `P0001` | Le montant total doit être supérieur à zéro | `montant_total <= 0` | Saisir un montant > 0 |
| `P0001` | Les montants payés ne peuvent pas être négatifs | `montant < 0` | Saisir des montants >= 0 |
| `P0001` | Au moins un montant de paiement doit être supérieur à zéro | Tous les montants = 0 | Saisir au moins un montant > 0 |
| `P0001` | Service introuvable | `service_id` invalide | Vérifier l'ID du service |

### Erreurs de solde

| Code d'erreur | Message | Cause | Solution |
|---------------|---------|-------|----------|
| `P0001` | Solde virtuel insuffisant. Disponible: X USD | Solde service < montant | Approvisionner le service |
| `P0001` | Solde cash USD insuffisant. Disponible: X USD | Cash USD < montant payé | Approvisionner le cash USD |
| `P0001` | Solde cash CDF insuffisant. Disponible: X CDF | Cash CDF < montant payé | Approvisionner le cash CDF |

### Erreurs de taux de change

| Code d'erreur | Message | Cause | Solution |
|---------------|---------|-------|----------|
| `P0001` | Aucun taux de change actif trouvé pour USD/CDF | Aucun taux actif | Configurer un taux dans le module Taux de change |
| `P0001` | Montant CDF incorrect. Attendu: X CDF pour Y USD au taux Z | Montant ne correspond pas | Utiliser le calcul automatique ou corriger le montant |

### Gestion côté client

```typescript
try {
  const { data, error } = await supabase.rpc(functionName, params);

  if (error) throw error;

  // Succès
  showNotification('Transaction créée avec succès', 'success');
  onSuccess();

} catch (err: any) {
  // Afficher l'erreur de manière conviviale
  let errorMessage = 'Erreur lors de la création de la transaction';

  if (err.message.includes('Solde')) {
    errorMessage = 'Solde insuffisant. ' + err.message;
  } else if (err.message.includes('taux de change')) {
    errorMessage = 'Taux de change non configuré. Veuillez créer un taux actif.';
  } else if (err.message.includes('Montant CDF incorrect')) {
    errorMessage = 'Le montant CDF ne correspond pas au taux de change. ' + err.message;
  } else {
    errorMessage = err.message;
  }

  setError(errorMessage);
  showNotification(errorMessage, 'error');
}
```

---

## Exemples d'utilisation

### Exemple 1: Retrait simple tout en USD

```sql
SELECT create_transaction_mixte_retrait(
  p_service_id := '123e4567-e89b-12d3-a456-426614174000',
  p_montant_total_usd := 100,
  p_montant_paye_usd := 100,    -- Tout en USD
  p_montant_paye_cdf := 0,      -- Pas de CDF
  p_info_client := 'Marie Durand',
  p_notes := 'Retrait guichet',
  p_created_by := '987fcdeb-51a2-43e1-b456-426614174999'
);
```

**Résultat** :
```
Transaction créée avec 2 lignes:
1. Débit service virtuel USD: 100 USD
2. Crédit cash USD: 100 USD
```

### Exemple 2: Retrait mixte 50/50

```sql
SELECT create_transaction_mixte_retrait(
  p_service_id := '123e4567-e89b-12d3-a456-426614174000',
  p_montant_total_usd := 100,
  p_montant_paye_usd := 50,
  p_montant_paye_cdf := 135000,   -- 50 USD * 2700
  p_info_client := 'Pierre Martin',
  p_notes := NULL,
  p_created_by := '987fcdeb-51a2-43e1-b456-426614174999'
);
```

**Résultat** :
```
Transaction créée avec 3 lignes:
1. Débit service virtuel USD: 100 USD
2. Crédit cash USD: 50 USD
3. Crédit cash CDF: 135,000 CDF
```

### Exemple 3: Dépôt tout en CDF

```sql
SELECT create_transaction_mixte_depot(
  p_service_id := '123e4567-e89b-12d3-a456-426614174000',
  p_montant_total_usd := 200,
  p_montant_recu_usd := 0,        -- Pas de USD
  p_montant_recu_cdf := 540000,   -- 200 USD * 2700
  p_info_client := 'Sophie Lambert',
  p_notes := 'Dépôt Mobile Money',
  p_created_by := '987fcdeb-51a2-43e1-b456-426614174999'
);
```

**Résultat** :
```
Transaction créée avec 2 lignes:
1. Débit cash CDF: 540,000 CDF
2. Crédit service virtuel USD: 200 USD
```

### Exemple 4: Retrait avec montant total en CDF

```sql
SELECT create_transaction_mixte_retrait_cdf(
  p_service_id := '123e4567-e89b-12d3-a456-426614174000',
  p_montant_total_cdf := 270000,  -- Montant total en CDF
  p_montant_paye_cdf := 200000,
  p_montant_paye_usd := 25.93,    -- (270000 - 200000) / 2700
  p_info_client := 'Client ABC',
  p_notes := NULL,
  p_created_by := '987fcdeb-51a2-43e1-b456-426614174999'
);
```

**Résultat** :
```
Transaction créée avec 3 lignes:
1. Débit service virtuel CDF: 270,000 CDF
2. Crédit cash CDF: 200,000 CDF
3. Crédit cash USD: 25.93 USD
```

### Exemple 5: Consulter les transactions d'un service

```sql
SELECT
  h.reference,
  h.type_operation,
  h.montant_total,
  h.devise_reference,
  h.taux_change,
  h.description,
  h.created_at,
  u.nom_complet as created_by_name
FROM transaction_headers h
JOIN transaction_lines l ON l.header_id = h.id
JOIN users u ON u.id = h.created_by
WHERE l.service_id = '123e4567-e89b-12d3-a456-426614174000'
  AND h.statut = 'validee'
  AND l.type_portefeuille = 'virtuel'
ORDER BY h.created_at DESC;
```

### Exemple 6: Calculer le total des retraits mixtes du jour

```sql
SELECT
  COUNT(*) as nombre_transactions,
  SUM(montant_total) as total_usd,
  AVG(taux_change) as taux_moyen
FROM transaction_headers
WHERE type_operation = 'retrait'
  AND paire_devises = 'USD/CDF'
  AND DATE(created_at) = CURRENT_DATE
  AND statut = 'validee';
```

---

## Tests et validation

### Tests unitaires des fonctions

#### Test 1: Retrait normal

```sql
-- Setup
INSERT INTO services (id, nom, type_compte, solde_virtuel_usd)
VALUES ('test-service-1', 'Test Service', 'virtuel', 500);

INSERT INTO global_balances (cash_usd, cash_cdf)
VALUES (1000, 1000000);

INSERT INTO exchange_rates (devise_source, devise_destination, taux, actif)
VALUES ('USD', 'CDF', 2700, true);

-- Test
DO $$
DECLARE
  v_header_id uuid;
  v_solde_avant numeric;
  v_solde_apres numeric;
BEGIN
  -- Récupérer solde avant
  SELECT solde_virtuel_usd INTO v_solde_avant
  FROM services WHERE id = 'test-service-1';

  -- Exécuter la fonction
  SELECT create_transaction_mixte_retrait(
    'test-service-1',
    100,
    50,
    135000,
    'Test Client',
    NULL,
    NULL
  ) INTO v_header_id;

  -- Vérifier que le header est créé
  ASSERT v_header_id IS NOT NULL, 'Header doit être créé';

  -- Vérifier le solde après
  SELECT solde_virtuel_usd INTO v_solde_apres
  FROM services WHERE id = 'test-service-1';

  ASSERT v_solde_apres = v_solde_avant - 100,
    'Solde doit être réduit de 100 USD';

  -- Vérifier le nombre de lignes
  ASSERT (SELECT COUNT(*) FROM transaction_lines WHERE header_id = v_header_id) = 3,
    'Doit avoir 3 lignes';

  RAISE NOTICE 'Test 1 PASSED';
END $$;
```

#### Test 2: Erreur de solde insuffisant

```sql
DO $$
DECLARE
  v_error_raised boolean := false;
BEGIN
  -- Tenter un retrait avec solde insuffisant
  BEGIN
    PERFORM create_transaction_mixte_retrait(
      'test-service-1',
      10000,  -- Montant supérieur au solde
      10000,
      0,
      'Test Client',
      NULL,
      NULL
    );
  EXCEPTION
    WHEN OTHERS THEN
      v_error_raised := true;
      ASSERT SQLERRM LIKE '%insuffisant%', 'Message doit contenir "insuffisant"';
  END;

  ASSERT v_error_raised, 'Une exception doit être levée';

  RAISE NOTICE 'Test 2 PASSED';
END $$;
```

#### Test 3: Erreur de conversion

```sql
DO $$
DECLARE
  v_error_raised boolean := false;
BEGIN
  -- Tenter un retrait avec mauvais montant CDF
  BEGIN
    PERFORM create_transaction_mixte_retrait(
      'test-service-1',
      100,
      50,
      100000,  -- Devrait être 135000 (50 USD * 2700)
      'Test Client',
      NULL,
      NULL
    );
  EXCEPTION
    WHEN OTHERS THEN
      v_error_raised := true;
      ASSERT SQLERRM LIKE '%Montant CDF incorrect%',
        'Message doit indiquer montant CDF incorrect';
  END;

  ASSERT v_error_raised, 'Une exception doit être levée';

  RAISE NOTICE 'Test 3 PASSED';
END $$;
```

### Tests d'intégration

#### Test 1: Flux complet retrait + dépôt

```sql
DO $$
DECLARE
  v_retrait_id uuid;
  v_depot_id uuid;
  v_solde_initial numeric;
  v_solde_final numeric;
BEGIN
  -- Solde initial
  SELECT solde_virtuel_usd INTO v_solde_initial
  FROM services WHERE id = 'test-service-1';

  -- Retrait
  SELECT create_transaction_mixte_retrait(
    'test-service-1', 100, 50, 135000, 'Test', NULL, NULL
  ) INTO v_retrait_id;

  -- Dépôt (même montant)
  SELECT create_transaction_mixte_depot(
    'test-service-1', 100, 50, 135000, 'Test', NULL, NULL
  ) INTO v_depot_id;

  -- Solde final
  SELECT solde_virtuel_usd INTO v_solde_final
  FROM services WHERE id = 'test-service-1';

  -- Vérifier que le solde est revenu à l'initial
  ASSERT ABS(v_solde_final - v_solde_initial) < 0.01,
    'Solde doit revenir à l''état initial';

  RAISE NOTICE 'Test intégration PASSED';
END $$;
```

### Tests de charge

#### Test de concurrence

```javascript
// test-concurrency.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testConcurrency() {
  const promises = [];
  const numTransactions = 100;

  // Créer 100 transactions simultanément
  for (let i = 0; i < numTransactions; i++) {
    const promise = supabase.rpc('create_transaction_mixte_retrait', {
      p_service_id: 'test-service-1',
      p_montant_total_usd: 10,
      p_montant_paye_usd: 5,
      p_montant_paye_cdf: 13500,
      p_info_client: `Test ${i}`,
      p_notes: null,
      p_created_by: null
    });
    promises.push(promise);
  }

  const results = await Promise.allSettled(promises);

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  console.log(`Succeeded: ${succeeded}, Failed: ${failed}`);

  // Vérifier l'intégrité des soldes
  const { data: service } = await supabase
    .from('services')
    .select('solde_virtuel_usd')
    .eq('id', 'test-service-1')
    .single();

  console.log(`Solde final: ${service.solde_virtuel_usd}`);

  // Le solde doit correspondre au nombre de transactions réussies
  const expectedBalance = 500 - (succeeded * 10);
  console.log(`Solde attendu: ${expectedBalance}`);
  console.log(`Différence: ${Math.abs(service.solde_virtuel_usd - expectedBalance)}`);
}

testConcurrency();
```

### Tests de performance

```sql
-- Test de performance: 1000 transactions
DO $$
DECLARE
  v_start_time timestamp;
  v_end_time timestamp;
  v_duration interval;
  v_header_id uuid;
BEGIN
  v_start_time := clock_timestamp();

  FOR i IN 1..1000 LOOP
    SELECT create_transaction_mixte_retrait(
      'test-service-1',
      10,
      5,
      13500,
      'Perf Test ' || i,
      NULL,
      NULL
    ) INTO v_header_id;
  END LOOP;

  v_end_time := clock_timestamp();
  v_duration := v_end_time - v_start_time;

  RAISE NOTICE '1000 transactions créées en: %', v_duration;
  RAISE NOTICE 'Moyenne par transaction: % ms',
    EXTRACT(MILLISECONDS FROM v_duration) / 1000;
END $$;
```

---

## Annexes

### A. Diagramme entité-relation

```
┌─────────────────┐
│ exchange_rates  │
├─────────────────┤
│ id (PK)         │
│ devise_source   │
│ devise_dest     │
│ taux            │
│ actif           │
└─────────────────┘

┌─────────────────────────┐
│ transaction_headers     │
├─────────────────────────┤
│ id (PK)                 │
│ reference               │
│ type_operation          │
│ devise_reference        │
│ montant_total           │
│ taux_change             │◄─── Taux figé au moment de la transaction
│ paire_devises           │
│ statut                  │
│ est_correction          │
│ transaction_source_id   │
└────────┬────────────────┘
         │
         │ 1:N
         │
┌────────▼────────────────┐
│ transaction_lines       │
├─────────────────────────┤
│ id (PK)                 │
│ header_id (FK)          │
│ ligne_numero            │
│ type_portefeuille       │
│ service_id (FK)         │
│ devise                  │
│ sens                    │
│ montant                 │
└─────────────────────────┘

┌─────────────────┐
│ services        │
├─────────────────┤
│ id (PK)         │
│ nom             │
│ type_compte     │
│ solde_virt_usd  │◄─── Mis à jour par les transactions
│ solde_virt_cdf  │
└─────────────────┘

┌─────────────────┐
│ global_balances │
├─────────────────┤
│ id (PK)         │
│ cash_usd        │◄─── Mis à jour par les transactions
│ cash_cdf        │
└─────────────────┘
```

### B. Glossaire

- **Transaction header** : En-tête d'une transaction contenant les informations générales
- **Transaction line** : Ligne de détail d'une transaction (écriture comptable)
- **Partie double** : Principe comptable où chaque opération génère un débit et un crédit
- **Solde virtuel** : Crédit d'un service envers la banque (pas de cash physique)
- **Cash global** : Argent physique disponible dans la trésorerie
- **Taux figé** : Taux de change enregistré au moment de la transaction (ne change plus)
- **Devise de référence** : Devise dans laquelle le montant total est exprimé
- **RPC** : Remote Procedure Call - Appel de fonction côté serveur depuis le client
- **Atomicité** : Propriété garantissant qu'une transaction s'exécute complètement ou pas du tout

### C. Références

- **Fichier frontend** : `/src/components/transactions/TransactionMixteForm.tsx`
- **Migrations** :
  - `/supabase/migrations/20251222092742_create_transaction_mixte_forex.sql`
  - `/supabase/migrations/20251227125614_20251227_add_transaction_mixte_cdf.sql`
- **Documentation utilisateur** : `GUIDE_TRANSACTIONS_MIXTES_FOREX.md`
- **Documentation corrections** : `SYSTEME_CORRECTION_TRANSACTIONS.md`

### D. FAQ

**Q: Peut-on faire une transaction 100% en CDF ?**
R: Oui, mettre `montant_usd = 0` et `montant_cdf = montant_total * taux`.

**Q: Que se passe-t-il si on change le taux pendant une transaction ?**
R: Le taux est figé au moment de la transaction, donc pas d'impact.

**Q: Peut-on annuler une transaction ?**
R: Non, mais on peut la corriger (crée une transaction inverse).

**Q: Y a-t-il une limite de montant ?**
R: Uniquement limitée par les soldes disponibles et le type `numeric(15,2)`.

**Q: Comment gérer les arrondis ?**
R: Une tolérance de 0.01 est appliquée sur les conversions.

**Q: Peut-on faire une transaction mixte avec 3 devises ?**
R: Non, seulement 2 devises (USD et CDF) pour l'instant.

---

**Version** : 1.0
**Date** : 21 janvier 2025
**Auteur** : Système Himaya CBS
**Contact** : support@himaya-cbs.com
