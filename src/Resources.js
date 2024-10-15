import React, { useState } from 'react';
import { Form, Button, Container, Row, Col, Table, Modal, Spinner, ListGroup } from 'react-bootstrap';

const Resources = ({ cgratesConfig }) => {
  const [searchParams, setSearchParams] = useState({
    tenant: '', // Tenant selection
  });
  const [resources, setResources] = useState([]); // Store the list of resources
  const [selectedResource, setSelectedResource] = useState(null); // Store the selected resource's details
  const [showModal, setShowModal] = useState(false); // Control the modal display
  const [isLoading, setIsLoading] = useState(false); // Handle loading state
  const [responseTime, setResponseTime] = useState(null); // API response time
  const [error, setError] = useState(''); // Handle error messages
  const [isEditing, setIsEditing] = useState(false); // Manage edit state
  const [editResource, setEditResource] = useState({}); // Store edited resource

  // Handle input change for tenant selection
  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setSearchParams({ ...searchParams, [name]: value });
  };

  // Fetch all resource profile IDs based on the selected tenant
  const fetchResources = async () => {
    setIsLoading(true);
    setResources([]); // Clear previous results
    const startTime = Date.now();

    try {
      const query = {
        method: 'APIerSv1.GetResourceProfileIDs',
        params: [{ Tenant: searchParams.tenant, Limit: null, Offset: null }],
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
        setResources(data.result); // Set the fetched resource IDs
      } else {
        console.warn('No resources found.');
      }
    } catch (error) {
      console.error('Error fetching resource IDs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch details of a selected resource profile
  const fetchResourceDetails = async (resourceId) => {
    setIsLoading(true);
    try {
      // First fetch resource profile details
      const resourceProfileQuery = {
        method: 'APIerSv1.GetResourceProfile',
        params: [{ Tenant: searchParams.tenant, ID: resourceId }],
      };

      const resourceProfileResponse = await fetch(cgratesConfig.url + '/jsonrpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resourceProfileQuery),
      });

      if (!resourceProfileResponse.ok) {
        throw new Error(`HTTP error! status: ${resourceProfileResponse.status}`);
      }

      const resourceProfileData = await resourceProfileResponse.json();

      // Fetch additional resource usage details
      const resourceUsageQuery = {
        method: 'ResourceSv1.GetResource',
        params: [{ Tenant: searchParams.tenant, ID: resourceId, APIOpts: {} }],
      };

      const resourceUsageResponse = await fetch(cgratesConfig.url + '/jsonrpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resourceUsageQuery),
      });

      if (!resourceUsageResponse.ok) {
        throw new Error(`HTTP error! status: ${resourceUsageResponse.status}`);
      }

      const resourceUsageData = await resourceUsageResponse.json();

      if (resourceProfileData.result && resourceUsageData.result) {
        setSelectedResource({ ...resourceProfileData.result, ...resourceUsageData.result });
        setEditResource({ ...resourceProfileData.result });
        setShowModal(true); // Show the modal with details
        setIsEditing(false); // Ensure it starts in view mode
      }
    } catch (error) {
      console.error('Error fetching resource details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowClick = (resourceId) => {
    fetchResourceDetails(resourceId); // Fetch the details when a resource is clicked
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedResource(null);
    setIsEditing(false); // Reset edit mode
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditResource({ ...editResource, [name]: value });
  };

  const handleFilterIDChange = (index, newValue) => {
    const updatedFilterIDs = [...(editResource.FilterIDs || [])];
    updatedFilterIDs[index] = newValue;
    setEditResource({ ...editResource, FilterIDs: updatedFilterIDs });
  };

  const addFilterID = () => {
    const updatedFilterIDs = [...(editResource.FilterIDs || [])];
    updatedFilterIDs.push(''); // Add empty FilterID
    setEditResource({ ...editResource, FilterIDs: updatedFilterIDs });
  };

  const removeFilterID = (index) => {
    const updatedFilterIDs = [...(editResource.FilterIDs || [])];
    updatedFilterIDs.splice(index, 1);
    setEditResource({ ...editResource, FilterIDs: updatedFilterIDs });
  };

  const saveResource = async () => {
    setIsLoading(true);
    setError(''); // Clear previous error
    try {
      const query = {
        method: 'ApierV1.SetResourceProfile',
        params: [editResource],
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
        console.log('Resource updated successfully');
        fetchResources(); // Refresh the resource list
        handleCloseModal();
      }
    } catch (error) {
      console.error('Error updating resource:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    fetchResources(); // Fetch resources based on the selected tenant
  };

  const handleNewResource = () => {
    setEditResource({
      Tenant: searchParams.tenant || '',
      ID: '',
      FilterIDs: [],
      UsageTTL: -1,
      Limit: 5,
      Blocker: false,
      Stored: true,
      Weight: 10,
      ThresholdIDs: ['*none'],
    });
    setSelectedResource(null); // Clear selectedResource so it doesn't render view mode
    setIsEditing(true); // Set to edit mode
    setShowModal(true); // Open modal for the new resource
  };

  return (
    <div className="App">
      <Container>
        <h2>Resource Profiles</h2>
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
              <Button type="submit" className="w-100">Fetch Resources</Button>
            </Col>
          </Row>
        </Form>

        <Button variant="success" className="mt-3" onClick={handleNewResource}>
          Add New Resource
        </Button>

        {isLoading ? (
          <div className="text-center mt-4">
            <Spinner animation="border" role="status">
              <span className="sr-only">Loading...</span>
            </Spinner>
            <p>Loading resources, please wait...</p>
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
                  <th>Resource ID</th>
                </tr>
              </thead>
              <tbody>
                {resources.length > 0 ? resources.map((resource, index) => (
                  <tr key={index} onClick={() => handleRowClick(resource)} style={{ cursor: 'pointer' }}>
                    <td>{index + 1}</td>
                    <td>{resource}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="2" className="text-center">No resources available</td>
                  </tr>
                )}
              </tbody>
            </Table>
          </>
        )}

        {/* Modal for displaying resource details */}
        <Modal show={showModal} onHide={handleCloseModal} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>{isEditing ? 'Edit Resource Profile' : 'Resource Profile Details'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {isEditing ? (
              <>
                <Form.Group>
                  <Form.Label>Tenant</Form.Label>
                  <Form.Control type="text" name="Tenant" value={editResource.Tenant} onChange={handleEditChange} readOnly={!isEditing} />
                </Form.Group>
                <Form.Group>
                  <Form.Label>ID</Form.Label>
                  <Form.Control type="text" name="ID" value={editResource.ID} onChange={handleEditChange} />
                </Form.Group>
                <Form.Group>
                  <Form.Label>Usage TTL</Form.Label>
                  <Form.Control type="number" name="UsageTTL" value={editResource.UsageTTL} onChange={handleEditChange} />
                </Form.Group>
                <Form.Group>
                  <Form.Label>Limit</Form.Label>
                  <Form.Control type="number" name="Limit" value={editResource.Limit} onChange={handleEditChange} />
                </Form.Group>
                <Form.Group>
                  <Form.Label>Blocker</Form.Label>
                  <Form.Control as="select" name="Blocker" value={editResource.Blocker} onChange={handleEditChange}>
                    <option value={true}>Yes</option>
                    <option value={false}>No</option>
                  </Form.Control>
                </Form.Group>
                <Form.Group>
                  <Form.Label>Stored</Form.Label>
                  <Form.Control as="select" name="Stored" value={editResource.Stored} onChange={handleEditChange}>
                    <option value={true}>Yes</option>
                    <option value={false}>No</option>
                  </Form.Control>
                </Form.Group>
                <Form.Group>
                  <Form.Label>Weight</Form.Label>
                  <Form.Control type="number" name="Weight" value={editResource.Weight} onChange={handleEditChange} />
                </Form.Group>
                <Form.Group>
                  <Form.Label>Threshold IDs</Form.Label>
                  <Form.Control type="text" name="ThresholdIDs" value={editResource.ThresholdIDs.join(', ')} onChange={handleEditChange} />
                </Form.Group>
                <h5>Edit FilterIDs</h5>
                {(editResource.FilterIDs || []).map((filterID, index) => (
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
              </>
            ) : (
              selectedResource && (
                <>
                  <h5>General Information</h5>
                  <ListGroup className="mb-3">
                    <ListGroup.Item><strong>Tenant:</strong> {selectedResource.Tenant}</ListGroup.Item>
                    <ListGroup.Item><strong>ID:</strong> {selectedResource.ID}</ListGroup.Item>
                    <ListGroup.Item><strong>Activation Interval:</strong> {selectedResource.ActivationInterval ? `${selectedResource.ActivationInterval.ActivationTime} to ${selectedResource.ActivationInterval.ExpiryTime}` : 'N/A'}</ListGroup.Item>
                    <ListGroup.Item><strong>Usage TTL:</strong> {selectedResource.UsageTTL}</ListGroup.Item>
                    <ListGroup.Item><strong>Limit:</strong> {selectedResource.Limit}</ListGroup.Item>
                    <ListGroup.Item><strong>Blocker:</strong> {selectedResource.Blocker ? 'Yes' : 'No'}</ListGroup.Item>
                    <ListGroup.Item><strong>Stored:</strong> {selectedResource.Stored ? 'Yes' : 'No'}</ListGroup.Item>
                    <ListGroup.Item><strong>Weight:</strong> {selectedResource.Weight}</ListGroup.Item>
                    <ListGroup.Item><strong>Threshold IDs:</strong> {selectedResource.ThresholdIDs.join(', ')}</ListGroup.Item>
                    <ListGroup.Item><strong>Filter IDs:</strong> {selectedResource.FilterIDs && selectedResource.FilterIDs.length > 0 ? selectedResource.FilterIDs.join(', ') : 'None'}</ListGroup.Item>
                  </ListGroup>

                  <h5>Usage Information</h5>
                  <ListGroup>
                    {selectedResource.Usages && Object.keys(selectedResource.Usages).length > 0 ? (
                      Object.entries(selectedResource.Usages).map(([usageId, usageDetails]) => (
                        <ListGroup.Item key={usageId}>
                          <strong>Usage ID:</strong> {usageId}<br />
                          <strong>Tenant:</strong> {usageDetails.Tenant}<br />
                          <strong>Expiry Time:</strong> {usageDetails.ExpiryTime}<br />
                          <strong>Units:</strong> {usageDetails.Units}
                        </ListGroup.Item>
                      ))
                    ) : (
                      <ListGroup.Item>No usages available</ListGroup.Item>
                    )}
                    <ListGroup.Item><strong>TTL Index:</strong> {selectedResource.TTLIdx || 'N/A'}</ListGroup.Item>
                  </ListGroup>
                </>
              )
            )}
          </Modal.Body>
          <Modal.Footer>
            {isEditing ? (
              <Button variant="primary" onClick={saveResource}>
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

export default Resources;