import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { notifySuccess, notifyError } from '../../lib/notifications';
import type { Service } from '../../types';

interface ApproFormProps {
  services: Service[];
  onSuccess: () => void;
  onCancel: () => void;
}

export function ApproForm({ services, onSuccess, onCancel }: ApproFormProps) {
  const { user } = useAuthStore();
  const [formData, setFormData] = useState({
    type_compte: 'cash' as 'cash' | 'virtuel',
    service_id: '',
    operation: 'entree' as 'entree' | 'sortie',
    montant: '' as string | number,
    devise: 'USD' as 'USD' | 'CDF',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();

    console.log('=== DIAGNOSTIC APPROVISIONNEMENT ===');
    console.log('1. User from store:', user);
    console.log('2. Session:', session);
    console.log('3. Session user:', session?.user);
    console.log('4. Form data:', formData);

    if (!session?.user) {
      setError('Vous devez être connecté pour effectuer cette action');
      setLoading(false);
      return;
    }

    try {
      // Validations strictes
      if (formData.type_compte === 'virtuel' && !formData.service_id) {
        throw new Error('Veuillez sélectionner un service pour un approvisionnement virtuel');
      }

      const montantNum = typeof formData.montant === 'string'
        ? parseFloat(formData.montant)
        : formData.montant;

      if (!montantNum || isNaN(montantNum) || montantNum <= 0) {
        throw new Error('Le montant doit être un nombre supérieur à zéro');
      }

      if (!['USD', 'CDF'].includes(formData.devise)) {
        throw new Error('Devise invalide. Utilisez USD ou CDF');
      }

      if (!['entree', 'sortie'].includes(formData.operation)) {
        throw new Error('Opération invalide');
      }

      // Appel RPC atomique (paramètres dans l'ordre de la fonction)
      const { data, error: rpcError } = await supabase.rpc('create_approvisionnement_atomic', {
        p_operation: formData.operation,
        p_montant: montantNum,
        p_devise: formData.devise,
        p_created_by: user?.id,
        p_service_id: formData.type_compte === 'virtuel' ? formData.service_id : null,
        p_notes: formData.notes?.trim() || null,
      });

      if (rpcError) {
        console.error('RPC error details:', {
          error: rpcError,
          code: rpcError.code,
          message: rpcError.message,
          details: rpcError.details,
          hint: rpcError.hint
        });
        throw new Error(rpcError.message || "Erreur lors de l'approvisionnement");
      }

      console.log('Approvisionnement créé avec succès:', data);

      // Notification de succès
      const destinationText = formData.type_compte === 'cash'
        ? 'Caisse globale'
        : services.find(s => s.id === formData.service_id)?.nom || 'Service';
      const operationText = formData.operation === 'entree' ? 'Entrée' : 'Sortie';
      notifySuccess(
        'Approvisionnement enregistré',
        `${operationText} de ${montantNum.toFixed(2)} ${formData.devise} sur ${destinationText}`
      );

      // Reset du formulaire
      setFormData({
        type_compte: 'cash',
        service_id: '',
        operation: 'entree',
        montant: '',
        devise: 'USD',
        notes: '',
      });

      // Fermeture modale
      onSuccess();
    } catch (err: any) {
      console.error('Erreur approvisionnement:', err);
      setError(err.message || "Erreur lors de l'approvisionnement");
      notifyError("Erreur d'approvisionnement", err);
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

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Type d'approvisionnement
        </label>
        <select
          value={formData.type_compte}
          onChange={(e) => setFormData({
            ...formData,
            type_compte: e.target.value as 'cash' | 'virtuel',
            service_id: '' // Reset service lors du changement de type
          })}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          required
        >
          <option value="cash">Cash (Caisse globale)</option>
          <option value="virtuel">Virtuel (Par service)</option>
        </select>
      </div>

      {formData.type_compte === 'virtuel' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Service <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.service_id}
            onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            required={formData.type_compte === 'virtuel'}
          >
            <option value="">Sélectionner un service</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.nom}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">
            Le solde virtuel de ce service sera mis à jour
          </p>
        </div>
      )}

      {formData.type_compte === 'cash' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-700">
            💰 <strong>Approvisionnement CASH</strong> - Le solde de la caisse globale sera mis à jour
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Opération</label>
          <select
            value={formData.operation}
            onChange={(e) =>
              setFormData({ ...formData, operation: e.target.value as 'entree' | 'sortie' })
            }
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="entree">Entrée (+)</option>
            <option value="sortie">Sortie (-)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Devise</label>
          <select
            value={formData.devise}
            onChange={(e) =>
              setFormData({ ...formData, devise: e.target.value as 'USD' | 'CDF' })
            }
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="USD">USD</option>
            <option value="CDF">CDF</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Montant</label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={formData.montant}
          onChange={(e) =>
            setFormData({ ...formData, montant: e.target.value })
          }
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          placeholder="0.00"
          required
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
          disabled={loading}
          className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Enregistrement...' : 'Créer l\'approvisionnement'}
        </button>
      </div>
    </form>
  );
}
