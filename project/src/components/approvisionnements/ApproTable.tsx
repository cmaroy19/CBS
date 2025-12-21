import { TrendingUp, TrendingDown } from 'lucide-react';
import { Table } from '../ui/Table';
import type { Approvisionnement } from '../../types';

interface ApproTableProps {
  approvisionnements: Approvisionnement[];
  loading?: boolean;
}

export function ApproTable({ approvisionnements, loading = false }: ApproTableProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <Table headers={['Opération', 'Type', 'Service', 'Montant', 'Date', 'Créé par', 'Notes']}>
        {loading ? (
          <tr>
            <td colSpan={7} className="px-6 py-12 text-center">
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
                <span className="text-slate-600">Chargement...</span>
              </div>
            </td>
          </tr>
        ) : approvisionnements.length === 0 ? (
          <tr>
            <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
              Aucun approvisionnement trouvé pour cette date
            </td>
          </tr>
        ) : (
          approvisionnements.map((appro) => (
            <tr key={appro.id} className="hover:bg-slate-50">
              <td className="px-6 py-4">
                <div className="flex items-center space-x-2">
                  {appro.operation === 'entree' ? (
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-rose-500" />
                  )}
                  <span className="text-sm font-medium text-slate-900">
                    {appro.operation === 'entree' ? 'Entrée' : 'Sortie'}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    appro.type === 'cash'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {appro.type === 'cash' ? 'Cash' : 'Virtuel'}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-slate-900">
                {appro.service?.nom || '-'}
              </td>
              <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                {new Intl.NumberFormat('fr-FR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(appro.montant)}{' '}
                {appro.devise}
              </td>
              <td className="px-6 py-4 text-sm text-slate-600">
                {new Date(appro.created_at).toLocaleString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
              <td className="px-6 py-4 text-sm text-slate-600">
                {appro.creator?.nom_complet || 'N/A'}
              </td>
              <td className="px-6 py-4 text-sm text-slate-600">
                {appro.notes || '-'}
              </td>
            </tr>
          ))
        )}
      </Table>
    </div>
  );
}
