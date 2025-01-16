import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Table, Modal, Spinner, ListGroup } from 'react-bootstrap';

const RouteProfiles = ({ cgratesConfig }) => {
  const [searchParams, setSearchParams] = useState({
    tenant: cgratesConfig.tenants.split(';')[0], // Default to the first tenant
  });
  const [routeProfiles, setRouteProfiles] = useState([]); // Store the list of route profiles
  const [selectedRouteProfile, setSelectedRouteProfile] = useState(null); // Store selected route profile details
  const [showModal, setShowModal] = useState(false); // Control modal display
  const [isLoading, setIsLoading] = useState(false); // Handle loading state
  const [responseTime, setResponseTime] = useState(null); // API response time
  const [isEditing, setIsEditing] = useState(false); // Manage edit state
  const [editRouteProfile, setEditRouteProfile] = useState({}); // Store edited route profile

  useEffect(() => {
    // Ensure tenant is set to default on mount
    setSearchParams({ tenant: cgratesConfig.tenants.split(';')[0] });
  }, [cgratesConfig]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setSearchParams({ ...searchParams, [name]: value });
  };

  const fetchRouteProfiles = async () => {
    setIsLoading(true);
    setRouteProfiles([]); // Clear previous results
    const startTime = Date.now();

    try {
      const query = {
        method: 'APIerSv1.GetRouteProfileIDs',
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
        setRouteProfiles(data.result); // Set fetched route profile IDs
      } else {
        console.warn('No route profiles found.');
      }
    } catch (error) {
      console.error('Error fetching route profile IDs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRouteProfileDetails = async (routeProfileId) => {
    setIsLoading(true);
    try {
      const query = {
        method: 'APIerSv1.GetRouteProfile',
        params: [{ Tenant: searchParams.tenant, ID: routeProfileId }],
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
        setSelectedRouteProfile(data.result);
        setEditRouteProfile(data.result);
        setShowModal(true);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error fetching route profile details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowClick = (routeProfileId) => {
    fetchRouteProfileDetails(routeProfileId);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedRouteProfile(null);
    setIsEditing(false);
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditRouteProfile({ ...editRouteProfile, [name]: value });
  };

  const handleRouteChange = (index, field, value) => {
    const updatedRoutes = [...editRouteProfile.Routes];
    updatedRoutes[index] = { ...updatedRoutes[index], [field]: value };
    setEditRouteProfile({ ...editRouteProfile, Routes: updatedRoutes });
  };

  const addRoute = () => {
    setEditRouteProfile({
      ...editRouteProfile,
      Routes: [...(editRouteProfile.Routes || []), { ID: '', FilterIDs: [], RouteParameters: '', Weight: 0, Blocker: false }],
    });
  };

  const removeRoute = (index) => {
    const updatedRoutes = [...editRouteProfile.Routes];
    updatedRoutes.splice(index, 1);
    setEditRouteProfile({ ...editRouteProfile, Routes: updatedRoutes });
  };

  const saveRouteProfile = async () => {
    setIsLoading(true);
    try {
      const query = {
        method: 'APIerSv1.SetRouteProfile',
        params: [editRouteProfile],
        id: 3,
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
        fetchRouteProfiles();
        handleCloseModal();
      }
    } catch (error) {
      console.error('Error saving route profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteRouteProfile = async () => {
    if (!selectedRouteProfile) return;
    setIsLoading(true);

    try {
      const query = {
        method: 'APIerSv1.RemoveRouteProfile',
        params: [
          {
            Tenant: selectedRouteProfile.Tenant,
            ID: selectedRouteProfile.ID,
          },
        ],
        id: 4,
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
        fetchRouteProfiles();
        handleCloseModal();
      }
    } catch (error) {
      console.error('Error deleting route profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    fetchRouteProfiles();
  };

  const handleNewRouteProfile = () => {
    setEditRouteProfile({
      Tenant: searchParams.tenant,
      ID: '',
      Weight: 10,
      Routes: [],
    });
    setSelectedRouteProfile(null);
    setIsEditing(true);
    setShowModal(true);
  };

  return (
    <div className="App">
      <Container>
        <h2>Route Profiles</h2>
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
                Fetch Route Profiles
              </Button>
            </Col>
          </Row>
        </Form>

        <Button variant="success" className="mt-3" onClick={handleNewRouteProfile}>
          Add New Route Profile
        </Button>

        {isLoading ? (
          <div className="text-center mt-4">
            <Spinner animation="border" role="status">
              <span className="sr-only">Loading...</span>
            </Spinner>
            <p>Loading route profiles, please wait...</p>
          </div>
        ) : (
          <Table striped bordered hover className="mt-4">
            <thead>
              <tr>
                <th>#</th>
                <th>Route Profile ID</th>
              </tr>
            </thead>
            <tbody>
              {routeProfiles.length > 0 ? (
                routeProfiles.map((profile, index) => (
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
                    No route profiles available
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        )}

        <Modal show={showModal} onHide={handleCloseModal} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>
              {isEditing ? 'Edit Route Profile' : 'Route Profile Details'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {isEditing ? (
              <>
                <Form.Group>
                  <Form.Label>Tenant</Form.Label>
                  <Form.Control
                    type="text"
                    name="Tenant"
                    value={editRouteProfile.Tenant}
                    onChange={handleEditChange}
                    readOnly={!isEditing}
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label>ID</Form.Label>
                  <Form.Control
                    type="text"
                    name="ID"
                    value={editRouteProfile.ID}
                    onChange={handleEditChange}
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label>Weight</Form.Label>
                  <Form.Control
                    type="number"
                    name="Weight"
                    value={editRouteProfile.Weight}
                    onChange={handleEditChange}
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label>Routes</Form.Label>
                  {(editRouteProfile.Routes || []).map((route, index) => (
                    <div key={index} style={{ marginBottom: '10px' }}>
                      <Form.Group>
                        <Form.Label>Route ID</Form.Label>
                        <Form.Control
                          type="text"
                          value={route.ID}
                          onChange={(e) => handleRouteChange(index, 'ID', e.target.value)}
                        />
                      </Form.Group>
                      <Form.Group>
                        <Form.Label>Route Parameters</Form.Label>
                        <Form.Control
                          type="text"
                          value={route.RouteParameters}
                          onChange={(e) => handleRouteChange(index, 'RouteParameters', e.target.value)}
                        />
                      </Form.Group>
                      <Form.Group>
                        <Form.Label>Weight</Form.Label>
                        <Form.Control
                          type="number"
                          value={route.Weight}
                          onChange={(e) => handleRouteChange(index, 'Weight', e.target.value)}
                        />
                      </Form.Group>
                      <Button variant="danger" onClick={() => removeRoute(index)}>
                        Remove Route
                      </Button>
                    </div>
                  ))}
                  <Button variant="secondary" onClick={addRoute}>
                    Add Route
                  </Button>
                </Form.Group>
              </>
            ) : (
              selectedRouteProfile && (
                <ListGroup>
                  <ListGroup.Item>
                    <strong>Tenant:</strong> {selectedRouteProfile.Tenant}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong>ID:</strong> {selectedRouteProfile.ID}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong>Weight:</strong> {selectedRouteProfile.Weight}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong>Routes:</strong>
                    {(selectedRouteProfile.Routes || []).map((route, index) => (
                      <div key={index} style={{ marginLeft: '20px' }}>
                        <p><strong>Route ID:</strong> {route.ID}</p>
                        <p><strong>Route Parameters:</strong> {route.RouteParameters}</p>
                        <p><strong>Weight:</strong> {route.Weight}</p>
                      </div>
                    ))}
                  </ListGroup.Item>
                </ListGroup>
              )
            )}
          </Modal.Body>
          <Modal.Footer>
            {isEditing ? (
              <Button variant="primary" onClick={saveRouteProfile}>
                Save Changes
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
                <Button variant="danger" onClick={deleteRouteProfile}>
                  Delete
                </Button>
              </>
            )}
            <Button variant="secondary" onClick={handleCloseModal}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </div>
  );
};

export default RouteProfiles;
