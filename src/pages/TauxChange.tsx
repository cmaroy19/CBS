import { useState, useEffect } from 'react';
import { Plus, TrendingUp, History, AlertCircle } from 'lucide-react';
import { exchangeRateService } from '../lib/exchangeRates';
import type { ExchangeRate } from '../types';
import { useAuthStore } from '../stores/authStore';

export default function TauxChange() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    devise_source: 'USD' as const,
    devise_destination: 'CDF' as const,
    taux: '',
    notes: '',
  });

  const user = useAuthStore((state) => state.user);
  const canManage = user?.role && ['gerant', 'proprietaire', 'administrateur'].includes(user.role);

  useEffect(() => {
    loadRates();
  }, []);

  const loadRates = async () => {
    setLoading(true);
    const { data, error } = await exchangeRateService.getActiveRates();
    if (data) {
      setRates(data);
    }
    if (error) {
      setError('Erreur lors du chargement des taux');
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const taux = parseFloat(formData.taux);
    if (isNaN(taux) || taux <= 0) {
      setError('Le taux doit être un nombre positif');
      return;
    }

    const { data, error } = await exchangeRateService.createRate({
      devise_source: formData.devise_source,
      devise_destination: formData.devise_destination,
      taux,
      actif: true,
      notes: formData.notes,
    });

    if (error) {
      setError(error.message);
      return;
    }

    if (data) {
      setSuccess(`Taux créé avec succès: 1 ${data.devise_source} = ${data.taux} ${data.devise_destination}`);
      setFormData({
        devise_source: 'USD',
        devise_destination: 'CDF',
        taux: '',
        notes: '',
      });
      setShowForm(false);
      loadRates();
    }
  };

  const handleDeactivate = async (rateId: string) => {
    if (!confirm('Désactiver ce taux de change ?')) return;

    const { error } = await exchangeRateService.deactivateRate(rateId);
    if (error) {
      setError(error.message);
      return;
    }

    setSuccess('Taux désactivé avec succès');
    loadRates();
  };

  const calculateInverse = (rate: ExchangeRate) => {
    const inverse = 1 / rate.taux;
    return `1 ${rate.devise_destination} = ${inverse.toFixed(8)} ${rate.devise_source}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Taux de Change</h1>
          <p className="text-gray-600">Gestion des taux de conversion USD ↔ CDF</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <History className="w-4 h-4" />
              Historique
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Nouveau Taux
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {showForm && canManage && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Créer un nouveau taux</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Devise Source
                </label>
                <select
                  value={formData.devise_source}
                  onChange={(e) => {
                    const source = e.target.value as 'USD' | 'CDF';
                    setFormData({
                      ...formData,
                      devise_source: source,
                      devise_destination: source === 'USD' ? 'CDF' : 'USD',
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="USD">USD</option>
                  <option value="CDF">CDF</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Devise Destination
                </label>
                <input
                  type="text"
                  value={formData.devise_destination}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Taux de Change
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.taux}
                onChange={(e) => setFormData({ ...formData, taux: e.target.value })}
                placeholder="Ex: 2700 pour 1 USD = 2700 CDF"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                1 {formData.devise_source} = ? {formData.devise_destination}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Raison du changement, source du taux, etc."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Créer le Taux
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Taux Actifs
          </h2>
        </div>

        {rates.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Aucun taux de change configuré
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {rates.map((rate) => (
              <div key={rate.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-gray-900">
                          {rate.devise_source}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="text-lg font-bold text-gray-900">
                          {rate.devise_destination}
                        </span>
                      </div>
                      <div className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                        ACTIF
                      </div>
                    </div>

                    <div className="mt-2 space-y-1">
                      <p className="text-2xl font-bold text-blue-600">
                        1 {rate.devise_source} = {rate.taux.toLocaleString()} {rate.devise_destination}
                      </p>
                      <p className="text-sm text-gray-500">
                        {calculateInverse(rate)}
                      </p>
                    </div>

                    {rate.notes && (
                      <p className="mt-2 text-sm text-gray-600">{rate.notes}</p>
                    )}

                    <p className="mt-2 text-xs text-gray-500">
                      Actif depuis le {new Date(rate.date_debut).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  {canManage && (
                    <button
                      onClick={() => handleDeactivate(rate.id)}
                      className="ml-4 px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Désactiver
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showHistory && (
        <HistorySection onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
}

function HistorySection({ onClose }: { onClose: () => void }) {
  const [history, setHistory] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    const { data } = await exchangeRateService.listRates({});
    if (data) {
      setHistory(data);
    }
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <History className="w-5 h-5 text-gray-600" />
          Historique des Taux
        </h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          Fermer
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Chargement...</div>
      ) : history.length === 0 ? (
        <div className="p-8 text-center text-gray-500">Aucun historique</div>
      ) : (
        <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
          {history.map((rate) => (
            <div key={rate.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {rate.devise_source} → {rate.devise_destination}
                    </span>
                    <span className="text-lg font-bold text-gray-900">
                      {rate.taux.toLocaleString()}
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                      rate.actif
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {rate.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </div>

                  <div className="mt-1 text-sm text-gray-600">
                    <p>
                      Du {new Date(rate.date_debut).toLocaleDateString('fr-FR')}
                      {rate.date_fin && ` au ${new Date(rate.date_fin).toLocaleDateString('fr-FR')}`}
                    </p>
                    {rate.notes && (
                      <p className="mt-1 text-gray-500">{rate.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
