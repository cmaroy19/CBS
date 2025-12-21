# 📦 SYSTÈME D'APPROVISIONNEMENT PAR TYPE DE COMPTE

**Date:** 22 Novembre 2025
**Statut:** ✅ **IMPLÉMENTÉ**

---

## 🎯 FONCTIONNEMENT

### Avant (Comportement Ancien)
```
Formulaire:
- Choix Type: Cash ou Virtuel (manuel)
- Choix Service: Optionnel pour cash, obligatoire pour virtuel

Impact:
- Type "cash" → Impacte cash_usd/cash_cdf dans global_balances
- Type "virtuel" → Impacte solde_virtuel_usd/cdf du service
```

### Après (Nouveau Comportement) ✅
```
Formulaire:
- Choix Service: TOUJOURS OBLIGATOIRE
- Plus de choix manuel Cash/Virtuel

Impact:
- Service avec type_compte='cash' → Impacte cash_usd/cash_cdf global
- Service avec type_compte='virtuel' → Impacte solde_virtuel_usd/cdf du service
```

---

## 🏗️ ARCHITECTURE

### 1. Base de Données

**Table `services` - Nouveau champ:**
```sql
ALTER TABLE services
ADD COLUMN type_compte text NOT NULL DEFAULT 'virtuel'
CHECK (type_compte IN ('cash', 'virtuel'));
```

**Valeurs:**
- `'cash'`: Les approvisionnements sur ce service impactent le **cash global**
- `'virtuel'`: Les approvisionnements sur ce service impactent le **solde virtuel du service**

---

### 2. Fonction SQL

**Signature AVANT:**
```sql
create_approvisionnement_atomic(
  p_type text,              -- 'cash' ou 'virtuel' (manuel)
  p_operation text,
  p_service_id uuid,        -- Optionnel pour cash
  p_montant numeric,
  p_devise text,
  p_notes text,
  p_created_by uuid
)
```

**Signature APRÈS:**
```sql
create_approvisionnement_atomic(
  p_service_id uuid,        -- TOUJOURS OBLIGATOIRE
  p_operation text,
  p_montant numeric,
  p_devise text,
  p_notes text,
  p_created_by uuid
)
-- p_type supprimé - calculé automatiquement
```

**Logique de la fonction:**
```sql
-- 1. Récupérer le type_compte du service
SELECT type_compte, nom
INTO v_type_compte, v_service_nom
FROM services
WHERE id = p_service_id;

-- 2. Insérer l'approvisionnement avec le type calculé
INSERT INTO approvisionnements (type, operation, service_id, ...)
VALUES (v_type_compte, ...);  -- type = type_compte du service

-- 3. Impacter selon le type
IF v_type_compte = 'cash' THEN
  -- Impacte global_balances.cash_usd ou cash_cdf
ELSE
  -- Impacte services.solde_virtuel_usd ou solde_virtuel_cdf
END IF;
```

---

### 3. Frontend

**Formulaire AVANT:**
```typescript
formData = {
  type: 'cash' | 'virtuel',  // Choix manuel
  operation: 'entree' | 'sortie',
  service_id: '',             // Optionnel
  montant: number,
  devise: 'USD' | 'CDF',
  notes: string
}
```

**Formulaire APRÈS:**
```typescript
formData = {
  service_id: '',             // OBLIGATOIRE
  operation: 'entree' | 'sortie',
  montant: number,
  devise: 'USD' | 'CDF',
  notes: string
}
// Plus de champ 'type' - calculé automatiquement
```

**Appel RPC:**
```typescript
supabase.rpc('create_approvisionnement_atomic', {
  p_service_id: formData.service_id,  // Toujours présent
  p_operation: formData.operation,
  p_montant: formData.montant,
  p_devise: formData.devise,
  p_notes: formData.notes || null,
  p_created_by: user?.id,
});
```

---

## 📊 EXEMPLES

### Exemple 1: Service "Caisse Principale" (type_compte='cash')

**Configuration:**
```sql
INSERT INTO services (nom, code, type_compte, actif)
VALUES ('Caisse Principale', 'CAISSE', 'cash', true);
```

**Approvisionnement:**
```typescript
// Utilisateur crée un approvisionnement:
{
  service_id: 'id-caisse-principale',
  operation: 'entree',
  montant: 1000,
  devise: 'USD'
}
```

