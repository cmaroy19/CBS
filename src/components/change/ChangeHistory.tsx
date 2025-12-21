import { Repeat } from 'lucide-react';
import { Table } from '../ui/Table';
import type { ChangeOperation } from '../../types';

interface ChangeHistoryProps {
  operations: ChangeOperation[];
  loading?: boolean;
}

export function ChangeHistory({ operations, loading = false }: ChangeHistoryProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <Table
        headers={[
          'Sens',
          'Montant USD',
          'Montant CDF',
          'Taux',
          'Commission',
          'Date',
          'Créé par',
          'Notes',
        ]}
      >
        {loading ? (
          <tr>
            <td colSpan={8} className="px-6 py-12 text-center">
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
                <span className="text-slate-600">Chargement...</span>
              </div>
            </td>
          </tr>
        ) : operations.length === 0 ? (
          <tr>
            <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
              Aucune opération de change trouvée pour cette date
            </td>
          </tr>
        ) : (
          operations.map((change) => (
            <tr key={change.id} className="hover:bg-slate-50">
              <td className="px-6 py-4">
                <div className="flex items-center space-x-2">
                  <Repeat
                    className={`w-5 h-5 ${
                      change.sens === 'usd_to_cdf' ? 'text-blue-500' : 'text-amber-500'
                    }`}
                  />
                  <span className="text-sm font-medium text-slate-900">
                    {change.sens === 'usd_to_cdf' ? 'USD → CDF' : 'CDF → USD'}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                {new Intl.NumberFormat('fr-FR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(change.montant_usd)}{' '}
                USD
              </td>
              <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                {new Intl.NumberFormat('fr-FR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(change.montant_cdf)}{' '}
                CDF
              </td>
              <td className="px-6 py-4 text-sm text-slate-600">
                {new Intl.NumberFormat('fr-FR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(change.taux)}
              </td>
              <td className="px-6 py-4 text-sm text-slate-600">
                {change.commission && change.commission > 0
                  ? `${new Intl.NumberFormat('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(change.commission)} ${change.sens === 'usd_to_cdf' ? 'CDF' : 'USD'}`
                  : '-'}
              </td>
              <td className="px-6 py-4 text-sm text-slate-600">
                {new Date(change.created_at).toLocaleString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
              <td className="px-6 py-4 text-sm text-slate-600">
                {change.creator?.nom_complet || 'N/A'}
              </td>
              <td className="px-6 py-4 text-sm text-slate-600">{change.notes || '-'}</td>
            </tr>
          ))
        )}
      </Table>
    </div>
  );
}
