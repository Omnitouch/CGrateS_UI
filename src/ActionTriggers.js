import React, { useState } from 'react';
import { Form, Button, Container, Row, Col, Table, Modal, Spinner, Alert } from 'react-bootstrap';

const ActionTriggers = ({ cgratesConfig }) => {
    const [searchParams, setSearchParams] = useState({
        tenant: cgratesConfig.tenants.split(';')[0], // Default to the first tenant
    });
    const [triggers, setTriggers] = useState([]); // Store the list of action triggers
    const [editTrigger, setEditTrigger] = useState(null); // Store editable trigger details
    const [showModal, setShowModal] = useState(false); // Control the modal display
    const [isLoading, setIsLoading] = useState(false); // Handle loading state
    const [isEditing, setIsEditing] = useState(false); // Toggle editing mode
    const [isNew, setIsNew] = useState(false); // Flag to track if creating a new trigger
    const [errorMessage, setErrorMessage] = useState(''); // Handle error messages

    // Available ThresholdTypes
    const thresholdTypes = [
        '*min_balance',
        '*max_balance',
        '*balance_expired',
        '*min_event_counter',
        '*max_event_counter',
        '*min_balance_counter',
        '*max_balance_counter',
    ];

    // Handle input change for tenant selection
    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setSearchParams({ ...searchParams, [name]: value });
    };

    // Fetch all triggers based on the selected tenant
    const fetchTriggers = async () => {
        setIsLoading(true);
        setTriggers([]); // Clear previous results
        try {
            const query = {
                method: 'APIerSv1.GetActionTriggers',
                params: [{ Tenant: searchParams.tenant }],
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
                setTriggers(data.result); // Set the fetched triggers
            } else {
                console.warn('No action triggers found.');
            }
        } catch (error) {
            console.error('Error fetching triggers:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Open modal to create a new trigger
    const openCreateNewTriggerModal = () => {
        const newTrigger = {
            GroupID: '', // Mandatory
            ActionTrigger: {
                Balance: {
                    BalanceType: '*monetary',
                    ID: '*default',
                    BalanceID: '*default',
                    Value: 0,
                },
                ThresholdType: '',
                ThresholdValue: 0,
                Weight: 0,
                ActionsID: '',
            },
        };
        setEditTrigger(newTrigger);
        setIsNew(true); // Mark this as a new trigger creation
        setIsEditing(true); // Automatically start in edit mode
        setShowModal(true); // Show modal
    };

    // Save the edited or newly created trigger
    const saveChanges = async () => {
        setIsLoading(true);
        setErrorMessage('');
        try {
            if (!editTrigger.GroupID) {
                setErrorMessage('Group ID is required.');
                setIsLoading(false);
                return;
            }
            if (!editTrigger.ActionTrigger.ThresholdType) {
                setErrorMessage('ThresholdType is required.');
                setIsLoading(false);
                return;
            }

            const payload = {
                GroupID: editTrigger.GroupID,
                ActionTrigger: editTrigger.ActionTrigger,
                Overwrite: true,
            };

            const query = {
                method: 'APIerSv1.SetActionTrigger',
                params: [payload],
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
                console.log('Action trigger updated successfully');
                setIsEditing(false);
                setShowModal(false);
                fetchTriggers(); // Refresh the list of triggers
            } else if (data.error) {
                setErrorMessage(`Error: ${data.error}`);
            }
        } catch (error) {
            setErrorMessage(`Error: ${error.message}`);
            console.error('Error saving trigger:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditTrigger(null);
        setIsEditing(false);
        setErrorMessage('');
    };

    return (
        <div className="App">
            <Container>
                <h2>Action Triggers</h2>
                <Form onSubmit={(e) => { e.preventDefault(); fetchTriggers(); }} className="mt-4">
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
                            <Button type="submit" className="w-100">Fetch Triggers</Button>
                        </Col>
                    </Row>
                </Form>

                {isLoading ? (
                    <div className="text-center mt-4">
                        <Spinner animation="border" role="status">
                            <span className="sr-only">Loading...</span>
                        </Spinner>
                        <p>Loading triggers, please wait...</p>
                    </div>
                ) : (
                    <>
                        <Table striped bordered hover className="mt-4">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>ID</th>
                                    <th>Threshold Type</th>
                                    <th>Threshold Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {triggers.length > 0 ? triggers.map((trigger, index) => (
                                    <tr key={index}>
                                        <td>{index + 1}</td>
                                        <td>{trigger.ID}</td>
                                        <td>{trigger.ThresholdType}</td>
                                        <td>{trigger.ThresholdValue}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="4" className="text-center">No triggers available</td>
                                    </tr>
                                )}
                            </tbody>
                        </Table>
                        <Button variant="success" className="mt-4" onClick={openCreateNewTriggerModal}>Create New Trigger</Button>
                    </>
                )}

                <Modal show={showModal} onHide={handleCloseModal} size="lg">
                    <Modal.Header closeButton>
                        <Modal.Title>{isNew ? "Create New Trigger" : "Trigger Details"}</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
                        {editTrigger && (
                            <>
                                <Form.Group>
                                    <Form.Label>Group ID</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editTrigger.GroupID}
                                        onChange={(e) => setEditTrigger({ ...editTrigger, GroupID: e.target.value })}
                                    />
                                </Form.Group>
                                <Form.Group>
                                    <Form.Label>Threshold Type</Form.Label>
                                    <Form.Control
                                        as="select"
                                        value={editTrigger.ActionTrigger.ThresholdType}
                                        onChange={(e) =>
                                            setEditTrigger({
                                                ...editTrigger,
                                                ActionTrigger: { ...editTrigger.ActionTrigger, ThresholdType: e.target.value },
                                            })
                                        }
                                    >
                                        <option value="">Select Threshold Type</option>
                                        {thresholdTypes.map((type, index) => (
                                            <option key={index} value={type}>
                                                {type}
                                            </option>
                                        ))}
                                    </Form.Control>
                                </Form.Group>
                                <Form.Group>
                                    <Form.Label>Threshold Value</Form.Label>
                                    <Form.Control
                                        type="number"
                                        value={editTrigger.ActionTrigger.ThresholdValue}
                                        onChange={(e) =>
                                            setEditTrigger({
                                                ...editTrigger,
                                                ActionTrigger: { ...editTrigger.ActionTrigger, ThresholdValue: parseInt(e.target.value, 10) },
                                            })
                                        }
                                    />
                                </Form.Group>
                                <Form.Group>
                                    <Form.Label>Balance Parameters</Form.Label>
                                    <Form.Label>Balance Type</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editTrigger.ActionTrigger.Balance.BalanceType}
                                        onChange={(e) =>
                                            setEditTrigger({
                                                ...editTrigger,
                                                ActionTrigger: {
                                                    ...editTrigger.ActionTrigger,
                                                    Balance: { ...editTrigger.ActionTrigger.Balance, BalanceType: e.target.value },
                                                },
                                            })
                                        }
                                    />
                                    <Form.Label>ID</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editTrigger.ActionTrigger.Balance.ID}
                                        onChange={(e) =>
                                            setEditTrigger({
                                                ...editTrigger,
                                                ActionTrigger: {
                                                    ...editTrigger.ActionTrigger,
                                                    Balance: { ...editTrigger.ActionTrigger.Balance, ID: e.target.value },
                                                },
                                            })
                                        }
                                    />
                                    <Form.Label>Balance ID</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editTrigger.ActionTrigger.Balance.BalanceID}
                                        onChange={(e) =>
                                            setEditTrigger({
                                                ...editTrigger,
                                                ActionTrigger: {
                                                    ...editTrigger.ActionTrigger,
                                                    Balance: { ...editTrigger.ActionTrigger.Balance, BalanceID: e.target.value },
                                                },
                                            })
                                        }
                                    />
                                    <Form.Label>Value</Form.Label>
                                    <Form.Control
                                        type="number"
                                        value={editTrigger.ActionTrigger.Balance.Value}
                                        onChange={(e) =>
                                            setEditTrigger({
                                                ...editTrigger,
                                                ActionTrigger: {
                                                    ...editTrigger.ActionTrigger,
                                                    Balance: { ...editTrigger.ActionTrigger.Balance, Value: parseFloat(e.target.value) },
                                                },
                                            })
                                        }
                                    />
                                </Form.Group>
                                <Form.Group>
                                    <Form.Label>Weight</Form.Label>
                                    <Form.Control
                                        type="number"
                                        value={editTrigger.ActionTrigger.Weight}
                                        onChange={(e) =>
                                            setEditTrigger({
                                                ...editTrigger,
                                                ActionTrigger: { ...editTrigger.ActionTrigger, Weight: parseInt(e.target.value, 10) },
                                            })
                                        }
                                    />
                                </Form.Group>
                                <Form.Group>
                                    <Form.Label>Actions ID</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editTrigger.ActionTrigger.ActionsID}
                                        onChange={(e) =>
                                            setEditTrigger({
                                                ...editTrigger,
                                                ActionTrigger: { ...editTrigger.ActionTrigger, ActionsID: e.target.value },
                                            })
                                        }
                                    />
                                </Form.Group>
                            </>
                        )}
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="primary" onClick={saveChanges}>
                            {isNew ? "Create Trigger" : "Save Changes"}
                        </Button>
                        <Button variant="secondary" onClick={handleCloseModal}>
                            Close
                        </Button>
                    </Modal.Footer>
                </Modal>
            </Container>
        </div>
    );
};

export default ActionTriggers;
