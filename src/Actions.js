import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Table, Modal, Spinner, ListGroup } from 'react-bootstrap';

const ActionsPage = ({ cgratesConfig }) => {
  const [searchParams, setSearchParams] = useState({
    tenant: '', // Tenant selection
  });
  const [actions, setActions] = useState([]); // Store the list of actions
  const [selectedAction, setSelectedAction] = useState(null); // Store the selected action's details
  const [showModal, setShowModal] = useState(false); // Control the modal display
  const [isLoading, setIsLoading] = useState(false); // Handle loading state
  const [error, setError] = useState(''); // Handle error messages

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setSearchParams({ ...searchParams, [name]: value });
  };

  const fetchActions = async () => {
    setIsLoading(true);
    try {
      const query = {
        method: 'APIerSv2.GetActions',
        params: searchParams.tenant ? [{ Tenant: searchParams.tenant }] : [{}], // If tenant is blank, fetch all actions
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
      if (data.result && Object.keys(data.result).length > 0) {
        const actionsList = Object.entries(data.result).map(([key, value]) => ({
          id: key,
          details: value,
        }));
        setActions(actionsList);
      } else {
        console.warn('No actions found.');
        setError('No actions found.');
      }
    } catch (error) {
      console.error('Error fetching actions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowClick = (actionDetails) => {
    setSelectedAction(actionDetails);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedAction(null);
    setError('');
  };

  return (
    <Container>
      <h2>Manage Actions</h2>
      <Form onSubmit={(e) => { e.preventDefault(); fetchActions(); }} className="mt-4">
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
          <Col md={12} className="d-flex align-items-end">
            <Button type="submit" className="w-100">Fetch Actions</Button>
          </Col>
        </Row>
      </Form>

      {isLoading ? (
        <div className="text-center mt-4">
          <Spinner animation="border" role="status">
            <span className="sr-only">Loading...</span>
          </Spinner>
        </div>
      ) : (
        error && <p className="text-danger mt-3">{error}</p>
      )}

      {actions.length > 0 && (
        <Table striped bordered hover className="mt-4">
          <thead>
            <tr>
              <th>#</th>
              <th>Action ID</th>
              <th>Number of Parts</th>
            </tr>
          </thead>
          <tbody>
            {actions.map((action, index) => (
              <tr key={index} onClick={() => handleRowClick(action.details)} style={{ cursor: 'pointer' }}>
                <td>{index + 1}</td>
                <td>{action.id}</td>
                <td>{action.details.length}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {/* Modal for displaying the selected action details */}
      <Modal show={showModal} onHide={handleCloseModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Action Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedAction && selectedAction.map((part, index) => (
            <div key={index} className="mb-4">
              <h5>Part {index + 1}</h5>
              <ListGroup>
                <ListGroup.Item><strong>ActionType:</strong> {part.ActionType}</ListGroup.Item>
                <ListGroup.Item><strong>ExtraParameters:</strong> {part.ExtraParameters || 'N/A'}</ListGroup.Item>
                <ListGroup.Item><strong>Filters:</strong> {part.Filters || 'N/A'}</ListGroup.Item>
                <ListGroup.Item><strong>Expiration:</strong> {part.ExpirationString || 'N/A'}</ListGroup.Item>
                <ListGroup.Item><strong>Weight:</strong> {part.Weight}</ListGroup.Item>
                <ListGroup.Item><strong>Balance ID:</strong> {part.Balance.ID || 'N/A'}</ListGroup.Item>
                <ListGroup.Item><strong>Balance Type:</strong> {part.Balance.Type || 'N/A'}</ListGroup.Item>
                <ListGroup.Item><strong>Balance Value:</strong> {part.Balance.Value.Static}</ListGroup.Item>
                <ListGroup.Item><strong>Balance Expiration Date:</strong> {part.Balance.ExpirationDate || 'N/A'}</ListGroup.Item>
                {/* Add more fields as needed */}
              </ListGroup>
            </div>
          ))}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ActionsPage;
