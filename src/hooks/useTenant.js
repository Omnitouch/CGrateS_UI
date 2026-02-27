import { useState, useEffect } from 'react';

/**
 * Custom hook for managing tenant state with automatic sync to cgratesConfig.
 * Solves the problem where components initialize before config is loaded.
 *
 * @param {Object} cgratesConfig - The CGrateS configuration object
 * @returns {Object} { tenant, setTenant, tenantList }
 */
export function useTenant(cgratesConfig) {
  const [tenant, setTenant] = useState('');

  // Sync tenant when config changes or on initial load
  useEffect(() => {
    if (cgratesConfig?.tenants) {
      const defaultTenant = cgratesConfig.tenants.split(';')[0];
      setTenant(defaultTenant);
    }
  }, [cgratesConfig?.tenants]);

  const tenantList = cgratesConfig?.tenants?.split(';').filter(Boolean) || [];

  return { tenant, setTenant, tenantList };
}

export default useTenant;
