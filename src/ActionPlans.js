import React, { useState } from 'react';
import { Form, Button, Container, Row, Col, Table, Modal, Spinner, Accordion, ListGroup, Alert } from 'react-bootstrap';

const Actions = ({ cgratesConfig }) => {
    const [searchParams, setSearchParams] = useState({
        tenant: '', // Tenant selection
    });
    const [actions, setActions] = useState([]); // Store the list of action plans
    const [selectedAction, setSelectedAction] = useState(null); // Store the selected action plan's details
    const [editAction, setEditAction] = useState(null); // Store the editable action plan details
    const [showModal, setShowModal] = useState(false); // Control the modal display
    const [isLoading, setIsLoading] = useState(false); // Handle loading state
    const [responseTime, setResponseTime] = useState(null); // API response time
    const [isEditing, setIsEditing] = useState(false); // Toggle editing mode
    const [isNew, setIsNew] = useState(false); // Flag to track if creating a new action plan
    const [errorMessage, setErrorMessage] = useState(''); // Handle error messages

    // Handle input change for tenant selection
    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setSearchParams({ ...searchParams, [name]: value });
    };

    // Fetch all action plan IDs based on the selected tenant
    const fetchActions = async () => {
        setIsLoading(true);
        setActions([]); // Clear previous results
        const startTime = Date.now();

        try {
            const query = {
                method: 'APIerSv1.GetActionPlanIDs',
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
                setActions(data.result); // Set the fetched action IDs
            } else {
                console.warn('No action plans found.');
            }
        } catch (error) {
            console.error('Error fetching action IDs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch details of a selected action plan
    const fetchActionDetails = async (actionId) => {
        setIsLoading(true);
        try {
            const query = {
                method: 'APIerSv1.GetActionPlan',
                params: [{ Tenant: searchParams.tenant, Id: actionId }]
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
            if (data.result && data.result[0]) {
                const actionPlan = data.result[0].ActionTimings || [];
                setSelectedAction(data.result[0]);
                setEditAction({ ...data.result[0], ActionTimings: actionPlan });
                setIsNew(false);
                setShowModal(true);
            }
        } catch (error) {
            console.error('Error fetching action details:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Open modal to create a new action plan
    const openCreateNewActionModal = () => {
        const newAction = {
            Id: '',
            AccountIDs: {},
            ActionPlan: [{
                ActionsId: '',
                Years: '*any',
                Months: '*any',
                MonthDays: '*any',
                WeekDays: '*any',
                Time: '*asap',
                Weight: 0
            }]
        };
        setEditAction(newAction);
        setIsNew(true); // Mark this as a new action plan creation
        setIsEditing(true); // Automatically start in edit mode
        setShowModal(true); // Show modal
    };

    // Toggle editing mode
    const toggleEdit = () => {
        setIsEditing(!isEditing);
    };

    // Handle changes to editable action plan data
    const handleEditChange = (field, value) => {
        setEditAction({ ...editAction, [field]: value });
    };

    // Handle changes to editable action plan data
    const handlePlanChange = (index, field, value) => {
        const updatedActionTimings = [...editAction.ActionTimings];
        updatedActionTimings[index][field] = value; // Treat as freeform text
        setEditAction({ ...editAction, ActionTimings: updatedActionTimings });
    };

    // Add a new Action to the ActionPlan
    const addActionToPlan = () => {
        const newPlan = {
            ActionsID: '', // freeform text
            Years: '*any', // freeform text
            Months: '*any', // freeform text
            MonthDays: '*any', // freeform text
            WeekDays: '*any', // freeform text
            Time: '*asap', // freeform text
            Weight: '0' // freeform text
        };
        setEditAction({ ...editAction, ActionTimings: [...editAction.ActionTimings, newPlan] });
    };

    // Remove an Action from the ActionPlan
    const removeActionFromPlan = (index) => {
        const updatedActionPlan = [...editAction.ActionPlan];
        updatedActionPlan.splice(index, 1);
        setEditAction({ ...editAction, ActionPlan: updatedActionPlan });
    };

    // Save the edited or newly created action plan
    const saveChanges = async () => {
        setIsLoading(true);
        setErrorMessage(''); // Clear previous error messages
        try {
            // Check if ActionTimings is properly initialized as an array
            const actionTimings = editAction.ActionTimings || [];

            const payload = {
                Id: editAction.Id || '',
                Tenant: searchParams.tenant || '', // Pass the correct tenant
                ActionPlan: actionTimings.map(plan => ({
                    ActionsId: plan.ActionsID || '', // freeform text
                    Years: plan.Years || '*any', // freeform text
                    Months: plan.Months || '*any', // freeform text
                    MonthDays: plan.MonthDays || '*any', // freeform text
                    WeekDays: plan.WeekDays || '*any', // freeform text
                    Time: plan.Time || '*asap', // freeform text
                    Weight: plan.Weight || '0' // freeform text
                })),
                Overwrite: true,
                ReloadScheduler: true
            };

            const query = {
                method: 'ApierV1.SetActionPlan',
                params: [payload] // Send the structured payload
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
                console.log('Action plan updated successfully');
                setIsEditing(false);
                setShowModal(false);
            } else if (data.error) {
                setErrorMessage(`Error: ${data.error}`);
            }
        } catch (error) {
            setErrorMessage(`Error: ${error.message}`);
            console.error('Error saving action plan:', error);
        } finally {
            setIsLoading(false);
        }
    };


    const handleRowClick = (actionId) => {
        fetchActionDetails(actionId); // Fetch the details when an action is clicked
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedAction(null);
        setIsEditing(false);
        setErrorMessage(''); // Clear error message when closing the modal
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        fetchActions(); // Fetch actions based on the selected tenant
    };

    return (
        <div className="App">
            <Container>
                <h2>Action Plans</h2>
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
                            <Button type="submit" className="w-100">Fetch Actions</Button>
                        </Col>
                    </Row>
                </Form>

                {isLoading ? (
                    <div className="text-center mt-4">
                        <Spinner animation="border" role="status">
                            <span className="sr-only">Loading...</span>
                        </Spinner>
                        <p>Loading actions, please wait...</p>
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
                                    <th>Action Plan ID</th>
                                </tr>
                            </thead>
                            <tbody>
                                {actions.length > 0 ? actions.map((action, index) => (
                                    <tr key={index} onClick={() => handleRowClick(action)} style={{ cursor: 'pointer' }}>
                                        <td>{index + 1}</td>
                                        <td>{action}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="2" className="text-center">No actions available</td>
                                    </tr>
                                )}
                            </tbody>
                        </Table>
                        {/* Button to create new action plan */}
                        <Button variant="success" className="mt-4" onClick={openCreateNewActionModal}>Create New Action</Button>
                    </>
                )}

                {/* Modal for displaying action plan details */}
                <Modal show={showModal} onHide={handleCloseModal} size="lg">
                    <Modal.Header closeButton>
                        <Modal.Title>{isNew ? "Create New Action Plan" : "Action Plan Details"}</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
                        {editAction ? (
                            <>
                                {isEditing ? (
                                    <>
                                        <h5>Edit General Information</h5>
                                        <Form.Group>
                                            <Form.Label>ID</Form.Label>
                                            <Form.Control
                                                type="text"
                                                value={editAction.Id || ''}
                                                onChange={(e) => handleEditChange('Id', e.target.value)}
                                            />
                                        </Form.Group>

                                        <h5>Edit Action Timings</h5>
                                        {(editAction.ActionTimings || []).map((timing, index) => (
                                            <div key={index} style={{ border: '1px solid #ddd', padding: '10px', marginBottom: '10px' }}>
                                                <Form.Group>
                                                    <Form.Label>Actions ID</Form.Label>
                                                    <Form.Control
                                                        type="text"
                                                        value={timing.ActionsID || ''}
                                                        onChange={(e) => handlePlanChange(index, 'ActionsID', e.target.value)}
                                                    />
                                                </Form.Group>
                                                <Form.Group>
                                                    <Form.Label>Years</Form.Label>
                                                    <Form.Control
                                                        type="text"
                                                        value={timing.Years || '*any'}
                                                        onChange={(e) => handlePlanChange(index, 'Years', e.target.value)}
                                                    />
                                                </Form.Group>
                                                <Form.Group>
                                                    <Form.Label>Months</Form.Label>
                                                    <Form.Control
                                                        type="text"
                                                        value={timing.Months || '*any'}
                                                        onChange={(e) => handlePlanChange(index, 'Months', e.target.value)}
                                                    />
                                                </Form.Group>
                                                <Form.Group>
                                                    <Form.Label>Month Days</Form.Label>
                                                    <Form.Control
                                                        type="text"
                                                        value={timing.MonthDays || '*any'}
                                                        onChange={(e) => handlePlanChange(index, 'MonthDays', e.target.value)}
                                                    />
                                                </Form.Group>
                                                <Form.Group>
                                                    <Form.Label>Week Days</Form.Label>
                                                    <Form.Control
                                                        type="text"
                                                        value={timing.WeekDays || '*any'}
                                                        onChange={(e) => handlePlanChange(index, 'WeekDays', e.target.value)}
                                                    />
                                                </Form.Group>
                                                <Form.Group>
                                                    <Form.Label>Time</Form.Label>
                                                    <Form.Control
                                                        type="text"
                                                        value={timing.Time || '*asap'}
                                                        onChange={(e) => handlePlanChange(index, 'Time', e.target.value)}
                                                    />
                                                </Form.Group>
                                                <Form.Group>
                                                    <Form.Label>Weight</Form.Label>
                                                    <Form.Control
                                                        type="text"
                                                        value={timing.Weight || '0'}
                                                        onChange={(e) => handlePlanChange(index, 'Weight', e.target.value)}
                                                    />
                                                </Form.Group>

                                                <hr />
                                                <Button variant="danger" onClick={() => removeActionFromPlan(index)}>Remove Action Timing</Button>
                                            </div>
                                        ))}
                                        {/* Add Action Timing Button */}
                                        <Button variant="primary" onClick={addActionToPlan} className="mt-3">Add Action Timing</Button>
                                    </>
                                ) : (
                                    <>
                                        <h5>General Information</h5>
                                        <ListGroup className="mb-3">
                                            <ListGroup.Item><strong>ID:</strong> {editAction.Id}</ListGroup.Item>
                                        </ListGroup>

                                        <h5>Action Timings</h5>
                                        <Accordion defaultActiveKey="0">
                                            {(editAction.ActionTimings || []).map((timing, index) => (
                                                <Accordion.Item eventKey={index.toString()} key={index}>
                                                    <Accordion.Header><strong>ActionsID:</strong> {timing.ActionsID}</Accordion.Header>
                                                    <Accordion.Body>
                                                        <ListGroup variant="flush">
                                                            <ListGroup.Item><strong>Years:</strong> {timing.Years || '*any'}</ListGroup.Item>
                                                            <ListGroup.Item><strong>Months:</strong> {timing.Months || '*any'}</ListGroup.Item>
                                                            <ListGroup.Item><strong>Month Days:</strong> {timing.MonthDays || '*any'}</ListGroup.Item>
                                                            <ListGroup.Item><strong>Week Days:</strong> {timing.WeekDays || '*any'}</ListGroup.Item>
                                                            <ListGroup.Item><strong>Time:</strong> {timing.Time || '*asap'}</ListGroup.Item>
                                                            <ListGroup.Item><strong>Weight:</strong> {timing.Weight || '0'}</ListGroup.Item>
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
                                {isNew ? "Create Action" : "Save Changes"}
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

export default Actions;
