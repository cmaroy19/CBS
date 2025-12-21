import { ArrowDownCircle, ArrowUpCircle, Repeat, DollarSign, ArrowRightLeft } from 'lucide-react';
import { Table } from '../ui/Table';
import type { TransactionHeader } from '../../types';

interface TransactionsTableProps {
  transactions: TransactionHeader[];
  loading?: boolean;
}

const getOperationIcon = (type: string) => {
  switch (type) {
    case 'depot':
      return <ArrowDownCircle className="w-5 h-5 text-emerald-500" />;
    case 'retrait':
      return <ArrowUpCircle className="w-5 h-5 text-blue-500" />;
    case 'approvisionnement':
      return <DollarSign className="w-5 h-5 text-amber-500" />;
    case 'change':
      return <Repeat className="w-5 h-5 text-teal-500" />;
    case 'transfert':
      return <ArrowRightLeft className="w-5 h-5 text-cyan-500" />;
    default:
      return <DollarSign className="w-5 h-5 text-slate-500" />;
  }
};

const getOperationLabel = (type: string) => {
  switch (type) {
    case 'depot':
      return 'Dépôt';
    case 'retrait':
      return 'Retrait';
    case 'approvisionnement':
      return 'Appro.';
    case 'change':
      return 'Change';
    case 'transfert':
      return 'Transfert';
    default:
      return type;
  }
};

const getStatutBadge = (statut: string) => {
  switch (statut) {
    case 'validee':
      return <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded">Validée</span>;
    case 'brouillon':
      return <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded">Brouillon</span>;
    case 'annulee':
      return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded">Annulée</span>;
    default:
      return <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded">{statut}</span>;
  }
};

export function TransactionsTable({ transactions, loading = false }: TransactionsTableProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <Table
        headers={[
          'Type',
          'Description',
          'Montant',
          'Statut',
          'Référence',
          'Info client',
          'Date',
          'Créé par',
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
        ) : transactions.length === 0 ? (
          <tr>
            <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
              Aucune transaction trouvée pour cette date
            </td>
          </tr>
        ) : (
          transactions.map((transaction) => (
            <tr key={transaction.id} className="hover:bg-slate-50">
              <td className="px-6 py-4">
                <div className="flex items-center space-x-2">
                  {getOperationIcon(transaction.type_operation)}
                  <span className="text-sm font-medium text-slate-900">
                    {getOperationLabel(transaction.type_operation)}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-slate-900 max-w-xs truncate">
                {transaction.description || '-'}
              </td>
              <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                {new Intl.NumberFormat('fr-FR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(transaction.montant_total)}{' '}
                {transaction.devise_reference}
              </td>
              <td className="px-6 py-4 text-sm">
                {getStatutBadge(transaction.statut)}
              </td>
              <td className="px-6 py-4 text-sm text-slate-600">
                <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                  {transaction.reference}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">
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
                -
              </td>
            </tr>
          ))
        )}
      </Table>
    </div>
  );
}
