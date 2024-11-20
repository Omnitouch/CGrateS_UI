import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Table, Modal, Spinner, ListGroup } from 'react-bootstrap';

const Chargers = ({ cgratesConfig }) => {
  const [searchParams, setSearchParams] = useState({
    tenant: cgratesConfig.tenants.split(';')[0], // Default to the first tenant
  });
  const [chargers, setChargers] = useState([]); // Store the list of chargers
  const [selectedCharger, setSelectedCharger] = useState(null); // Store the selected charger's details
  const [showModal, setShowModal] = useState(false); // Control the modal display
  const [isLoading, setIsLoading] = useState(false); // Handle loading state
  const [responseTime, setResponseTime] = useState(null); // API response time
  const [error, setError] = useState(''); // Handle error messages
  const [isEditing, setIsEditing] = useState(false); // Manage edit state
  const [editCharger, setEditCharger] = useState({}); // Store edited charger

  useEffect(() => {
    setSearchParams({ tenant: cgratesConfig.tenants.split(';')[0] }); // Ensure tenant is set to default on mount
  }, [cgratesConfig]);

  // Handle input change for tenant selection
  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setSearchParams({ ...searchParams, [name]: value });
  };

  // Fetch all charger profile IDs based on the selected tenant
  const fetchChargers = async () => {
    setIsLoading(true);
    setChargers([]); // Clear previous results
    const startTime = Date.now();

    try {
      const query = {
        method: 'APIerSv1.GetChargerProfileIDs',
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
        setChargers(data.result); // Set the fetched charger IDs
      } else {
        console.warn('No chargers found.');
      }
    } catch (error) {
      console.error('Error fetching charger IDs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch details of a selected charger profile
  const fetchChargerDetails = async (chargerId) => {
    setIsLoading(true);
    try {
      const chargerProfileQuery = {
        method: 'APIerSv1.GetChargerProfile',
        params: [{ Tenant: searchParams.tenant, ID: chargerId }],
        id: 3,
      };

      const chargerProfileResponse = await fetch(cgratesConfig.url + '/jsonrpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chargerProfileQuery),
      });

      if (!chargerProfileResponse.ok) {
        throw new Error(`HTTP error! status: ${chargerProfileResponse.status}`);
      }

      const chargerProfileData = await chargerProfileResponse.json();

      if (chargerProfileData.result) {
        const result = chargerProfileData.result;
        result.FilterIDs = result.FilterIDs || []; // Ensure FilterIDs are initialized as an array
        result.AttributeIDs = result.AttributeIDs || []; // Ensure AttributeIDs are initialized as an array
        setSelectedCharger(result);
        setEditCharger(result);
        setShowModal(true); // Show the modal with details
        setIsEditing(false); // Ensure it starts in view mode
      }
    } catch (error) {
      console.error('Error fetching charger details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowClick = (chargerId) => {
    fetchChargerDetails(chargerId); // Fetch the details when a charger is clicked
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedCharger(null);
    setIsEditing(false); // Reset edit mode
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditCharger({ ...editCharger, [name]: value });
  };

  // Handle FilterID changes
  const handleFilterIDChange = (index, newValue) => {
    const updatedFilterIDs = [...editCharger.FilterIDs];
    updatedFilterIDs[index] = newValue;
    setEditCharger({ ...editCharger, FilterIDs: updatedFilterIDs });
  };

  // Add a new FilterID
  const addFilterID = () => {
    const updatedFilterIDs = [...(editCharger.FilterIDs || [])];
    updatedFilterIDs.push(''); // Add empty FilterID
    setEditCharger({ ...editCharger, FilterIDs: updatedFilterIDs });
  };

  // Remove a FilterID
  const removeFilterID = (index) => {
    const updatedFilterIDs = [...editCharger.FilterIDs];
    updatedFilterIDs.splice(index, 1);
    setEditCharger({ ...editCharger, FilterIDs: updatedFilterIDs });
  };

  // Handle AttributeID changes
  const handleAttributeIDChange = (index, newValue) => {
    const updatedAttributeIDs = [...editCharger.AttributeIDs];
    updatedAttributeIDs[index] = newValue;
    setEditCharger({ ...editCharger, AttributeIDs: updatedAttributeIDs });
  };

  // Add a new AttributeID
  const addAttributeID = () => {
    const updatedAttributeIDs = [...(editCharger.AttributeIDs || [])];
    updatedAttributeIDs.push(''); // Add empty AttributeID
    setEditCharger({ ...editCharger, AttributeIDs: updatedAttributeIDs });
  };

  // Remove an AttributeID
  const removeAttributeID = (index) => {
    const updatedAttributeIDs = [...editCharger.AttributeIDs];
    updatedAttributeIDs.splice(index, 1);
    setEditCharger({ ...editCharger, AttributeIDs: updatedAttributeIDs });
  };

  const saveCharger = async () => {
    setIsLoading(true);
    setError(''); // Clear previous error
    try {
      const query = {
        method: 'APIerSv1.SetChargerProfile',
        params: [
          {
            Tenant: editCharger.Tenant,
            ID: editCharger.ID,
            RunID: editCharger.RunID,
            FilterIDs: editCharger.FilterIDs,
            AttributeIDs: editCharger.AttributeIDs,
            Weight: editCharger.Weight,
          },
        ],
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
        console.log('Charger updated successfully');
        fetchChargers(); // Refresh the charger list
        handleCloseModal();
      }
    } catch (error) {
      console.error('Error updating charger:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    fetchChargers(); // Fetch chargers based on the selected tenant
  };

  const handleNewCharger = () => {
    setEditCharger({
      Tenant: searchParams.tenant || '',
      ID: '',
      FilterIDs: [],
      UsageTTL: -1,
      Limit: 5,
      Blocker: false,
      Stored: true,
      Weight: 10,
      ThresholdIDs: ['*none'],
      RunID: '',
      AttributeIDs: [],
    });
    setSelectedCharger(null); // Clear selectedCharger so it doesn't render view mode
    setIsEditing(true); // Set to edit mode
    setShowModal(true); // Open modal for the new charger
  };

  return (
    <div className="App">
      <Container>
        <h2>Charger Profiles</h2>
        <Form onSubmit={handleSubmit} className="mt-4">
          <Row>
            <Col md={6}>
              <Form.Group controlId="formTenant">
                <Form.Label>Tenant</Form.Label>
                <Form.Control as="select" name="tenant" value={searchParams.tenant} onChange={handleInputChange}>
                  {cgratesConfig.tenants.split(';').map((tenant, index) => (
                    <option key={index} value={tenant}>{tenant}</option>
                  ))}
                </Form.Control>
              </Form.Group>
            </Col>
            <Col md={6} className="d-flex align-items-end">
              <Button type="submit" className="w-100">Fetch Chargers</Button>
            </Col>
          </Row>
        </Form>

        <Button variant="success" className="mt-3" onClick={handleNewCharger}>
          Add New Charger
        </Button>

        {isLoading ? (
          <div className="text-center mt-4">
            <Spinner animation="border" role="status">
              <span className="sr-only">Loading...</span>
            </Spinner>
            <p>Loading chargers, please wait...</p>
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
                  <th>Charger ID</th>
                </tr>
              </thead>
              <tbody>
                {chargers.length > 0 ? chargers.map((charger, index) => (
                  <tr key={index} onClick={() => handleRowClick(charger)} style={{ cursor: 'pointer' }}>
                    <td>{index + 1}</td>
                    <td>{charger}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="2" className="text-center">No chargers available</td>
                  </tr>
                )}
              </tbody>
            </Table>
          </>
        )}

        {/* Modal for displaying charger details */}
        <Modal show={showModal} onHide={handleCloseModal} size="xl">
          <Modal.Header closeButton>
            <Modal.Title>{isEditing ? 'Edit Charger Profile' : 'Charger Profile Details'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {isEditing ? (
              <>
                <Form.Group>
                  <Form.Label>Tenant</Form.Label>
                  <Form.Control type="text" name="Tenant" value={editCharger.Tenant} onChange={handleEditChange} readOnly={!isEditing} />
                </Form.Group>
                <Form.Group>
                  <Form.Label>ID</Form.Label>
                  <Form.Control type="text" name="ID" value={editCharger.ID} onChange={handleEditChange} />
                </Form.Group>
                <Form.Group>
                  <Form.Label>Weight</Form.Label>
                  <Form.Control type="number" name="Weight" value={editCharger.Weight} onChange={handleEditChange} />
                </Form.Group>
                <Form.Group>
                  <Form.Label>Run ID</Form.Label>
                  <Form.Control type="text" name="RunID" value={editCharger.RunID} onChange={handleEditChange} />
                </Form.Group>
                <Form.Group>
                  <Form.Label>Filter IDs</Form.Label>
                  {(editCharger.FilterIDs || []).map((filterID, index) => (
                    <div key={index} style={{ display: 'flex', marginBottom: '5px' }}>
                      <Form.Control
                        type="text"
                        value={filterID}
                        onChange={(e) => handleFilterIDChange(index, e.target.value)}
                        style={{ marginRight: '10px' }}
                      />
                      <Button variant="danger" onClick={() => removeFilterID(index)}>Remove</Button>
                    </div>
                  ))}
                  <Button onClick={addFilterID}>Add FilterID</Button>
                </Form.Group>
                <Form.Group>
                  <Form.Label>Attribute IDs</Form.Label>
                  {(editCharger.AttributeIDs || []).map((attributeID, index) => (
                    <div key={index} style={{ display: 'flex', marginBottom: '5px' }}>
                      <Form.Control
                        type="text"
                        value={attributeID}
                        onChange={(e) => handleAttributeIDChange(index, e.target.value)}
                        style={{ marginRight: '10px' }}
                      />
                      <Button variant="danger" onClick={() => removeAttributeID(index)}>Remove</Button>
                    </div>
                  ))}
                  <Button onClick={addAttributeID}>Add AttributeID</Button>
                </Form.Group>
              </>
            ) : (
              selectedCharger && (
                <>
                  <h5>General Information</h5>
                  <ListGroup className="mb-3">
                    <ListGroup.Item><strong>Tenant:</strong> {selectedCharger.Tenant}</ListGroup.Item>
                    <ListGroup.Item><strong>ID:</strong> {selectedCharger.ID}</ListGroup.Item>
                    <ListGroup.Item><strong>Weight:</strong> {selectedCharger.Weight}</ListGroup.Item>
                    <ListGroup.Item><strong>Run ID:</strong> {selectedCharger.RunID}</ListGroup.Item>
                    <ListGroup.Item><strong>Filter IDs:</strong> {selectedCharger.FilterIDs.length > 0 ? selectedCharger.FilterIDs.join(', ') : 'None'}</ListGroup.Item>
                    <ListGroup.Item><strong>Attribute IDs:</strong> {selectedCharger.AttributeIDs.length > 0 ? selectedCharger.AttributeIDs.join(', ') : 'None'}</ListGroup.Item>
                  </ListGroup>
                </>
              )
            )}
          </Modal.Body>
          <Modal.Footer>
            {isEditing ? (
              <Button variant="primary" onClick={saveCharger}>
                Save Changes
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
      </Container>
    </div>
  );
};

export default Chargers;
