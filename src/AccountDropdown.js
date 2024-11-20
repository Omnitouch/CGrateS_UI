import React, { useState, useEffect } from 'react';
import { Form, Spinner } from 'react-bootstrap';

const AccountDropdown = ({ cgratesConfig, onSelect }) => {
    const [accounts, setAccounts] = useState([]); // Full list of accounts
    const [filteredAccounts, setFilteredAccounts] = useState([]); // Filtered accounts for display
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState(''); // Track user input

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
                    setAccounts(data.result.map(account => account.ID)); // Store account IDs
                    setFilteredAccounts(data.result.map(account => account.ID)); // Initially display all
                } else {
                    setAccounts([]);
                    setFilteredAccounts([]);
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

    const handleSearchChange = (e) => {
        const term = e.target.value;
        setSearchTerm(term);

        // Filter accounts based on the search term
        setFilteredAccounts(
            accounts.filter(account =>
                account.toLowerCase().includes(term.toLowerCase())
            )
        );
    };

    const handleSelect = (e) => {
        const selected = e.target.value;
        const [tenant, account] = selected.split(':'); // Split into tenant and account
        onSelect({ tenant, account }); // Return as an object
    };

    return (
        <div>
            <Form.Group>
                <Form.Label>Select Account</Form.Label>
                <Form.Control
                    type="text"
                    placeholder="Search accounts..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                />
            </Form.Group>
            {isLoading ? (
                <Spinner animation="border" role="status">
                    <span className="sr-only">Loading accounts...</span>
                </Spinner>
            ) : error ? (
                <p className="text-danger">{error}</p>
            ) : (
                <Form.Group>
                    <Form.Control as="select" onChange={handleSelect} defaultValue="">
                        <option value="" disabled>
                            Select an account
                        </option>
                        {filteredAccounts.map((account, index) => (
                            <option key={index} value={account}>
                                {account}
                            </option>
                        ))}
                    </Form.Control>
                </Form.Group>
            )}
        </div>
    );
};

export default AccountDropdown;
