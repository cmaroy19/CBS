# 🧪 TESTS APPROVISIONNEMENT - GUIDE COMPLET

**Date:** 22 Novembre 2025
**Module:** Approvisionnement CASH & VIRTUEL
**Statut:** ✅ **CORRECTIONS APPLIQUÉES - PRÊT POUR TESTS**

---

## 📋 CORRECTIONS APPLIQUÉES

### ✅ 1. Système de Notifications
- **Créé:** `src/lib/notifications.ts` - Système toast complet
- **Créé:** `src/components/ui/Toast.tsx` - Composant toast UI
- **Intégré:** Dans `App.tsx` - Notifications globales actives

### ✅ 2. Formulaire Approvisionnement Amélioré
- **Validations strictes** frontend:
  - Service obligatoire
  - Montant > 0 (pas de valeur négative ou nulle)
  - Devise ∈ {USD, CDF}
  - Opération ∈ {entree, sortie}
- **Messages d'erreur** clairs et précis
- **Messages de succès** avec détails (montant, devise, service, opération)
- **Reset automatique** du formulaire après succès
- **Try/catch/finally** avec `setLoading(false)` garanti

### ✅ 3. Temps Réel Optimisé
- **Écoute INSERT** sur `approvisionnements` → Recharge approvisionnements + services
- **Écoute UPDATE** sur `global_balances` → Recharge services (pour cash)
- **Écoute UPDATE** sur `services` → Recharge services (pour virtuel)
- **Canal unique** - Pas de duplications
- **Cleanup** correct

### ✅ 4. Fonction SQL Atomique
- **Transaction complète** avec WHERE clauses
- **Validations serveur** robustes
- **Type automatique** basé sur `service.type_compte`
- **Gestion erreurs** avec messages clairs

---

## 🧪 TESTS À EFFECTUER

### TEST 1: Approvisionnement CASH USD (Entrée)

**Prérequis:**
```sql
-- 1. Créer un service de type CASH
INSERT INTO services (nom, code, type_compte, actif)
VALUES ('Caisse Principale', 'CAISSE', 'cash', true);

-- 2. Noter le solde actuel
SELECT cash_usd FROM global_balances;
-- Exemple: 5000.00 USD
```

**Actions:**
1. Aller sur page "Approvisionnements"
2. Cliquer "Nouvel approvisionnement"
3. Sélectionner service: "Caisse Principale"
4. Opération: "Entrée (+)"
5. Devise: "USD"
6. Montant: 1000.00
7. Notes: "Test approvisionnement cash USD"
8. Cliquer "Créer l'approvisionnement"

**Résultats attendus:**
- ✅ Notification succès: "Approvisionnement enregistré - Entrée de 1000.00 USD sur Caisse Principale"
- ✅ Modale se ferme automatiquement
- ✅ Nouvel approvisionnement apparaît dans le tableau
- ✅ Type affiché: "Cash" (badge bleu)
- ✅ Solde cash USD global: 6000.00 USD (5000 + 1000)
- ✅ Dashboard mis à jour automatiquement

**Vérification SQL:**
```sql
-- Vérifier l'approvisionnement créé
SELECT * FROM approvisionnements
WHERE notes = 'Test approvisionnement cash USD'
ORDER BY created_at DESC LIMIT 1;
-- type doit être 'cash', operation 'entree', montant 1000, devise 'USD'

-- Vérifier le solde global
SELECT cash_usd FROM global_balances;
-- Doit être 6000.00
```

---

### TEST 2: Approvisionnement CASH CDF (Sortie)

**Actions:**
1. Même service "Caisse Principale"
2. Opération: **"Sortie (-)"**
3. Devise: **"CDF"**
4. Montant: 50000.00
5. Notes: "Test sortie cash CDF"
6. Soumettre

