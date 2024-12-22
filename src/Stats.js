import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Table, Modal, Spinner, ListGroup } from 'react-bootstrap';

const StatsS = ({ cgratesConfig }) => {
  const [searchParams, setSearchParams] = useState({
    tenant: cgratesConfig.tenants.split(';')[0], // Default to the first tenant
  });
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [responseTime, setResponseTime] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setSearchParams({ tenant: cgratesConfig.tenants.split(';')[0] });
  }, [cgratesConfig]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setSearchParams({ ...searchParams, [name]: value });
  };

  const fetchProfiles = async () => {
    setIsLoading(true);
    setProfiles([]);
    const startTime = Date.now();

    try {
      const query = {
        method: 'APIerSv1.GetStatQueueProfileIDs',
        params: [{ Tenant: searchParams.tenant, Limit: null, Offset: null }],
        id: 1,
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
        setProfiles(data.result);
      } else {
        console.warn('No profiles found.');
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfileDetails = async (profileId) => {
    setIsLoading(true);
    try {
      const query = {
        method: 'APIerSv1.GetStatQueueProfile',
        params: [{ Tenant: searchParams.tenant, ID: profileId }],
        id: 2,
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
        setSelectedProfile(data.result);
        setShowModal(true);
      }
    } catch (error) {
      console.error('Error fetching profile details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowClick = (profileId) => {
    fetchProfileDetails(profileId);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedProfile(null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    fetchProfiles();
  };

  return (
    <div className="App">
      <Container>
        <h2>Stat Queue Profiles</h2>
        <Form onSubmit={handleSubmit} className="mt-4">
          <Row>
            <Col md={6}>
              <Form.Group controlId="formTenant">
                <Form.Label>Tenant</Form.Label>
                <Form.Control
                  as="select"
                  name="tenant"
                  value={searchParams.tenant}
                  onChange={handleInputChange}
                >
                  {cgratesConfig.tenants.split(';').map((tenant, index) => (
                    <option key={index} value={tenant}>
                      {tenant}
                    </option>
                  ))}
                </Form.Control>
              </Form.Group>
            </Col>
            <Col md={6} className="d-flex align-items-end">
              <Button type="submit" className="w-100">
                Fetch Profiles
              </Button>
            </Col>
          </Row>
        </Form>

        {isLoading ? (
          <div className="text-center mt-4">
            <Spinner animation="border" role="status">
              <span className="sr-only">Loading...</span>
            </Spinner>
            <p>Loading profiles, please wait...</p>
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
                  <th>Profile ID</th>
                </tr>
              </thead>
              <tbody>
                {profiles.length > 0 ? (
                  profiles.map((profile, index) => (
                    <tr
                      key={index}
                      onClick={() => handleRowClick(profile)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>{index + 1}</td>
                      <td>{profile}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="2" className="text-center">
                      No profiles available
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </>
        )}

        <Modal show={showModal} onHide={handleCloseModal} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>Profile Details</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {selectedProfile && (
              <>
                <h5>General Information</h5>
                <ListGroup>
                  <ListGroup.Item>
                    <strong>Tenant:</strong> {selectedProfile.Tenant}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong>ID:</strong> {selectedProfile.ID}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong>Queue Length:</strong> {selectedProfile.QueueLength}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong>Metrics:</strong>{' '}
                    {selectedProfile.Metrics.map((metric) => metric.MetricID).join(', ')}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong>Stored:</strong> {selectedProfile.Stored ? 'Yes' : 'No'}
                  </ListGroup.Item>
                </ListGroup>
              </>
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

export default StatsS;
