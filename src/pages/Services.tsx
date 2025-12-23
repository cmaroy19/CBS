import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useDataStore } from '../stores/dataStore';
import { useAuthStore } from '../stores/authStore';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { Plus, Edit, Trash2 } from 'lucide-react';
import type { Service } from '../types';

export function Services() {
  const services = useDataStore(state => state.services);
  const setServices = useDataStore(state => state.setServices);
  const user = useAuthStore(state => state.user);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    nom: '',
    code: '',
    solde_virtuel_usd: 0,
    solde_virtuel_cdf: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const hasLoadedRef = useRef(false);

  const canManageServices = user?.role === 'proprietaire' || user?.role === 'gerant';

  useEffect(() => {
    if (!hasLoadedRef.current && services.length === 0) {
      hasLoadedRef.current = true;
      loadServices();
    }
  }, []);

  // Realtime géré par useOptimizedRealtime() dans App.tsx

  const loadServices = async () => {
    try {
      const { data, error: loadError } = await supabase
        .from('services')
        .select('id, nom, code, solde_virtuel_usd, solde_virtuel_cdf, actif, created_at')
        .order('created_at', { ascending: false });

      if (loadError) {
        setError('Erreur lors du chargement des services');
        return;
      }

      if (data) {
        setServices(data);
      }
    } catch (err) {
      setError('Erreur lors du chargement des services');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    console.log('5. Form data:', formData);

    if (!session?.user) {
      setError('Vous devez être connecté pour effectuer cette action');
      setLoading(false);
      return;
    }

    if (!canManageServices) {
      setError('Vous n\'avez pas les permissions nécessaires pour gérer les services');
      setLoading(false);
      return;
    }

    try {
      if (editingService) {
        const { error: updateError } = await supabase
          .from('services')
          .update({
            nom: formData.nom,
            code: formData.code,
          })
          .eq('id', editingService.id);

        if (updateError) {
          console.error('Update error:', updateError);
          throw updateError;
        }
      } else {
        const { data, error: insertError } = await supabase
          .from('services')
          .insert([{
            nom: formData.nom.trim(),
            code: formData.code.trim(),
            solde_virtuel_usd: 0,
            solde_virtuel_cdf: 0,
          }])
          .select()
          .single();

        if (insertError) {
          console.error('Insert error details:', {
            error: insertError,
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint
          });
          throw insertError;
        }

        console.log('Service created successfully:', data);
      }

      await loadServices();
      setIsModalOpen(false);
      resetForm();
      setError('');
    } catch (err: any) {
      console.error('Submit error:', err);
      let errorMessage = err.message || 'Erreur lors de la sauvegarde';

      if (err.code === '23505') {
        if (err.message.includes('services_nom_key')) {
          errorMessage = 'Un service avec ce nom existe déjà';
        } else if (err.message.includes('services_code_key')) {
          errorMessage = 'Un service avec ce code existe déjà';
        } else {
          errorMessage = 'Ce service existe déjà (nom ou code en doublon)';
        }
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      code: '',
      solde_virtuel_usd: 0,
      solde_virtuel_cdf: 0,
    });
    setEditingService(null);
  };

  const openEditModal = (service: Service) => {
    setEditingService(service);
    setFormData({
      nom: service.nom,
      code: service.code,
      solde_virtuel_usd: service.solde_virtuel_usd,
      solde_virtuel_cdf: service.solde_virtuel_cdf,
    });
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleDelete = async (service: Service) => {
    if (service.solde_virtuel_usd !== 0 || service.solde_virtuel_cdf !== 0) {
      setError('Impossible de supprimer ce service : les soldes doivent être à zéro (0 USD et 0 CDF)');
      setTimeout(() => setError(''), 5000);
      return;
    }

    if (!confirm(`Êtes-vous sûr de vouloir supprimer le service "${service.nom}" ?`)) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from('services')
        .delete()
        .eq('id', service.id);

      if (deleteError) throw deleteError;

      setError('');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression du service');
      setTimeout(() => setError(''), 5000);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Services</h1>
          <p className="text-slate-600">Gestion des services partenaires</p>
        </div>
        {canManageServices && (
          <button
            onClick={openAddModal}
            className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Ajouter un service</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <Table headers={['Service', 'Solde USD', 'Solde CDF', 'Statut', 'Actions']}>
          {services.map((service) => (
            <tr key={service.id} className="hover:bg-slate-50">
              <td className="px-6 py-4 text-sm font-medium text-slate-900">{service.nom}</td>
              <td className="px-6 py-4 text-sm text-slate-900 font-semibold">
                {new Intl.NumberFormat('fr-FR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(service.solde_virtuel_usd)}{' '}
                USD
              </td>
              <td className="px-6 py-4 text-sm text-slate-900 font-semibold">
                {new Intl.NumberFormat('fr-FR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(service.solde_virtuel_cdf)}{' '}
                CDF
              </td>
              <td className="px-6 py-4">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    service.actif
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {service.actif ? 'Actif' : 'Inactif'}
                </span>
              </td>
              <td className="px-6 py-4">
                {canManageServices && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => openEditModal(service)}
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                      title="Modifier"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(service)}
                      className="text-red-600 hover:text-red-800 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
        }}
        title={editingService ? 'Modifier le service' : 'Nouveau service'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Nom du service
            </label>
            <input
              type="text"
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Code
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Solde virtuel USD
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.solde_virtuel_usd}
                readOnly
                className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-600 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Solde virtuel CDF
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.solde_virtuel_cdf}
                readOnly
                className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-600 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
              }}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Enregistrement...' : editingService ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
