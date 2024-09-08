import React, { useState } from 'react';
import { Form, Button, Container, Row, Col, Table, Pagination, Modal, Spinner } from 'react-bootstrap';

const GetAccounts = ({ cgratesConfig }) => {
  const [searchParams, setSearchParams] = useState({
    tenant: '',
    account: '',
  });

  const [query, setQuery] = useState(null); // State to store the API query object
  const [apiQuery, setApiQuery] = useState('');
  const [results, setResults] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [offset, setOffset] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [selectedRowData, setSelectedRowData] = useState(null);
  const [accountDetails, setAccountDetails] = useState(null); // State to store detailed account data
  const [isLoading, setIsLoading] = useState(false);
  const [modalLoading, setModalLoading] = useState(false); // Loading state for modal API call
  const [responseTime, setResponseTime] = useState(null);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setSearchParams({ ...searchParams, [name]: value });
  };

  const fetchResults = async (page = 1, offsetValue = 0) => {
    setIsLoading(true);
    setResults([]); // Clear the current results
    const startTime = Date.now();

    const newQuery = {
      method: 'APIerSv2.GetAccounts',
      params: [{
        Tenant: searchParams.tenant || 'cgrates.org',
        AccountIDs: null,
        Offset:0,
        Limit:0,
        Filter:null
      }],
      id: 1
    };

    setQuery(newQuery); // Store the query for later use
    setApiQuery(JSON.stringify(newQuery, null, 2));

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
      const endTime = Date.now();
      const timeTaken = ((endTime - startTime) / 1000).toFixed(2);
      setResponseTime(timeTaken);

      console.log('Data fetched successfully:', data);

      if (data && data.result) {
        setResults(data.result); // Handle the fetched results
      } else {
        console.warn('Data format unexpected:', data);
        setResults([]); // Reset results if data format is unexpected
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setResults([]); // Reset results on error
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAccountDetails = async (tenant, account) => {
    setModalLoading(true); // Set modal loading
    const newQuery = {
      method: 'AccountSv1.GetAccount',
      params: [{
        Tenant: tenant,
        Account: account
      }],
      id: 2
    };

    console.log(`Fetching account details for account: ${account}`);

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
      console.log('Detailed account data:', data);

      if (data && data.result) {
        setAccountDetails(data.result); // Store account details in state
      } else {
        setAccountDetails(null);
        console.warn('Unexpected data format:', data);
      }
    } catch (error) {
      console.error('Error fetching account details:', error);
      setAccountDetails(null);
    } finally {
      setModalLoading(false); // End modal loading
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setOffset(0);
    setCurrentPage(1);
    fetchResults(1, 0);
  };

  const handleNextPage = () => {
    const newOffset = offset + 50;
    setOffset(newOffset);
    setCurrentPage(currentPage + 1);
    fetchResults(currentPage + 1, newOffset);
  };

  const handlePreviousPage = () => {
    const newOffset = offset - 50;
    setOffset(newOffset);
    setCurrentPage(currentPage - 1);
    fetchResults(currentPage - 1, newOffset);
  };

  const handleRowClick = (rowData) => {
    setSelectedRowData(rowData);
    setShowModal(true);
    fetchAccountDetails(rowData.Tenant, rowData.Account); // Fetch additional account details
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedRowData(null);
    setAccountDetails(null); // Clear account details when modal is closed
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
                  <option value="">Select Tenant</option>
                  {cgratesConfig.tenants.split(';').map((tenant, index) => (
                    <option key={index} value={tenant}>{tenant}</option>
                  ))}
                </Form.Control>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group controlId="formAccount">
                <Form.Label>Account</Form.Label>
                <Form.Control type="text" name="account" value={searchParams.account} onChange={handleInputChange} />
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
          <pre className="mt-4 text-left">
            {apiQuery}
          </pre>
        )}

        <p>
          Response from CGrateS at <b>{cgratesConfig.url}</b>
          {responseTime && !isLoading && ` in ${responseTime} seconds`}
        </p>

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
                <td>{index + 1 + (currentPage - 1) * 50}</td>
                <td>{result.Tenant}</td>
                <td>{result.Account}</td>
                <td>{result.Balance}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5" className="text-center">No results available</td>
              </tr>
            )}
          </tbody>
        </Table>

        <Pagination className="justify-content-center mt-4">
          <Pagination.Prev disabled={offset === 0} onClick={handlePreviousPage} />
          <Pagination.Next onClick={handleNextPage} />
        </Pagination>
      </Container>

      {/* Modal for Row Details */}
      <Modal show={showModal} onHide={handleCloseModal}>
        <Modal.Header closeButton>
          <Modal.Title>Account Details</Modal.Title>
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
              <p><strong>Tenant:</strong> {accountDetails.Tenant}</p>
              <p><strong>Account:</strong> {accountDetails.Account}</p>
              <p><strong>Balance:</strong> {accountDetails.Balance}</p>
              <p><strong>Additional Data:</strong></p>
              <pre>{JSON.stringify(accountDetails, null, 2)}</pre>
            </div>
          ) : (
            <p>No detailed data available for this account.</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default GetAccounts;
