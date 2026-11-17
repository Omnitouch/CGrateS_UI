import { createContext, useContext, type ReactNode } from 'react';

export interface OcsContextValue {
  /** Base URL for CGrateS JSON-RPC API calls (e.g. "/proxy/ocs1" or "http://127.0.0.1:2080") */
  baseUrl: string | null;
  /** Available CGrateS tenants */
  tenants: string[];
  /** The default tenant to pre-select */
  defaultTenant: string;
  /** Optional display names keyed by tenant; tenants without one show as-is. */
  tenantLabels?: Record<string, string>;
  /** Whether the Engineering nav group is shown */
  showEngineering: boolean;
}

const OcsContext = createContext<OcsContextValue>({
  baseUrl: null,
  tenants: [],
  defaultTenant: '',
  showEngineering: true,
});

export interface OcsProviderProps {
  baseUrl: string | null;
  tenants: string[];
  defaultTenant: string;
  tenantLabels?: Record<string, string>;
  /** Hide the Engineering nav group (sidebar only; routes stay reachable). Defaults to true. */
  showEngineering?: boolean;
  children: ReactNode;
}

export function OcsProvider({ baseUrl, tenants, defaultTenant, tenantLabels, showEngineering = true, children }: OcsProviderProps) {
  return (
    <OcsContext.Provider value={{ baseUrl, tenants, defaultTenant, tenantLabels, showEngineering }}>
      {children}
    </OcsContext.Provider>
  );
}

/** Hook to get the CGrateS base URL from context */
export function useOcsBaseUrl(): string | null {
  return useContext(OcsContext).baseUrl;
}

/** Hook to get available tenants from context */
export function useOcsTenants(): { tenants: string[]; defaultTenant: string; tenantLabel: (t: string) => string } {
  const { tenants, defaultTenant, tenantLabels } = useContext(OcsContext);
  return { tenants, defaultTenant, tenantLabel: t => tenantLabels?.[t] || t };
}

export function useOcsShowEngineering(): boolean {
  return useContext(OcsContext).showEngineering;
}
