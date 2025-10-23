import React, { useState } from 'react';
import { Form, Button, Container, Row, Col, Table, Modal, Spinner, Alert } from 'react-bootstrap';

const Thresholds = ({ cgratesConfig }) => {
  const [searchParams, setSearchParams] = useState({
    tenant: cgratesConfig.tenants.split(';')[0], // Default to the first tenant
  });
  const [thresholds, setThresholds] = useState([]); // Store the list of threshold profile IDs
  const [selectedThreshold, setSelectedThreshold] = useState(null); // Store the selected threshold profile details
  const [editThreshold, setEditThreshold] = useState(null); // Store the editable threshold details
  const [showModal, setShowModal] = useState(false); // Control the modal display
  const [isLoading, setIsLoading] = useState(false); // Handle loading state
  const [responseTime, setResponseTime] = useState(null); // API response time
  const [isEditing, setIsEditing] = useState(false); // Toggle editing mode
  const [isNew, setIsNew] = useState(false); // Flag to track if creating a new threshold
  const [errorMessage, setErrorMessage] = useState(''); // Handle error messages

  // Handle input change for tenant selection
  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setSearchParams({ ...searchParams, [name]: value });
  };

  // Fetch all threshold profile IDs based on the selected tenant
  const fetchThresholds = async () => {
    setIsLoading(true);
    setThresholds([]); // Clear previous results
    setErrorMessage('');
    const startTime = Date.now();

    try {
      const query = {
        method: 'APIerSv1.GetThresholdProfileIDs',
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

      if (data.error) {
        setErrorMessage(data.error.message || 'Error fetching threshold profiles');
      } else if (data.result) {
        setThresholds(data.result); // Set the fetched threshold IDs
      } else {
        console.warn('No threshold profiles found.');
      }
    } catch (error) {
      console.error('Error fetching threshold IDs:', error);
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch details of a selected threshold profile
  const fetchThresholdDetails = async (thresholdId) => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const query = {
        method: 'APIerSv1.GetThresholdProfile',
        params: [{ Tenant: searchParams.tenant, ID: thresholdId }]
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
        setErrorMessage(data.error.message || 'Error fetching threshold profile details');
      } else if (data.result) {
        setSelectedThreshold(data.result); // Set the fetched threshold details
        setEditThreshold(JSON.parse(JSON.stringify(data.result))); // Deep copy for editing
        setIsNew(false); // Ensure this is treated as an edit
        setShowModal(true); // Show the modal with details
      }
    } catch (error) {
      console.error('Error fetching threshold details:', error);
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Open modal to create a new threshold profile
  const openCreateNewThresholdModal = () => {
    const newThreshold = {
      Tenant: searchParams.tenant,
      ID: '',
      FilterIDs: [],
      ActivationInterval: null,
      MaxHits: -1,
      MinHits: 1,
      MinSleep: '0',
      Blocker: false,
      Weight: 0,
      ActionIDs: [],
      Async: false,
    };
    setEditThreshold(newThreshold);
    setIsNew(true); // Mark this as a new threshold creation
    setIsEditing(true); // Automatically start in edit mode
    setShowModal(true); // Show modal
    setErrorMessage('');
  };

  // Toggle editing mode
  const toggleEdit = () => {
    setIsEditing(!isEditing);
  };

  // Handle changes to editable threshold data
  const handleEditChange = (field, value) => {
    setEditThreshold({ ...editThreshold, [field]: value });
  };

  // Handle FilterIDs changes
  const handleFilterIDChange = (index, value) => {
    const updatedFilterIDs = [...(editThreshold.FilterIDs || [])];
    updatedFilterIDs[index] = value;
    setEditThreshold({ ...editThreshold, FilterIDs: updatedFilterIDs });
  };

  // Add new FilterID
  const addFilterID = () => {
    const updatedFilterIDs = [...(editThreshold.FilterIDs || [])];
    updatedFilterIDs.push('');
    setEditThreshold({ ...editThreshold, FilterIDs: updatedFilterIDs });
  };

  // Remove FilterID
  const removeFilterID = (index) => {
    const updatedFilterIDs = [...(editThreshold.FilterIDs || [])];
    updatedFilterIDs.splice(index, 1);
    setEditThreshold({ ...editThreshold, FilterIDs: updatedFilterIDs });
  };

  // Handle ActionIDs changes
  const handleActionIDChange = (index, value) => {
    const updatedActionIDs = [...(editThreshold.ActionIDs || [])];
    updatedActionIDs[index] = value;
    setEditThreshold({ ...editThreshold, ActionIDs: updatedActionIDs });
  };

  // Add new ActionID
  const addActionID = () => {
    const updatedActionIDs = [...(editThreshold.ActionIDs || [])];
    updatedActionIDs.push('');
    setEditThreshold({ ...editThreshold, ActionIDs: updatedActionIDs });
  };

  // Remove ActionID
  const removeActionID = (index) => {
    const updatedActionIDs = [...(editThreshold.ActionIDs || [])];
    updatedActionIDs.splice(index, 1);
    setEditThreshold({ ...editThreshold, ActionIDs: updatedActionIDs });
  };

  // Save the edited or newly created threshold
  const saveChanges = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const query = {
        method: 'APIerSv1.SetThresholdProfile',
        params: [editThreshold] // Send the edited or new threshold back to the API
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
        setErrorMessage(data.error.message || 'Error saving threshold profile');
      } else if (data.result) {
        console.log('Threshold profile saved successfully');
        setIsEditing(false);
        setShowModal(false);
        fetchThresholds(); // Refresh the list of thresholds after saving
      }
    } catch (error) {
      console.error('Error saving threshold profile:', error);
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete selected threshold profile
  const deleteThreshold = async (thresholdId) => {
    if (!window.confirm(`Are you sure you want to delete threshold profile: ${thresholdId}?`)) {
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      const query = {
        method: 'APIerSv1.RemoveThresholdProfile',
        params: [{ Tenant: searchParams.tenant, ID: thresholdId }]
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
        setErrorMessage(data.error.message || 'Error deleting threshold profile');
      } else if (data.result) {
        console.log('Threshold profile deleted successfully');
        setShowModal(false);
        fetchThresholds(); // Refresh the list of thresholds after deletion
      }
    } catch (error) {
      console.error('Error deleting threshold profile:', error);
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowClick = (thresholdId) => {
    fetchThresholdDetails(thresholdId); // Fetch the details when a threshold is clicked
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedThreshold(null);
    setIsEditing(false);
    setErrorMessage('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    fetchThresholds(); // Fetch thresholds based on the selected tenant
  };

  return (
    <Container>
      <h2>Threshold Profiles</h2>
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
          <Col md={3} className="d-flex align-items-end">
            <Button type="submit" className="w-100" variant="primary">
              Fetch Threshold Profiles
            </Button>
          </Col>
          <Col md={3} className="d-flex align-items-end">
            <Button
              onClick={openCreateNewThresholdModal}
              className="w-100"
              variant="success"
            >
              Create New Threshold
            </Button>
          </Col>
        </Row>
      </Form>

      {errorMessage && (
        <Alert variant="danger" className="mt-3" dismissible onClose={() => setErrorMessage('')}>
          {errorMessage}
        </Alert>
      )}

      {isLoading && !showModal ? (
        <div className="text-center mt-4">
          <Spinner animation="border" />
          <p>Loading...</p>
        </div>
      ) : (
        <>
          {responseTime && (
            <p className="mt-3">Response Time: {responseTime}s</p>
          )}
          <Table striped bordered hover className="mt-4">
            <thead>
              <tr>
                <th>#</th>
                <th>Threshold Profile ID</th>
              </tr>
            </thead>
            <tbody>
              {thresholds.length > 0 ? thresholds.map((thresholdId, index) => (
                <tr key={index} onClick={() => handleRowClick(thresholdId)} style={{ cursor: 'pointer' }}>
                  <td>{index + 1}</td>
                  <td>{thresholdId}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="2" className="text-center">No threshold profiles found</td>
                </tr>
              )}
            </tbody>
          </Table>
        </>
      )}

      {/* Modal for viewing/editing threshold details */}
      <Modal show={showModal} onHide={handleCloseModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {isNew ? 'Create New Threshold Profile' : `Threshold Profile: ${selectedThreshold?.ID}`}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {errorMessage && (
            <Alert variant="danger" dismissible onClose={() => setErrorMessage('')}>
              {errorMessage}
            </Alert>
          )}

          {isLoading ? (
            <div className="text-center">
              <Spinner animation="border" />
              <p>Loading...</p>
            </div>
          ) : editThreshold ? (
            <div>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>ID</Form.Label>
                  <Form.Control
                    type="text"
                    value={editThreshold.ID || ''}
                    onChange={(e) => handleEditChange('ID', e.target.value)}
                    disabled={!isEditing}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Weight</Form.Label>
                  <Form.Control
                    type="number"
                    value={editThreshold.Weight || 0}
                    onChange={(e) => handleEditChange('Weight', parseFloat(e.target.value))}
                    disabled={!isEditing}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Max Hits (-1 for unlimited)</Form.Label>
                  <Form.Control
                    type="number"
                    value={editThreshold.MaxHits || -1}
                    onChange={(e) => handleEditChange('MaxHits', parseInt(e.target.value))}
                    disabled={!isEditing}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Min Hits</Form.Label>
                  <Form.Control
                    type="number"
                    value={editThreshold.MinHits || 1}
                    onChange={(e) => handleEditChange('MinHits', parseInt(e.target.value))}
                    disabled={!isEditing}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Min Sleep (duration)</Form.Label>
                  <Form.Control
                    type="text"
                    value={editThreshold.MinSleep || '0'}
                    onChange={(e) => handleEditChange('MinSleep', e.target.value)}
                    disabled={!isEditing}
                    placeholder="e.g., 1s, 1m, 1h"
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label="Blocker"
                    checked={editThreshold.Blocker || false}
                    onChange={(e) => handleEditChange('Blocker', e.target.checked)}
                    disabled={!isEditing}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label="Async"
                    checked={editThreshold.Async || false}
                    onChange={(e) => handleEditChange('Async', e.target.checked)}
                    disabled={!isEditing}
                  />
                </Form.Group>

                <hr />
                <h5>Filter IDs</h5>
                {(editThreshold.FilterIDs || []).map((filterId, index) => (
                  <div key={index} className="d-flex mb-2">
                    <Form.Control
                      type="text"
                      value={filterId}
                      onChange={(e) => handleFilterIDChange(index, e.target.value)}
                      disabled={!isEditing}
                      placeholder="Filter ID"
                    />
                    {isEditing && (
                      <Button
                        variant="danger"
                        className="ms-2"
                        onClick={() => removeFilterID(index)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                {isEditing && (
                  <Button variant="secondary" onClick={addFilterID}>
                    Add Filter ID
                  </Button>
                )}

                <hr />
                <h5>Action IDs</h5>
                {(editThreshold.ActionIDs || []).map((actionId, index) => (
                  <div key={index} className="d-flex mb-2">
                    <Form.Control
                      type="text"
                      value={actionId}
                      onChange={(e) => handleActionIDChange(index, e.target.value)}
                      disabled={!isEditing}
                      placeholder="Action ID"
                    />
                    {isEditing && (
                      <Button
                        variant="danger"
                        className="ms-2"
                        onClick={() => removeActionID(index)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                {isEditing && (
                  <Button variant="secondary" onClick={addActionID}>
                    Add Action ID
                  </Button>
                )}

                <hr />
                <h5>Raw Data</h5>
                <pre style={{
                  backgroundColor: '#f4f4f4',
                  padding: '10px',
                  borderRadius: '5px',
                  maxHeight: '300px',
                  overflow: 'auto'
                }}>
                  {JSON.stringify(editThreshold, null, 2)}
                </pre>
              </Form>
            </div>
          ) : (
            <p>No data available</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          {!isNew && !isEditing && (
            <Button variant="danger" onClick={() => deleteThreshold(editThreshold?.ID)}>
              Delete
            </Button>
          )}
          {isEditing ? (
            <>
              <Button variant="success" onClick={saveChanges} disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="secondary" onClick={toggleEdit}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button variant="primary" onClick={toggleEdit}>
                Edit
              </Button>
              <Button variant="secondary" onClick={handleCloseModal}>
                Close
              </Button>
            </>
          )}
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default Thresholds;