**Impact:**
```sql
-- Enregistrement créé:
INSERT INTO approvisionnements
(type, operation, service_id, montant, devise)
VALUES
('cash', 'entree', 'id-caisse-principale', 1000, 'USD');
-- type='cash' automatiquement déduit

-- Solde impacté:
UPDATE global_balances
SET cash_usd = cash_usd + 1000;
-- ✅ Cash global augmenté
```

---

### Exemple 2: Service "Airtel Money" (type_compte='virtuel')

**Configuration:**
```sql
INSERT INTO services (nom, code, type_compte, actif)
VALUES ('Airtel Money', 'AIRTEL', 'virtuel', true);
```

**Approvisionnement:**
```typescript
// Utilisateur crée un approvisionnement:
{
  service_id: 'id-airtel',
  operation: 'entree',
  montant: 500,
  devise: 'USD'
}
```

**Impact:**
```sql
-- Enregistrement créé:
INSERT INTO approvisionnements
(type, operation, service_id, montant, devise)
VALUES
('virtuel', 'entree', 'id-airtel', 500, 'USD');
-- type='virtuel' automatiquement déduit

-- Solde impacté:
UPDATE services
SET solde_virtuel_usd = solde_virtuel_usd + 500
WHERE id = 'id-airtel';
-- ✅ Solde virtuel du service Airtel augmenté
```

---

## 🔐 SÉCURITÉ

### Validations maintenues:
```sql
✅ Utilisateur authentifié (role: proprietaire/gerant)
✅ Montant > 0
✅ Service existe et actif
✅ Devise valide (USD/CDF)
✅ Opération valide (entree/sortie)
✅ Vérification solde insuffisant
✅ Transaction atomique (rollback auto en cas d'erreur)
✅ UPDATE avec WHERE clauses (RLS compliant)
```

---

## 📁 FICHIERS MODIFIÉS

### 3 Migrations SQL

1. **`add_type_compte_to_services.sql`**
   - Ajoute colonne `type_compte` à `services`
   - Valeur par défaut: `'virtuel'`
   - Contrainte CHECK: `IN ('cash', 'virtuel')`

2. **`update_atomic_function_use_type_compte.sql`**
   - Supprime paramètre `p_type`
   - Rend `p_service_id` obligatoire
   - Calcule automatiquement le type depuis `services.type_compte`
   - Impact automatique sur cash ou virtuel selon le type

3. **`fix_atomic_function_where_clause.sql`** (déjà existant)
   - Maintient les WHERE clauses pour RLS

### 2 Fichiers Frontend

1. **`src/components/approvisionnements/ApproForm.tsx`**
   - Supprimé: Champ "Type" (cash/virtuel)
   - Service: Maintenant toujours obligatoire
   - Label: "Service (détermine si cash ou virtuel)"
   - Appel RPC: Sans paramètre `p_type`

2. **`src/types/index.ts`**
   - Ajout: `type_compte: 'cash' | 'virtuel'` dans interface Service

---

## 🧪 TESTS

### Test 1: Service Cash
```sql
-- Créer un service cash
INSERT INTO services (nom, code, type_compte, actif)
VALUES ('Caisse Test', 'TEST_CASH', 'cash', true);

-- Approvisionner
SELECT create_approvisionnement_atomic(
  (SELECT id FROM services WHERE code = 'TEST_CASH'),
  'entree',
  100.00,
  'USD',
  'Test cash',
  (SELECT id FROM users WHERE role = 'proprietaire' LIMIT 1)
);

-- Vérifier
SELECT cash_usd FROM global_balances;
-- ✅ cash_usd augmenté de 100
```

### Test 2: Service Virtuel
```sql
-- Créer un service virtuel
INSERT INTO services (nom, code, type_compte, actif)
VALUES ('Mobile Money Test', 'TEST_VIRTUAL', 'virtuel', true);

-- Approvisionner
SELECT create_approvisionnement_atomic(
  (SELECT id FROM services WHERE code = 'TEST_VIRTUAL'),
  'entree',
  200.00,
  'USD',
  'Test virtuel',
  (SELECT id FROM users WHERE role = 'proprietaire' LIMIT 1)
);

-- Vérifier
SELECT solde_virtuel_usd FROM services WHERE code = 'TEST_VIRTUAL';
-- ✅ solde_virtuel_usd augmenté de 200
```

