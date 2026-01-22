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

  useEffect(() => {
    loadExchangeRate();
  }, [formData.devise_reference]);

  const loadExchangeRate = async () => {
    try {
      const deviseSource = formData.devise_reference;
      const deviseDestination = formData.devise_reference === 'USD' ? 'CDF' : 'USD';

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
    } catch (err: any) {
      console.error('Erreur chargement taux:', err);
      setError('Impossible de charger le taux de change actif');
    }
  };

  useEffect(() => {
    if (autoCalculate && exchangeRate && formData.montant_total > 0) {
      if (formData.devise_reference === 'USD' && formData.montant_usd >= 0) {
        const resteUsd = formData.montant_total - formData.montant_usd;
        if (resteUsd >= 0) {
          const montantCdfCalcule = resteUsd * exchangeRate.taux;
          setFormData(prev => ({ ...prev, montant_cdf: Math.round(montantCdfCalcule * 100) / 100 }));
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
            `Montant CDF incorrect. Pour ${resteUsd.toFixed(2)} USD au taux ${exchangeRate.taux}, ` +
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
        } : {
          p_service_id: formData.service_id,
          p_montant_total_usd: formData.montant_total,
          p_montant_recu_usd: formData.montant_usd,
          p_montant_recu_cdf: formData.montant_cdf,
          p_info_client: formData.info_client || null,
          p_notes: formData.notes || null,
          p_created_by: user?.id,
        };
      } else {
        const resteCdf = formData.montant_total - formData.montant_cdf;
        const montantUsdAttendu = resteCdf * exchangeRate.taux;

        if (Math.abs(montantUsdAttendu - formData.montant_usd) > 0.01) {
          throw new Error(
            `Montant USD incorrect. Pour ${resteCdf.toFixed(2)} CDF au taux ${exchangeRate.taux}, ` +
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
        } : {
          p_service_id: formData.service_id,
          p_montant_total_cdf: formData.montant_total,
          p_montant_recu_cdf: formData.montant_cdf,
          p_montant_recu_usd: formData.montant_usd,
          p_info_client: formData.info_client || null,
          p_notes: formData.notes || null,
          p_created_by: user?.id,
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
        principale: formData.montant_usd,
        reste: resteUsd,
        complementaire: montantCdfCalcule,
        labelPrincipale: 'USD',
        labelComplementaire: 'CDF'
      };
    } else {
      const resteCdf = formData.montant_total - formData.montant_cdf;
      const montantUsdCalcule = resteCdf * exchangeRate.taux;

      return {
        principale: formData.montant_cdf,
        reste: resteCdf,
        complementaire: montantUsdCalcule,
        labelPrincipale: 'CDF',
        labelComplementaire: 'USD'
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

      {exchangeRate && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg">
          <div className="flex items-center space-x-2">
            <Calculator className="w-4 h-4" />
            <span className="text-sm font-medium">
              Taux actif: 1 {exchangeRate.devise_source} = {exchangeRate.taux.toLocaleString('fr-FR')} {exchangeRate.devise_destination}
            </span>
          </div>
        </div>
      )}

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
          Montant total ({formData.devise_reference})
        </label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={formData.montant_total || ''}
          onChange={(e) =>
            setFormData({ ...formData, montant_total: parseFloat(e.target.value) || 0 })
          }
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          required
        />
      </div>

      <div className="border-t border-slate-200 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-700">Répartition du paiement</h4>
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
              Montant en USD
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
              />
              <DollarSign className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Montant en CDF
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max={formData.devise_reference === 'USD' ? undefined : formData.montant_total}
              value={formData.montant_cdf || ''}
              onChange={(e) => {
                setAutoCalculate(false);
                setFormData({ ...formData, montant_cdf: parseFloat(e.target.value) || 0 });
              }}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>

        {equivalent && exchangeRate && (
          <div className="mt-3 p-3 bg-slate-50 rounded-lg text-sm space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Montant {equivalent.labelPrincipale}:</span>
              <span className="font-medium">{equivalent.principale.toFixed(2)} {equivalent.labelPrincipale}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Reste à convertir:</span>
              <span className="font-medium">{equivalent.reste.toFixed(2)} {formData.devise_reference}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Équivalent {equivalent.labelComplementaire}:</span>
              <span className="font-medium">{equivalent.complementaire.toFixed(2)} {equivalent.labelComplementaire}</span>
            </div>
            <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between text-slate-900 font-semibold">
              <span>Total:</span>
              <span>{formData.montant_total.toFixed(2)} {formData.devise_reference}</span>
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
          disabled={loading || !exchangeRate}
          className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Enregistrement...' : 'Créer la transaction'}
        </button>
      </div>
    </form>
  );
}
