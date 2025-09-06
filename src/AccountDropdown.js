import React, { useState, useEffect } from 'react';
import Select from 'react-select';

const AccountDropdown = ({ cgratesConfig, tenant, onSelect }) => {
  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [value, setValue] = useState(null);

  useEffect(() => {
    if (!tenant) return;
    let cancelled = false;
    const controller = new AbortController();

    const fetchAccounts = async () => {
      setIsLoading(true);
      setError('');
      try {
        const query = {
          method: 'APIerSv2.GetAccounts',
          params: [
            {
              Tenant: tenant,     // <-- use current tenant
              Offset: 0,
              Limit: 1000,
            },
          ],
          id: 1,
        };

        const res = await fetch(`${cgratesConfig.url}/jsonrpc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(query),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        const ids = Array.isArray(data?.result)
          ? data.result
              .map(a => a?.ID ?? a?.Id ?? a?.id ?? a?.Account ?? a?.account)
              .filter(Boolean)
          : [];

        const opts = ids.map(id => ({ value: String(id), label: String(id) }));

        if (!cancelled) {
          setOptions(opts);
          setValue(null);     // clear selection on tenant change
          onSelect?.(null);   // propagate clear to parent
        }
      } catch (e) {
        if (!cancelled && e.name !== 'AbortError') {
          console.error('Error fetching accounts:', e);
          setError('Failed to fetch accounts.');
          setOptions([]);
          setValue(null);
          onSelect?.(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchAccounts();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [cgratesConfig.url, tenant, onSelect]);

  const handleSelect = (selected) => {
    setValue(selected);
    if (!selected) {
      onSelect?.(null);
      return;
    }

    // Parse "tenant:account" if present; otherwise fall back to current tenant
    const raw = String(selected.value);
    const [idTenant, ...rest] = raw.split(':');
    const hasSeparator = raw.includes(':');
    const parsedTenant = hasSeparator ? idTenant : tenant;
    const parsedAccount = hasSeparator ? rest.join(':') : raw;

    onSelect?.({ tenant: parsedTenant, account: parsedAccount });
  };

  return (
    <div className="w-100">
      <label htmlFor="account-select" className="form-label">Account</label>
      {isLoading ? (
        <p>Loading accounts...</p>
      ) : error ? (
        <p className="text-danger">{error}</p>
      ) : (
        <Select
          inputId="account-select"
          options={options}
          value={value}
          isClearable
          isSearchable
          placeholder="Search or select an account..."
          onChange={handleSelect}
          noOptionsMessage={() => 'No accounts found'}
        />
      )}
    </div>
  );
};

export default AccountDropdown;
