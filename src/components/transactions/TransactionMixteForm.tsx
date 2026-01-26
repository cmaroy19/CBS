import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import type { Service, ExchangeRate } from '../../types';
import { Calculator, DollarSign } from 'lucide-react';

interface TransactionMixteFormProps {
  services: Service[];
  onSuccess: () => void;
  onCancel: () => void;
}

export function TransactionMixteForm({ services, onSuccess, onCancel }: TransactionMixteFormProps) {
  const { user } = useAuthStore();
  const [formData, setFormData] = useState({
    type: 'retrait' as 'depot' | 'retrait',
    devise_reference: 'USD' as 'USD' | 'CDF',
    service_id: '',
    montant_total: 0,
    montant_usd: 0,
    montant_cdf: 0,
    info_client: '',
    notes: '',
  });
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoCalculate, setAutoCalculate] = useState(true);

  // Nouveaux states pour le choix du taux
  const [exchangeRateMode, setExchangeRateMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [availableRates, setAvailableRates] = useState<ExchangeRate[]>([]);
  const [selectedRateId, setSelectedRateId] = useState<string>('');

  useEffect(() => {
    loadExchangeRate();
  }, [formData.devise_reference, exchangeRateMode]);

  const loadExchangeRate = async () => {
    try {
      const deviseSource = formData.devise_reference;
      const deviseDestination = formData.devise_reference === 'USD' ? 'CDF' : 'USD';

      if (exchangeRateMode === 'AUTO') {
        // Mode automatique : charger le taux actif par défaut
        const { data, error } = await supabase
          .from('exchange_rates')
          .select('*')
          .eq('devise_source', deviseSource)
          .eq('devise_destination', deviseDestination)
          .eq('actif', true)
          .maybeSingle();

        if (error) throw error;
        setExchangeRate(data);

        if (!data) {
          setError(`Aucun taux de change actif pour ${deviseSource} → ${deviseDestination}. Veuillez le configurer.`);
        } else {
          setError('');
        }
      } else {
        // Mode manuel : charger tous les taux actifs
        const { data, error } = await supabase
          .from('exchange_rates')
          .select('*')
          .eq('devise_source', deviseSource)
          .eq('devise_destination', deviseDestination)
          .eq('actif', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setAvailableRates(data || []);

        if (!data || data.length === 0) {
          setError(`Aucun taux de change actif pour ${deviseSource} → ${deviseDestination}. Veuillez le configurer.`);
          setExchangeRate(null);
        } else {
          setError('');
          // Si un taux est déjà sélectionné, le conserver
          if (selectedRateId) {
            const selectedRate = data.find(r => r.id === selectedRateId);
            if (selectedRate) {
              setExchangeRate(selectedRate);
            } else {
              // Taux sélectionné n'existe plus, réinitialiser
              setSelectedRateId('');
              setExchangeRate(null);
            }
          } else {
            setExchangeRate(null);
          }
        }
      }
    } catch (err: any) {
      console.error('Erreur chargement taux:', err);
      setError('Impossible de charger les taux de change');
    }
  };

  // Gestion du changement de taux manuel
  const handleManualRateChange = (rateId: string) => {
    setSelectedRateId(rateId);
    const selectedRate = availableRates.find(r => r.id === rateId);
    if (selectedRate) {
      setExchangeRate(selectedRate);
      setError('');
    } else {
      setExchangeRate(null);
    }
  };

  useEffect(() => {
    if (autoCalculate && exchangeRate && formData.montant_total > 0) {
      if (formData.devise_reference === 'USD' && formData.montant_usd >= 0) {
        const resteUsd = formData.montant_total - formData.montant_usd;
        if (resteUsd >= 0) {
          const montantCdfCalcule = resteUsd * exchangeRate.taux;
          setFormData(prev => ({ ...prev, montant_cdf: Math.round(montantCdfCalcule) }));
        }
      } else if (formData.devise_reference === 'CDF' && formData.montant_cdf >= 0) {
        const resteCdf = formData.montant_total - formData.montant_cdf;
        if (resteCdf >= 0) {
          const montantUsdCalcule = resteCdf * exchangeRate.taux;
          setFormData(prev => ({ ...prev, montant_usd: Math.round(montantUsdCalcule * 100) / 100 }));
        }
      }
    }
  }, [formData.montant_total, formData.montant_usd, formData.montant_cdf, formData.devise_reference, exchangeRate, autoCalculate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const service = services.find((s) => s.id === formData.service_id);
      if (!service) {
        throw new Error('Service non trouvé');
      }

      if (!exchangeRate) {
        throw new Error('Aucun taux de change actif. Veuillez configurer un taux dans le module Taux de change.');
      }

      if (formData.montant_total <= 0) {
        throw new Error('Le montant total doit être supérieur à zéro');
      }

      if (formData.montant_usd < 0 || formData.montant_cdf < 0) {
        throw new Error('Les montants ne peuvent pas être négatifs');
      }

      if (formData.montant_usd === 0 && formData.montant_cdf === 0) {
        throw new Error('Au moins un montant doit être renseigné');
      }

      let functionName: string;
      let params: any;

      if (formData.devise_reference === 'USD') {
        const resteUsd = formData.montant_total - formData.montant_usd;
        const montantCdfAttendu = resteUsd * exchangeRate.taux;

        if (Math.abs(montantCdfAttendu - formData.montant_cdf) > 0.01) {
          throw new Error(
            `Montant CDF incorrect. Pour ${resteUsd.toFixed(2)} USD au taux ${exchangeRate.taux.toFixed(2)}, ` +
            `le montant attendu est ${montantCdfAttendu.toFixed(2)} CDF`
          );
        }

        functionName = formData.type === 'retrait'
          ? 'create_transaction_mixte_retrait'
          : 'create_transaction_mixte_depot';

        params = formData.type === 'retrait' ? {
          p_service_id: formData.service_id,
          p_montant_total_usd: formData.montant_total,
          p_montant_paye_usd: formData.montant_usd,
          p_montant_paye_cdf: formData.montant_cdf,
          p_info_client: formData.info_client || null,
          p_notes: formData.notes || null,
          p_created_by: user?.id,
          p_exchange_rate_mode: exchangeRateMode,
          p_exchange_rate_id: exchangeRateMode === 'MANUAL' ? selectedRateId : null,
        } : {
          p_service_id: formData.service_id,
          p_montant_total_usd: formData.montant_total,
          p_montant_recu_usd: formData.montant_usd,
          p_montant_recu_cdf: formData.montant_cdf,
          p_info_client: formData.info_client || null,
          p_notes: formData.notes || null,
          p_created_by: user?.id,
          p_exchange_rate_mode: exchangeRateMode,
          p_exchange_rate_id: exchangeRateMode === 'MANUAL' ? selectedRateId : null,
        };
      } else {
        const resteCdf = formData.montant_total - formData.montant_cdf;
        const montantUsdAttendu = resteCdf * exchangeRate.taux;
        const tauxAffiche = 1 / exchangeRate.taux;

        if (Math.abs(montantUsdAttendu - formData.montant_usd) > 0.01) {
          throw new Error(
            `Montant USD incorrect. Pour ${resteCdf.toFixed(2)} CDF au taux 1 USD = ${tauxAffiche.toFixed(2)} CDF, ` +
            `le montant attendu est ${montantUsdAttendu.toFixed(2)} USD`
          );
        }

        functionName = formData.type === 'retrait'
          ? 'create_transaction_mixte_retrait_cdf'
          : 'create_transaction_mixte_depot_cdf';

        params = formData.type === 'retrait' ? {
          p_service_id: formData.service_id,
          p_montant_total_cdf: formData.montant_total,
          p_montant_paye_cdf: formData.montant_cdf,
          p_montant_paye_usd: formData.montant_usd,
          p_info_client: formData.info_client || null,
          p_notes: formData.notes || null,
          p_created_by: user?.id,
          p_exchange_rate_mode: exchangeRateMode,
          p_exchange_rate_id: exchangeRateMode === 'MANUAL' ? selectedRateId : null,
        } : {
          p_service_id: formData.service_id,
          p_montant_total_cdf: formData.montant_total,
          p_montant_recu_cdf: formData.montant_cdf,
          p_montant_recu_usd: formData.montant_usd,
          p_info_client: formData.info_client || null,
          p_notes: formData.notes || null,
          p_created_by: user?.id,
          p_exchange_rate_mode: exchangeRateMode,
          p_exchange_rate_id: exchangeRateMode === 'MANUAL' ? selectedRateId : null,
        };
      }

      const { data, error: rpcError } = await supabase.rpc(functionName, params);

      if (rpcError) throw rpcError;

      await supabase.from('audit_logs').insert({
        table_name: 'transaction_headers',
        operation: 'INSERT',
        record_id: data,
        new_data: {
          type: formData.type,
          devise_reference: formData.devise_reference,
          service: service.nom,
          montant_total: formData.montant_total,
          montant_usd: formData.montant_usd,
          montant_cdf: formData.montant_cdf,
          taux: exchangeRate.taux,
        },
        user_id: user?.id,
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création de la transaction');
    } finally {
      setLoading(false);
    }
  };

  const calculerEquivalent = () => {
    if (!exchangeRate || formData.montant_total <= 0) return null;

    if (formData.devise_reference === 'USD') {
      const resteUsd = formData.montant_total - formData.montant_usd;
      const montantCdfCalcule = resteUsd * exchangeRate.taux;

      return {
        montantPrincipal: formData.montant_total,
        devisePrincipale: 'USD',
        montantPaye1: formData.montant_usd,
        devise1: 'USD',
        montantPaye2: Math.round(montantCdfCalcule),
        devise2: 'CDF',
        tauxAffichage: exchangeRate.taux.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        reste: resteUsd
      };
    } else {
      const resteCdf = formData.montant_total - formData.montant_cdf;
      const montantUsdCalcule = resteCdf * exchangeRate.taux;
      const tauxAffiche = 1 / exchangeRate.taux;

      return {
        montantPrincipal: formData.montant_total,
        devisePrincipale: 'CDF',
        montantPaye1: formData.montant_cdf,
        devise1: 'CDF',
        montantPaye2: Math.round(montantUsdCalcule * 100) / 100,
        devise2: 'USD',
        tauxAffichage: tauxAffiche.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        reste: resteCdf
      };
    }
  };

  const equivalent = calculerEquivalent();

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {!exchangeRate && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm">
          Aucun taux de change actif configuré. Veuillez en créer un dans le module Taux de change.
        </div>
      )}

      {/* Section Choix du Taux de Change */}
      <div className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-lg space-y-3">
        <div className="flex items-center space-x-2">
          <Calculator className="w-4 h-4 text-slate-600" />
          <h4 className="text-sm font-semibold text-slate-700">Taux de change</h4>
        </div>

        {/* Radio Buttons */}
        <div className="space-y-2">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="exchangeRateMode"
              value="AUTO"
              checked={exchangeRateMode === 'AUTO'}
              onChange={(e) => {
                setExchangeRateMode(e.target.value as 'AUTO');
                setSelectedRateId('');
              }}
              className="w-4 h-4 text-emerald-500 border-slate-300 focus:ring-emerald-500"
            />
            <span className="text-sm text-slate-700">Taux automatique</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="exchangeRateMode"
              value="MANUAL"
              checked={exchangeRateMode === 'MANUAL'}
              onChange={(e) => setExchangeRateMode(e.target.value as 'MANUAL')}
              className="w-4 h-4 text-emerald-500 border-slate-300 focus:ring-emerald-500"
            />
            <span className="text-sm text-slate-700">Choisir un taux actif</span>
          </label>
        </div>

        {/* Affichage selon le mode */}
        {exchangeRateMode === 'AUTO' && exchangeRate && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg">
            <span className="text-sm font-medium">
              {exchangeRate.devise_source === 'CDF' && exchangeRate.devise_destination === 'USD' ? (
                <>
                  Taux actif : 1 USD = {(1 / exchangeRate.taux).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} CDF
                  <span className="block text-xs text-emerald-600 mt-0.5">
                    (taux interne: 1 CDF = {exchangeRate.taux.toFixed(6)} USD)
                  </span>
                </>
              ) : (
                <>
                  Taux actif : 1 {exchangeRate.devise_source} = {exchangeRate.taux.toLocaleString('fr-FR')} {exchangeRate.devise_destination}
                </>
              )}
            </span>
          </div>
        )}

        {exchangeRateMode === 'MANUAL' && (
          <div>
            <select
              value={selectedRateId}
              onChange={(e) => handleManualRateChange(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              required
            >
              <option value="">Sélectionner un taux</option>
              {availableRates.map((rate) => {
                const displayRate = rate.devise_source === 'CDF' && rate.devise_destination === 'USD'
                  ? `1 USD = ${(1 / rate.taux).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} CDF`
                  : `1 ${rate.devise_source} = ${rate.taux.toLocaleString('fr-FR')} ${rate.devise_destination}`;

                const dateFormatted = new Date(rate.created_at).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                });

                return (
                  <option key={rate.id} value={rate.id}>
                    {displayRate} ({dateFormatted})
                  </option>
                );
              })}
            </select>

            {selectedRateId && exchangeRate && (
              <div className="mt-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg">
                <span className="text-sm font-medium">
                  {exchangeRate.devise_source === 'CDF' && exchangeRate.devise_destination === 'USD' ? (
                    <>
                      Taux sélectionné : 1 USD = {(1 / exchangeRate.taux).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} CDF
                      <span className="block text-xs text-emerald-600 mt-0.5">
                        (taux interne: 1 CDF = {exchangeRate.taux.toFixed(6)} USD)
                      </span>
                    </>
                  ) : (
                    <>
                      Taux sélectionné : 1 {exchangeRate.devise_source} = {exchangeRate.taux.toLocaleString('fr-FR')} {exchangeRate.devise_destination}
                    </>
                  )}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
          <select
            value={formData.type}
            onChange={(e) =>
              setFormData({ ...formData, type: e.target.value as 'depot' | 'retrait' })
            }
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="depot">Dépôt</option>
            <option value="retrait">Retrait</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Devise de référence</label>
          <select
            value={formData.devise_reference}
            onChange={(e) =>
              setFormData({ ...formData, devise_reference: e.target.value as 'USD' | 'CDF' })
            }
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="USD">USD (Dollar)</option>
            <option value="CDF">CDF (Franc congolais)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Service</label>
        <select
          value={formData.service_id}
          onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          required
        >
          <option value="">Sélectionner un service</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.nom}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Montant principal ({formData.devise_reference})
          <span className="text-xs text-slate-500 ml-2">
            ({formData.type === 'retrait' ? 'créance qui augmente' : 'créance qui diminue'})
          </span>
        </label>
        <input
          type="number"
          step={formData.devise_reference === 'USD' ? '0.01' : '1'}
          min={formData.devise_reference === 'USD' ? '0.01' : '1'}
          value={formData.montant_total || ''}
          onChange={(e) =>
            setFormData({ ...formData, montant_total: parseFloat(e.target.value) || 0 })
          }
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          placeholder={formData.devise_reference === 'USD' ? '0.00' : '0'}
          required
        />
      </div>

      <div className="border-t border-slate-200 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-700">
            {formData.type === 'retrait' ? 'Répartition du paiement au client' : 'Répartition de la réception du client'}
          </h4>
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={autoCalculate}
              onChange={(e) => setAutoCalculate(e.target.checked)}
              className="w-4 h-4 text-emerald-500 border-slate-300 rounded focus:ring-emerald-500"
            />
            <span className="text-slate-600">Calcul auto</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Montant {formData.type === 'retrait' ? 'payé' : 'reçu'} en USD
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                max={formData.devise_reference === 'CDF' ? undefined : formData.montant_total}
                value={formData.montant_usd || ''}
                onChange={(e) =>
                  setFormData({ ...formData, montant_usd: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="0.00"
              />
              <DollarSign className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Montant {formData.type === 'retrait' ? 'payé' : 'reçu'} en CDF
            </label>
            <input
              type="number"
              step="1"
              min="0"
              max={formData.devise_reference === 'USD' ? undefined : formData.montant_total}
              value={formData.montant_cdf || ''}
              onChange={(e) => {
                setAutoCalculate(false);
                setFormData({ ...formData, montant_cdf: parseFloat(e.target.value) || 0 });
              }}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="0"
            />
          </div>
        </div>

        {equivalent && exchangeRate && (
          <div className="mt-3 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg text-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
              <span className="text-slate-700 font-semibold">
                {formData.type === 'retrait' ? 'Détail du paiement' : 'Détail de la réception'}
              </span>
              <span className="text-emerald-700 text-xs font-medium">
                Taux: 1 {formData.devise_reference === 'USD' ? 'USD' : 'USD'} = {equivalent.tauxAffichage} {formData.devise_reference === 'USD' ? 'CDF' : 'CDF'}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-slate-700">
                <span className="flex items-center">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></span>
                  Montant principal
                </span>
                <span className="font-bold text-emerald-700">
                  {equivalent.montantPrincipal.toLocaleString('fr-FR', {
                    minimumFractionDigits: equivalent.devisePrincipale === 'USD' ? 2 : 0,
                    maximumFractionDigits: equivalent.devisePrincipale === 'USD' ? 2 : 0
                  })} {equivalent.devisePrincipale}
                </span>
              </div>

              <div className="pl-4 space-y-1.5 border-l-2 border-emerald-200">
                <div className="flex justify-between items-center text-slate-600">
                  <span className="text-xs">
                    {formData.type === 'retrait' ? 'Payé' : 'Reçu'} en {equivalent.devise1}
                  </span>
                  <span className="font-semibold">
                    {equivalent.montantPaye1.toLocaleString('fr-FR', {
                      minimumFractionDigits: equivalent.devise1 === 'USD' ? 2 : 0,
                      maximumFractionDigits: equivalent.devise1 === 'USD' ? 2 : 0
                    })} {equivalent.devise1}
                  </span>
                </div>

                {equivalent.reste > 0 && (
                  <>
                    <div className="flex justify-between items-center text-slate-600">
                      <span className="text-xs">Reste à convertir</span>
                      <span className="font-medium text-xs">
                        {equivalent.reste.toLocaleString('fr-FR', {
                          minimumFractionDigits: formData.devise_reference === 'USD' ? 2 : 0,
                          maximumFractionDigits: formData.devise_reference === 'USD' ? 2 : 0
                        })} {formData.devise_reference}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-slate-600">
                      <span className="text-xs">
                        {formData.type === 'retrait' ? 'Payé' : 'Reçu'} en {equivalent.devise2}
                      </span>
                      <span className="font-semibold">
                        {equivalent.montantPaye2.toLocaleString('fr-FR', {
                          minimumFractionDigits: equivalent.devise2 === 'USD' ? 2 : 0,
                          maximumFractionDigits: equivalent.devise2 === 'USD' ? 2 : 0
                        })} {equivalent.devise2}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="pt-2 border-t border-emerald-200 flex justify-between items-center">
                <span className="text-slate-700 font-semibold">Impact sur le service virtuel</span>
                <span className={`font-bold ${formData.type === 'retrait' ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {formData.type === 'retrait' ? '+' : '-'}{equivalent.montantPrincipal.toLocaleString('fr-FR', {
                    minimumFractionDigits: equivalent.devisePrincipale === 'USD' ? 2 : 0,
                    maximumFractionDigits: equivalent.devisePrincipale === 'USD' ? 2 : 0
                  })} {equivalent.devisePrincipale}
                  <span className="text-xs font-normal text-slate-600 ml-2">
                    ({formData.type === 'retrait' ? 'créance augmente' : 'créance diminue'})
                  </span>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Info client <span className="text-slate-500 font-normal">(optionnel)</span>
        </label>
        <input
          type="text"
          value={formData.info_client}
          onChange={(e) => setFormData({ ...formData, info_client: e.target.value })}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          placeholder="Nom du client, téléphone, etc."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Notes <span className="text-slate-500 font-normal">(optionnel)</span>
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          rows={3}
          placeholder="Informations supplémentaires..."
        />
      </div>

      <div className="flex space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={loading || !exchangeRate || (exchangeRateMode === 'MANUAL' && !selectedRateId)}
          className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Enregistrement...' : 'Créer la transaction'}
        </button>
      </div>
    </form>
  );
}
