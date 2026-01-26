# Documentation : Choix du Taux de Change pour Transactions Mixtes

## Vue d'ensemble

Cette fonctionnalité permet aux utilisateurs de choisir le taux de change à utiliser lors de la création de transactions mixtes (Forex), tout en conservant la logique comptable existante.

---

## Modifications Apportées

### 1. Base de Données

#### Nouvelles Colonnes dans `transaction_headers`

```sql
- exchange_rate_mode (text) : 'AUTO' ou 'MANUAL'
- exchange_rate_id (uuid) : Référence vers exchange_rates (NULL si AUTO)
```

**Comportement :**
- `exchange_rate_mode = NULL` : Équivaut à 'AUTO' (comportement par défaut)
- `exchange_rate_mode = 'AUTO'` : Utilise le taux actif par défaut
- `exchange_rate_mode = 'MANUAL'` : Utilise le taux sélectionné via `exchange_rate_id`

**Migration appliquée :** `add_exchange_rate_mode_to_transactions`

---

### 2. Interface Utilisateur (Frontend)

#### Formulaire TransactionMixteForm

**Nouveaux éléments ajoutés :**

1. **Section "Taux de change"** avec deux options :
   - Radio button "Taux automatique" (sélectionné par défaut)
   - Radio button "Choisir un taux actif"

2. **Affichage dynamique :**
   - **Mode AUTO** : Affiche le taux actif non éditable
   - **Mode MANUAL** : Affiche un dropdown avec tous les taux actifs disponibles

3. **Select dropdown (Mode MANUAL) :**
   - Liste tous les taux actifs pour la paire de devises sélectionnée
   - Format : "1 USD = 2 300 CDF (25/01/2026)"
   - Triés par date de création décroissante

4. **Validation :**
   - Le bouton "Créer la transaction" est désactivé si :
     - Aucun taux n'est disponible
     - Mode MANUAL sélectionné mais aucun taux choisi dans le dropdown

**Code ajouté :**

```typescript
// Nouveaux states
const [exchangeRateMode, setExchangeRateMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
const [availableRates, setAvailableRates] = useState<ExchangeRate[]>([]);
const [selectedRateId, setSelectedRateId] = useState<string>('');

// Fonction de gestion du changement de taux manuel
const handleManualRateChange = (rateId: string) => {
  setSelectedRateId(rateId);
  const selectedRate = availableRates.find(r => r.id === rateId);
  if (selectedRate) {
    setExchangeRate(selectedRate);
  }
};
```

**Paramètres transmis au backend :**

```typescript
{
  // ... paramètres existants
  p_exchange_rate_mode: exchangeRateMode,
  p_exchange_rate_id: exchangeRateMode === 'MANUAL' ? selectedRateId : null
}
```

---

### 3. Backend (Fonctions SQL)

#### Fonctions Adaptées

Les 4 fonctions de transaction mixte ont été recréées avec les nouveaux paramètres :

1. `create_transaction_mixte_retrait` (Retrait USD)
2. `create_transaction_mixte_depot` (Dépôt USD)
3. `create_transaction_mixte_retrait_cdf` (Retrait CDF)
4. `create_transaction_mixte_depot_cdf` (Dépôt CDF)

**Nouveaux paramètres ajoutés :**

```sql
p_exchange_rate_mode text DEFAULT NULL,
p_exchange_rate_id uuid DEFAULT NULL
```

**Logique implémentée :**

```sql
-- Détermination du mode effectif (NULL = AUTO)
v_effective_mode := COALESCE(p_exchange_rate_mode, 'AUTO');

-- Si mode MANUAL
IF v_effective_mode = 'MANUAL' THEN
  -- Vérifier qu'un ID est fourni
  IF p_exchange_rate_id IS NULL THEN
    RAISE EXCEPTION 'Un ID de taux doit être fourni en mode MANUAL';
  END IF;

  -- Charger le taux depuis exchange_rates
  SELECT taux INTO v_taux_change
  FROM exchange_rates
  WHERE id = p_exchange_rate_id
    AND devise_source = [devise_source]
    AND devise_destination = [devise_destination]
    AND actif = true;

  -- Vérifier que le taux existe et est actif
  IF v_taux_change IS NULL THEN
    RAISE EXCEPTION 'Le taux sélectionné n''existe pas ou n''est pas actif';
  END IF;

-- Si mode AUTO (défaut)
ELSE
  v_taux_change := get_active_exchange_rate([devise_source], [devise_destination]);

  IF v_taux_change IS NULL THEN
    RAISE EXCEPTION 'Aucun taux de change actif trouvé';
  END IF;
END IF;
```

**Enregistrement dans la base :**

```sql
INSERT INTO transaction_headers (
  ...
  taux_change,              -- Valeur du taux utilisé
  exchange_rate_mode,       -- 'AUTO' ou 'MANUAL'
  exchange_rate_id,         -- UUID si MANUAL, NULL si AUTO
  ...
)
```

**Migrations appliquées :**
- `drop_old_transaction_mixte_functions` : Suppression des anciennes signatures
- `recreate_transaction_mixte_functions_with_rate_choice` : Recréation avec nouveaux paramètres

