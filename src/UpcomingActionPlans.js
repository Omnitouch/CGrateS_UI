import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Table, Pagination, Modal, Spinner } from 'react-bootstrap';

const UpcomingActionPlans = ({ cgratesConfig }) => {
  const firstTenant = (cgratesConfig.tenants || '').split(';')[0] || '';
  const [searchParams, setSearchParams] = useState({
    tenant: firstTenant,
  });

  const [results, setResults] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // Default 10 records per page
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedRowData, setSelectedRowData] = useState(null);

  useEffect(() => {
    if (searchParams.tenant) {
      fetchResults(1); // Fetch results for the first page whenever the tenant changes
    }
  }, [searchParams.tenant]);

  const fetchResults = async (page = 1) => {
    setIsLoading(true);
    const offset = (page - 1) * itemsPerPage;

    const newQuery = {
      method: 'ApierV1.GetScheduledActions',
      params: [{
        Offset: offset,
        Limit: itemsPerPage,
      }],
      id: 1
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

      if (data && data.result) {
        setResults(data.result);
        setCurrentPage(page);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error('Error fetching scheduled actions:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setSearchParams({ ...searchParams, [name]: value });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    fetchResults(1);
  };

  const handleRowClick = (rowData) => {
    setSelectedRowData(rowData);
    setShowModal(true);
  };

  const handleNextPage = () => {
    fetchResults(currentPage + 1);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      fetchResults(currentPage - 1);
    }
  };

  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return 'N/A';
    try {
      const date = new Date(dateTimeStr);
      return date.toLocaleString();
    } catch (error) {
      return dateTimeStr;
    }
  };

  return (
    <Container>
      <h2>Upcoming ActionPlans</h2>
      <Form onSubmit={handleSubmit} className="mt-4">
        <Row>
          <Col md={6}>
            <Form.Group>
              <Form.Label>Tenant</Form.Label>
              <Form.Control
                as="select"
                name="tenant"
                value={searchParams.tenant}
                onChange={handleInputChange}
              >
                {cgratesConfig.tenants.split(';').map((tenant, index) => (
                  <option key={index} value={tenant}>{tenant}</option>
                ))}
              </Form.Control>
            </Form.Group>
          </Col>
          <Col md={6} className="d-flex align-items-end">
            <Button type="submit" className="w-100" variant="primary">
              Fetch Scheduled Actions
            </Button>
          </Col>
        </Row>
      </Form>

      {isLoading ? (
        <div className="text-center mt-4">
          <Spinner animation="border" />
          <p>Loading...</p>
        </div>
      ) : (
        <>
          <Table striped bordered hover className="mt-4" size="sm">
            <thead>
              <tr>
                <th>#</th>
                <th>Action Plan ID</th>
                <th>Actions ID</th>
                <th>Next Run Time</th>
                <th>Accounts</th>
              </tr>
            </thead>
            <tbody>
              {results.length > 0 ? results.map((item, index) => (
                <tr
                  key={index}
                  onClick={() => handleRowClick(item)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{(currentPage - 1) * itemsPerPage + index + 1}</td>
                  <td>{item.ActionPlanID || 'N/A'}</td>
                  <td>{item.ActionsID || 'N/A'}</td>
                  <td>{formatDateTime(item.NextRunTime)}</td>
                  <td>{item.Accounts !== undefined ? item.Accounts : 'N/A'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="text-center">
                    No upcoming action plans found
                  </td>
                </tr>
              )}
            </tbody>
          </Table>

          {results.length > 0 && (
            <Pagination className="justify-content-center mt-4">
              <Pagination.Prev
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
              />
              <Pagination.Item active>{currentPage}</Pagination.Item>
              <Pagination.Next
                onClick={handleNextPage}
                disabled={results.length < itemsPerPage}
              />
            </Pagination>
          )}
        </>
      )}

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Scheduled Action Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedRowData ? (
            <div>
              <p><strong>Action Plan ID:</strong> {selectedRowData.ActionPlanID}</p>
              <p><strong>Actions ID:</strong> {selectedRowData.ActionsID}</p>
              <p><strong>Action Timing UUID:</strong> {selectedRowData.ActionTimingUUID}</p>
              <p><strong>Next Run Time:</strong> {formatDateTime(selectedRowData.NextRunTime)}</p>
              <p><strong>Accounts:</strong> {selectedRowData.Accounts !== undefined ? selectedRowData.Accounts : 'N/A'}</p>

              <hr />
              <h5>Raw Data</h5>
              <pre style={{
                backgroundColor: '#f4f4f4',
                padding: '10px',
                borderRadius: '5px',
                maxHeight: '400px',
                overflow: 'auto'
              }}>
                {JSON.stringify(selectedRowData, null, 2)}
              </pre>
            </div>
          ) : (
            <p>No data available</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default UpcomingActionPlans;
