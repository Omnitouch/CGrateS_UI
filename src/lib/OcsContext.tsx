import { createContext, useContext, type ReactNode } from 'react';

export interface OcsContextValue {
  /** Base URL for CGrateS JSON-RPC API calls (e.g. "/proxy/ocs1" or "http://127.0.0.1:2080") */
  baseUrl: string | null;
  /** Available CGrateS tenants */
  tenants: string[];
  /** The default tenant to pre-select */
  defaultTenant: string;
}

const OcsContext = createContext<OcsContextValue>({
  baseUrl: null,
  tenants: [],
  defaultTenant: '',
});

export interface OcsProviderProps {
  baseUrl: string | null;
  tenants: string[];
  defaultTenant: string;
  children: ReactNode;
}

export function OcsProvider({ baseUrl, tenants, defaultTenant, children }: OcsProviderProps) {
  return (
    <OcsContext.Provider value={{ baseUrl, tenants, defaultTenant }}>
      {children}
    </OcsContext.Provider>
  );
}

/** Hook to get the CGrateS base URL from context */
export function useOcsBaseUrl(): string | null {
  return useContext(OcsContext).baseUrl;
}

/** Hook to get available tenants from context */
export function useOcsTenants(): { tenants: string[]; defaultTenant: string } {
  const { tenants, defaultTenant } = useContext(OcsContext);
  return { tenants, defaultTenant };
}
