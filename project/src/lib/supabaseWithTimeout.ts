import { supabase } from './supabase';

const DEFAULT_TIMEOUT = 15000;

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number = DEFAULT_TIMEOUT): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new TimeoutError(`Requête expirée après ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

export const supabaseWithTimeout = {
  from: (table: string) => {
    const query = supabase.from(table);

    return {
      select: (...args: Parameters<typeof query.select>) => {
        const selectQuery = query.select(...args);
        return {
          ...selectQuery,
          then: (resolve: any, reject: any) =>
            withTimeout(selectQuery.then(resolve, reject)).then(resolve, reject),
        };
      },
      insert: (...args: Parameters<typeof query.insert>) => {
        const insertQuery = query.insert(...args);
        return {
          ...insertQuery,
          then: (resolve: any, reject: any) =>
            withTimeout(insertQuery.then(resolve, reject)).then(resolve, reject),
        };
      },
      update: (...args: Parameters<typeof query.update>) => {
        const updateQuery = query.update(...args);
        return {
          ...updateQuery,
          then: (resolve: any, reject: any) =>
            withTimeout(updateQuery.then(resolve, reject)).then(resolve, reject),
        };
      },
      delete: (...args: Parameters<typeof query.delete>) => {
        const deleteQuery = query.delete(...args);
        return {
          ...deleteQuery,
          then: (resolve: any, reject: any) =>
            withTimeout(deleteQuery.then(resolve, reject)).then(resolve, reject),
        };
      },
    };
  },

  rpc: (fn: string, args?: any, options?: any) => {
    return withTimeout(supabase.rpc(fn, args, options));
  },

  auth: supabase.auth,
  channel: supabase.channel.bind(supabase),
};
