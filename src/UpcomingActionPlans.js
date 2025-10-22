import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Table, Pagination, Modal, Spinner, Alert, Badge } from 'react-bootstrap';

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
  const [errorMessage, setErrorMessage] = useState('');

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

  const handleDeleteActionPlan = async (actionPlanId) => {
    if (!window.confirm(`Are you sure you want to delete the action plan: ${actionPlanId}?\n\nThis will remove the scheduled action.`)) {
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const query = {
        method: 'APIerSv1.RemoveActionPlan',
        params: [{
          Id: actionPlanId,
          Tenant: searchParams.tenant,
        }],
        id: 1
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

      if (data.error) {
        throw new Error(data.error.message || 'Failed to delete action plan');
      }

      // Success - close modal and refresh results
      setShowModal(false);
      setErrorMessage('');
      alert('Action plan deleted successfully!');
      fetchResults(currentPage); // Refresh the current page
    } catch (error) {
      console.error('Error deleting action plan:', error);
      setErrorMessage(`Error deleting action plan: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getRelativeTime = (dateTimeStr) => {
    if (!dateTimeStr) return '';

    try {
      const targetDate = new Date(dateTimeStr);
      const now = new Date();
      const diffMs = targetDate - now;

      if (diffMs < 0) {
        return 'Overdue';
      }

      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMinutes < 60) {
        return `in ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
      } else if (diffHours < 24) {
        return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
      } else if (diffDays < 7) {
        return `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
      } else {
        const diffWeeks = Math.floor(diffDays / 7);
        return `in ${diffWeeks} week${diffWeeks !== 1 ? 's' : ''}`;
      }
    } catch (error) {
      return '';
    }
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
                <th style={{ width: '50px' }}>#</th>
                <th style={{ width: '500px' }}>Action Plan ID</th>
                <th style={{ width: '400px' }}>Actions ID</th>
                <th>Next Run Time</th>
                <th style={{ width: '100px' }}>Accounts</th>
              </tr>
            </thead>
            <tbody>
              {results.length > 0 ? results.map((item, index) => {
                const relativeTime = getRelativeTime(item.NextRunTime);
                return (
                  <tr
                    key={index}
                    onClick={() => handleRowClick(item)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{(currentPage - 1) * itemsPerPage + index + 1}</td>
                    <td style={{
                      maxWidth: '250px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }} title={item.ActionPlanID || 'N/A'}>
                      {item.ActionPlanID || 'N/A'}
                    </td>
                    <td style={{
                      maxWidth: '200px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }} title={item.ActionsID || 'N/A'}>
                      {item.ActionsID || 'N/A'}
                    </td>
                    <td>
                      {formatDateTime(item.NextRunTime)}
                      {relativeTime && (
                        <div>
                          <small className="text-muted">({relativeTime})</small>
                        </div>
                      )}
                    </td>
                    <td>
                      <Badge bg={item.Accounts > 0 ? 'success' : 'secondary'}>
                        {item.Accounts !== undefined ? item.Accounts : 'N/A'}
                      </Badge>
                    </td>
                  </tr>
                );
              }) : (
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
          {errorMessage && (
            <Alert variant="danger" onClose={() => setErrorMessage('')} dismissible>
              {errorMessage}
            </Alert>
          )}

          {selectedRowData ? (
            <div>
              <p><strong>Action Plan ID:</strong> {selectedRowData.ActionPlanID}</p>
              <p><strong>Actions ID:</strong> {selectedRowData.ActionsID}</p>
              <p><strong>Action Timing UUID:</strong> {selectedRowData.ActionTimingUUID}</p>
              <p>
                <strong>Next Run Time:</strong> {formatDateTime(selectedRowData.NextRunTime)}
                {getRelativeTime(selectedRowData.NextRunTime) && (
                  <span className="ms-2">
                    <Badge bg="info">{getRelativeTime(selectedRowData.NextRunTime)}</Badge>
                  </span>
                )}
              </p>
              <p>
                <strong>Number of Accounts:</strong>{' '}
                <Badge bg={selectedRowData.Accounts > 0 ? 'success' : 'secondary'}>
                  {selectedRowData.Accounts !== undefined ? selectedRowData.Accounts : 'N/A'}
                </Badge>
              </p>

              {selectedRowData.Accounts === 0 && (
                <Alert variant="warning">
                  This action plan has 0 accounts associated with it and may not execute.
                </Alert>
              )}

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
          <Button
            variant="danger"
            onClick={() => handleDeleteActionPlan(selectedRowData?.ActionPlanID)}
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete Action Plan'}
          </Button>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default UpcomingActionPlans;
