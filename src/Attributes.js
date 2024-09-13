import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Table, Modal, Spinner, Accordion, ListGroup } from 'react-bootstrap';

const Attributes = ({ cgratesConfig }) => {
  const [searchParams, setSearchParams] = useState({
    tenant: '', // Tenant selection
  });
  const [attributes, setAttributes] = useState([]); // Store the list of attributes
  const [selectedAttribute, setSelectedAttribute] = useState(null); // Store the selected attribute's details
  const [editAttribute, setEditAttribute] = useState(null); // Store the editable attribute details
  const [showModal, setShowModal] = useState(false); // Control the modal display
  const [isLoading, setIsLoading] = useState(false); // Handle loading state
  const [responseTime, setResponseTime] = useState(null); // API response time
  const [isEditing, setIsEditing] = useState(false); // Toggle editing mode
  const [isNew, setIsNew] = useState(false); // Flag to track if creating a new attribute
  const [typeExplainer, setTypeExplainer] = useState(''); // Explainer for Type

  // Explainers for each type
  const typeExplainers = {
    "*constant": "The Value is a constant value, it will just set the FieldName to this value as it is.",
    "*variable": "The Value is a RSRParser which will capture the value from one or more fields in the event (can combine with constants) and write it to Path.",
    "*composed": "Same as *variable but instead of overwriting Path, it will append to it.",
    "*usage_difference": "Will calculate the duration difference between two field names defined in the Value. If the number of fields in the Value is not 2, it will throw an error.",
    "*sum": "Will sum up the values in the Value.",
    "*value_exponent": "Will compute the exponent of the first field in the Value."
  };

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
        setEditAttribute(data.result); // Prepare the attribute for editing
        setIsNew(false); // Ensure this is treated as an edit
        setShowModal(true); // Show the modal with details
      }
    } catch (error) {
      console.error('Error fetching attribute details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Open modal to create a new attribute
  const openCreateNewAttributeModal = () => {
    const newAttribute = {
      Tenant: searchParams.tenant, // Use the selected tenant
      ID: '',
      Contexts: [],
      FilterIDs: [],
      ActivationInterval: null,
      Attributes: [],
      Blocker: false,
      Weight: 0,
    };
    setEditAttribute(newAttribute);
    setIsNew(true); // Mark this as a new attribute creation
    setIsEditing(true); // Automatically start in edit mode
    setShowModal(true); // Show modal
  };

  // Toggle editing mode
  const toggleEdit = () => {
    setIsEditing(!isEditing);
  };

  // Handle changes to editable attribute data
  const handleEditChange = (index, field, value) => {
    const updatedAttributes = [...editAttribute.Attributes];
    updatedAttributes[index][field] = value;
    setEditAttribute({ ...editAttribute, Attributes: updatedAttributes });
  };

  // Handle Type dropdown change and set the explainer
  const handleTypeChange = (index, newValue) => {
    const updatedAttributes = [...editAttribute.Attributes];
    updatedAttributes[index].Type = newValue;
    setEditAttribute({ ...editAttribute, Attributes: updatedAttributes });

    // Update the explainer for the selected type
    setTypeExplainer(typeExplainers[newValue]);
  };

  // Handle rules changes in the Value array
  const handleRuleChange = (attrIndex, valueIndex, newValue) => {
    const updatedAttributes = [...editAttribute.Attributes];
    updatedAttributes[attrIndex].Value[valueIndex].Rules = newValue;
    setEditAttribute({ ...editAttribute, Attributes: updatedAttributes });
  };

  // Add new value to an attribute
  const addValue = (attrIndex) => {
    const updatedAttributes = [...editAttribute.Attributes];
    updatedAttributes[attrIndex].Value.push({ Rules: '' }); // Add empty Rules object
    setEditAttribute({ ...editAttribute, Attributes: updatedAttributes });
  };

  // Remove value from an attribute
  const removeValue = (attrIndex, valueIndex) => {
    const updatedAttributes = [...editAttribute.Attributes];
    updatedAttributes[attrIndex].Value.splice(valueIndex, 1);
    setEditAttribute({ ...editAttribute, Attributes: updatedAttributes });
  };

  // Add a new rule to an attribute when "Add Rule to Attribute" is clicked
  const addRuleToAttribute = () => {
    const newAttribute = { Path: '', Type: '', Value: [{ Rules: '' }], FilterIDs: [] }; // Template for a new rule
    setEditAttribute({ ...editAttribute, Attributes: [...editAttribute.Attributes, newAttribute] });
  };

  // Handle changes to FilterIDs (Attribute level)
  const handleFilterIDChange = (filterIndex, newValue) => {
    const updatedFilterIDs = [...editAttribute.FilterIDs];
    updatedFilterIDs[filterIndex] = newValue;
    setEditAttribute({ ...editAttribute, FilterIDs: updatedFilterIDs });
  };

  // Handle changes to FilterIDs (Rule level)
  const handleRuleFilterIDChange = (attrIndex, filterIndex, newValue) => {
    const updatedAttributes = [...editAttribute.Attributes];
    updatedAttributes[attrIndex].FilterIDs[filterIndex] = newValue;
    setEditAttribute({ ...editAttribute, Attributes: updatedAttributes });
  };

  // Add new FilterID at the Attribute level
  const addFilterID = () => {
    const updatedFilterIDs = [...editAttribute.FilterIDs];
    updatedFilterIDs.push(''); // Add empty FilterID
    setEditAttribute({ ...editAttribute, FilterIDs: updatedFilterIDs });
  };

  // Add new FilterID at the Rule level
  const addRuleFilterID = (attrIndex) => {
    const updatedAttributes = [...editAttribute.Attributes];
    updatedAttributes[attrIndex].FilterIDs.push(''); // Add empty FilterID
    setEditAttribute({ ...editAttribute, Attributes: updatedAttributes });
  };

  // Remove a FilterID from the Attribute level
  const removeFilterID = (filterIndex) => {
    const updatedFilterIDs = [...editAttribute.FilterIDs];
    updatedFilterIDs.splice(filterIndex, 1);
    setEditAttribute({ ...editAttribute, FilterIDs: updatedFilterIDs });
  };

  // Remove a FilterID from the Rule level
  const removeRuleFilterID = (attrIndex, filterIndex) => {
    const updatedAttributes = [...editAttribute.Attributes];
    updatedAttributes[attrIndex].FilterIDs.splice(filterIndex, 1);
    setEditAttribute({ ...editAttribute, Attributes: updatedAttributes });
  };

  // Remove an attribute
  const removeAttribute = (index) => {
    const updatedAttributes = [...editAttribute.Attributes];
    updatedAttributes.splice(index, 1);
    setEditAttribute({ ...editAttribute, Attributes: updatedAttributes });
  };

  // Save the edited or newly created attribute
  const saveChanges = async () => {
    setIsLoading(true);
    try {
      const query = {
        method: 'APIerSv1.SetAttributeProfile',
        params: [editAttribute] // Send the edited or new attribute back to the API
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
        console.log('Attribute profile updated successfully');
        setIsEditing(false);
        setShowModal(false);
      }
    } catch (error) {
      console.error('Error saving attribute profile:', error);
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
    setIsEditing(false);
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
            {/* Button to create new attribute */}
            <Button variant="success" className="mt-4" onClick={openCreateNewAttributeModal}>Create New Attribute</Button>
          </>
        )}

        {/* Modal for displaying attribute details */}
        <Modal show={showModal} onHide={handleCloseModal} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>{isNew ? "Create New Attribute" : "Attribute Profile Details"}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {editAttribute ? (
              <>
                {isEditing ? (
                  <>
                    <h5>Edit General Information</h5>
                    <Form.Group>
                      <Form.Label>Tenant</Form.Label>
                      <Form.Control type="text" value={editAttribute.Tenant} readOnly />
                    </Form.Group>
                    <Form.Group>
                      <Form.Label>ID</Form.Label>
                      <Form.Control 
                        type="text" 
                        value={editAttribute.ID} 
                        onChange={(e) => setEditAttribute({ ...editAttribute, ID: e.target.value })} 
                      />
                    </Form.Group>

                    <h5>Edit Attribute-Level FilterIDs</h5>
                    {editAttribute.FilterIDs.map((filterID, filterIndex) => (
                      <div key={filterIndex} style={{ display: 'flex', marginBottom: '5px' }}>
                        <Form.Control
                          type="text"
                          value={filterID}
                          onChange={(e) => handleFilterIDChange(filterIndex, e.target.value)}
                          style={{ marginRight: '10px' }}
                        />
                        <Button variant="danger" onClick={() => removeFilterID(filterIndex)}>Remove</Button>
                      </div>
                    ))}
                    <Button onClick={addFilterID}>Add FilterID</Button>

                    <h5>Edit Attributes and Rules</h5>
                    {editAttribute.Attributes.map((attr, index) => (
                      <div key={index} style={{ border: '1px solid #ddd', padding: '10px', marginBottom: '10px' }}>
                        <Form.Group>
                          <Form.Label>Path</Form.Label>
                          <Form.Control 
                            type="text" 
                            value={attr.Path} 
                            onChange={(e) => handleEditChange(index, 'Path', e.target.value)} 
                          />
                        </Form.Group>
                        <Form.Group>
                          <Form.Label>Type</Form.Label>
                          <Form.Control 
                            as="select" 
                            value={attr.Type}
                            onChange={(e) => handleTypeChange(index, e.target.value)}
                          >
                            <option value="">Select Type</option>
                            <option value="*constant">*constant</option>
                            <option value="*variable">*variable</option>
                            <option value="*composed">*composed</option>
                            <option value="*usage_difference">*usage_difference</option>
                            <option value="*sum">*sum</option>
                            <option value="*value_exponent">*value_exponent</option>
                          </Form.Control>
                          {typeExplainer && <p className="text-muted">{typeExplainer}</p>}
                        </Form.Group>

                        <Form.Label>Rules</Form.Label>
                        {attr.Value.map((value, valueIndex) => (
                          <div key={valueIndex} style={{ display: 'flex', marginBottom: '5px' }}>
                            <Form.Control
                              type="text"
                              value={value.Rules}
                              onChange={(e) => handleRuleChange(index, valueIndex, e.target.value)}
                              style={{ marginRight: '10px' }}
                            />
                            <Button variant="danger" onClick={() => removeValue(index, valueIndex)}>Remove</Button>
                          </div>
                        ))}
                        <Button onClick={() => addValue(index)}>Add Rule</Button>

                        <h5>Rule-Level FilterIDs</h5>
                        {attr.FilterIDs.map((filterID, filterIndex) => (
                          <div key={filterIndex} style={{ display: 'flex', marginBottom: '5px' }}>
                            <Form.Control
                              type="text"
                              value={filterID}
                              onChange={(e) => handleRuleFilterIDChange(index, filterIndex, e.target.value)}
                              style={{ marginRight: '10px' }}
                            />
                            <Button variant="danger" onClick={() => removeRuleFilterID(index, filterIndex)}>Remove</Button>
                          </div>
                        ))}
                        <Button onClick={() => addRuleFilterID(index)}>Add Rule-Level FilterID</Button>

                        <hr />
                        <Button variant="danger" onClick={() => removeAttribute(index)}>Remove Attribute</Button>
                      </div>
                    ))}
                    {/* Add Rule to Attribute Button */}
                    <Button variant="primary" onClick={addRuleToAttribute} className="mt-3">Add Rule to Attribute</Button>
                  </>
                ) : (
                  <>
                    <h5>General Information</h5>
                    <ListGroup className="mb-3">
                      <ListGroup.Item><strong>Tenant:</strong> {editAttribute.Tenant}</ListGroup.Item>
                      <ListGroup.Item><strong>ID:</strong> {editAttribute.ID}</ListGroup.Item>
                    </ListGroup>

                    <h5>Attribute-Level FilterIDs</h5>
                    <ListGroup className="mb-3">
                      {editAttribute.FilterIDs.length > 0 ? (
                        <ListGroup.Item><strong>FilterIDs:</strong> {editAttribute.FilterIDs.join(', ')}</ListGroup.Item>
                      ) : (
                        <ListGroup.Item>No FilterIDs</ListGroup.Item>
                      )}
                    </ListGroup>

                    <h5>Attributes</h5>
                    <Accordion defaultActiveKey="0">
                      {editAttribute.Attributes.map((attr, index) => (
                        <Accordion.Item eventKey={index.toString()} key={index}>
                          <Accordion.Header><strong>Path:</strong> {attr.Path}</Accordion.Header>
                          <Accordion.Body>
                            <ListGroup variant="flush">
                              <ListGroup.Item><strong>Path:</strong> {attr.Path}</ListGroup.Item>
                              <ListGroup.Item><strong>Type:</strong> {attr.Type}</ListGroup.Item>
                              <ListGroup.Item>
                                {attr.Value.map((valueObj, idx) => (
                                  <div key={idx}>
                                    <p><strong>Rules:</strong> {valueObj.Rules}</p>
                                  </div>
                                ))}
                              </ListGroup.Item>
                              {attr.FilterIDs.length > 0 && (
                                <ListGroup.Item><strong>Rule-Level Filter IDs:</strong> {attr.FilterIDs.join(', ')}</ListGroup.Item>
                              )}
                            </ListGroup>
                          </Accordion.Body>
                        </Accordion.Item>
                      ))}
                    </Accordion>
                  </>
                )}
              </>
            ) : (
              <p>No details available</p>
            )}
          </Modal.Body>
          <Modal.Footer>
            {isEditing ? (
              <Button variant="primary" onClick={saveChanges}>
                {isNew ? "Create Attribute" : "Save Changes"}
              </Button>
            ) : (
              <Button variant="secondary" onClick={toggleEdit}>
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

export default Attributes;