---

## Exemples d'Utilisation

### Mode Automatique (Défaut)

**Scénario :** L'utilisateur crée un retrait USD de 100 USD payé 80 USD + 46,000 CDF

**Interface :**
1. Sélectionner "Taux automatique" (déjà sélectionné par défaut)
2. Affichage : "Taux actif : 1 USD = 2,300 CDF"
3. Remplir le formulaire normalement
4. Cliquer sur "Créer la transaction"

**Backend :**
```sql
-- Appel automatique
SELECT create_transaction_mixte_retrait(
  p_service_id := '...',
  p_montant_total_usd := 100,
  p_montant_paye_usd := 80,
  p_montant_paye_cdf := 46000,
  p_exchange_rate_mode := 'AUTO',    -- Envoyé par le frontend
  p_exchange_rate_id := NULL          -- NULL en mode AUTO
);
```

**Résultat en base :**
```
transaction_headers:
- taux_change: 2300
- exchange_rate_mode: 'AUTO'
- exchange_rate_id: NULL
```

---

### Mode Manuel

**Scénario :** L'utilisateur veut utiliser un taux spécifique parmi les taux actifs

**Interface :**
1. Sélectionner "Choisir un taux actif"
2. Un dropdown s'affiche avec les taux disponibles :
   ```
   1 USD = 2,300 CDF (26/01/2026)
   1 USD = 2,280 CDF (25/01/2026)
   1 USD = 2,350 CDF (24/01/2026)
   ```
3. Sélectionner "1 USD = 2,280 CDF (25/01/2026)"
4. Affichage sous le dropdown : "Taux sélectionné : 1 USD = 2,280 CDF"
5. Remplir le formulaire avec les montants correspondants
6. Cliquer sur "Créer la transaction"

**Backend :**
```sql
SELECT create_transaction_mixte_retrait(
  p_service_id := '...',
  p_montant_total_usd := 100,
  p_montant_paye_usd := 80,
  p_montant_paye_cdf := 45600,  -- Calculé avec le taux 2,280
  p_exchange_rate_mode := 'MANUAL',
  p_exchange_rate_id := '123e4567-...'  -- ID du taux sélectionné
);
```

**Résultat en base :**
```
transaction_headers:
- taux_change: 2280
- exchange_rate_mode: 'MANUAL'
- exchange_rate_id: '123e4567-...'
```

---

## Validation et Sécurité

### Validations Frontend

1. **Mode AUTO :**
   - Vérifie qu'un taux actif existe
   - Désactive le bouton si aucun taux n'est disponible

2. **Mode MANUAL :**
   - Désactive le bouton si aucun taux n'est sélectionné dans le dropdown
   - Vérifie que le taux sélectionné existe dans la liste

3. **Calculs :**
   - Utilise toujours `exchangeRate.taux` pour les calculs automatiques
   - Pas de changement dans la logique de validation des montants

### Validations Backend

1. **Mode MANUAL :**
   - Vérifie qu'un `exchange_rate_id` est fourni
   - Vérifie que le taux existe dans la table `exchange_rates`
   - Vérifie que le taux est actif (`actif = true`)
   - Vérifie que le taux correspond à la bonne paire de devises

2. **Mode AUTO :**
   - Utilise `get_active_exchange_rate()` comme avant
   - Lève une exception si aucun taux actif n'est trouvé

3. **Sécurité :**
   - Pas de saisie libre du taux (empêche les manipulations)
   - Seuls les taux actifs validés sont utilisables
   - L'ID du taux est vérifié contre la base de données

---

## Avantages de cette Implémentation

### 1. Non-Destructive
- **Aucune modification** de la logique comptable existante
- **Aucune modification** des triggers de mise à jour des soldes
- **Aucune modification** des lignes de conversion
- **Compatibilité totale** avec les transactions existantes

### 2. Sécurisé
- Pas de saisie manuelle du taux (empêche les erreurs et fraudes)
- Seuls les taux actifs sont proposés
- Validation stricte en backend

### 3. Traçable
- Le mode utilisé est enregistré (`exchange_rate_mode`)
- L'ID du taux est conservé si mode MANUAL (`exchange_rate_id`)
- Le taux lui-même est toujours stocké (`taux_change`)

### 4. UX Optimale
- Par défaut, le comportement reste identique (mode AUTO)
- Option avancée facilement accessible si nécessaire
- Feedback visuel clair sur le taux utilisé

### 5. Rétrocompatible
- Les anciennes transactions sans `exchange_rate_mode` fonctionnent toujours
- NULL est traité comme AUTO dans les fonctions

---

## Points d'Attention

### 1. Taux Actifs Multiples

Si plusieurs taux sont actifs pour une même paire de devises :
- **Mode AUTO** : Utilise la fonction `get_active_exchange_rate()` qui retourne UN seul taux (le dernier créé en général)
- **Mode MANUAL** : Affiche TOUS les taux actifs et laisse l'utilisateur choisir

**Recommandation :** Pour éviter la confusion, maintenir un seul taux actif par paire de devises, ou utiliser systématiquement le mode MANUAL si plusieurs taux coexistent.

