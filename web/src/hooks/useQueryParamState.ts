import { useCallback, useEffect, useState } from 'react';

function readQueryParam(key: string, defaultValue: string): string {
  if (typeof window === 'undefined') return defaultValue;
  const value = new URLSearchParams(window.location.search).get(key);
  return value ?? defaultValue;
}

export function useQueryParamState(key: string, defaultValue: string) {
  const [value, setValue] = useState<string>(() => readQueryParam(key, defaultValue));

  useEffect(() => {
    const onPopState = () => setValue(readQueryParam(key, defaultValue));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [key, defaultValue]);

  const updateValue = useCallback(
    (next: string | null) => {
      const params = new URLSearchParams(window.location.search);
      if (next === null || next === '' || next === defaultValue) {
        params.delete(key);
      } else {
        params.set(key, next);
      }

      const nextSearch = params.toString();
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
      window.history.replaceState(window.history.state, '', nextUrl);
      setValue(readQueryParam(key, defaultValue));
    },
    [key, defaultValue],
  );

  return [value, updateValue] as const;
}
