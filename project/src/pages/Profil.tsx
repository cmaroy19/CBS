import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { PasswordChangeForm } from '../components/profile/PasswordChangeForm';
import { User, Shield, Camera } from 'lucide-react';

export function Profil() {
  const { user, setUser } = useAuthStore();
  const [formData, setFormData] = useState({
    nom_complet: user?.nom_complet || '',
    age: user?.age || '',
    email: user?.email || '',
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!user) throw new Error('Utilisateur non connecté');

      const { data, error: updateError } = await supabase
        .from('users')
        .update({
          nom_complet: formData.nom_complet,
          age: formData.age ? parseInt(formData.age) : null,
        })
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setUser(data);
      setSuccess('Profil mis à jour avec succès');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingPhoto(true);
    setError('');
    setSuccess('');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);

      const { data, error: updateError } = await supabase
        .from('users')
        .update({ photo_url: urlData.publicUrl })
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setUser(data);
      setSuccess('Photo de profil mise à jour avec succès');
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'upload de la photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePasswordChangeSuccess = () => {
    setSuccess('Mot de passe modifié avec succès');
    setTimeout(() => setSuccess(''), 3000);
  };

  const roleLabels = {
    administrateur: 'Administrateur',
    proprietaire: 'Propriétaire',
    gerant: 'Gérant',
    caissier: 'Caissier',
  };


  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Mon profil</h1>
        <p className="text-slate-600">Gérez vos informations personnelles</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm">
          {success}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center space-x-6 mb-6 pb-6 border-b border-slate-200">
          <div className="relative">
            {user?.photo_url ? (
              <img
                src={user.photo_url}
                alt={user.nom_complet}
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center">
                <User className="w-12 h-12 text-white" />
              </div>
            )}
            <label className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-lg cursor-pointer hover:bg-slate-50 transition-colors">
              <Camera className="w-4 h-4 text-slate-600" />
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={uploadingPhoto}
                className="hidden"
              />
            </label>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{user?.nom_complet}</h2>
            <p className="text-slate-600">{user?.email}</p>
            <div className="flex items-center space-x-2 mt-2">
              <Shield className="w-4 h-4 text-slate-600" />
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                {user?.role ? roleLabels[user.role] : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nom complet
              </label>
              <input
                type="text"
                value={formData.nom_complet}
                onChange={(e) => setFormData({ ...formData, nom_complet: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Âge <span className="text-slate-500 font-normal">(optionnel)</span>
              </label>
              <input
                type="number"
                min="18"
                max="100"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Votre âge"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              disabled
              className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">L'email ne peut pas être modifié</p>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Mise à jour...' : 'Mettre à jour le profil'}
            </button>
          </div>
        </form>
      </div>

      <PasswordChangeForm onSuccess={handlePasswordChangeSuccess} />

      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-2">Informations du compte</h3>
        <div className="space-y-2 text-sm text-slate-600">
          <p>
            <span className="font-medium">ID:</span> {user?.id}
          </p>
          <p>
            <span className="font-medium">Statut:</span>{' '}
            <span className={user?.actif ? 'text-emerald-600' : 'text-red-600'}>
              {user?.actif ? 'Actif' : 'Inactif'}
            </span>
          </p>
          <p>
            <span className="font-medium">Créé le:</span>{' '}
            {user?.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR') : 'N/A'}
          </p>
          {user?.last_login_at && (
            <p>
              <span className="font-medium">Dernière connexion:</span>{' '}
              {new Date(user.last_login_at).toLocaleString('fr-FR')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
