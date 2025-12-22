import { ArrowDownCircle, ArrowUpCircle, AlertCircle, Ban } from 'lucide-react';
import { Table } from '../ui/Table';
import { useAuthStore } from '../../stores/authStore';
import type { Transaction } from '../../types';

interface TransactionsTableProps {
  transactions: Transaction[];
  loading?: boolean;
  onCorrect?: (transaction: Transaction) => void;
}

export function TransactionsTable({ transactions, loading = false, onCorrect }: TransactionsTableProps) {
  const { user } = useAuthStore();
  const canCorrect = user?.role === 'Administrateur' || user?.role === 'Proprietaire';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <Table
        headers={[
          'Type',
          'Service',
          'Montant',
          'Référence',
          'Info client',
          'Date',
          'Créé par',
          ...(canCorrect ? ['Actions'] : []),
        ]}
      >
        {loading ? (
          <tr>
            <td colSpan={canCorrect ? 8 : 7} className="px-6 py-12 text-center">
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
                <span className="text-slate-600">Chargement...</span>
              </div>
            </td>
          </tr>
        ) : transactions.length === 0 ? (
          <tr>
            <td colSpan={canCorrect ? 8 : 7} className="px-6 py-12 text-center text-slate-500">
              Aucune transaction trouvée
            </td>
          </tr>
        ) : (
          transactions.map((transaction) => (
            <tr key={transaction.id} className="hover:bg-slate-50">
              <td className="px-6 py-4">
                <div className="flex items-center space-x-2">
                  {transaction.type === 'depot' ? (
                    <ArrowDownCircle className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <ArrowUpCircle className="w-5 h-5 text-blue-500" />
                  )}
                  <span className="text-sm font-medium text-slate-900">
                    {transaction.type === 'depot' ? 'Dépôt' : 'Retrait'}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-slate-900">
                {transaction.service?.nom || 'N/A'}
              </td>
              <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                {new Intl.NumberFormat('fr-FR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(transaction.montant)}{' '}
                {transaction.devise}
              </td>
              <td className="px-6 py-4 text-sm text-slate-600">
                <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                  {transaction.reference}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-slate-600">
                {transaction.info_client || '-'}
              </td>
              <td className="px-6 py-4 text-sm text-slate-600">
                {new Date(transaction.created_at).toLocaleString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
              <td className="px-6 py-4 text-sm text-slate-600">
                {transaction.creator?.nom_complet || 'N/A'}
              </td>
              {canCorrect && (
                <td className="px-6 py-4">
                  {transaction.annule ? (
                    <div className="flex items-center space-x-2 text-slate-500">
                      <Ban className="w-4 h-4" />
                      <span className="text-xs">Annulée</span>
                    </div>
                  ) : transaction.transaction_origine_id ? (
                    <div className="flex items-center space-x-2 text-blue-600">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-xs">Correction</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => onCorrect?.(transaction)}
                      className="flex items-center space-x-1 text-amber-600 hover:text-amber-700 transition-colors"
                      title="Corriger cette transaction"
                    >
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-xs font-medium">Corriger</span>
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))
        )}
      </Table>
    </div>
  );
}
