import { Clock, ArrowUpDown, DollarSign } from 'lucide-react';

interface Transaction {
  id: string;
  reference: string;
  type_transaction: string;
  montant: number;
  devise: string;
  service_nom: string | null;
  info_client: string | null;
  created_at: string;
}

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  const formatNumber = (value: number) =>
    new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'depot':
        return 'bg-emerald-100 text-emerald-700';
      case 'retrait':
        return 'bg-red-100 text-red-700';
      case 'transfert':
        return 'bg-blue-100 text-blue-700';
      case 'paiement':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      depot: 'Dépôt',
      retrait: 'Retrait',
      transfert: 'Transfert',
      paiement: 'Paiement',
    };
    return labels[type] || type;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Clock className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Transactions Récentes
              </h3>
              <p className="text-sm text-slate-500">10 dernières opérations</p>
            </div>
          </div>
          <div className="text-sm text-slate-500">
            {transactions.length} transaction{transactions.length > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-200">
        {transactions.length === 0 ? (
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
              <ArrowUpDown className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-600">Aucune transaction récente</p>
          </div>
        ) : (
          transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="px-6 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3 mb-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${getTypeColor(
                        transaction.type_transaction
                      )}`}
                    >
                      {getTypeLabel(transaction.type_transaction)}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {transaction.reference}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-900">
                      {transaction.service_nom || 'Service non spécifié'}
                    </p>
                    {transaction.info_client && (
                      <p className="text-xs text-slate-500">
                        {transaction.info_client}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right ml-4">
                  <div className="flex items-center justify-end space-x-2 mb-1">
                    <DollarSign className="w-4 h-4 text-slate-400" />
                    <p className="text-lg font-bold text-slate-900">
                      {formatNumber(transaction.montant)}
                    </p>
                  </div>
                  <div className="flex items-center justify-end space-x-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        transaction.devise === 'USD'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {transaction.devise}
                    </span>
                    <p className="text-xs text-slate-500">
                      {formatDate(transaction.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
