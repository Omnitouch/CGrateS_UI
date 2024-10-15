import React, { useState } from 'react';
import { Form, Button, Container, Row, Col, Table, Modal, Spinner, ListGroup } from 'react-bootstrap';

const Filters = ({ cgratesConfig }) => {
  const [searchParams, setSearchParams] = useState({
    tenant: '', // Tenant selection
  });
  const [filters, setFilters] = useState([]); // Store the list of filters
  const [selectedFilter, setSelectedFilter] = useState(null); // Store the selected filter's details
  const [showModal, setShowModal] = useState(false); // Control the modal display
  const [isLoading, setIsLoading] = useState(false); // Handle loading state
  const [responseTime, setResponseTime] = useState(null); // API response time
  const [isEditing, setIsEditing] = useState(false); // Manage edit state
  const [editFilter, setEditFilter] = useState({}); // Store edited filter
  const [error, setError] = useState(''); // Handle error messages

  const filterTypes = [
    '*string*', '*notstring', '*prefix', '*notprefix', '*suffix', '*notsuffix*', '*empty', '*notempty', '*exists', '*notexists',
    '*timings', '*nottimings', '*destinations', '*notdestinations', '*rsr', '*notrsr*',
    '*lt', '*lte', '*gt', '*gte'
  ];

  const filterTypeHints = {
    '*string*': 'Matches in full the Element with at least one value in Values.',
    '*notstring': 'Negation of *string*.',
    '*prefix': 'Matches the beginning of the Element with one of the values in Values.',
    '*notprefix': 'Negation of *prefix*.',
    '*suffix': 'Matches the end of the Element with one of the values in Values.',
    '*notsuffix*': 'Negation of *suffix*.',
    '*empty': 'Ensures that the Element is empty or does not exist.',
    '*notempty': 'Negation of *empty*.',
    '*exists': 'Ensures that the Element exists.',
    '*notexists': 'Negation of *exists*.',
    '*timings': 'Compares the time in Element with a TimingID in Values.',
    '*nottimings': 'Negation of *timings*.',
    '*destinations': 'Ensures that the Element is a prefix of one of the destination IDs in Values.',
    '*notdestinations': 'Negation of *destinations*.',
    '*rsr': 'Matches the RSRFilters in Values on the Element.',
    '*notrsr*': 'Negation of *rsr*.',
    '*lt': 'Compares if the Element is less than one of the Values.',
    '*lte': 'Compares if the Element is less than or equal to one of the Values.',
    '*gt': 'Compares if the Element is greater than one of the Values.',
    '*gte': 'Compares if the Element is greater than or equal to one of the Values.',
  };

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
        setEditFilter(data.result); // Set the filter for editing
        setShowModal(true); // Show the modal with details
        setIsEditing(false); // Ensure it starts in view mode
      }
    } catch (error) {
      console.error('Error fetching filter details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle input changes in edit mode for filter general info
  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditFilter({ ...editFilter, [name]: value });
  };

  // Handle rule input changes (dynamically updating rules)
  const handleRuleChange = (index, field, value) => {
    const updatedRules = [...editFilter.Rules];
    updatedRules[index][field] = value; // Update the specific rule's field
    setEditFilter({ ...editFilter, Rules: updatedRules }); // Update the entire filter with modified rules
  };

  // Handle value input change within a rule
  const handleValueChange = (ruleIndex, valueIndex, newValue) => {
    const updatedRules = [...editFilter.Rules];
    updatedRules[ruleIndex].Values[valueIndex] = newValue; // Update specific value in the rule
    setEditFilter({ ...editFilter, Rules: updatedRules });
  };

  // Add a new rule
  const addRule = () => {
    const newRule = { Type: '', Element: '', Values: [''] }; // New rule template
    setEditFilter({ ...editFilter, Rules: [...editFilter.Rules, newRule] });
  };

  // Remove an existing rule
  const removeRule = (index) => {
    const updatedRules = [...editFilter.Rules];
    updatedRules.splice(index, 1); // Remove the rule at the given index
    setEditFilter({ ...editFilter, Rules: updatedRules });
  };

  // Add a new value to a rule
  const addValue = (ruleIndex) => {
    const updatedRules = [...editFilter.Rules];
    updatedRules[ruleIndex].Values.push(''); // Add empty value
    setEditFilter({ ...editFilter, Rules: updatedRules });
  };

  // Remove an existing value from a rule
  const removeValue = (ruleIndex, valueIndex) => {
    const updatedRules = [...editFilter.Rules];
    updatedRules[ruleIndex].Values.splice(valueIndex, 1); // Remove the value at the given index
    setEditFilter({ ...editFilter, Rules: updatedRules });
  };

  // Handle saving the updated filter
  const saveFilter = async () => {
    // Validation: Ensure mandatory fields are filled
    if (!editFilter.ID || !editFilter.Tenant || editFilter.Rules.length === 0) {
      setError('ID, Tenant, and at least one rule are mandatory.');
      return;
    }

    setIsLoading(true);
    setError(''); // Clear previous error
    try {
      const { Tenant, ...filterToSend } = editFilter; // Remove the Tenant key from the filter object

      const query = {
        method: 'ApierV1.SetFilter', // Correct method name
        params: [filterToSend] // Send the filtered data without the Tenant key
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
        console.log('Filter updated successfully');
        setIsEditing(false); // Exit edit mode
        fetchFilters(); // Refresh the filter list
        handleCloseModal();
      }
    } catch (error) {
      console.error('Error updating filter:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowClick = (filterId) => {
    fetchFilterDetails(filterId); // Fetch the details when a filter is clicked
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedFilter(null);
    setIsEditing(false); // Reset edit mode
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    fetchFilters(); // Fetch filters based on the selected tenant
  };

  // Handle creating a new filter
  const handleNewFilter = () => {
    setEditFilter({
      Tenant: searchParams.tenant || '',
      ID: '',
      ActivationInterval: {},
      Rules: [{ Type: '', Element: '', Values: [''] }], // Prepopulate with one rule
    });
    setSelectedFilter(null); // Clear selectedFilter so it doesn't render view mode
    setIsEditing(true); // Set to edit mode
    setShowModal(true); // Open modal for the new filter
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

        <Button variant="success" className="mt-3" onClick={handleNewFilter}>
          Add New Filter
        </Button>

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

        {/* Modal for displaying and editing filter details */}
        <Modal show={showModal} onHide={handleCloseModal} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>Filter Profile Details</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {isEditing ? (
              <>
                <h5>Edit General Information</h5>
                <Form.Group>
                  <Form.Label>Tenant</Form.Label>
                  <Form.Control type="text" name="Tenant" value={editFilter.Tenant} onChange={handleEditChange} readOnly />
                </Form.Group>
                <Form.Group>
                  <Form.Label>ID</Form.Label>
                  <Form.Control type="text" name="ID" value={editFilter.ID} onChange={handleEditChange} />
                </Form.Group>
                <Form.Group>
                  <Form.Label>Activation Interval</Form.Label>
                  <Form.Control type="text" name="ActivationInterval" value={editFilter.ActivationInterval ? editFilter.ActivationInterval.ActivationTime : 'N/A'} onChange={handleEditChange} />
                </Form.Group>

                <h5>Edit Rules</h5>
                {editFilter.Rules.map((rule, ruleIndex) => (
                  <div key={ruleIndex} style={{ border: '1px solid #ddd', padding: '10px', marginBottom: '10px' }}>
                    <Form.Group>
                      <Form.Label>Type</Form.Label>
                      <Form.Control 
                        as="select" 
                        value={rule.Type} 
                        onChange={(e) => handleRuleChange(ruleIndex, 'Type', e.target.value)} 
                      >
                        <option value="">Select Type</option>
                        {filterTypes.map((type, index) => (
                          <option key={index} value={type}>{type}</option>
                        ))}
                      </Form.Control>
                      <Form.Text className="text-muted">
                        {filterTypeHints[rule.Type]}
                      </Form.Text>
                    </Form.Group>
                    <Form.Group>
                      <Form.Label>Element</Form.Label>
                      <Form.Control 
                        type="text" 
                        value={rule.Element} 
                        onChange={(e) => handleRuleChange(ruleIndex, 'Element', e.target.value)} 
                      />
                    </Form.Group>
                    <Form.Label>Values</Form.Label>
                    {rule.Values.map((value, valueIndex) => (
                      <div key={valueIndex} style={{ display: 'flex', marginBottom: '5px' }}>
                        <Form.Control
                          type="text"
                          value={value}
                          onChange={(e) => handleValueChange(ruleIndex, valueIndex, e.target.value)}
                          style={{ marginRight: '10px' }}
                        />
                        <Button variant="danger" onClick={() => removeValue(ruleIndex, valueIndex)}>Remove</Button>
                      </div>
                    ))}
                    <Button onClick={() => addValue(ruleIndex)}>Add Value</Button>
                    <hr />
                    <Button variant="danger" onClick={() => removeRule(ruleIndex)}>Remove Rule</Button>
                  </div>
                ))}
                <Button onClick={addRule}>Add Rule</Button>

                {error && (
                  <div className="mt-3 text-danger">
                    {error}
                  </div>
                )}
              </>
            ) : (
              <>
                {selectedFilter && (
                  <>
                    <h5>General Information</h5>
                    <ListGroup className="mb-3">
                      <ListGroup.Item><strong>Tenant:</strong> {selectedFilter.Tenant}</ListGroup.Item>
                      <ListGroup.Item><strong>ID:</strong> {selectedFilter.ID}</ListGroup.Item>
                      <ListGroup.Item><strong>Activation Interval:</strong> 
                        {selectedFilter.ActivationInterval
                          ? `${selectedFilter.ActivationInterval.ActivationTime} to ${selectedFilter.ActivationInterval.ExpiryTime}`
                          : 'N/A'}
                      </ListGroup.Item>
                    </ListGroup>

                    <h5>Rules</h5>
                    <ListGroup>
                      {selectedFilter.Rules.length > 0 ? selectedFilter.Rules.map((rule, index) => (
                        <ListGroup.Item key={index}>
                          <strong>Type:</strong> {rule.Type}<br />
                          <strong>Element:</strong> {rule.Element}<br />
                          <strong>Values:</strong> {rule.Values.join(', ')}
                        </ListGroup.Item>
                      )) : (
                        <ListGroup.Item>No rules defined</ListGroup.Item>
                      )}
                    </ListGroup>
                  </>
                )}
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            {isEditing ? (
              <Button variant="primary" onClick={saveFilter}>
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

export default Filters;
