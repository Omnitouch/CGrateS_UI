import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Table, Pagination, Modal, Spinner, Alert } from 'react-bootstrap';

const GetAccounts = ({ cgratesConfig }) => {
  const [searchParams, setSearchParams] = useState({
    tenant: cgratesConfig.tenants.split(';')[0] || '', // Set default tenant
    account: '',
  });

  const [results, setResults] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // Default 10 records per page
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [balanceModal, setBalanceModal] = useState(false); // New modal for balance details
  const [selectedRowData, setSelectedRowData] = useState(null);
  const [selectedBalance, setSelectedBalance] = useState(null); // Store clicked balance data
  const [accountDetails, setAccountDetails] = useState(null); // State to store detailed account data
  const [modalLoading, setModalLoading] = useState(false); // Loading state for modal API call
  const [actions, setActions] = useState([]); // Actions available for the selected account
  const [selectedAction, setSelectedAction] = useState(''); // Selected action for execution
  const [showConfirm, setShowConfirm] = useState(false); // State to show confirmation alert

  useEffect(() => {
    if (searchParams.tenant) {
      fetchActions(searchParams.tenant);
    }
  }, [searchParams.tenant]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setSearchParams({ ...searchParams, [name]: value });
  };

  const fetchResults = async (page = 1) => {
    setIsLoading(true);
    setResults([]); // Clear the current results
    const offset = (page - 1) * itemsPerPage; // Calculate the offset based on page and items per page

    const newQuery = {
      method: 'APIerSv2.GetAccounts',
      params: [{
        Tenant: searchParams.tenant,
        AccountIDs: searchParams.account ? [searchParams.account] : null,
        Offset: offset,
        Limit: itemsPerPage,
        Filter: null
      }],
      id: 1
    };

    console.log(`Fetching accounts from: ${cgratesConfig.url}`);

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
        setTotalItems(data.result.length); // Set the total items for pagination
        if (searchParams.tenant) {
          fetchActions(searchParams.tenant); // Fetch actions after fetching accounts
        }
      } else {
        setResults([]);
        setTotalItems(0);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setResults([]);
      setTotalItems(0);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAccountDetails = async (tenant, account) => {
    setModalLoading(true); // Set modal loading
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

    const actionPlanQuery = {
      method: 'ApierV2.GetAccountActionPlan',
      params: [{
        Account: account,
        Tenant: tenant
      }],
      id: 5
    };

    console.log(`Fetching account details for account: ${account}`);

    try {
      const [accountDetailsResponse, actionPlanResponse] = await Promise.all([
        fetch(cgratesConfig.url + '/jsonrpc', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(accountDetailsQuery),
        }),
        fetch(cgratesConfig.url + '/jsonrpc', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(actionPlanQuery),
        })
      ]);

      if (!accountDetailsResponse.ok || !actionPlanResponse.ok) {
        throw new Error(`HTTP error! status: ${accountDetailsResponse.status} or ${actionPlanResponse.status}`);
      }

      const accountDetailsData = await accountDetailsResponse.json();
      const actionPlanData = await actionPlanResponse.json();

      console.log('Detailed account data:', accountDetailsData);
      console.log('Action plan data:', actionPlanData);

      if (accountDetailsData && accountDetailsData.result) {
        setAccountDetails({ ...accountDetailsData.result[0], actionPlans: actionPlanData.result || [] }); // Store account details and action plans in state
      } else {
        setAccountDetails(null);
      }
    } catch (error) {
      console.error('Error fetching account details or action plans:', error);
      setAccountDetails(null);
    } finally {
      setModalLoading(false); // End modal loading
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

  const handleSubmit = (event) => {
    event.preventDefault();
    setCurrentPage(1); // Reset to the first page
    fetchResults(1);
  };

  const handleRowClick = (rowData) => {
    setSelectedRowData(rowData);
    const [tenant, account] = rowData.ID.split(':');
    setAccountDetails({ Tenant: tenant, Account: account, ...rowData }); // Set the tenant and account details in state
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
    setCurrentPage(pageNumber);
    fetchResults(pageNumber);
  };

  // Function to render the balance map by category
  const renderBalanceTable = (balanceMap, category) => {
    if (!balanceMap || !balanceMap[category]) return null;

    return (
      <Table striped bordered hover>
        <thead>
          <tr>
            <th>ID</th>
            <th>Value</th>
            <th>Expiration Date</th>
            <th>Weight</th>
            <th>Blocker</th>
          </tr>
        </thead>
        <tbody>
          {balanceMap[category].map((balance, index) => (
            <tr key={index} onClick={() => handleBalanceClick(balance)} style={{ cursor: 'pointer' }}>
              <td>{balance.ID}</td>
              <td>{balance.Value}</td>
              <td>{balance.ExpirationDate}</td>
              <td>{balance.Weight}</td>
              <td>{balance.Blocker ? 'Yes' : 'No'}</td>
            </tr>
          ))}
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
              {[...Array(Math.ceil(totalItems / itemsPerPage)).keys()].map(page => (
                <Pagination.Item
                  key={page + 1}
                  active={page + 1 === currentPage}
                  onClick={() => handlePageChange(page + 1)}
                >
                  {page + 1}
                </Pagination.Item>
              ))}
              {results.length === itemsPerPage && (
                <Pagination.Next onClick={() => handlePageChange(currentPage + 1)} />
              )}
            </Pagination>
          </div>
        )}
      </Container>

      {/* Modal for Account Details */}
      <Modal show={showModal} onHide={handleCloseModal} size="lg">
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
              <p><strong>Action Triggers:</strong> {accountDetails.ActionTriggers ? JSON.stringify(accountDetails.ActionTriggers, null, 2) : 'None'}</p>

              <h5>Action Plans</h5>
              {accountDetails.actionPlans && accountDetails.actionPlans.length > 0 ? (
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
                    {accountDetails.actionPlans.map((plan, index) => (
                      <tr key={index}>
                        <td>{plan.ActionPlanId}</td>
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
          <Button
            variant="danger"
            onClick={() => removeAccount(selectedRowData.ID.split(':')[0], selectedRowData.ID.split(':')[1])}
          >
            Delete Account
          </Button>
          <Button variant="secondary" onClick={handleCloseModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal for Balance Details */}
      <Modal show={balanceModal} onHide={handleCloseBalanceModal} size="lg">
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
    </div>
  );
};

export default GetAccounts;
