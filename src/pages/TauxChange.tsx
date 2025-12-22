import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { TrendingUp, Plus, Edit2, CheckCircle, XCircle } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import type { ExchangeRate } from '../types';

export function TauxChange() {
  const { user } = useAuthStore();
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRate, setEditingRate] = useState<ExchangeRate | null>(null);
  const [error, setError] = useState('');

  const canModify = user?.role === 'gerant' || user?.role === 'proprietaire' || user?.role === 'administrateur';

  useEffect(() => {
    loadRates();
  }, []);

  const loadRates = async () => {
    try {
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .order('date_debut', { ascending: false });

      if (error) throw error;
      setRates(data || []);
    } catch (err: any) {
      console.error('Erreur chargement taux:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForm = (rate?: ExchangeRate) => {
    setEditingRate(rate || null);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingRate(null);
  };

  const handleSuccess = () => {
    loadRates();
    handleCloseForm();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Taux de Change</h1>
            <p className="text-slate-600">Gestion des taux de conversion USD/CDF</p>
          </div>
        </div>
        {canModify && (
          <button
            onClick={() => handleOpenForm()}
            className="flex items-center space-x-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Nouveau taux</span>
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Paire
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Taux
                </th>
                <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Période de validité
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Notes
                </th>
                {canModify && (
                  <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rates.length === 0 ? (
                <tr>
                  <td colSpan={canModify ? 6 : 5} className="px-6 py-8 text-center text-slate-500">
                    Aucun taux de change configuré
                  </td>
                </tr>
              ) : (
                rates.map((rate) => (
                  <tr key={rate.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-900">
                        {rate.devise_source}/{rate.devise_destination}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-lg font-bold text-slate-900">
                        {rate.taux.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {rate.actif ? (
                        <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          <CheckCircle className="w-3 h-3" />
                          <span>Actif</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          <XCircle className="w-3 h-3" />
                          <span>Inactif</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      <div>
                        Début: {new Date(rate.date_debut).toLocaleDateString('fr-FR')}
                      </div>
                      {rate.date_fin && (
                        <div className="text-xs text-slate-500">
                          Fin: {new Date(rate.date_fin).toLocaleDateString('fr-FR')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">
                      {rate.notes || '-'}
                    </td>
                    {canModify && (
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleOpenForm(rate)}
                          className="text-slate-600 hover:text-emerald-600 transition-colors"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && canModify && (
        <Modal
          isOpen={showForm}
          onClose={handleCloseForm}
          title={editingRate ? 'Modifier le taux de change' : 'Nouveau taux de change'}
        >
          <ExchangeRateForm
            rate={editingRate}
            onSuccess={handleSuccess}
            onCancel={handleCloseForm}
          />
        </Modal>
      )}
    </div>
  );
}

interface ExchangeRateFormProps {
  rate: ExchangeRate | null;
  onSuccess: () => void;
  onCancel: () => void;
}

function ExchangeRateForm({ rate, onSuccess, onCancel }: ExchangeRateFormProps) {
  const { user } = useAuthStore();
  const [formData, setFormData] = useState({
    devise_source: rate?.devise_source || 'USD',
    devise_destination: rate?.devise_destination || 'CDF',
    taux: rate?.taux || 0,
    actif: rate?.actif ?? true,
    date_debut: rate?.date_debut?.split('T')[0] || new Date().toISOString().split('T')[0],
    date_fin: rate?.date_fin?.split('T')[0] || '',
    notes: rate?.notes || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (formData.taux <= 0) {
        throw new Error('Le taux doit être supérieur à zéro');
      }

      if (formData.devise_source === formData.devise_destination) {
        throw new Error('Les devises source et destination doivent être différentes');
      }

      const payload: any = {
        devise_source: formData.devise_source,
        devise_destination: formData.devise_destination,
        taux: formData.taux,
        actif: formData.actif,
        date_debut: formData.date_debut,
        date_fin: formData.date_fin || null,
        notes: formData.notes || null,
      };

      if (rate) {
        const { error: updateError } = await supabase
          .from('exchange_rates')
          .update(payload)
          .eq('id', rate.id);

        if (updateError) throw updateError;
      } else {
        payload.created_by = user?.id;

        const { error: insertError } = await supabase
          .from('exchange_rates')
          .insert(payload);

        if (insertError) throw insertError;
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Devise source
          </label>
          <select
            value={formData.devise_source}
            onChange={(e) =>
              setFormData({ ...formData, devise_source: e.target.value as 'USD' | 'CDF' })
            }
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            disabled={!!rate}
          >
            <option value="USD">USD</option>
            <option value="CDF">CDF</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Devise destination
          </label>
          <select
            value={formData.devise_destination}
            onChange={(e) =>
              setFormData({ ...formData, devise_destination: e.target.value as 'USD' | 'CDF' })
            }
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            disabled={!!rate}
          >
            <option value="USD">USD</option>
            <option value="CDF">CDF</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Taux de change
        </label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={formData.taux || ''}
          onChange={(e) => setFormData({ ...formData, taux: parseFloat(e.target.value) || 0 })}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          placeholder="Ex: 2700"
          required
        />
        <p className="text-xs text-slate-500 mt-1">
          1 {formData.devise_source} = {formData.taux || 0} {formData.devise_destination}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Date de début
          </label>
          <input
            type="date"
            value={formData.date_debut}
            onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Date de fin <span className="text-slate-500 font-normal">(optionnel)</span>
          </label>
          <input
            type="date"
            value={formData.date_fin}
            onChange={(e) => setFormData({ ...formData, date_fin: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={formData.actif}
            onChange={(e) => setFormData({ ...formData, actif: e.target.checked })}
            className="w-4 h-4 text-emerald-500 border-slate-300 rounded focus:ring-emerald-500"
          />
          <span className="text-sm font-medium text-slate-700">Taux actif</span>
        </label>
        <p className="text-xs text-slate-500 mt-1">
          Un seul taux peut être actif par paire de devises
        </p>
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
          placeholder="Commentaires..."
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
          disabled={loading}
          className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Enregistrement...' : rate ? 'Mettre à jour' : 'Créer'}
        </button>
      </div>
    </form>
  );
}
