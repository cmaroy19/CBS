import type { Devise, TypePortefeuille } from '../types';

export interface DepotTransactionParams {
  montant: number;
  devise: Devise;
  commission: number;
  service_id: string;
  type_portefeuille: TypePortefeuille;
  info_client?: string;
}

export interface RetraitTransactionParams {
  montant: number;
  devise: Devise;
  commission: number;
  service_id: string;
  type_portefeuille: TypePortefeuille;
  info_client?: string;
}

export interface ApprovisionnementParams {
  montant: number;
  devise: Devise;
  type_operation: 'entree' | 'sortie';
  type_portefeuille: TypePortefeuille;
  service_id?: string;
  description?: string;
}

export interface ChangeParams {
  montant_source: number;
  devise_source: Devise;
  montant_destination: number;
  devise_destination: Devise;
  commission: number;
  taux: number;
}

export interface RetraitMixteParams {
  montant_total_usd: number;
  cash_usd_disponible: number;
  taux_usd_cdf: number;
  commission: number;
  service_id: string;
  info_client?: string;
}

export class TransactionBuilders {
  static buildDepot(params: DepotTransactionParams) {
    const { montant, devise, commission, service_id, type_portefeuille, info_client } = params;

    return {
      header: {
        type_operation: 'depot' as const,
        devise_reference: devise,
        montant_total: montant,
        description: `Dépôt ${type_portefeuille} - ${devise}`,
        info_client,
      },
      lines: [
        {
          ligne_numero: 1,
          type_portefeuille: 'cash' as TypePortefeuille,
          devise,
          sens: 'debit' as const,
          montant,
          description: 'Entrée Cash',
        },
        {
          ligne_numero: 2,
          type_portefeuille,
          service_id: type_portefeuille === 'virtuel' ? service_id : undefined,
          devise,
          sens: 'credit' as const,
          montant,
          description: `Crédit ${type_portefeuille} ${type_portefeuille === 'virtuel' ? 'service' : 'client'}`,
        },
      ],
    };
  }

  static buildRetrait(params: RetraitTransactionParams) {
    const { montant, devise, commission, service_id, type_portefeuille, info_client } = params;

    return {
      header: {
        type_operation: 'retrait' as const,
        devise_reference: devise,
        montant_total: montant,
        description: `Retrait ${type_portefeuille} - ${devise}`,
        info_client,
      },
      lines: [
        {
          ligne_numero: 1,
          type_portefeuille,
          service_id: type_portefeuille === 'virtuel' ? service_id : undefined,
          devise,
          sens: 'debit' as const,
          montant,
          description: `Débit ${type_portefeuille} ${type_portefeuille === 'virtuel' ? 'service' : 'client'}`,
        },
        {
          ligne_numero: 2,
          type_portefeuille: 'cash' as TypePortefeuille,
          devise,
          sens: 'credit' as const,
          montant,
          description: 'Sortie Cash',
        },
      ],
    };
  }

  static buildApprovisionnement(params: ApprovisionnementParams) {
    const { montant, devise, type_operation, type_portefeuille, service_id, description } = params;

    const isEntree = type_operation === 'entree';

    const lines = [
      {
        ligne_numero: 1,
        type_portefeuille: 'cash' as TypePortefeuille,
        devise,
        sens: (isEntree ? 'debit' : 'credit') as const,
        montant,
        description: isEntree ? 'Entrée Cash' : 'Sortie Cash',
      },
    ];

    if (type_portefeuille === 'virtuel' && service_id) {
      lines.push({
        ligne_numero: 2,
        type_portefeuille: 'virtuel' as TypePortefeuille,
        service_id,
        devise,
        sens: (isEntree ? 'credit' : 'debit') as const,
        montant,
        description: isEntree ? 'Crédit virtuel service' : 'Débit virtuel service',
      });
    } else {
      lines.push({
        ligne_numero: 2,
        type_portefeuille: 'cash' as TypePortefeuille,
        devise,
        sens: (isEntree ? 'credit' : 'debit') as const,
        montant,
        description: isEntree ? 'Ajustement Cash' : 'Ajustement Cash',
      });
    }

    return {
      header: {
        type_operation: 'approvisionnement' as const,
        devise_reference: devise,
        montant_total: montant,
        description: description || `Approvisionnement ${type_operation} ${type_portefeuille} - ${devise}`,
      },
      lines,
    };
  }

  static buildChange(params: ChangeParams) {
    const {
      montant_source,
      devise_source,
      montant_destination,
      devise_destination,
      commission,
      taux,
    } = params;

    return {
      header: {
        type_operation: 'change' as const,
        devise_reference: devise_source,
        montant_total: montant_source,
        description: `Change ${devise_source} vers ${devise_destination} (taux: ${taux})`,
        taux_change: taux,
        paire_devises: `${devise_source}/${devise_destination}`,
      },
      lines: [
        {
          ligne_numero: 1,
          type_portefeuille: 'cash' as TypePortefeuille,
          devise: devise_source,
          sens: 'debit' as const,
          montant: montant_source,
          description: `Débit ${devise_source}`,
        },
        {
          ligne_numero: 2,
          type_portefeuille: 'cash' as TypePortefeuille,
          devise: devise_destination,
          sens: 'credit' as const,
          montant: montant_destination - commission,
          description: `Crédit ${devise_destination}`,
        },
        {
          ligne_numero: 3,
          type_portefeuille: 'cash' as TypePortefeuille,
          devise: devise_source,
          sens: 'credit' as const,
          montant: commission,
          description: 'Commission change',
        },
      ],
    };
  }

