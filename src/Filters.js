import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Table, Modal, Spinner, Accordion, ListGroup } from 'react-bootstrap';

const Filters = ({ cgratesConfig }) => {
  const [searchParams, setSearchParams] = useState({
    tenant: '', // Tenant selection
  });
  const [filters, setFilters] = useState([]); // Store the list of filters
  const [selectedFilter, setSelectedFilter] = useState(null); // Store the selected filter's details
  const [showModal, setShowModal] = useState(false); // Control the modal display
  const [isLoading, setIsLoading] = useState(false); // Handle loading state
  const [responseTime, setResponseTime] = useState(null); // API response time

  // Handle input change for tenant selection
  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setSearchParams({ ...searchParams, [name]: value });
  };

  // Fetch all filter profile IDs based on the selected tenant
  const fetchFilters = async () => {
    setIsLoading(true);
    setFilters([]); // Clear previous results
    const startTime = Date.now();
    
    try {
      const query = {
        method: 'APIerSv1.GetFilterIDs',
        params: [{ Tenant: searchParams.tenant }] // Fetch based on the selected tenant
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
      const endTime = Date.now();
      const timeTaken = ((endTime - startTime) / 1000).toFixed(2);
      setResponseTime(timeTaken);

      if (data.result) {
        setFilters(data.result); // Set the fetched filter IDs
      } else {
        console.warn('No filter profiles found.');
      }
    } catch (error) {
      console.error('Error fetching filter IDs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch details of a selected filter profile
  const fetchFilterDetails = async (filterId) => {
    setIsLoading(true);
    try {
      const query = {
        method: 'APIerSv1.GetFilter',
        params: [{ Tenant: searchParams.tenant, Id: filterId }]
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
      if (data.result) {
        setSelectedFilter(data.result); // Set the fetched filter details
        setShowModal(true); // Show the modal with details
      }
    } catch (error) {
      console.error('Error fetching filter details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowClick = (filterId) => {
    fetchFilterDetails(filterId); // Fetch the details when an filter is clicked
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedFilter(null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    fetchFilters(); // Fetch filters based on the selected tenant
  };

  return (
    <div className="App">
      <Container>
        <h2>Filter Profiles</h2>
        <Form onSubmit={handleSubmit} className="mt-4">
          <Row>
            <Col md={6}>
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
            <Col md={6} className="d-flex align-items-end">
              <Button type="submit" className="w-100">Fetch Filters</Button>
            </Col>
          </Row>
        </Form>

        {isLoading ? (
          <div className="text-center mt-4">
            <Spinner animation="border" role="status">
              <span className="sr-only">Loading...</span>
            </Spinner>
            <p>Loading filters, please wait...</p>
          </div>
        ) : (
          <>
            {responseTime && (
              <p className="mt-3">
                Response from CGrateS at <b>{cgratesConfig.url}</b> in {responseTime} seconds
              </p>
            )}
            <Table striped bordered hover className="mt-4">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Filter ID</th>
                </tr>
              </thead>
              <tbody>
                {filters.length > 0 ? filters.map((filter, index) => (
                  <tr key={index} onClick={() => handleRowClick(filter)} style={{ cursor: 'pointer' }}>
                    <td>{index + 1}</td>
                    <td>{filter}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="2" className="text-center">No filters available</td>
                  </tr>
                )}
              </tbody>
            </Table>
          </>
        )}

        {/* Modal for displaying filter details */}
        <Modal show={showModal} onHide={handleCloseModal} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>Filter Profile Details</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {selectedFilter ? (
              <>
                <h5>General Information</h5>
                <ListGroup className="mb-3">
                  <ListGroup.Item><strong>Tenant:</strong> {selectedFilter.Tenant}</ListGroup.Item>
                  <ListGroup.Item><strong>ID:</strong> {selectedFilter.ID}</ListGroup.Item>
                  <ListGroup.Item><strong>Activation Interval:</strong> {selectedFilter.ActivationInterval || 'N/A'}</ListGroup.Item>
                  <ListGroup.Item><strong>Blocker:</strong> {selectedFilter.Blocker ? 'Yes' : 'No'}</ListGroup.Item>
                  <ListGroup.Item><strong>Weight:</strong> {selectedFilter.Weight}</ListGroup.Item>
                </ListGroup>

              </>
            ) : (
              <p>No details available</p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </div>
  );
};

export default Filters;