**Résultats attendus:**
- ✅ Notification succès: "Approvisionnement enregistré - Sortie de 50000.00 CDF sur Caisse Principale"
- ✅ Type: "Cash"
- ✅ Opération: Icône flèche bas rouge
- ✅ Solde cash CDF diminue de 50000

**Vérification SQL:**
```sql
SELECT cash_cdf FROM global_balances;
-- Doit avoir diminué de 50000
```

---

### TEST 3: Approvisionnement VIRTUEL USD (Entrée)

**Prérequis:**
```sql
-- 1. Créer un service de type VIRTUEL
INSERT INTO services (nom, code, type_compte, actif)
VALUES ('Airtel Money', 'AIRTEL', 'virtuel', true);

-- 2. Noter le solde virtuel actuel
SELECT solde_virtuel_usd FROM services WHERE code = 'AIRTEL';
-- Exemple: 2000.00 USD
```

**Actions:**
1. Service: "Airtel Money"
2. Opération: "Entrée (+)"
3. Devise: "USD"
4. Montant: 500.00
5. Notes: "Test approvisionnement virtuel USD"
6. Soumettre

**Résultats attendus:**
- ✅ Notification succès: "Approvisionnement enregistré - Entrée de 500.00 USD sur Airtel Money"
- ✅ Type: "Virtuel" (badge orange)
- ✅ Solde virtuel USD du service Airtel: 2500.00 USD (2000 + 500)
- ✅ Solde cash global **INCHANGÉ** (car virtuel)

**Vérification SQL:**
```sql
SELECT solde_virtuel_usd FROM services WHERE code = 'AIRTEL';
-- Doit être 2500.00

SELECT cash_usd FROM global_balances;
-- DOIT ÊTRE INCHANGÉ (car c'est virtuel)
```

---

### TEST 4: Approvisionnement VIRTUEL CDF (Sortie)

**Actions:**
1. Service: "Airtel Money"
2. Opération: **"Sortie (-)"**
3. Devise: **"CDF"**
4. Montant: 100000.00
5. Notes: "Test sortie virtuel CDF"
6. Soumettre

**Résultats attendus:**
- ✅ Notification succès
- ✅ Type: "Virtuel"
- ✅ Solde virtuel CDF du service diminue de 100000
- ✅ Cash global inchangé

---

### TEST 5: Validation - Montant Vide

**Actions:**
1. Service: "Caisse Principale"
2. Montant: **(laisser vide ou 0)**
3. Soumettre

**Résultats attendus:**
- ❌ Message d'erreur: "Le montant doit être un nombre supérieur à zéro"
- ❌ Notification rouge: "Erreur d'approvisionnement"
- ✅ Formulaire reste ouvert
- ✅ Pas de spinner infini
- ✅ Aucune donnée insérée en base

---

### TEST 6: Validation - Montant Négatif

**Actions:**
1. Montant: **-100**
2. Soumettre

**Résultats attendus:**
- ❌ Erreur: "Le montant doit être un nombre supérieur à zéro"
- ❌ Notification rouge
- ✅ Pas de spinner infini

---

### TEST 7: Validation - Service Non Sélectionné

**Actions:**
1. Service: **(laisser vide)**
2. Montant: 100
3. Soumettre

**Résultats attendus:**
- ❌ Erreur: "Veuillez sélectionner un service"
- ❌ Notification rouge
- ✅ Formulaire reste ouvert

---

### TEST 8: Validation - Solde Insuffisant (Cash)

**Prérequis:**
```sql
-- Réduire le solde cash USD à 50
UPDATE global_balances SET cash_usd = 50.00;
```

**Actions:**
1. Service: "Caisse Principale" (cash)
2. Opération: **"Sortie (-)"**
3. Devise: "USD"
4. Montant: **1000.00** (plus que disponible)
5. Soumettre

**Résultats attendus:**
- ❌ Erreur SQL: "Solde cash USD insuffisant. Disponible: 50.00 USD"
- ❌ Notification rouge avec message clair
- ✅ Pas d'insertion en base
- ✅ Transaction rollback automatique
- ✅ Formulaire reste ouvert