  static buildTransfert(params: {
    montant: number;
    devise: Devise;
    service_source_id: string;
    service_destination_id: string;
    description?: string;
  }) {
    const { montant, devise, service_source_id, service_destination_id, description } = params;

    return {
      header: {
        type_operation: 'transfert' as const,
        devise_reference: devise,
        montant_total: montant,
        description: description || `Transfert entre services - ${devise}`,
      },
      lines: [
        {
          ligne_numero: 1,
          type_portefeuille: 'virtuel' as TypePortefeuille,
          service_id: service_source_id,
          devise,
          sens: 'debit' as const,
          montant,
          description: 'Débit service source',
        },
        {
          ligne_numero: 2,
          type_portefeuille: 'virtuel' as TypePortefeuille,
          service_id: service_destination_id,
          devise,
          sens: 'credit' as const,
          montant,
          description: 'Crédit service destination',
        },
      ],
    };
  }

  static buildRetraitMixte(params: RetraitMixteParams) {
    const {
      montant_total_usd,
      cash_usd_disponible,
      taux_usd_cdf,
      commission,
      service_id,
      info_client,
    } = params;

    const montant_usd_restant = montant_total_usd - cash_usd_disponible;
    const montant_cdf_equivalent = montant_usd_restant * taux_usd_cdf;

    if (montant_usd_restant <= 0) {
      return {
        header: {
          type_operation: 'retrait' as const,
          devise_reference: 'USD' as Devise,
          montant_total: montant_total_usd,
          description: `Retrait USD complet`,
          info_client,
        },
        lines: [
          {
            ligne_numero: 1,
            type_portefeuille: 'virtuel' as TypePortefeuille,
            service_id,
            devise: 'USD' as Devise,
            sens: 'credit' as const,
            montant: montant_total_usd,
            description: 'Crédit virtuel USD',
          },
          {
            ligne_numero: 2,
            type_portefeuille: 'cash' as TypePortefeuille,
            devise: 'USD' as Devise,
            sens: 'credit' as const,
            montant: montant_total_usd,
            description: 'Sortie Cash USD',
          },
          {
            ligne_numero: 3,
            type_portefeuille: 'cash' as TypePortefeuille,
            devise: 'USD' as Devise,
            sens: 'debit' as const,
            montant: montant_total_usd,
            description: 'Contrepartie équilibrage',
          },
          {
            ligne_numero: 4,
            type_portefeuille: 'cash' as TypePortefeuille,
            devise: 'USD' as Devise,
            sens: 'credit' as const,
            montant: commission,
            description: 'Commission retrait',
          },
        ],
      };
    }

    return {
      header: {
        type_operation: 'retrait' as const,
        devise_reference: 'USD' as Devise,
        montant_total: montant_total_usd,
        description: `Retrait mixte USD/CDF (${cash_usd_disponible.toFixed(2)} USD + ${montant_cdf_equivalent.toFixed(0)} CDF au taux ${taux_usd_cdf})`,
        info_client,
        taux_change: taux_usd_cdf,
        paire_devises: 'USD/CDF',
      },
      lines: [
        {
          ligne_numero: 1,
          type_portefeuille: 'virtuel' as TypePortefeuille,
          service_id,
          devise: 'USD' as Devise,
          sens: 'credit' as const,
          montant: montant_total_usd,
          description: 'Crédit virtuel USD (retrait client)',
        },
        {
          ligne_numero: 2,
          type_portefeuille: 'cash' as TypePortefeuille,
          devise: 'USD' as Devise,
          sens: 'credit' as const,
          montant: cash_usd_disponible,
          description: `Sortie Cash USD (${cash_usd_disponible.toFixed(2)} USD disponibles)`,
        },
        {
          ligne_numero: 3,
          type_portefeuille: 'cash' as TypePortefeuille,
          devise: 'CDF' as Devise,
          sens: 'credit' as const,
          montant: montant_cdf_equivalent,
          description: `Sortie Cash CDF (équiv. ${montant_usd_restant.toFixed(2)} USD au taux ${taux_usd_cdf})`,
        },
        {
          ligne_numero: 4,
          type_portefeuille: 'cash' as TypePortefeuille,
          devise: 'USD' as Devise,
          sens: 'debit' as const,
          montant: montant_total_usd + commission,
          description: 'Contrepartie équilibrage USD',
        },
        {
          ligne_numero: 5,
          type_portefeuille: 'cash' as TypePortefeuille,
          devise: 'CDF' as Devise,
          sens: 'debit' as const,
          montant: montant_cdf_equivalent,
          description: 'Contrepartie équilibrage CDF',
        },
        {
          ligne_numero: 6,
          type_portefeuille: 'cash' as TypePortefeuille,
          devise: 'USD' as Devise,
          sens: 'credit' as const,
          montant: commission,
          description: 'Commission retrait',
        },
      ],
    };
  }
}

export const transactionBuilders = TransactionBuilders;
