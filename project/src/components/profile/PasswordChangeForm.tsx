import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';

interface PasswordChangeFormProps {
  onSuccess: () => void;
}

export function PasswordChangeForm({ onSuccess }: PasswordChangeFormProps) {
  const { user } = useAuthStore();
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'Le mot de passe doit contenir au moins 8 caractères';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Le mot de passe doit contenir au moins une majuscule';
    }
    if (!/[a-z]/.test(password)) {
      return 'Le mot de passe doit contenir au moins une minuscule';
    }
    if (!/[0-9]/.test(password)) {
      return 'Le mot de passe doit contenir au moins un chiffre';
    }
    return null;
  };

  const verifyCurrentPassword = async (email: string, password: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return false;
      return !!data.user;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      if (!user?.email) {
        throw new Error('Email utilisateur non trouvé');
      }

      if (!passwordData.currentPassword) {
        throw new Error('Veuillez entrer votre mot de passe actuel');
      }

      const isCurrentPasswordValid = await verifyCurrentPassword(
        user.email,
        passwordData.currentPassword
      );

      if (!isCurrentPasswordValid) {
        throw new Error('Le mot de passe actuel est incorrect');
      }

      const passwordValidationError = validatePassword(passwordData.newPassword);
      if (passwordValidationError) {
        throw new Error(passwordValidationError);
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        throw new Error('Le nouveau mot de passe et sa confirmation ne correspondent pas');
      }

      if (passwordData.currentPassword === passwordData.newPassword) {
        throw new Error('Le nouveau mot de passe doit être différent de l\'ancien');
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (updateError) throw updateError;

      await supabase.from('audit_logs').insert({
        table_name: 'auth.users',
        operation: 'UPDATE',
        record_id: user.id,
        new_data: {
          action: 'password_change',
          timestamp: new Date().toISOString(),
        },
        user_id: user.id,
      });

      setSuccess(true);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });

      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du changement de mot de passe');
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const getPasswordStrength = (password: string): { level: number; label: string; color: string } => {
    if (!password) return { level: 0, label: '', color: '' };

    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    if (strength <= 2) return { level: 1, label: 'Faible', color: 'bg-red-500' };
    if (strength <= 4) return { level: 2, label: 'Moyen', color: 'bg-yellow-500' };
    return { level: 3, label: 'Fort', color: 'bg-emerald-500' };
  };

  const passwordStrength = getPasswordStrength(passwordData.newPassword);

  if (success) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-emerald-200 p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4 animate-bounce">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900 mb-2">
          Mot de passe modifié avec succès !
        </h3>
        <p className="text-slate-600">
          Votre mot de passe a été mis à jour. Cette fenêtre se fermera automatiquement.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 bg-slate-100 rounded-lg">
          <Lock className="w-5 h-5 text-slate-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Changer le mot de passe</h3>
          <p className="text-sm text-slate-600">Sécurisez votre compte avec un mot de passe fort</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Erreur</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Mot de passe actuel <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPasswords.current ? 'text' : 'password'}
              value={passwordData.currentPassword}
              onChange={(e) =>
                setPasswordData({ ...passwordData, currentPassword: e.target.value })
              }
              className="w-full px-4 py-2.5 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="Entrez votre mot de passe actuel"
              required
            />
            <button
              type="button"
              onClick={() => togglePasswordVisibility('current')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPasswords.current ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pour votre sécurité, veuillez confirmer votre mot de passe actuel
          </p>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Nouveau mot de passe <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPasswords.new ? 'text' : 'password'}
                value={passwordData.newPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, newPassword: e.target.value })
                }
                className="w-full px-4 py-2.5 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Minimum 8 caractères"
                required
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('new')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPasswords.new ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            {passwordData.newPassword && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-600">Force du mot de passe</span>
                  <span className={`text-xs font-medium ${
                    passwordStrength.level === 1 ? 'text-red-600' :
                    passwordStrength.level === 2 ? 'text-yellow-600' : 'text-emerald-600'
                  }`}>
                    {passwordStrength.label}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                    style={{ width: `${(passwordStrength.level / 3) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="mt-2 space-y-1">
              <p className="text-xs text-slate-600">Le mot de passe doit contenir :</p>
              <ul className="text-xs text-slate-500 space-y-0.5 ml-4">
                <li className={passwordData.newPassword.length >= 8 ? 'text-emerald-600' : ''}>
                  • Au moins 8 caractères
                </li>
                <li className={/[A-Z]/.test(passwordData.newPassword) ? 'text-emerald-600' : ''}>
                  • Au moins une majuscule
                </li>
                <li className={/[a-z]/.test(passwordData.newPassword) ? 'text-emerald-600' : ''}>
                  • Au moins une minuscule
                </li>
                <li className={/[0-9]/.test(passwordData.newPassword) ? 'text-emerald-600' : ''}>
                  • Au moins un chiffre
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Confirmer le nouveau mot de passe <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPasswords.confirm ? 'text' : 'password'}
              value={passwordData.confirmPassword}
              onChange={(e) =>
                setPasswordData({ ...passwordData, confirmPassword: e.target.value })
              }
              className="w-full px-4 py-2.5 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="Confirmez votre nouveau mot de passe"
              required
            />
            <button
              type="button"
              onClick={() => togglePasswordVisibility('confirm')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPasswords.confirm ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
          {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
            <p className="text-xs text-red-600 mt-1">
              Les mots de passe ne correspondent pas
            </p>
          )}
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center space-x-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                <span>Changement en cours...</span>
              </span>
            ) : (
              'Changer le mot de passe'
            )}
          </button>
        </div>
      </form>

      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-800">
          <strong>Conseil de sécurité :</strong> Utilisez un mot de passe unique que vous n'utilisez
          pas sur d'autres sites. Évitez les informations personnelles évidentes.
        </p>
      </div>
    </div>
  );
}
