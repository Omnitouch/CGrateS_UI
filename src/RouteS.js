import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Table, Pagination, Modal, Spinner } from 'react-bootstrap';
import moment from 'moment';

const GetRoutes = ({ cgratesConfig }) => {
  const [searchParams, setSearchParams] = useState({
    tenant: cgratesConfig.tenants.split(';')[0], // Default to the first tenant
    account: '',
    destination: ''
  });

  const [query, setQuery] = useState(null); // State to store the API query object
  const [apiQuery, setApiQuery] = useState('');
  const [results, setResults] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [offset, setOffset] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [selectedRowData, setSelectedRowData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [responseTime, setResponseTime] = useState(null);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setSearchParams({ ...searchParams, [name]: value });
  };

  const fetchResults = async (page = 1, offsetValue = 0) => {
    setIsLoading(true);
    setResults([]); // Clear the current results
    const startTime = Date.now();

    const today = moment().format('YYYY-MM-DD HH:mm:ss');
    const newQuery = {
      method: 'RouteSv1.GetRoutes',
      params: [{
        IgnoreErrors: true,
        Tenant: searchParams.tenant,
        ID: '362ac79',  // You might want to dynamically assign the ID based on actual usage
        Event: {
          Account: searchParams.account,
          Tenant: searchParams.tenant,
          Subject: searchParams.account,
          SetupTime: today,
          Destination: searchParams.destination,
          Usage: '1m'
        },
      }],
      id: 1
    };

    setQuery(newQuery); // Store the query for later use
    setApiQuery(JSON.stringify(newQuery, null, 2));

    console.log(`Fetching routes from: ${cgratesConfig.url}`);

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
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedRowData(null);
  };
  const blockRouteForDestination = async (destination, ratingPlanID) => {
    try {
      // Extract the operator name from the Rating Plan ID
      const operatorName = ratingPlanID.split('_').pop();

      // Fetch the existing filter
      const fetchResponse = await fetch(cgratesConfig.url + '/jsonrpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: 'APIerSv1.GetFilter',
          params: [{
            Tenant: 'cgrates.org',
            Id: `Filter_Operator_Route_Blacklist_${operatorName}`,
          }],
        }),
      });

      if (!fetchResponse.ok) {
        throw new Error(`HTTP error! status: ${fetchResponse.status}`);
      }

      const fetchData = await fetchResponse.json();
      if (fetchData.error) {
        throw new Error(`Error fetching filter: ${fetchData.error.message}`);
      }

      const existingFilter = fetchData.result;

      // Add the new rule for the destination
      const updatedRules = [
        ...existingFilter.Rules,
        {
          Type: '*notprefix',
          Element: '~*req.Destination',
          Values: [destination],
        },
      ];

      // Push the updated filter back to the server
      const updateResponse = await fetch(cgratesConfig.url + '/jsonrpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: 'ApierV1.SetFilter',
          params: [{
            ID: `Filter_Operator_Route_Blacklist_${operatorName}`,
            Rules: updatedRules,
            ActivationInterval: {
              ActivationTime: '0001-01-01T00:00:00Z',
              ExpiryTime: '0001-01-01T00:00:00Z',
            },
          }],
        }),
      });

      if (!updateResponse.ok) {
        throw new Error(`HTTP error! status: ${updateResponse.status}`);
      }

      const updateData = await updateResponse.json();
      if (updateData.error) {
        throw new Error(`Error updating filter: ${updateData.error.message}`);
      }

      alert(`Route for destination ${destination} has been successfully blocked for operator ${operatorName}.`);
    } catch (error) {
      console.error('Error blocking route:', error);
      alert(`Failed to block route for destination ${destination}: ${error.message}`);
    }
  };

  return (
    <div className="App">
      <Container>
        <Form onSubmit={handleSubmit} className="mt-4">
          <Row>
            <Col md={4}>
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
                <Form.Control type="text" name="account" value={searchParams.account} onChange={handleInputChange} />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group controlId="formDestination">
                <Form.Label>Destination</Form.Label>
                <Form.Control type="text" name="destination" value={searchParams.destination} onChange={handleInputChange} />
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
            <p>Loading Routes, please wait...</p>
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
              <th>Profile ID</th>
              <th>Sorting</th>
              <th>Routes</th>
            </tr>
          </thead>
          <tbody>
            {results && results.length > 0 ? results.map((result, index) => (
              <tr key={index} onClick={() => handleRowClick(result)} style={{ cursor: 'pointer' }}>
                <td>{index + 1 + (currentPage - 1) * 50}</td>
                <td>{result.ProfileID}</td>
                <td>{result.Sorting}</td>
                <td>
                  {result.Routes.map((route, routeIndex) => (
                    <div key={routeIndex}>
                      <strong>RouteID:</strong> {route.RouteID} <br />
                      <strong>RouteParameters:</strong> {route.RouteParameters} <br />
                      <strong>Cost:</strong> {route.SortingData.Cost} <br />
                      <strong>RatingPlanID:</strong> {route.SortingData.RatingPlanID}
                    </div>
                  ))}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="4" className="text-center">No results available</td>
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
      <Modal show={showModal} onHide={handleCloseModal} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            Route Details{selectedRowData ? `: ${selectedRowData.ProfileID}` : ''}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <p>
            To blacklist a given route for a specific operator, <a href="/filters" target="_blank" rel="noopener noreferrer">add it to the FilterS page for that operator.</a> or click the "Blacklist" button below.
          </p>
          {selectedRowData ? (
            <div>
              <p><strong>Profile ID:</strong> {selectedRowData.ProfileID}</p>
              <p><strong>Sorting:</strong> {selectedRowData.Sorting}</p>
              <table className="table table-bordered mt-3">
                <thead>
                  <tr>
                    <th>Route ID</th>
                    <th>Cost</th>
                    <th>Rating Plan ID</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRowData.Routes.map((route, routeIndex) => (
                    <tr key={routeIndex}>
                      <td>{route.RouteID}</td>
                      <td>{route.SortingData.Cost}</td>
                      <td>{route.SortingData.RatingPlanID}</td>
                      <td>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering row click
                            blockRouteForDestination(searchParams.destination, route.SortingData.RatingPlanID);
                          }}
                        >
                          Block this Route for this Destination
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No data available</p>
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

export default GetRoutes;