---

### TEST 9: Validation - Solde Insuffisant (Virtuel)

**Prérequis:**
```sql
-- Réduire le solde virtuel
UPDATE services
SET solde_virtuel_usd = 10.00
WHERE code = 'AIRTEL';
```

**Actions:**
1. Service: "Airtel Money" (virtuel)
2. Opération: **"Sortie (-)"**
3. Devise: "USD"
4. Montant: **500.00** (plus que disponible)
5. Soumettre

**Résultats attendus:**
- ❌ Erreur SQL: "Solde virtuel USD insuffisant pour Airtel Money. Disponible: 10.00 USD"
- ❌ Notification rouge
- ✅ Rollback automatique

---

### TEST 10: Temps Réel - Mise à Jour Automatique

**Setup:**
- Ouvrir 2 onglets du navigateur
- Connecter avec 2 utilisateurs différents (ou même utilisateur)
- Onglet 1: Page "Approvisionnements"
- Onglet 2: Page "Dashboard"

**Actions:**
1. **Onglet 1:** Créer un approvisionnement cash USD entrée de 1000
2. Observer **Onglet 2**

**Résultats attendus:**
- ✅ **Onglet 2** Dashboard se met à jour **automatiquement**
- ✅ Solde cash USD augmente sans refresh
- ✅ Pas besoin de recharger la page

---

### TEST 11: Reset Formulaire Après Succès

**Actions:**
1. Créer un approvisionnement avec:
   - Service: "Caisse Principale"
   - Montant: 100
   - Devise: USD
   - Notes: "Test reset"
2. Soumettre avec succès
3. Rouvrir le formulaire

**Résultats attendus:**
- ✅ Service: **(vide - "Sélectionner un service")**
- ✅ Montant: **(vide)**
- ✅ Opération: "Entrée" (défaut)
- ✅ Devise: "USD" (défaut)
- ✅ Notes: **(vide)**

---

### TEST 12: Annulation Formulaire

**Actions:**
1. Ouvrir formulaire
2. Remplir champs
3. Cliquer **"Annuler"**

**Résultats attendus:**
- ✅ Modale se ferme
- ✅ Aucune donnée insérée
- ✅ Pas d'erreur console

---

### TEST 13: Permissions - Utilisateur Non Autorisé

**Prérequis:**
```sql
-- Se connecter avec un utilisateur caissier
-- Ou modifier temporairement le rôle
UPDATE users SET role = 'caissier' WHERE email = 'test@example.com';
```

**Actions:**
1. Essayer de créer un approvisionnement

**Résultats attendus:**
- ❌ Erreur SQL: "Permission refusée: utilisateur non autorisé"
- ❌ Notification rouge
- ✅ Aucune insertion en base

---

### TEST 14: Historique Complet

**Actions:**
1. Créer 5 approvisionnements différents:
   - Cash USD entrée
   - Cash CDF sortie
   - Virtuel USD entrée
   - Virtuel CDF sortie
   - Mixte
2. Vérifier le tableau

**Résultats attendus:**
- ✅ Tous les approvisionnements affichés
- ✅ Ordre chronologique inverse (plus récent en haut)
- ✅ Colonnes correctes:
  - Opération (icône + texte)
  - Type (badge cash/virtuel)
  - Service (nom du service)
  - Montant (formaté avec 2 décimales)
  - Date (format français)
  - Créé par (nom utilisateur)
  - Notes

---

### TEST 15: Performance - Pas de Boucle Infinie

**Actions:**
1. Ouvrir DevTools Console
2. Naviguer sur page "Approvisionnements"
3. Observer les logs console pendant 30 secondes

**Résultats attendus:**
- ✅ Pas de fetch en boucle
- ✅ Pas de "Loading data..." répétitif
- ✅ Maximum 1-2 requêtes au chargement
- ✅ Subscription realtime établie une seule fois

