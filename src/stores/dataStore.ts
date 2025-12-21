import { create } from 'zustand';
import type {
  Service,
  Transaction,
  Approvisionnement,
  ChangeOperation,
  RealtimeBalance
} from '../types';

interface DataState {
  services: Service[];
  transactions: Transaction[];
  approvisionnements: Approvisionnement[];
  changeOperations: ChangeOperation[];
  realtimeBalance: RealtimeBalance | null;

  setServices: (services: Service[]) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setApprovisionnements: (approvisionnements: Approvisionnement[]) => void;
  setChangeOperations: (changeOperations: ChangeOperation[]) => void;
  setRealtimeBalance: (balance: RealtimeBalance | null) => void;

  addService: (service: Service) => void;
  updateService: (id: string, service: Partial<Service>) => void;

  addTransaction: (transaction: Transaction) => void;
  addApprovisionnement: (appro: Approvisionnement) => void;
  addChangeOperation: (change: ChangeOperation) => void;
}

export const useDataStore = create<DataState>((set, get) => ({
  services: [],
  transactions: [],
  approvisionnements: [],
  changeOperations: [],
  realtimeBalance: null,

  setServices: (services) => {
    const current = get().services;
    if (JSON.stringify(current) !== JSON.stringify(services)) {
      set({ services });
    }
  },
  setTransactions: (transactions) => {
    const current = get().transactions;
    if (JSON.stringify(current) !== JSON.stringify(transactions)) {
      set({ transactions });
    }
  },
  setApprovisionnements: (approvisionnements) => {
    const current = get().approvisionnements;
    if (JSON.stringify(current) !== JSON.stringify(approvisionnements)) {
      set({ approvisionnements });
    }
  },
  setChangeOperations: (changeOperations) => {
    const current = get().changeOperations;
    if (JSON.stringify(current) !== JSON.stringify(changeOperations)) {
      set({ changeOperations });
    }
  },
  setRealtimeBalance: (realtimeBalance) => {
    const current = get().realtimeBalance;
    if (JSON.stringify(current) !== JSON.stringify(realtimeBalance)) {
      set({ realtimeBalance });
    }
  },

  addService: (service) => set((state) => ({
    services: [service, ...state.services],
  })),

  updateService: (id, updates) => set((state) => ({
    services: state.services.map((s) =>
      s.id === id ? { ...s, ...updates } : s
    ),
  })),

  addTransaction: (transaction) => set((state) => ({
    transactions: [transaction, ...state.transactions],
  })),

  addApprovisionnement: (appro) => set((state) => ({
    approvisionnements: [appro, ...state.approvisionnements],
  })),

  addChangeOperation: (change) => set((state) => ({
    changeOperations: [change, ...state.changeOperations],
  })),
}));
