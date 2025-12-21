/**
 * Script de test de concurrence pour détecter les race conditions
 *
 * À exécuter manuellement avec: node test-concurrency.js
 *
 * Prérequis:
 * 1. npm install @supabase/supabase-js
 * 2. Configurer les variables d'environnement
 * 3. Avoir un utilisateur de test avec rôle gérant/propriétaire
 */

// Décommenter pour utiliser:
/*
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'test-password';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testConcurrency() {
  console.log('🔐 Connexion...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (authError) {
    console.error('❌ Erreur de connexion:', authError);
    return;
  }

  console.log('✅ Connecté:', authData.user.email);

  // Créer un service de test
  console.log('\n📦 Création d\'un service de test...');
  const testServiceCode = `TEST_${Date.now()}`;
  const { data: service, error: serviceError } = await supabase
    .from('services')
    .insert({
      nom: 'Service Test Concurrence',
      code: testServiceCode,
      solde_virtuel_usd: 1000,
      solde_virtuel_cdf: 0,
    })
    .select()
    .single();

  if (serviceError) {
    console.error('❌ Erreur création service:', serviceError);
    return;
  }

  console.log('✅ Service créé:', service.id);

  // Test de concurrence: 10 approvisionnements simultanés
  console.log('\n🚀 Lancement de 10 approvisionnements simultanés...');
  const startTime = Date.now();

  const promises = Array.from({ length: 10 }, (_, i) =>
    supabase.rpc('create_approvisionnement_atomic', {
      p_type: 'virtuel',
      p_operation: 'sortie',
      p_service_id: service.id,
      p_montant: 50,
      p_devise: 'USD',
      p_notes: `Test concurrence #${i + 1}`,
      p_created_by: authData.user.id,
    })
  );

  const results = await Promise.allSettled(promises);
  const endTime = Date.now();

  console.log(`\n⏱️  Temps total: ${endTime - startTime}ms`);

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  console.log(`✅ Réussis: ${succeeded}`);
  console.log(`❌ Échoués: ${failed}`);

  // Vérifier le solde final
  const { data: finalService } = await supabase
    .from('services')
    .select('solde_virtuel_usd')
    .eq('id', service.id)
    .single();

  console.log('\n💰 Solde initial: 1000 USD');
  console.log(`💰 Solde final: ${finalService.solde_virtuel_usd} USD`);
  console.log(`💰 Solde attendu: ${1000 - succeeded * 50} USD`);

  if (finalService.solde_virtuel_usd === 1000 - succeeded * 50) {
    console.log('✅ COHÉRENCE DES DONNÉES VALIDÉE');
  } else {
    console.log('❌ INCOHÉRENCE DÉTECTÉE - RACE CONDITION!');
  }

  // Nettoyer
  console.log('\n🧹 Nettoyage...');
  await supabase.from('services').delete().eq('id', service.id);
  console.log('✅ Service de test supprimé');

  await supabase.auth.signOut();
}

// testConcurrency().catch(console.error);
console.log('Script de test de concurrence prêt.');
console.log('Décommentez les lignes pour exécuter les tests.');
*/

console.log('⚠️  Ce script nécessite une configuration manuelle.');
console.log('Lisez les instructions dans le fichier pour l\'utiliser.');
