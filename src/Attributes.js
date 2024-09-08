import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Table, Modal, Spinner } from 'react-bootstrap';

const Attributes = ({ cgratesConfig }) => {
  const [searchParams, setSearchParams] = useState({
    tenant: '', // Tenant selection
  });
  const [attributes, setAttributes] = useState([]); // Store the list of attributes
  const [selectedAttribute, setSelectedAttribute] = useState(null); // Store the selected attribute's details
  const [showModal, setShowModal] = useState(false); // Control the modal display
  const [isLoading, setIsLoading] = useState(false); // Handle loading state
  const [responseTime, setResponseTime] = useState(null); // API response time

  // Handle input change for tenant selection
  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setSearchParams({ ...searchParams, [name]: value });
  };

  // Fetch all attribute profile IDs based on the selected tenant
  const fetchAttributes = async () => {
    setIsLoading(true);
    setAttributes([]); // Clear previous results
    const startTime = Date.now();
    
    try {
      const query = {
        method: 'APIerSv1.GetAttributeProfileIDs',
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
        setAttributes(data.result); // Set the fetched attribute IDs
      } else {
        console.warn('No attribute profiles found.');
      }
    } catch (error) {
      console.error('Error fetching attribute IDs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch details of a selected attribute profile
  const fetchAttributeDetails = async (attributeId) => {
    setIsLoading(true);
    try {
      const query = {
        method: 'APIerSv1.GetAttributeProfile',
        params: [{ Tenant: searchParams.tenant, Id: attributeId }]
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
        setSelectedAttribute(data.result); // Set the fetched attribute details
        setShowModal(true); // Show the modal with details
      }
    } catch (error) {
      console.error('Error fetching attribute details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowClick = (attributeId) => {
    fetchAttributeDetails(attributeId); // Fetch the details when an attribute is clicked
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedAttribute(null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    fetchAttributes(); // Fetch attributes based on the selected tenant
  };

  return (
    <div className="App">
      <Container>
        <h2>Attribute Profiles</h2>
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
              <Button type="submit" className="w-100">Fetch Attributes</Button>
            </Col>
          </Row>
        </Form>

        {isLoading ? (
          <div className="text-center mt-4">
            <Spinner animation="border" role="status">
              <span className="sr-only">Loading...</span>
            </Spinner>
            <p>Loading attributes, please wait...</p>
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
                  <th>Attribute ID</th>
                </tr>
              </thead>
              <tbody>
                {attributes.length > 0 ? attributes.map((attribute, index) => (
                  <tr key={index} onClick={() => handleRowClick(attribute)} style={{ cursor: 'pointer' }}>
                    <td>{index + 1}</td>
                    <td>{attribute}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="2" className="text-center">No attributes available</td>
                  </tr>
                )}
              </tbody>
            </Table>
          </>
        )}

        {/* Modal for displaying attribute details */}
        <Modal show={showModal} onHide={handleCloseModal}>
          <Modal.Header closeButton>
            <Modal.Title>Attribute Profile Details</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {selectedAttribute ? (
              <div>
                <p><strong>TPid:</strong> {selectedAttribute.TPid}</p>
                <p><strong>Id:</strong> {selectedAttribute.Id}</p>
                <p><strong>Details:</strong></p>
                <pre>{JSON.stringify(selectedAttribute, null, 2)}</pre>
              </div>
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

export default Attributes;
