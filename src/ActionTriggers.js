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
    const [isNewTrigger, setIsNewTrigger] = useState(false); // Determine if adding a new trigger
    const [errorMessage, setErrorMessage] = useState(''); // Handle error messages

    // Available ThresholdTypes and BalanceTypes
    const thresholdTypes = [
        '*min_balance',
        '*max_balance',
        '*balance_expired',
        '*min_event_counter',
        '*max_event_counter',
        '*min_balance_counter',
        '*max_balance_counter',
    ];
    const balanceTypes = ['*voice', '*data', '*sms', '*monetary', '*generic'];

    // Default template for a new trigger
    const defaultTrigger = {
        GroupID: '',
        ThresholdType: '',
        ThresholdValue: 0,
        Recurrent: false,
        MinSleep: 0,
        ExpirationDate: '',
        ActivationDate: '',
        BalanceType: '*monetary', // Mapped from API `Type`
        Balance: {
            Type: '*monetary', // Used for reading
            ID: '',
            Value: 0,
        },
        Weight: 0,
        ActionsID: '',
        MinQueuedItems: 0,
        Executed: false,
        LastExecutionTime: '',
    };

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
                // Map ID to GroupID and Type to BalanceType for editing compatibility
                const triggersWithMappings = data.result.map(trigger => ({
                    ...trigger,
                    GroupID: trigger.ID,
                    BalanceType: trigger.Balance?.Type, // Map Type to BalanceType
                }));
                setTriggers(triggersWithMappings);
            } else {
                console.warn('No action triggers found.');
            }
        } catch (error) {
            console.error('Error fetching triggers:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Open modal for adding a new trigger
    const openAddTriggerModal = () => {
        setEditTrigger(defaultTrigger);
        setIsNewTrigger(true);
        setShowModal(true);
    };

    // Open modal for editing an existing trigger
    const handleRowClick = (trigger) => {
        setEditTrigger(trigger);
        setIsNewTrigger(false);
        setShowModal(true);
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
            if (!editTrigger.ThresholdType) {
                setErrorMessage('ThresholdType is required.');
                setIsLoading(false);
                return;
            }

            // Prepare payload for API call
            const payload = {
                GroupID: editTrigger.GroupID,
                ActionTrigger: {
                    BalanceType: editTrigger.BalanceType, // Map BalanceType to API field
                    Balance: {
                        BalanceType: editTrigger.BalanceType, // Use BalanceType instead of Type
                    },
                    ThresholdType: editTrigger.ThresholdType,
                    ThresholdValue: editTrigger.ThresholdValue,
                    Weight: editTrigger.Weight,
                    ActionsID: editTrigger.ActionsID,
                    UniqueID: editTrigger.UniqueID,
                    GroupID: editTrigger.GroupID,
                },
                Overwrite: true,
                Tenant: searchParams.tenant,
            };

            const query = {
                method: isNewTrigger ? 'APIerSv1.SetActionTrigger' : 'APIerSv1.SetActionTrigger',
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
                console.log(`Action trigger ${isNewTrigger ? 'created' : 'updated'} successfully`);
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

    // Delete the current ActionTrigger
    const removeActionTrigger = async () => {
        if (!editTrigger.GroupID) {
            setErrorMessage('Cannot delete ActionTrigger: GroupID is missing.');
            return;
        }

        if (!window.confirm(`Are you sure you want to delete the ActionTrigger: ${editTrigger.GroupID}?`)) {
            return;
        }

        setIsLoading(true);
        setErrorMessage('');
        try {
            const query = {
                method: 'APIerSv1.RemoveActionTrigger',
                params: [{ GroupID: editTrigger.GroupID, Tenant: searchParams.tenant }],
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
                console.log(`ActionTrigger ${editTrigger.GroupID} removed successfully.`);
                setShowModal(false);
                fetchTriggers(); // Refresh the list of triggers
            } else if (data.error) {
                setErrorMessage(`Error: ${data.error}`);
            }
        } catch (error) {
            setErrorMessage(`Error: ${error.message}`);
            console.error('Error removing ActionTrigger:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditTrigger(null);
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
                        <Col md={3}>
                            <Button type="submit" className="w-100 mt-4">Fetch Triggers</Button>
                        </Col>
                        <Col md={3}>
                            <Button variant="success" className="w-100 mt-4" onClick={openAddTriggerModal}>
                                Add Trigger
                            </Button>
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
                                    <th>Actions ID</th>
                                    <th>Balance Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                {triggers.length > 0 ? triggers.map((trigger, index) => (
                                    <tr key={index} onClick={() => handleRowClick(trigger)} style={{ cursor: 'pointer' }}>
                                        <td>{index + 1}</td>
                                        <td>{trigger.ID}</td>
                                        <td>{trigger.ThresholdType}</td>
                                        <td>{trigger.ThresholdValue}</td>
                                        <td>{trigger.ActionsID}</td>
                                        <td>{trigger.BalanceType}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="6" className="text-center">No triggers available</td>
                                    </tr>
                                )}
                            </tbody>
                        </Table>
                    </>
                )}

                <Modal show={showModal} onHide={handleCloseModal} size="lg">
                    <Modal.Header closeButton>
                        <Modal.Title>{isNewTrigger ? 'Add New Trigger' : 'Edit Action Trigger'}</Modal.Title>
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
                                        value={editTrigger.ThresholdType}
                                        onChange={(e) =>
                                            setEditTrigger({ ...editTrigger, ThresholdType: e.target.value })
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
                                        value={editTrigger.ThresholdValue}
                                        onChange={(e) =>
                                            setEditTrigger({ ...editTrigger, ThresholdValue: parseInt(e.target.value, 10) })
                                        }
                                    />
                                </Form.Group>
                                <Form.Group>
                                <Form.Label>Recurrent</Form.Label>
                                    <Form.Check
                                        type="checkbox"
                                        checked={editTrigger.Recurrent}
                                        onChange={(e) =>
                                            setEditTrigger({ ...editTrigger, Recurrent: e.target.checked })
                                        }
                                    />
                                </Form.Group>
                                <Form.Group>
                                    <Form.Label>Min Sleep (ns)</Form.Label>
                                    <Form.Control
                                        type="number"
                                        value={editTrigger.MinSleep}
                                        onChange={(e) =>
                                            setEditTrigger({ ...editTrigger, MinSleep: parseInt(e.target.value, 10) })
                                        }
                                    />
                                </Form.Group>
                                <Form.Group>
                                    <Form.Label>Expiration Date</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editTrigger.ExpirationDate}
                                        onChange={(e) =>
                                            setEditTrigger({ ...editTrigger, ExpirationDate: e.target.value })
                                        }
                                    />
                                </Form.Group>
                                <Form.Group>
                                    <Form.Label>Activation Date</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editTrigger.ActivationDate}
                                        onChange={(e) =>
                                            setEditTrigger({ ...editTrigger, ActivationDate: e.target.value })
                                        }
                                    />
                                </Form.Group>
                                <div style={{ paddingLeft: '20px', borderLeft: '2px solid #ddd', marginTop: '15px' }}>
                                    <h5>Balance Parameters</h5>
                                    <Form.Group>
                                    <Form.Label>Balance Type</Form.Label>
                                    <Form.Control
                                        as="select"
                                        value={editTrigger.BalanceType || ''}
                                        onChange={(e) =>
                                            setEditTrigger({ ...editTrigger, BalanceType: e.target.value })
                                        }
                                    >
                                        <option value="">Select Balance Type</option>
                                        {balanceTypes.map((type, index) => (
                                            <option key={index} value={type}>
                                                {type}
                                            </option>
                                        ))}
                                    </Form.Control>
                                    </Form.Group>
                                    <Form.Group>
                                        <Form.Label>ID</Form.Label>
                                        <Form.Control
                                            type="text"
                                            value={editTrigger.Balance.ID || ''}
                                            onChange={(e) =>
                                                setEditTrigger({
                                                    ...editTrigger,
                                                    Balance: { ...editTrigger.Balance, ID: e.target.value },
                                                })
                                            }
                                        />
                                    </Form.Group>
                                    <Form.Group>
                                        <Form.Label>Value</Form.Label>
                                        <Form.Control
                                            type="number"
                                            value={editTrigger.Balance.Value || 0}
                                            onChange={(e) =>
                                                setEditTrigger({
                                                    ...editTrigger,
                                                    Balance: { ...editTrigger.Balance, Value: parseFloat(e.target.value) },
                                                })
                                            }
                                        />
                                    </Form.Group>
                                </div>
                                <Form.Group>
                                    <Form.Label>Weight</Form.Label>
                                    <Form.Control
                                        type="number"
                                        value={editTrigger.Weight}
                                        onChange={(e) =>
                                            setEditTrigger({ ...editTrigger, Weight: parseInt(e.target.value, 10) })
                                        }
                                    />
                                </Form.Group>
                                <Form.Group>
                                    <Form.Label>Actions ID</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editTrigger.ActionsID}
                                        onChange={(e) =>
                                            setEditTrigger({ ...editTrigger, ActionsID: e.target.value })
                                        }
                                    />
                                </Form.Group>
                                <Form.Group>
                                    <Form.Label>Min Queued Items</Form.Label>
                                    <Form.Control
                                        type="number"
                                        value={editTrigger.MinQueuedItems}
                                        onChange={(e) =>
                                            setEditTrigger({ ...editTrigger, MinQueuedItems: parseInt(e.target.value, 10) })
                                        }
                                    />
                                </Form.Group>
                                <Form.Group>
                                    <Form.Label>Executed</Form.Label>
                                    <Form.Control type="text" value={editTrigger.Executed ? 'Yes' : 'No'} readOnly />
                                </Form.Group>
                                <Form.Group>
                                    <Form.Label>Last Execution Time</Form.Label>
                                    <Form.Control type="text" value={editTrigger.LastExecutionTime} readOnly />
                                </Form.Group>
                                <div style={{ marginTop: '20px' }}>
                                    <h5>JSON Representation</h5>
                                    <pre style={{ background: '#f8f9fa', padding: '10px', borderRadius: '5px' }}>
                                        {JSON.stringify(editTrigger, null, 2)}
                                    </pre>
                                </div>
                            </>
                        )}
                    </Modal.Body>
                    <Modal.Footer>
                        {!isNewTrigger && (
                            <Button variant="danger" onClick={removeActionTrigger}>
                                Remove ActionTrigger
                            </Button>
                        )}
                        <Button variant="primary" onClick={saveChanges}>
                            {isNewTrigger ? 'Add Trigger' : 'Save Changes'}
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