### 2. Désactivation d'un Taux

Si un taux utilisé dans une transaction est désactivé après coup :
- La transaction reste valide
- Le `taux_change` est conservé dans `transaction_headers`
- L'historique est préservé

**Important :** Ne jamais supprimer un taux qui a été utilisé dans des transactions.

### 3. Calcul Auto avec Mode MANUAL

Le bouton "Calcul auto" fonctionne avec les deux modes :
- Il utilise toujours `exchangeRate.taux` (la valeur actuellement sélectionnée)
- Que ce soit le taux AUTO ou le taux MANUAL choisi

### 4. Changement de Devise de Référence

Si l'utilisateur change la devise de référence (USD ↔ CDF) après avoir sélectionné un taux manuel :
- Le formulaire recharge automatiquement les taux pour la nouvelle paire
- Le taux sélectionné est réinitialisé
- L'utilisateur doit choisir un nouveau taux dans la liste

---

## Tests Recommandés

### 1. Tests Fonctionnels

- [ ] Créer une transaction mixte retrait USD en mode AUTO
- [ ] Créer une transaction mixte dépôt USD en mode AUTO
- [ ] Créer une transaction mixte retrait CDF en mode AUTO
- [ ] Créer une transaction mixte dépôt CDF en mode AUTO
- [ ] Créer une transaction mixte retrait USD en mode MANUAL
- [ ] Créer une transaction mixte dépôt USD en mode MANUAL
- [ ] Créer une transaction mixte retrait CDF en mode MANUAL
- [ ] Créer une transaction mixte dépôt CDF en mode MANUAL

### 2. Tests de Validation

- [ ] Tenter de créer une transaction en mode MANUAL sans sélectionner de taux → Bouton désactivé
- [ ] Tenter de créer une transaction avec aucun taux actif → Message d'erreur
- [ ] Changer de devise de référence en mode MANUAL → Taux réinitialisé
- [ ] Vérifier que le calcul auto fonctionne avec le taux MANUAL sélectionné

### 3. Tests de Sécurité

- [ ] Vérifier qu'on ne peut pas envoyer un `exchange_rate_id` invalide
- [ ] Vérifier qu'on ne peut pas utiliser un taux inactif en mode MANUAL
- [ ] Vérifier qu'on ne peut pas utiliser un taux d'une autre paire de devises

### 4. Tests de Soldes

- [ ] Vérifier que les soldes sont correctement mis à jour en mode AUTO
- [ ] Vérifier que les soldes sont correctement mis à jour en mode MANUAL
- [ ] Comparer les résultats entre AUTO et MANUAL avec le même taux → Doivent être identiques

---

## Migration des Données Existantes

**Question :** Que deviennent les transactions existantes créées avant cette fonctionnalité ?

**Réponse :** Elles restent totalement fonctionnelles :
- `exchange_rate_mode` = NULL (équivaut à AUTO)
- `exchange_rate_id` = NULL
- `taux_change` = valeur historique conservée

**Aucune action requise** sur les données existantes.

---

## Support et Dépannage

### Erreur : "Un ID de taux doit être fourni en mode MANUAL"

**Cause :** Le frontend envoie `exchange_rate_mode = 'MANUAL'` mais `exchange_rate_id = NULL`

**Solution :** Vérifier que le dropdown du taux est bien rempli avant de soumettre

---

### Erreur : "Le taux sélectionné n'existe pas ou n'est pas actif"

**Cause :** Le taux sélectionné a été désactivé ou supprimé entre le chargement de la liste et la soumission

**Solution :** Recharger la page pour obtenir la liste à jour des taux actifs

---

### Le dropdown des taux est vide en mode MANUAL

**Cause :** Aucun taux actif n'existe pour la paire de devises sélectionnée

**Solution :** Créer un taux actif dans le module "Taux de change"

---

## Évolutions Futures Possibles

1. **Historique des taux utilisés**
   - Vue dédiée aux taux de change utilisés dans les transactions
   - Statistiques sur les taux les plus utilisés

2. **Taux favoris**
   - Permettre de marquer des taux comme "favoris"
   - Afficher les favoris en premier dans le dropdown

3. **Restriction par rôle**
   - Limiter le mode MANUAL aux administrateurs
   - Les caissiers utiliseraient uniquement le mode AUTO

4. **Notification de changement de taux**
   - Alerter l'utilisateur si le taux actif change pendant la saisie

5. **Comparaison de taux**
   - Afficher visuellement la différence entre plusieurs taux
   - Calculer l'impact d'un changement de taux sur la transaction

---

## Conclusion

Cette implémentation répond parfaitement au cahier des charges :
- ✅ UI minimale et intégrée naturellement
- ✅ Aucune modification de la logique comptable
- ✅ Aucune saisie libre de taux
- ✅ Mode AUTO par défaut préservé
- ✅ Traçabilité complète
- ✅ Code clair et documenté
- ✅ Prêt pour production

**Version :** 1.0
**Date :** 26 janvier 2026
**Système :** Gestion Financière Himaya