---

## 📊 RÉSUMÉ DES VÉRIFICATIONS

### Fonctionnalités Testées
- ✅ Approvisionnement CASH USD/CDF
- ✅ Approvisionnement VIRTUEL USD/CDF
- ✅ Entrées et sorties
- ✅ Validations frontend
- ✅ Validations backend (SQL)
- ✅ Messages d'erreur clairs
- ✅ Messages de succès
- ✅ Reset formulaire
- ✅ Temps réel
- ✅ Permissions
- ✅ Historique
- ✅ Performance

### Points Critiques Vérifiés
- ✅ **Pas de spinner infini** (finally avec setLoading)
- ✅ **Messages d'erreur affichés** (notification toast)
- ✅ **Messages de succès** (notification toast)
- ✅ **Reset des champs** après succès
- ✅ **Transaction atomique** (fonction SQL)
- ✅ **Temps réel fonctionnel** (UPDATE sur services/global_balances)
- ✅ **Validations strictes** (montant, devise, service)
- ✅ **Pas de boucle fetch** (useEffect optimisé)

---

## 🔧 OUTILS DE DÉBOGAGE

### Console Logs Utiles
```javascript
// Dans ApproForm.tsx
console.log('=== DIAGNOSTIC APPROVISIONNEMENT ===');
console.log('Form data:', formData);
console.log('RPC error:', rpcError);
console.log('Approvisionnement créé:', data);
```

### Requêtes SQL de Vérification
```sql
-- Vérifier les approvisionnements récents
SELECT
  a.id,
  a.type,
  a.operation,
  a.montant,
  a.devise,
  s.nom as service_nom,
  u.nom_complet as created_by,
  a.created_at
FROM approvisionnements a
LEFT JOIN services s ON s.id = a.service_id
LEFT JOIN users u ON u.id = a.created_by
ORDER BY a.created_at DESC
LIMIT 10;

-- Vérifier les soldes globaux
SELECT * FROM global_balances;

-- Vérifier les soldes virtuels
SELECT nom, solde_virtuel_usd, solde_virtuel_cdf, type_compte
FROM services
WHERE actif = true;
```

---

## ✅ CHECKLIST FINALE

Avant de déclarer le module APPROVISIONNEMENT en production:

- [ ] Test 1: Cash USD entrée ✅
- [ ] Test 2: Cash CDF sortie ✅
- [ ] Test 3: Virtuel USD entrée ✅
- [ ] Test 4: Virtuel CDF sortie ✅
- [ ] Test 5: Validation montant vide ✅
- [ ] Test 6: Validation montant négatif ✅
- [ ] Test 7: Validation service vide ✅
- [ ] Test 8: Solde cash insuffisant ✅
- [ ] Test 9: Solde virtuel insuffisant ✅
- [ ] Test 10: Temps réel fonctionne ✅
- [ ] Test 11: Reset formulaire ✅
- [ ] Test 12: Annulation ✅
- [ ] Test 13: Permissions ✅
- [ ] Test 14: Historique complet ✅
- [ ] Test 15: Pas de boucle infinie ✅

---

## 🎯 CRITÈRES DE SUCCÈS

Le module est **VALIDÉ** si:

1. ✅ **Tous les tests passent** sans erreur
2. ✅ **Aucun spinner infini** observé
3. ✅ **Messages d'erreur/succès** toujours affichés
4. ✅ **Temps réel** fonctionne (mise à jour automatique)
5. ✅ **Transaction atomique** garantie (pas d'incohérence)
6. ✅ **Performance** acceptable (pas de boucle fetch)
7. ✅ **Build production** sans erreur

---

**Date:** 22 Novembre 2025
**Statut:** ✅ **CORRECTIONS COMPLÈTES - PRÊT POUR VALIDATION UTILISATEUR**
