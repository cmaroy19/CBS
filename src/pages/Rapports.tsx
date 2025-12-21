import { useState, useRef, useEffect } from 'react';
import { FileText, Calendar, Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useDataStore } from '../stores/dataStore';
import { DateRangeFilter } from '../components/reports/DateRangeFilter';
import { ReportFilters } from '../components/reports/ReportFilters';
import { CurrencyReportSection } from '../components/reports/CurrencyReportSection';
import { PrintableReport } from '../components/reports/PrintableReport';
import type { Transaction, Approvisionnement, ChangeOperation } from '../types';

export function Rapports() {
  const services = useDataStore(state => state.services);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedService, setSelectedService] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [selectedOperationType, setSelectedOperationType] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [approvisionnements, setApprovisionnements] = useState<Approvisionnement[]>([]);
  const [changeOperations, setChangeOperations] = useState<ChangeOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadReportData();
  }, [startDate, endDate, selectedService, selectedCurrency, selectedOperationType]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      let transactionsQuery = supabase
        .from('transactions')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59');

      if (selectedService) {
        transactionsQuery = transactionsQuery.eq('service_id', selectedService);
      }
      if (selectedCurrency) {
        transactionsQuery = transactionsQuery.eq('devise', selectedCurrency);
      }
      if (selectedOperationType && selectedOperationType !== 'approvisionnement' && selectedOperationType !== 'change') {
        transactionsQuery = transactionsQuery.eq('type', selectedOperationType);
      }

      const { data: transactionsData } = await transactionsQuery;

      let approvisionnementsQuery = supabase
        .from('approvisionnements')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59');

      if (selectedService) {
        approvisionnementsQuery = approvisionnementsQuery.eq('service_id', selectedService);
      }
      if (selectedCurrency) {
        approvisionnementsQuery = approvisionnementsQuery.eq('devise', selectedCurrency);
      }

      let changeQuery = supabase
        .from('change_operations')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59');

      const [approvisionnementsResult, changeResult] = await Promise.all([
        selectedOperationType === 'approvisionnement' || !selectedOperationType ? approvisionnementsQuery : Promise.resolve({ data: [] }),
        selectedOperationType === 'change' || !selectedOperationType ? changeQuery : Promise.resolve({ data: [] }),
      ]);

      setTransactions(transactionsData || []);
      setApprovisionnements(approvisionnementsResult.data || []);
      setChangeOperations(changeResult.data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const filterDataByCurrency = (currency: string) => {
    return {
      transactions: transactions.filter(t => t.devise === currency),
      approvisionnements: approvisionnements.filter(a => a.devise === currency),
    };
  };

  const usdData = filterDataByCurrency('USD');
  const cdfData = filterDataByCurrency('CDF');

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center space-x-3">
            <FileText className="w-8 h-8 text-emerald-400" />
            <span>Rapports</span>
          </h1>
          <p className="text-slate-400 mt-1">Analyse détaillée des opérations</p>
        </div>

        <button
          onClick={handlePrint}
          className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
        >
          <Printer className="w-4 h-4" />
          <span>Imprimer</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />

          <ReportFilters
            services={services}
            selectedService={selectedService}
            selectedCurrency={selectedCurrency}
            selectedOperationType={selectedOperationType}
            onServiceChange={setSelectedService}
            onCurrencyChange={setSelectedCurrency}
            onOperationTypeChange={setSelectedOperationType}
          />
        </div>

        <div className="lg:col-span-3 space-y-6">
          {loading ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
              <p className="text-slate-600">Chargement des données...</p>
            </div>
          ) : (
            <>
              <CurrencyReportSection
                currency="USD"
                symbol="$"
                transactions={usdData.transactions}
                approvisionnements={usdData.approvisionnements}
                changeOperations={changeOperations}
              />

              <CurrencyReportSection
                currency="CDF"
                symbol="FC"
                transactions={cdfData.transactions}
                approvisionnements={cdfData.approvisionnements}
                changeOperations={changeOperations}
              />
            </>
          )}
        </div>
      </div>

      <PrintableReport
        ref={printRef}
        startDate={startDate}
        endDate={endDate}
        transactions={transactions}
        approvisionnements={approvisionnements}
        changeOperations={changeOperations}
        services={services}
        selectedService={selectedService}
        selectedCurrency={selectedCurrency}
        selectedOperationType={selectedOperationType}
      />
    </div>
  );
}