---

## 🎓 BONNES PRATIQUES

### Configuration des Services

**Services de type CASH:**
```sql
-- Exemples: Caisse physique, coffre-fort
INSERT INTO services (nom, code, type_compte) VALUES
('Caisse Principale', 'CAISSE', 'cash'),
('Coffre Bureau', 'COFFRE', 'cash');
```

**Services de type VIRTUEL:**
```sql
-- Exemples: Mobile money, banques, wallets
INSERT INTO services (nom, code, type_compte) VALUES
('M-Pesa', 'MPESA', 'virtuel'),
('Airtel Money', 'AIRTEL', 'virtuel'),
('Orange Money', 'ORANGE', 'virtuel'),
('Equity Bank', 'EQUITY', 'virtuel');
```

---

## 📊 RÉSULTAT UTILISATEUR

### Interface AVANT ❌
```
┌─────────────────────────────┐
│ Type: [Cash ▼] [Virtuel]    │ ← Choix manuel
│ Service: [Airtel ▼]         │ ← Optionnel pour cash
│ Opération: [Entrée ▼]       │
│ Devise: [USD ▼]             │
│ Montant: [____]             │
└─────────────────────────────┘

Problème: Confusion possible entre type et service
```

### Interface APRÈS ✅
```
┌─────────────────────────────┐
│ Service: [Airtel ▼]         │ ← Toujours obligatoire
│ (détermine si cash/virtuel) │ ← Indication claire
│ Opération: [Entrée (+) ▼]   │
│ Devise: [USD ▼]             │
│ Montant: [____]             │
└─────────────────────────────┘

Avantages:
✅ Interface plus simple
✅ Moins de confusion
✅ Type calculé automatiquement
✅ Cohérence garantie
```

---

## ✨ AVANTAGES

### 1. Simplicité
- ✅ Formulaire plus simple (1 champ en moins)
- ✅ Utilisateur choisit juste le service
- ✅ Pas de confusion type vs service

### 2. Cohérence
- ✅ Type toujours cohérent avec le service
- ✅ Impossible de faire un "virtuel" sur un service cash
- ✅ Configuration centralisée dans `services.type_compte`

### 3. Flexibilité
- ✅ Changer le type d'un service = 1 UPDATE SQL
- ✅ Pas besoin de modifier le code frontend
- ✅ Configuration au niveau base de données

### 4. Maintenabilité
- ✅ Logique métier dans la base de données
- ✅ Moins de validation côté frontend
- ✅ Source de vérité unique

---

## 🚀 MIGRATION DES DONNÉES EXISTANTES

**Tous les services existants:**
```sql
-- Par défaut, tous les services sont en 'virtuel'
SELECT nom, type_compte FROM services;

-- Résultat:
-- nom              | type_compte
-- Airtel Money     | virtuel
-- M-Pesa           | virtuel
-- Orange Money     | virtuel
```

**Pour créer un service cash:**
```sql
INSERT INTO services (nom, code, type_compte, actif)
VALUES ('Caisse Principale', 'CAISSE', 'cash', true);
```

**Pour convertir un service existant:**
```sql
-- Convertir "Caisse Principale" en cash
UPDATE services
SET type_compte = 'cash'
WHERE nom = 'Caisse Principale';
```

---

## ✅ VALIDATION

### Build Production
```bash
npm run build
✓ built in 6.75s
✅ 0 erreurs TypeScript
```

### Tests SQL
```sql
-- Test service cash
✅ PASS: Approvisionnement impacte global_balances.cash_usd

-- Test service virtuel
✅ PASS: Approvisionnement impacte services.solde_virtuel_usd

-- Test validation
✅ PASS: Service requis (erreur si null)
✅ PASS: Montant > 0 (erreur si <= 0)
✅ PASS: Permissions vérifiées
```

---

## 📝 CONCLUSION

**Le système d'approvisionnement est maintenant intelligent:**
- ✅ Type déterminé automatiquement par le service
- ✅ Interface utilisateur simplifiée
- ✅ Cohérence garantie
- ✅ Configuration centralisée
- ✅ Build validé

**L'approvisionnement a maintenant un impact automatique sur cash ou virtuel selon le type_compte du service choisi!** 🎉

---

**Date de fin:** 22 Novembre 2025
**Statut:** ✅ **PRODUCTION READY**
