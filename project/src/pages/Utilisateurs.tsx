import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { usePageCleanup } from '../hooks/usePageCleanup';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { Plus, User, Lock, Ban, CheckCircle, XCircle, Key } from 'lucide-react';

interface UserData {
  id: string;
  nom_complet: string;
  email: string;
  role: 'administrateur' | 'proprietaire' | 'gerant' | 'caissier';
  age?: number;
  actif: boolean;
  suspended: boolean;
  last_login_at?: string;
  created_at: string;
  photo_url?: string;
}

export function Utilisateurs() {
  const { user: currentUser } = useAuthStore();
  const { isMounted } = usePageCleanup('Utilisateurs');
  const [users, setUsers] = useState<UserData[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [userToResetPassword, setUserToResetPassword] = useState<UserData | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [formData, setFormData] = useState({
    nom_complet: '',
    email: '',
    role: 'caissier' as 'administrateur' | 'proprietaire' | 'gerant' | 'caissier',
    age: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isAdmin = currentUser?.role === 'administrateur' || currentUser?.role === 'gerant';

  useEffect(() => {
    console.log('🟢 [Utilisateurs] useEffect - Chargement initial');
    if (isAdmin) {
      loadUsers();
    }

    return () => {
      console.log('🔴 [Utilisateurs] useEffect cleanup');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUsers = async () => {
    if (!isMounted()) return;
    setLoadingUsers(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .order('email', { ascending: true });

      if (!isMounted()) return;

      if (fetchError) {
        console.error('Error loading users:', fetchError);
        setError('Erreur lors du chargement des utilisateurs: ' + fetchError.message);
        return;
      }

      if (data) {
        console.log('Loaded users:', data);
        setUsers(data);
      }
    } catch (err: any) {
      if (!isMounted()) return;
      console.error('Exception loading users:', err);
      setError('Erreur lors du chargement des utilisateurs: ' + err.message);
    } finally {
      if (isMounted()) {
        setLoadingUsers(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (selectedUser) {
        const { error: updateError } = await supabase
          .from('users')
          .update({
            nom_complet: formData.nom_complet,
            role: formData.role,
            age: formData.age ? parseInt(formData.age) : null,
          })
          .eq('id', selectedUser.id);

        if (updateError) throw updateError;

        setSuccess('Utilisateur modifié avec succès');
      } else {
        console.log('Creating user with data:', formData);

        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: undefined,
            data: {
              nom_complet: formData.nom_complet,
              role: formData.role,
              age: formData.age ? parseInt(formData.age) : null,
            },
          },
        });

        console.log('Auth signup result:', { authData, signUpError });

        if (signUpError) throw signUpError;

        if (authData.user) {
          const { error: insertError } = await supabase.from('users').insert({
            id: authData.user.id,
            email: formData.email,
            nom_complet: formData.nom_complet,
            role: formData.role,
            age: formData.age ? parseInt(formData.age) : null,
            actif: true,
            suspended: false,
          });

          if (insertError) {
            console.error('Error inserting user:', insertError);
            throw insertError;
          }

          console.log('User created successfully');
        }

        setSuccess('Utilisateur créé avec succès');
      }

      setIsModalOpen(false);
      resetForm();
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'opération');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async (userId: string, suspend: boolean) => {
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          suspended: suspend,
          suspended_at: suspend ? new Date().toISOString() : null,
          suspended_by: suspend ? currentUser?.id : null,
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      setSuccess(suspend ? 'Utilisateur suspendu' : 'Suspension levée');
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'opération');
    }
  };

  const handleResetPassword = async (_userId: string, email: string) => {
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);

      if (resetError) throw resetError;

      setSuccess('Email de réinitialisation envoyé');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'envoi');
    }
  };

  const resetForm = () => {
    setFormData({
      nom_complet: '',
      email: '',
      role: 'caissier',
      age: '',
      password: '',
    });
    setSelectedUser(null);
  };

  const openEditModal = (user: UserData) => {
    setSelectedUser(user);
    setFormData({
      nom_complet: user.nom_complet,
      email: user.email,
      role: user.role,
      age: user.age?.toString() || '',
      password: '',
    });
    setIsModalOpen(true);
  };

  const openResetPasswordModal = (user: UserData) => {
    setUserToResetPassword(user);
    setNewPassword('');
    setIsResetPasswordModalOpen(true);
  };

  const handleResetPasswordSubmit = async () => {
    if (!userToResetPassword || !newPassword) {
      setError('Veuillez entrer un nouveau mot de passe');
      return;
    }

    if (newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    setResettingPassword(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Session non trouvée');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-user-password`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userToResetPassword.id,
          newPassword: newPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la réinitialisation');
      }

      setSuccess(`Mot de passe réinitialisé pour ${userToResetPassword.nom_complet}`);
      setIsResetPasswordModalOpen(false);
      setUserToResetPassword(null);
      setNewPassword('');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la réinitialisation du mot de passe');
    } finally {
      setResettingPassword(false);
    }
  };

  const roleLabels = {
    administrateur: 'Administrateur',
    proprietaire: 'Propriétaire',
    gerant: 'Gérant',
    caissier: 'Caissier',
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <Ban className="w-16 h-16 text-slate-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Accès refusé</h2>
        <p className="text-slate-600">Seuls les administrateurs et gérants peuvent accéder à cette page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Gestion des utilisateurs</h1>
          <p className="text-slate-600">Gérer les comptes utilisateurs et leurs accès</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Nouvel utilisateur</span>
        </button>
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

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <Table
          headers={['Utilisateur', 'Email', 'Rôle', 'Statut', 'Dernière connexion', 'Actions']}
        >
          {loadingUsers ? (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
                  <span>Chargement...</span>
                </div>
              </td>
            </tr>
          ) : users.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                Aucun utilisateur trouvé
              </td>
            </tr>
          ) : (
            users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    {user.photo_url ? (
                      <img
                        src={user.photo_url}
                        alt={user.nom_complet}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-900">{user.nom_complet}</p>
                      {user.age && <p className="text-xs text-slate-500">{user.age} ans</p>}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{user.email}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
                    {roleLabels[user.role]}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    {user.suspended ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-red-100 text-red-800 text-xs font-semibold">
                        <Ban className="w-3 h-3 mr-1" />
                        Suspendu
                      </span>
                    ) : (() => {
                      const isActive = user.last_login
                        ? (new Date().getTime() - new Date(user.last_login).getTime()) < 5 * 60 * 1000
                        : false;
                      return isActive ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-semibold">
                          <XCircle className="w-3 h-3 mr-1" />
                          Inactif
                        </span>
                      );
                    })()}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {user.last_login
                    ? new Date(user.last_login).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Jamais'}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => openEditModal(user)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Modifier
                    </button>
                    {user.id !== currentUser?.id && (
                      <>
                        <span className="text-slate-300">|</span>
                        <button
                          onClick={() => handleSuspend(user.id, !user.suspended)}
                          className={`text-sm font-medium ${
                            user.suspended
                              ? 'text-emerald-600 hover:text-emerald-800'
                              : 'text-amber-600 hover:text-amber-800'
                          }`}
                        >
                          {user.suspended ? 'Activer' : 'Suspendre'}
                        </button>
                        {currentUser?.role === 'administrateur' && (
                          <>
                            <span className="text-slate-300">|</span>
                            <button
                              onClick={() => openResetPasswordModal(user)}
                              className="text-slate-600 hover:text-slate-800 text-sm font-medium"
                              title="Réinitialiser le mot de passe"
                            >
                              <Key className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </Table>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
        }}
        title={selectedUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
        size="lg"
      >
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
                placeholder="Âge"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              disabled={!!selectedUser}
              required
            />
            {selectedUser && (
              <p className="text-xs text-slate-500 mt-1">L'email ne peut pas être modifié</p>
            )}
          </div>

          {!selectedUser && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Mot de passe
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Minimum 6 caractères"
                required
                minLength={6}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Rôle</label>
            <select
              value={formData.role}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  role: e.target.value as 'administrateur' | 'proprietaire' | 'gerant' | 'caissier',
                })
              }
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              required
            >
              <option value="caissier">Caissier</option>
              <option value="gerant">Gérant</option>
              <option value="proprietaire">Propriétaire</option>
              {currentUser?.role === 'administrateur' && (
                <option value="administrateur">Administrateur</option>
              )}
            </select>
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
              {loading ? 'Enregistrement...' : selectedUser ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isResetPasswordModalOpen}
        onClose={() => {
          setIsResetPasswordModalOpen(false);
          setUserToResetPassword(null);
          setNewPassword('');
          setError('');
        }}
        title="Réinitialiser le mot de passe"
      >
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              <strong>Attention :</strong> Vous êtes sur le point de réinitialiser le mot de passe de{' '}
              <strong>{userToResetPassword?.nom_complet}</strong>.
            </p>
            <p className="text-xs text-amber-700 mt-2">
              Cette action est irréversible. L'utilisateur devra utiliser le nouveau mot de passe pour se connecter.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Nouveau mot de passe <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="Minimum 8 caractères"
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              Le mot de passe doit contenir au moins 8 caractères
            </p>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsResetPasswordModalOpen(false);
                setUserToResetPassword(null);
                setNewPassword('');
                setError('');
              }}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleResetPasswordSubmit}
              disabled={resettingPassword || !newPassword}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resettingPassword ? (
                <span className="flex items-center justify-center space-x-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  <span>Réinitialisation...</span>
                </span>
              ) : (
                'Réinitialiser le mot de passe'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
