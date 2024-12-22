import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Table, Modal, Spinner, ListGroup } from 'react-bootstrap';

const StatsS = ({ cgratesConfig }) => {
  const [searchParams, setSearchParams] = useState({
    tenant: cgratesConfig.tenants.split(';')[0],
  });
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [editProfile, setEditProfile] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [responseTime, setResponseTime] = useState(null);

  const metricsOptions = [
    { value: '*asr', label: 'Answer-seizure ratio' },
    { value: '*acd', label: 'Average call duration' },
    { value: '*tcd', label: 'Total call duration' },
    { value: '*acc', label: 'Average call cost' },
    { value: '*tcc', label: 'Total call cost' },
    { value: '*pdd', label: 'Post dial delay' },
    { value: '*ddc', label: 'Distinct destination count' },
    { value: '*sum', label: 'Generic sum (e.g., *sum#FieldName)' },
    { value: '*average', label: 'Generic average (e.g., *average#FieldName)' },
    { value: '*distinct', label: 'Generic distinct (e.g., *distinct#FieldName)' },
  ];

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

      const data = await response.json();
      const endTime = Date.now();
      setResponseTime(((endTime - startTime) / 1000).toFixed(2));

      if (data.result) {
        setProfiles(data.result);
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

      const data = await response.json();

      if (data.result) {
        setSelectedProfile(data.result);
        setEditProfile({ ...data.result });
        setShowModal(true);
        setIsEditing(false);
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
    setIsEditing(false);
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditProfile({ ...editProfile, [name]: value });
  };

  const handleMetricChange = (index, newValue) => {
    const updatedMetrics = [...editProfile.Metrics];
    updatedMetrics[index].MetricID = newValue;
    setEditProfile({ ...editProfile, Metrics: updatedMetrics });
  };

  const addMetric = () => {
    const updatedMetrics = [...(editProfile.Metrics || [])];
    updatedMetrics.push({ MetricID: metricsOptions[0].value }); // Default to first metric
    setEditProfile({ ...editProfile, Metrics: updatedMetrics });
  };

  const removeMetric = (index) => {
    const updatedMetrics = [...editProfile.Metrics];
    updatedMetrics.splice(index, 1);
    setEditProfile({ ...editProfile, Metrics: updatedMetrics });
  };

  const saveProfile = async () => {
    setIsLoading(true);
    try {
      const query = {
        method: 'APIerSv1.SetStatQueueProfile',
        params: [{ ...editProfile }],
      };

      const response = await fetch(cgratesConfig.url + '/jsonrpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(query),
      });

      const data = await response.json();

      if (data.result) {
        fetchProfiles();
        handleCloseModal();
      }
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const removeProfile = async (profileId) => {
    if (!window.confirm('Are you sure you want to remove this profile?')) return;

    setIsLoading(true);
    try {
      const query = {
        method: 'StatSv1.RemoveStatQueueProfile',
        params: [{ Tenant: searchParams.tenant, ID: profileId }],
        id: 3,
      };

      const response = await fetch(cgratesConfig.url + '/jsonrpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(query),
      });

      const data = await response.json();

      if (data.result) {
        fetchProfiles();
      }
    } catch (error) {
      console.error('Error removing profile:', error);
    } finally {
      setIsLoading(false);
    }
  };



  const fetchMetrics = async (profileId) => {
    setIsLoading(true);
    try {
      const query = {
        method: 'StatSv1.GetQueueStringMetrics',
        params: [{ Tenant: searchParams.tenant, ID: profileId, APIOpts: {} }],
        id: 12,
      };

      const response = await fetch(cgratesConfig.url + '/jsonrpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(query),
      });

      const data = await response.json();

      if (data.result) {
        setSelectedProfile((prevProfile) => ({
          ...prevProfile,
          MetricsDetails: data.result,
        }));
        setShowModal(true);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearStat = async (profileId) => {
    setIsLoading(true);
    try {
      const query = {
        method: 'StatSv1.ResetStatQueue',
        params: [{ Tenant: searchParams.tenant, ID: profileId }],
        id: 4,
      };

      const response = await fetch(cgratesConfig.url + '/jsonrpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(query),
      });

      const data = await response.json();

      if (data.result) {
        console.log('Stat cleared successfully.');
      }
    } catch (error) {
      console.error('Error clearing stat:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewProfile = () => {
    setEditProfile({
      Tenant: searchParams.tenant,
      ID: '',
      QueueLength: 0,
      TTL: -1,
      MinItems: 0,
      Metrics: [],
    });
    setIsEditing(true);
    setShowModal(true);
  };

  return (
    <div>
      <Container>
        <h2>Stat Queue Profiles</h2>
        <Form onSubmit={(e) => e.preventDefault()}>
          <Row>
            <Col>
              <Form.Group controlId="tenant">
                <Form.Label>Tenant</Form.Label>
                <Form.Control
                  as="select"
                  name="tenant"
                  value={searchParams.tenant}
                  onChange={handleInputChange}
                >
                  {cgratesConfig.tenants.split(';').map((tenant) => (
                    <option key={tenant}>{tenant}</option>
                  ))}
                </Form.Control>
              </Form.Group>
            </Col>
            <Col>
              <Button onClick={fetchProfiles}>Fetch Profiles</Button>
            </Col>
          </Row>
        </Form>
        <Table striped bordered hover>
          <thead>
            <tr>
              <th>ID</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile}>
                <td>{profile}</td>
                <td>
                  <Button onClick={() => handleRowClick(profile)}>View</Button>
                  <Button onClick={() => fetchMetrics(profile)}>View Metrics</Button>
                  <Button onClick={() => removeProfile(profile)}>Remove</Button>
                  <Button onClick={() => clearStat(profile)}>Clear Stat</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Container>
      {/* Profile Modal */}
      <Modal show={showModal} onHide={handleCloseModal}>
        <Modal.Header closeButton>
          <Modal.Title>
            {isEditing ? 'Edit Profile' : 'View Profile'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {isEditing ? (
            <>
              <Form.Group>
                <Form.Label>ID</Form.Label>
                <Form.Control
                  type="text"
                  name="ID"
                  value={editProfile.ID}
                  onChange={handleEditChange}
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Queue Length</Form.Label>
                <Form.Control
                  type="number"
                  name="QueueLength"
                  value={editProfile.QueueLength}
                  onChange={handleEditChange}
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Metrics</Form.Label>
                {(editProfile.Metrics || []).map((metric, index) => (
                  <div
                    key={index}
                    style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}
                  >
                    <Form.Control
                      as="select"
                      value={metric.MetricID}
                      onChange={(e) => handleMetricChange(index, e.target.value)}
                      style={{ marginRight: '10px' }}
                    >
                      {metricsOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Form.Control>
                    <Button variant="danger" onClick={() => removeMetric(index)}>
                      Remove
                    </Button>
                  </div>
                ))}
                <Button onClick={addMetric}>Add Metric</Button>
              </Form.Group>
            </>
          ) : (
            selectedProfile && (
              <>
                <ListGroup>
                  <ListGroup.Item>
                    <strong>ID:</strong> {selectedProfile.ID}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong>Queue Length:</strong> {selectedProfile.QueueLength}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong>Metrics:</strong>
                    <ul>
                      {selectedProfile.Metrics.map((metric, index) => (
                        <li key={index}>{metric.MetricID}</li>
                      ))}
                    </ul>
                  </ListGroup.Item>
                </ListGroup>
              </>
            )
          )}
        </Modal.Body>
        <Modal.Footer>
          {isEditing ? (
            <Button variant="primary" onClick={saveProfile}>
              Save
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          )}
          <Button variant="secondary" onClick={handleCloseModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default StatsS;
