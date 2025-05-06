import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Table, Pagination, Modal, Spinner } from 'react-bootstrap';

const GetAccounts = ({ cgratesConfig }) => {
  const firstTenant = (cgratesConfig.tenants || '').split(';')[0] || '';
  const [searchParams, setSearchParams] = useState({
    tenant: firstTenant,
    account: '',
  });

  const [results, setResults] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // Default 10 records per page
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [balanceModal, setBalanceModal] = useState(false); // New modal for balance details
  const [actionTriggerModal, setActionTriggerModal] = useState(false); // New modal for action trigger details
  const [selectedRowData, setSelectedRowData] = useState(null);
  const [selectedBalance, setSelectedBalance] = useState(null); // Store clicked balance data
  const [selectedActionTrigger, setSelectedActionTrigger] = useState(null); // Store clicked action trigger data
  const [accountDetails, setAccountDetails] = useState(null); // State to store detailed account data
  const [actionPlans, setActionPlans] = useState([]); // State to store action plans
  const [modalLoading, setModalLoading] = useState(false); // Loading state for modal API call
  const [actions, setActions] = useState([]); // Actions available for the selected account
  const [selectedAction, setSelectedAction] = useState(''); // Selected action for execution
  const [showConfirm, setShowConfirm] = useState(false); // State to show confirmation alert

  useEffect(() => {
    if (searchParams.tenant) {
      fetchActions(searchParams.tenant);
    }
  }, [searchParams.tenant]);

  useEffect(() => {
    if (searchParams.tenant) {
      fetchResults(1); // Fetch results for the first page whenever the tenant changes
    }
  }, [searchParams.tenant]);

  useEffect(() => {
    let intervalId;

    if (showModal && selectedRowData) {
      const [tenant, account] = selectedRowData.ID.split(':');

      // Set up an interval to refresh account details every 5 seconds
      intervalId = setInterval(() => {
        fetchAccountDetails(tenant, account, true); // Only fetch account details during auto-refresh
      }, 5000);
    }

    // Clear the interval when the modal is closed or the component unmounts
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [showModal, selectedRowData]);

  const fetchAccountDetails = async (tenant, account, autoRefresh = false) => {
    if (!autoRefresh) {
      setModalLoading(true); // Show loading only if not auto-refreshing
    }

    const accountDetailsQuery = {
      method: 'APIerSv2.GetAccounts',
      params: [{
        Tenant: tenant,
        AccountIDs: [account],
        Offset: 0,
        Limit: 999,
        Filter: null
      }],
      id: 1
    };

    try {
      const response = await fetch(cgratesConfig.url + '/jsonrpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(accountDetailsQuery),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const accountDetailsData = await response.json();

      if (accountDetailsData && accountDetailsData.result) {
        setAccountDetails((prevDetails) => ({
          ...prevDetails,
          ...accountDetailsData.result[0], // Update only account details
        }));
      } else {
        setAccountDetails(null);
      }
    } catch (error) {
      console.error('Error fetching account details:', error);
    } finally {
      if (!autoRefresh) {
        setModalLoading(false); // End loading only if not auto-refreshing
      }
    }
  };

  const fetchActionPlans = async (tenant, account) => {
    const actionPlanQuery = {
      method: 'ApierV2.GetAccountActionPlan',
      params: [{
        Account: account,
        Tenant: tenant,
      }],
      id: 2,
    };

    console.log(`Fetching action plans for account: ${account} in tenant: ${tenant}`);

    try {
      const response = await fetch(cgratesConfig.url + '/jsonrpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(actionPlanQuery),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Action plans fetched successfully:', data);

      if (data && data.result) {
        return data.result; // Return the fetched action plans
      } else {
        return [];
      }
    } catch (error) {
      console.error('Error fetching action plans:', error);
      return [];
    }
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setSearchParams({ ...searchParams, [name]: value });
  };

  const fetchResults = async (page = 1) => {
    setIsLoading(true);
    const offset = (page - 1) * itemsPerPage; // Calculate offset based on page number

    const newQuery = {
      method: 'APIerSv2.GetAccounts',
      params: [{
        Tenant: searchParams.tenant,
        AccountIDs: searchParams.account ? [searchParams.account] : null,
        Offset: offset,
        Limit: itemsPerPage,
        Filter: null,
      }],
      id: 1,
    };

    try {
      const response = await fetch(cgratesConfig.url + '/jsonrpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newQuery),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Data fetched successfully:', data);

      if (data && data.result) {
        setResults(data.result); // Store the fetched results
        setCurrentPage(page); // Update the current page
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };


  const fetchActions = async (tenant) => {
    const actionsQuery = {
      method: 'APIerSv2.GetActions',
      params: [{
        Tenant: tenant
      }],
      id: 2
    };

    console.log(`Fetching actions for tenant: ${tenant}`);

    try {
      const response = await fetch(cgratesConfig.url + '/jsonrpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(actionsQuery),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Actions fetched successfully:', data);

      if (data && data.result) {
        const actionKeys = Object.keys(data.result); // Extract action keys to use as action names
        setActions(actionKeys); // Store available actions for the tenant
      } else {
        setActions([]);
      }
    } catch (error) {
      console.error('Error fetching actions:', error);
      setActions([]);
    }
  };

  const executeAction = async (tenant, account, actionId) => {
    const actionQuery = {
      method: 'APIerSv1.ExecuteAction',
      params: [{
        Tenant: tenant,
        Account: account,
        ActionsId: actionId
      }],
      id: 4
    };

    console.log(`Executing action ${actionId} for account: ${account}`);

    try {
      const response = await fetch(cgratesConfig.url + '/jsonrpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(actionQuery),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Action executed successfully:', data);

      // Re-fetch account details to update balances in the open modal
      fetchAccountDetails(tenant, account);
    } catch (error) {
      console.error('Error executing action:', error);
    }
  };

  const removeAccount = async (tenant, account) => {
    const removeQuery = {
      method: 'ApierV1.RemoveAccount',
      params: [{
        Tenant: tenant,
        Account: account,
        ReloadScheduler: true
      }],
      id: 3
    };

    console.log(`Removing account: ${account}`);

    try {
      const response = await fetch(cgratesConfig.url + '/jsonrpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(removeQuery),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Account removed successfully:', data);

      // Refresh results after removing an account
      fetchResults(currentPage);
      handleCloseModal(); // Close the modal after deleting the account
    } catch (error) {
      console.error('Error removing account:', error);
    }
  };

  const updateAccountState = async (tenant, account, disabled) => {
    const updateStateQuery = {
      method: 'ApierV2.SetAccount',
      params: [{
        Tenant: tenant,
        Account: account,
        ReloadScheduler: true,
        ExtraOptions: {
          Disabled: disabled, // Set Disabled state
        },
      }],
      id: 7,
    };

    console.log(`Updating account state for ${account} to Disabled: ${disabled}`);

    try {
      const response = await fetch(cgratesConfig.url + '/jsonrpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateStateQuery),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Account state updated successfully:', data);

      // Refresh account details
      fetchAccountDetails(tenant, account);
    } catch (error) {
      console.error('Error updating account state:', error);
    }
  };

  const updateAccountNegative = async (tenant, account, allowNegative) => {
    const updateNegativeQuery = {
      method: 'ApierV2.SetAccount',
      params: [{
        Tenant: tenant,
        Account: account,
        ReloadScheduler: true,
        ExtraOptions: {
          AllowNegative: allowNegative, // Set AllowNegative state
        },
      }],
      id: 8,
    };

    console.log(`Updating account AllowNegative for ${account} to: ${allowNegative}`);

    try {
      const response = await fetch(cgratesConfig.url + '/jsonrpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateNegativeQuery),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Account AllowNegative updated successfully:', data);

      // Refresh account details
      fetchAccountDetails(tenant, account);
    } catch (error) {
      console.error('Error updating AllowNegative:', error);
    }
  };


  const removeActionPlan = async (tenant, actionPlanId) => {
    const removeActionPlanQuery = {
      method: 'APIerSv1.RemoveActionPlan',
      params: [{
        Tenant: tenant,
        Id: actionPlanId
      }],
      id: 6
    };

    console.log(`Removing action plan: ${actionPlanId}`);

    try {
      const response = await fetch(cgratesConfig.url + '/jsonrpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(removeActionPlanQuery),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Action plan removed successfully:', data);

      // Refresh modal content after removing the action plan
      if (selectedRowData) {
        const [tenant, account] = selectedRowData.ID.split(':');
        fetchAccountDetails(tenant, account); // Refresh account details
      }
    } catch (error) {
      console.error('Error removing action plan:', error);
    }
  };

  const removeActionTrigger = async (tenant, account, actionTrigger, UniqueID) => {
    const removeActionTriggerQuery = {
      method: 'APIerSv1.RemoveAccountActionTriggers',
      params: [{
        Tenant: tenant,
        Account: account,
        UniqueID: UniqueID,
      }],
      id: 6
    };

    console.log(`Removing actionTrigger: ${actionTrigger}`);

    try {
      const response = await fetch(cgratesConfig.url + '/jsonrpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(removeActionTriggerQuery),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Action Trigger removed successfully:', data);

      // Refresh modal content after removing the action plan
      if (selectedRowData) {
        const [tenant, account] = selectedRowData.ID.split(':');
        fetchAccountDetails(tenant, account); // Refresh account details
      }
    } catch (error) {
      console.error('Error removing action actionTrigger:', error);
    }
  };

  const resetActionTrigger = async (tenant, account, actionTrigger, UniqueID) => {
    const resetActionTriggerQuery = {
      method: 'APIerSv1.ResetAccountActionTriggers',
      params: [{
        Tenant: tenant,
        Account: account,
        UniqueID: UniqueID,
        Executed: false
      }],
      id: 6
    };

    console.log(`Removing actionTrigger: ${actionTrigger}`);

    try {
      const response = await fetch(cgratesConfig.url + '/jsonrpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resetActionTriggerQuery),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Action Trigger reset successfully:', data);

      // Refresh modal content after removing the action plan
      if (selectedRowData) {
        const [tenant, account] = selectedRowData.ID.split(':');
        fetchAccountDetails(tenant, account); // Refresh account details
      }
    } catch (error) {
      console.error('Error resetting action actionTrigger:', error);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setCurrentPage(1); // Reset to the first page
    fetchResults(1);
  };

  const handleRowClick = async (rowData) => {
    setSelectedRowData(rowData);
    const [tenant, account] = rowData.ID.split(':');
    setAccountDetails({ Tenant: tenant, Account: account, ...rowData }); // Set the tenant and account details in state

    // Fetch actions before opening the modal
    await fetchActions(tenant);

    // Fetch action plans and update the state
    const actionPlans = await fetchActionPlans(tenant, account);
    setActionPlans(actionPlans);

    setShowModal(true);
    fetchAccountDetails(tenant, account); // Fetch additional account details
  };


  const handleActionSelect = (event) => {
    setSelectedAction(event.target.value);
  };

  const handleExecuteActionClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmExecuteAction = () => {
    if (selectedRowData && selectedAction) {
      const [tenant, account] = selectedRowData.ID.split(':');
      executeAction(tenant, account, selectedAction);
    }
    setShowConfirm(false);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedRowData(null);
    setAccountDetails(null); // Clear account details when modal is closed
    setActions([]); // Clear actions when modal is closed
    setSelectedAction(''); // Clear selected action
    setShowConfirm(false); // Hide confirmation alert
  };


  const handlePageChange = (pageNumber) => {
    fetchResults(pageNumber);
  };

  function formatExpiration(expirationDateStr) {
    // Convert to date
    const expirationDate = new Date(expirationDateStr);
    const now = new Date();
    // Check if the date is "0001-01-01T00:00:00Z"
    if (expirationDate.toISOString() === "0001-01-01T00:00:00.000Z") {
      return {
        prettyDate: "No date set",
        timeUntil: "Never",
      };
    }

    // Format the date
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    };
    const prettyDate = expirationDate.toLocaleString('en-US', options);

    // Calculate time difference
    const diffInSeconds = Math.floor((expirationDate - now) / 1000);
    let timeUntil;

    if (diffInSeconds < 60) {
      timeUntil = `${diffInSeconds} seconds`;
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      timeUntil = `${minutes} minutes`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      timeUntil = `${hours} hours`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      timeUntil = `${days} days`;
    } else {
      const weeks = Math.floor(diffInSeconds / 604800);
      timeUntil = `${weeks} weeks`;
    }

    return { prettyDate, timeUntil };
  }

  // Utility function to format Usage based on ToR
  const formatUsage = (usage, tor) => {
    if (tor === '*data') {
      const mb = (usage / (1024 * 1024)).toFixed(2);
      return (
        <>
          {`${mb} MB`}
          <br />
          {`(${usage} bytes)`}
        </>
      );
    } else if (tor === '*voice') {
      const totalSeconds = Math.floor(usage / 1e9); // Convert nanoseconds to seconds
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const timeFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      return (
        <>
          {timeFormatted}
          <br />
          {`(${usage} ns)`}
        </>
      );
    }
    return usage; // Default case, no formatting
  };


  // Function to render the balance map by category
  const renderBalanceTable = (balanceMap, category) => {
    if (!balanceMap || !balanceMap[category]) return null;

    const handleRemoveBalance = async (balance) => {
      if (!window.confirm(`Are you sure you want to remove the balance with ID: ${balance.ID}?`)) {
        return;
      }

      const removeBalanceQuery = {
        method: 'APIerSv1.RemoveBalances',
        params: [{
          Tenant: searchParams.tenant,
          Account: selectedRowData.ID.split(':')[1], // Account ID
          BalanceType: category, // Balance category (*monetary, *data, etc.)
          Balance: {
            ID: balance.ID, // Balance ID to remove
          },
          ActionExtraData: null,
          Cdrlog: true, // Enable CDR logging
        }],
        id: 6,
      };

      console.log(`Removing balance ID: ${balance.ID} for account: ${selectedRowData.ID.split(':')[1]}`);

      try {
        const response = await fetch(cgratesConfig.url + '/jsonrpc', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(removeBalanceQuery),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Balance removed successfully:', data);

        // Refresh account details to reflect the removal
        const [tenant, account] = selectedRowData.ID.split(':');
        fetchAccountDetails(tenant, account);
      } catch (error) {
        console.error('Error removing balance:', error);
      }
    };

    return (
      <Table striped bordered hover>
        <thead>
          <tr>
            <th>ID</th>
            <th>Value</th>
            <th>Expiration Date</th>
            <th>Weight</th>
            <th>Blocker</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {balanceMap[category].map((balance, index) => {
            const { prettyDate, timeUntil } = formatExpiration(balance.ExpirationDate);
            return (
              <tr key={index} style={{ cursor: 'pointer' }}>
                <td>{balance.ID}</td>
                <td>{formatUsage(balance.Value, category)}</td>
                <td>
                  {prettyDate}
                  <br />
                  <span style={{ color: 'gray' }}>Time remaining: {timeUntil}</span>
                </td>
                <td>{balance.Weight}</td>
                <td>{balance.Blocker ? 'Yes' : 'No'}</td>
                <td>
                  <Button variant="success" onClick={() => handleBalanceClick(balance)}>
                    View Balance
                  </Button>
                  <br />
                  <Button variant="danger" onClick={() => handleRemoveBalance(balance)}>
                    Remove Balance
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    );
  };

  const handleBalanceClick = (balance) => {
    setSelectedBalance(balance);
    setBalanceModal(true); // Show balance modal with clicked balance details
  };

  const handleCloseBalanceModal = () => {
    setBalanceModal(false);
    setSelectedBalance(null); // Clear balance details when modal is closed
  };

  const handleActionTriggerClick = (trigger) => {
    setSelectedActionTrigger(trigger);
    setActionTriggerModal(true); // Show balance modal with clicked balance details
  };

  const handleCloseActionTriggerModal = () => {
    setActionTriggerModal(false);
    setSelectedActionTrigger(null); // Clear balance details when modal is closed
  };


  return (
    <div className="App">
      <Container>
        <Form onSubmit={handleSubmit} className="mt-4">
          <Row>
            <Col md={3}>
              <Form.Group controlId="formTenant">
                <Form.Label>Tenant</Form.Label>
                <Form.Control as="select" name="tenant" value={searchParams.tenant} onChange={handleInputChange}>
                  {cgratesConfig.tenants.split(';').map((tenant, index) => (
                    <option key={index} value={tenant}>{tenant}</option>
                  ))}
                </Form.Control>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group controlId="formAccount">
                <Form.Label>Account</Form.Label>
                <Form.Control
                  type="text"
                  name="account"
                  value={searchParams.account}
                  placeholder="Search Account"
                  onChange={handleInputChange}
                />
              </Form.Group>
            </Col>
            <Col md={12} className="d-flex align-items-end mt-3">
              <Button type="submit" className="w-100">Search</Button>
            </Col>
          </Row>
        </Form>

        {isLoading ? (
          <div className="text-center mt-4">
            <Spinner animation="border" role="status">
              <span className="sr-only">Loading...</span>
            </Spinner>
            <p>Loading Accounts, please wait...</p>
          </div>
        ) : (
          <div>
            <Table striped bordered hover className="mt-4">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tenant</th>
                  <th>Account</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {results && results.length > 0 ? results.map((result, index) => (
                  <tr key={index} onClick={() => handleRowClick(result)} style={{ cursor: 'pointer' }}>
                    <td>{index + 1 + (currentPage - 1) * itemsPerPage}</td>
                    <td>{result.ID.split(':')[0]}</td> {/* Tenant */}
                    <td>{result.ID.split(':')[1]}</td> {/* Account */}
                    <td>{result.BalanceMap ? 'Available' : 'N/A'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="4" className="text-center">No results available</td>
                  </tr>
                )}
              </tbody>
            </Table>

            <Pagination className="justify-content-center mt-4">
              <Pagination.Prev
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1} // Disable "Back" on the first page
              >
                Back
              </Pagination.Prev>
              <Pagination.Item active>{currentPage}</Pagination.Item>
              <Pagination.Next
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={results.length < itemsPerPage} // Disable "Next" if fewer results than limit
              >
                Next
              </Pagination.Next>
            </Pagination>
          </div>
        )}
      </Container>

      {/* Modal for Account Details */}
      <Modal show={showModal} onHide={handleCloseModal} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>Account Details - {accountDetails ? `${accountDetails.ID}` : ''}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalLoading ? (
            <div className="text-center">
              <Spinner animation="border" role="status">
                <span className="sr-only">Loading account details...</span>
              </Spinner>
              <p>Loading account details, please wait...</p>
            </div>
          ) : accountDetails ? (
            <div>
              <p><strong>Allow Negative:</strong> {accountDetails.AllowNegative ? 'Yes' : 'No'}</p>
              <p><strong>Disabled:</strong> {accountDetails.Disabled ? 'Yes' : 'No'}</p>
              <h5>Action Triggers</h5>
              {accountDetails.ActionTriggers && accountDetails.ActionTriggers.length > 0 ? (
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th>Action Trigger ID</th>
                      <th>Action</th>
                      <th>Last Execution Time</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountDetails.ActionTriggers.map((trigger, index) => {
                      const { prettyDate, timeUntil } = formatExpiration(trigger.LastExecutionTime);
                      return (
                        <tr key={index}>
                          <td>
                            {trigger.ID}
                            <br />
                            <span style={{ color: 'gray' }}>{trigger.UniqueID}</span>
                          </td>
                          <td>{trigger.ActionsID}</td>
                          <td>
                            {timeUntil}
                            <br />
                            <span style={{ color: 'gray' }}>
                              {prettyDate}
                              <br />
                              Executed: {trigger.Executed ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td>
                            <Button variant="success" onClick={() => handleActionTriggerClick(trigger)}>
                              View ActionTrigger
                            </Button>
                            <br />
                            <Button
                              variant="danger"
                              onClick={() => removeActionTrigger(accountDetails.ID.split(':')[0], accountDetails.ID.split(':')[1], trigger.ActionsID, trigger.UniqueID)}
                            >
                              Remove ActionTrigger
                            </Button>
                            <br />
                            <Button
                              variant="warning"
                              onClick={() => resetActionTrigger(accountDetails.ID.split(':')[0], accountDetails.ID.split(':')[1], trigger.ActionsID, trigger.UniqueID)}
                            >
                              Reset ActionTrigger
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              ) : (
                <p>No ActionTriggers available for this account.</p>
              )}
              <h5>Action Plans</h5>
              {actionPlans && actionPlans.length > 0 ? (
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th>Action Plan ID</th>
                      <th>UUID</th>
                      <th>Actions ID</th>
                      <th>Next Execution Time</th>
                      <th>Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actionPlans.map((plan, index) => (
                      <tr key={index}>
                        <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {plan.ActionPlanId}
                        </td>
                        <td>{plan.Uuid}</td>
                        <td>{plan.ActionsId}</td>
                        <td>{plan.NextExecTime}</td>
                        <td>
                          <Button
                            variant="danger"
                            onClick={() => removeActionPlan(accountDetails.Tenant, plan.ActionPlanId)}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <p>No action plans available for this account.</p>
              )}

              <h5>Available Actions</h5>
              <Form.Group controlId="formActions">
                <Form.Control as="select" value={selectedAction} onChange={handleActionSelect}>
                  <option value="">Select Action</option>
                  {actions.map((action, index) => (
                    <option key={index} value={action}>{action}</option>
                  ))}
                </Form.Control>
              </Form.Group>

              {selectedAction && (
                <Button variant="primary" className="mt-3" onClick={handleExecuteActionClick}>
                  Execute Action
                </Button>
              )}

              {showConfirm && (
                <Alert variant="warning" className="mt-3">
                  <p>Confirm you want to execute Action <strong>{selectedAction}</strong> on Account <strong>{accountDetails.ID}</strong>?</p>
                  <Button variant="danger" onClick={handleConfirmExecuteAction}>Confirm</Button>
                  <Button variant="secondary" onClick={() => setShowConfirm(false)} className="ml-2">Cancel</Button>
                </Alert>
              )}

              <h5>Data Balances</h5>
              {renderBalanceTable(accountDetails.BalanceMap, '*data')}

              <h5>Monetary Balances</h5>
              {renderBalanceTable(accountDetails.BalanceMap, '*monetary')}

              <h5>SMS Balances</h5>
              {renderBalanceTable(accountDetails.BalanceMap, '*sms')}

              <h5>Voice Balances</h5>
              {renderBalanceTable(accountDetails.BalanceMap, '*voice')}
            </div>
          ) : (
            <p>No detailed data available for this account.</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          {selectedRowData && (
            <>
              <Button
                variant={accountDetails?.Disabled ? 'success' : 'warning'}
                onClick={() =>
                  updateAccountState(
                    selectedRowData.ID.split(':')[0], // Extract Tenant
                    selectedRowData.ID.split(':')[1], // Extract Account
                    !accountDetails?.Disabled // Toggle Disabled state
                  )
                }
              >
                {accountDetails?.Disabled ? 'Enable Account' : 'Disable Account'}
              </Button>

              <Button
                variant={accountDetails?.AllowNegative ? 'danger' : 'primary'}
                onClick={() =>
                  updateAccountNegative(
                    selectedRowData.ID.split(':')[0], // Extract Tenant
                    selectedRowData.ID.split(':')[1], // Extract Account
                    !accountDetails?.AllowNegative // Toggle AllowNegative state
                  )
                }
              >
                {accountDetails?.AllowNegative ? 'Disallow Negative' : 'Allow Negative'}
              </Button>
            </>
          )}
          <Button
            variant="danger"
            onClick={() =>
              removeAccount(
                selectedRowData.ID.split(':')[0], // Extract Tenant
                selectedRowData.ID.split(':')[1] // Extract Account
              )
            }
          >
            Delete Account
          </Button>
          <Button variant="secondary" onClick={handleCloseModal}>
            Close
          </Button>
        </Modal.Footer>


      </Modal>

      {/* Modal for Balance Details */}
      <Modal show={balanceModal} onHide={handleCloseBalanceModal} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>Balance Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedBalance ? (
            <Table striped bordered hover>
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(selectedBalance).map(([key, value], index) => (
                  <tr key={index}>
                    <td>{key}</td>
                    <td>{typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : String(value)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p>No balance details available.</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseBalanceModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal for Action Trigger Details */}
      <Modal show={actionTriggerModal} onHide={handleCloseActionTriggerModal} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>Action Trigger Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedActionTrigger ? (
            <Table striped bordered hover>
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(selectedActionTrigger).map(([key, value], index) => (
                  <tr key={index}>
                    <td>{key}</td>
                    <td>{typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : String(value)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p>No action trigger details available.</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseActionTriggerModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default GetAccounts;
