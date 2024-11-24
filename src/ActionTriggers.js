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
                // Map ID to GroupID for editing compatibility
                const triggersWithGroupID = data.result.map(trigger => ({
                    ...trigger,
                    GroupID: trigger.ID,
                }));
                setTriggers(triggersWithGroupID);
            } else {
                console.warn('No action triggers found.');
            }
        } catch (error) {
            console.error('Error fetching triggers:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Open modal for editing an existing trigger
    const handleRowClick = (trigger) => {
        setEditTrigger(trigger);
        setShowModal(true);
    };

    // Save the edited trigger
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

            const payload = {
                GroupID: editTrigger.GroupID, // Use GroupID when setting the trigger
                ActionTrigger: {
                    ...editTrigger,
                    Balance: {
                        ...editTrigger.Balance,
                        Value: parseFloat(editTrigger.Balance.Value || 0),
                    },
                },
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
                                    <th>Actions ID</th>
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
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="5" className="text-center">No triggers available</td>
                                    </tr>
                                )}
                            </tbody>
                        </Table>
                    </>
                )}

                <Modal show={showModal} onHide={handleCloseModal} size="lg">
                    <Modal.Header closeButton>
                        <Modal.Title>Edit Action Trigger</Modal.Title>
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
                                <div style={{ paddingLeft: '20px', borderLeft: '2px solid #ddd', marginTop: '15px' }}>
                                    <h5>Balance Parameters</h5>
                                    <Form.Group>
                                        <Form.Label>Balance Type</Form.Label>
                                        <Form.Control
                                            as="select"
                                            value={editTrigger.Balance.BalanceType || ''}
                                            onChange={(e) =>
                                                setEditTrigger({
                                                    ...editTrigger,
                                                    Balance: { ...editTrigger.Balance, BalanceType: e.target.value },
                                                })
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
                                        <Form.Label>Balance ID</Form.Label>
                                        <Form.Control
                                            type="text"
                                            value={editTrigger.Balance.BalanceID || ''}
                                            onChange={(e) =>
                                                setEditTrigger({
                                                    ...editTrigger,
                                                    Balance: { ...editTrigger.Balance, BalanceID: e.target.value },
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
                        <Button variant="danger" onClick={removeActionTrigger}>
                            Remove ActionTrigger
                        </Button>
                        <Button variant="primary" onClick={saveChanges}>
                            Save Changes
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
