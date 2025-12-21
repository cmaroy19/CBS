import { forwardRef } from 'react';
import type { Transaction, Approvisionnement, ChangeOperation, Service } from '../../types';

interface PrintableReportProps {
  startDate: string;
  endDate: string;
  transactions: Transaction[];
  approvisionnements: Approvisionnement[];
  changeOperations: ChangeOperation[];
  services: Service[];
  selectedService?: string;
  selectedCurrency?: string;
  selectedOperationType?: string;
}

export const PrintableReport = forwardRef<HTMLDivElement, PrintableReportProps>(
  (
    {
      startDate,
      endDate,
      transactions,
      approvisionnements,
      changeOperations,
      services,
      selectedService,
      selectedCurrency,
      selectedOperationType,
    },
    ref
  ) => {
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(date);
    };

    const calculateTotalsByDevise = () => {
      const totals = {
        USD: { volume: 0, commissions: 0, operations: 0 },
        CDF: { volume: 0, commissions: 0, operations: 0 },
      };

      transactions.forEach((t) => {
        if (t.devise === 'USD') {
          totals.USD.volume += t.montant;
          totals.USD.commissions += t.commission;
          totals.USD.operations++;
        } else if (t.devise === 'CDF') {
          totals.CDF.volume += t.montant;
          totals.CDF.commissions += t.commission;
          totals.CDF.operations++;
        }
      });

      approvisionnements.forEach((a) => {
        if (a.devise === 'USD') {
          totals.USD.volume += a.montant;
          totals.USD.operations++;
        } else if (a.devise === 'CDF') {
          totals.CDF.volume += a.montant;
          totals.CDF.operations++;
        }
      });

      totals.USD.volume += changeOperations.reduce((sum, c) => sum + c.montant_usd, 0);
      totals.CDF.volume += changeOperations.reduce((sum, c) => sum + c.montant_cdf, 0);
      totals.USD.commissions += changeOperations.filter(c => c.sens === 'cdf_to_usd').reduce((sum, c) => sum + c.commission, 0);
      totals.CDF.commissions += changeOperations.filter(c => c.sens === 'usd_to_cdf').reduce((sum, c) => sum + c.commission, 0);
      totals.USD.operations += changeOperations.length;

      return totals;
    };

    const totals = calculateTotalsByDevise();

    const getOperationTypeLabel = () => {
      if (!selectedOperationType) return 'Toutes les opérations';
      switch (selectedOperationType) {
        case 'depot':
          return 'Dépôts';
        case 'retrait':
          return 'Retraits';
        case 'approvisionnement':
          return 'Approvisionnements';
        case 'change':
          return 'Opérations de change';
        default:
          return 'Toutes les opérations';
      }
    };

    const getServiceName = () => {
      if (!selectedService) return 'Tous les services';
      const service = services.find((s) => s.id === selectedService);
      return service ? service.nom : 'Tous les services';
    };

    const getCurrencyLabel = () => {
      if (!selectedCurrency) return 'Toutes les devises';
      return selectedCurrency;
    };

    return (
      <div ref={ref} className="print-container hidden">
        <div className="print-content">
          <div className="print-header">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <img src="/himaya-logo.png" alt="Logo" className="h-16 w-auto" />
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">HIMAYA SERVICES</h1>
                  <p className="text-sm text-slate-600">Rapport d'activité</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-600">Date d'impression</p>
                <p className="text-sm font-semibold text-slate-900">
                  {formatDate(new Date().toISOString())}
                </p>
              </div>
            </div>

            <div className="border-t border-b border-slate-300 py-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-600">Période</p>
                  <p className="font-semibold text-slate-900">
                    Du {formatDate(startDate)} au {formatDate(endDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Service</p>
                  <p className="font-semibold text-slate-900">{getServiceName()}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Type d'opération</p>
                  <p className="font-semibold text-slate-900">{getOperationTypeLabel()}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Devise</p>
                  <p className="font-semibold text-slate-900">{getCurrencyLabel()}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="print-body">
            <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b-2 border-emerald-500">RAPPORT USD</h2>

            <table className="print-table w-full mb-6">
              <thead>
                <tr>
                  <th className="text-left">Type</th>
                  <th className="text-right">Nombre</th>
                  <th className="text-right">Volume (USD)</th>
                  <th className="text-right">Commissions (USD)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Dépôts</td>
                  <td className="text-right">
                    {transactions.filter((t) => t.type === 'depot' && t.devise === 'USD').length}
                  </td>
                  <td className="text-right">
                    {new Intl.NumberFormat('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(
                      transactions
                        .filter((t) => t.type === 'depot' && t.devise === 'USD')
                        .reduce((sum, t) => sum + t.montant, 0)
                    )}
                  </td>
                  <td className="text-right">
                    {new Intl.NumberFormat('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(
                      transactions
                        .filter((t) => t.type === 'depot' && t.devise === 'USD')
                        .reduce((sum, t) => sum + t.commission, 0)
                    )}
                  </td>
                </tr>
                <tr>
                  <td>Retraits</td>
                  <td className="text-right">
                    {transactions.filter((t) => t.type === 'retrait' && t.devise === 'USD').length}
                  </td>
                  <td className="text-right">
                    {new Intl.NumberFormat('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(
                      transactions
                        .filter((t) => t.type === 'retrait' && t.devise === 'USD')
                        .reduce((sum, t) => sum + t.montant, 0)
                    )}
                  </td>
                  <td className="text-right">
                    {new Intl.NumberFormat('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(
                      transactions
                        .filter((t) => t.type === 'retrait' && t.devise === 'USD')
                        .reduce((sum, t) => sum + t.commission, 0)
                    )}
                  </td>
                </tr>
                <tr>
                  <td>Transferts</td>
                  <td className="text-right">
                    {transactions.filter((t) => t.type === 'transfert' && t.devise === 'USD').length}
                  </td>
                  <td className="text-right">
                    {new Intl.NumberFormat('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(
                      transactions
                        .filter((t) => t.type === 'transfert' && t.devise === 'USD')
                        .reduce((sum, t) => sum + t.montant, 0)
                    )}
                  </td>
                  <td className="text-right">
                    {new Intl.NumberFormat('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(
                      transactions
                        .filter((t) => t.type === 'transfert' && t.devise === 'USD')
                        .reduce((sum, t) => sum + t.commission, 0)
                    )}
                  </td>
                </tr>
                <tr>
                  <td>Paiements</td>
                  <td className="text-right">
                    {transactions.filter((t) => t.type === 'paiement' && t.devise === 'USD').length}
                  </td>
                  <td className="text-right">
                    {new Intl.NumberFormat('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(
                      transactions
                        .filter((t) => t.type === 'paiement' && t.devise === 'USD')
                        .reduce((sum, t) => sum + t.montant, 0)
                    )}
                  </td>
                  <td className="text-right">
                    {new Intl.NumberFormat('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(
                      transactions
                        .filter((t) => t.type === 'paiement' && t.devise === 'USD')
                        .reduce((sum, t) => sum + t.commission, 0)
                    )}
                  </td>
                </tr>
                <tr>
                  <td>Approvisionnements</td>
                  <td className="text-right">{approvisionnements.filter((a) => a.devise === 'USD').length}</td>
                  <td className="text-right">
                    {new Intl.NumberFormat('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(approvisionnements.filter((a) => a.devise === 'USD').reduce((sum, a) => sum + a.montant, 0))}
                  </td>
                  <td className="text-right">-</td>
                </tr>
                <tr>
                  <td>Opérations de change</td>
                  <td className="text-right">{changeOperations.length}</td>
                  <td className="text-right">
                    {new Intl.NumberFormat('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(
                      changeOperations.reduce((sum, c) => sum + c.montant_usd, 0)
                    )}
                  </td>
                  <td className="text-right">
                    {new Intl.NumberFormat('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(changeOperations.reduce((sum, c) => sum + c.commission, 0))}
                  </td>
                </tr>
              </tbody>
            </table>

            <h2 className="text-lg font-bold text-slate-900 mb-4 mt-8 pb-2 border-b-2 border-blue-500">RAPPORT CDF</h2>

            <table className="print-table w-full mb-6">
              <thead>
                <tr>
                  <th className="text-left">Type</th>
                  <th className="text-right">Nombre</th>
                  <th className="text-right">Volume (CDF)</th>
                  <th className="text-right">Commissions (CDF)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Dépôts</td>
                  <td className="text-right">
                    {transactions.filter((t) => t.type === 'depot' && t.devise === 'CDF').length}
                  </td>
                  <td className="text-right">
                    {new Intl.NumberFormat('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(
                      transactions
                        .filter((t) => t.type === 'depot' && t.devise === 'CDF')
                        .reduce((sum, t) => sum + t.montant, 0)
                    )}
                  </td>
                  <td className="text-right">
                    {new Intl.NumberFormat('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(
                      transactions
                        .filter((t) => t.type === 'depot' && t.devise === 'CDF')
                        .reduce((sum, t) => sum + t.commission, 0)
                    )}
                  </td>
                </tr>
                <tr>
                  <td>Retraits</td>
                  <td className="text-right">
                    {transactions.filter((t) => t.type === 'retrait' && t.devise === 'CDF').length}
                  </td>
                  <td className="text-right">
                    {new Intl.NumberFormat('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(
                      transactions
                        .filter((t) => t.type === 'retrait' && t.devise === 'CDF')
                        .reduce((sum, t) => sum + t.montant, 0)
                    )}
                  </td>
                  <td className="text-right">
                    {new Intl.NumberFormat('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(
                      transactions
                        .filter((t) => t.type === 'retrait' && t.devise === 'CDF')
                        .reduce((sum, t) => sum + t.commission, 0)
                    )}
                  </td>
                </tr>
                <tr>
                  <td>Transferts</td>
                  <td className="text-right">
                    {transactions.filter((t) => t.type === 'transfert' && t.devise === 'CDF').length}
                  </td>
                  <td className="text-right">
                    {new Intl.NumberFormat('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(
                      transactions
                        .filter((t) => t.type === 'transfert' && t.devise === 'CDF')
                        .reduce((sum, t) => sum + t.montant, 0)
                    )}
                  </td>
                  <td className="text-right">
                    {new Intl.NumberFormat('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(
                      transactions
                        .filter((t) => t.type === 'transfert' && t.devise === 'CDF')
                        .reduce((sum, t) => sum + t.commission, 0)
                    )}
                  </td>
                </tr>
                <tr>
                  <td>Paiements</td>
                  <td className="text-right">
                    {transactions.filter((t) => t.type === 'paiement' && t.devise === 'CDF').length}
                  </td>
                  <td className="text-right">
                    {new Intl.NumberFormat('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(
                      transactions
                        .filter((t) => t.type === 'paiement' && t.devise === 'CDF')
                        .reduce((sum, t) => sum + t.montant, 0)
                    )}
                  </td>
                  <td className="text-right">
                    {new Intl.NumberFormat('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(
                      transactions
                        .filter((t) => t.type === 'paiement' && t.devise === 'CDF')
                        .reduce((sum, t) => sum + t.commission, 0)
                    )}
                  </td>
                </tr>
                <tr>
                  <td>Approvisionnements</td>
                  <td className="text-right">{approvisionnements.filter((a) => a.devise === 'CDF').length}</td>
                  <td className="text-right">
                    {new Intl.NumberFormat('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(approvisionnements.filter((a) => a.devise === 'CDF').reduce((sum, a) => sum + a.montant, 0))}
                  </td>
                  <td className="text-right">-</td>
                </tr>
                <tr>
                  <td>Opérations de change</td>
                  <td className="text-right">{changeOperations.length}</td>
                  <td className="text-right">
                    {new Intl.NumberFormat('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(
                      changeOperations.reduce((sum, c) => sum + c.montant_cdf, 0)
                    )}
                  </td>
                  <td className="text-right">-</td>
                </tr>
              </tbody>
            </table>

            <h2 className="text-lg font-bold text-slate-900 mb-4 mt-8">Totaux par devise</h2>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="border border-slate-300 rounded-lg p-4">
                <h3 className="text-base font-bold text-slate-900 mb-3">USD</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Opérations :</span>
                    <span className="font-semibold">{totals.USD.operations}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Volume :</span>
                    <span className="font-semibold">
                      {new Intl.NumberFormat('fr-FR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(totals.USD.volume)}{' '}
                      $
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Commissions :</span>
                    <span className="font-semibold">
                      {new Intl.NumberFormat('fr-FR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(totals.USD.commissions)}{' '}
                      $
                    </span>
                  </div>
                </div>
              </div>

              <div className="border border-slate-300 rounded-lg p-4">
                <h3 className="text-base font-bold text-slate-900 mb-3">CDF</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Opérations :</span>
                    <span className="font-semibold">{totals.CDF.operations}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Volume :</span>
                    <span className="font-semibold">
                      {new Intl.NumberFormat('fr-FR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(totals.CDF.volume)}{' '}
                      FC
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Commissions :</span>
                    <span className="font-semibold">
                      {new Intl.NumberFormat('fr-FR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(totals.CDF.commissions)}{' '}
                      FC
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="print-footer">
            <div className="border-t border-slate-300 pt-4 mt-8">
              <p className="text-xs text-slate-500 text-center">
                Document généré automatiquement par HIMAYA SERVICES
              </p>
            </div>
          </div>
        </div>

        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }

            .print-container,
            .print-container * {
              visibility: visible;
            }

            .print-container {
              display: block !important;
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              background: white;
            }

            .print-content {
              padding: 1.5cm;
              font-family: Arial, sans-serif;
            }

            .print-header {
              margin-bottom: 1cm;
            }

            .print-table {
              border-collapse: collapse;
              width: 100%;
              margin-bottom: 1cm;
            }

            .print-table th,
            .print-table td {
              border: 1px solid #cbd5e1;
              padding: 8px 12px;
              font-size: 10pt;
            }

            .print-table th {
              background-color: #f1f5f9;
              font-weight: 600;
            }

            .print-table tbody tr:nth-child(even) {
              background-color: #f8fafc;
            }

            @page {
              size: A4;
              margin: 1cm;
            }
          }
        `}</style>
      </div>
    );
  }
);

PrintableReport.displayName = 'PrintableReport';
