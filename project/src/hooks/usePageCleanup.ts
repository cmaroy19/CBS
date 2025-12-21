import { useEffect, useRef } from 'react';

/**
 * Hook pour gérer le cleanup des pages lors de la navigation
 * Empêche les fetch en cours de continuer après démontage
 */
export function usePageCleanup(pageName: string) {
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController>(new AbortController());

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      abortControllerRef.current.abort();
    };
  }, []);

  return {
    isMounted: () => isMountedRef.current,
    signal: abortControllerRef.current.signal,
  };
}
