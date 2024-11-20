import React, { useState, useEffect } from 'react';
import Select from 'react-select';

const AccountDropdown = ({ cgratesConfig, onSelect }) => {
    const [accounts, setAccounts] = useState([]); // Full list of accounts
    const [options, setOptions] = useState([]); // Options for the dropdown
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchAccounts = async () => {
            setIsLoading(true);
            try {
                const query = {
                    method: 'APIerSv2.GetAccounts',
                    params: [
                        {
                            Tenant: cgratesConfig.tenants.split(';')[0],
                            Offset: 0,
                            Limit: 1000, // Adjust the limit as per your requirement
                        },
                    ],
                };

                const response = await fetch(cgratesConfig.url + '/jsonrpc', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(query),
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();

                if (data && data.result) {
                    const accountIds = data.result.map(account => account.ID);
                    setAccounts(accountIds);
                    setOptions(accountIds.map(id => ({ value: id, label: id }))); // Prepare options for dropdown
                } else {
                    setAccounts([]);
                    setOptions([]);
                }
            } catch (error) {
                console.error('Error fetching accounts:', error);
                setError('Failed to fetch accounts.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchAccounts();
    }, [cgratesConfig]);

    const handleSelect = (selectedOption) => {
        if (selectedOption) {
            const [tenant, account] = selectedOption.value.split(':'); // Split into tenant and account
            onSelect({ tenant, account }); // Return as an object
        }
    };

    return (
        <div>
            <label htmlFor="account-select">Select Account</label>
            {isLoading ? (
                <p>Loading accounts...</p>
            ) : error ? (
                <p className="text-danger">{error}</p>
            ) : (
                <Select
                    id="account-select"
                    options={options}
                    isSearchable
                    placeholder="Search or select an account..."
                    onChange={handleSelect}
                />
            )}
        </div>
    );
};

export default AccountDropdown;
