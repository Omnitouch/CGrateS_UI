import React, { useState } from 'react';
import { Form, Button, Container, Row, Col, Table, Modal, Spinner, ListGroup } from 'react-bootstrap';

const ActionsPage = ({ cgratesConfig }) => {
    const [searchParams, setSearchParams] = useState({
        tenant: '', // Tenant selection
    });
    const [actions, setActions] = useState([]); // Store the list of actions
    const [selectedAction, setSelectedAction] = useState(null); // Store the selected action's details
    const [isEditing, setIsEditing] = useState(false); // Track if editing is active
    const [showModal, setShowModal] = useState(false); // Control the modal display
    const [isLoading, setIsLoading] = useState(false); // Handle loading state
    const [error, setError] = useState(''); // Handle error messages

    const actionTypes = [
        '*log', '*reset_triggers', '*cdrlog', '*set_recurrent', '*unset_recurrent', '*allow_negative', '*deny_negative',
        '*reset_account', '*topup_reset', '*topup', '*debit_reset', '*debit', '*reset_counters', '*enable_account',
        '*disable_account', '*http_post', '*http_post_async', '*mail_async', '*set_ddestinations', '*remove_account',
        '*remove_balance', '*set_balance', '*transfer_monetary_default', '*cgr_rpc', '*topup_zero_negative', '*set_expiry',
        '*publish_account', '*publish_balance', '*remove_session_costs', '*remove_expired', '*cdr_account'
    ];

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setSearchParams({ ...searchParams, [name]: value });
    };

    const fetchActions = async () => {
        setIsLoading(true);
        try {
            const query = {
                method: 'APIerSv2.GetActions',
                params: searchParams.tenant ? [{ Tenant: searchParams.tenant }] : [{}], // If tenant is blank, fetch all actions
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
            if (data.result && Object.keys(data.result).length > 0) {
                const actionsList = Object.entries(data.result).map(([key, value]) => ({
                    id: key,
                    details: value,
                }));
                setActions(actionsList);
            } else {
                console.warn('No actions found.');
                setError('No actions found.');
            }
        } catch (error) {
            console.error('Error fetching actions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRowClick = (actionDetails) => {
        const updatedActionDetails = actionDetails.map(part => {
            const { Balance } = part;
            return {
                ...part,
                // Convert DestinationIDs object back into a string for display/editing
                Balance: Balance
                    ? {
                        ...Balance,
                        DestinationIDs: typeof Balance.DestinationIDs === 'object'
                            ? Object.keys(Balance.DestinationIDs).join(';')
                            : Balance.DestinationIDs,
                    }
                    : part.Balance,
            };
        });

        setSelectedAction(updatedActionDetails);
        setShowModal(true);
        setIsEditing(false); // Start in view mode
    };

    const handleEditChange = (index, field, value) => {
        const updatedAction = [...selectedAction];
        const fieldParts = field.split('.');

        // Check if we're editing the Balance.Value.Static field
        if (fieldParts[0] === 'Balance' && fieldParts[1] === 'Value' && fieldParts[2] === 'Static') {
            updatedAction[index].Balance.Value.Static = parseFloat(value) || 0; // Parse back to number
        } else if (fieldParts.length === 2 && fieldParts[0] === 'Balance') {
            updatedAction[index].Balance = {
                ...updatedAction[index].Balance,
                [fieldParts[1]]: value,
            };
        } else {
            updatedAction[index][field] = value;
        }

        setSelectedAction(updatedAction);
    };



    const handleAddPart = () => {
        const newPart = {
            Id: '',
            ActionType: '',
            ExtraParameters: '',
            Filters: '',
            ExpirationString: '',
            Weight: 0,
            Balance: {
                Uuid: '',
                ID: '',
                Type: '',
                Value: { Static: 0 },
                ExpirationDate: '',
                Weight: 0,
                DestinationIDs: {},
                RatingSubject: '',
                Categories: {},
                SharedGroups: {},
                TimingIDs: {},
                Timings: null,
                Disabled: null,
                Factors: null,
                Blocker: null,
            },
        };
        setSelectedAction([...selectedAction, newPart]);
    };

    const handleRemovePart = (index) => {
        const updatedAction = [...selectedAction];
        updatedAction.splice(index, 1);
        setSelectedAction(updatedAction);
    };

    const handleSaveAction = async () => {
        setIsLoading(true);
        setError('');

        try {
            const updatedActions = selectedAction.map(part => {
                const { Balance } = part;

                // Convert Balance fields for saving
                const balanceData = Balance
                    ? {
                        BalanceId: Balance.ID || undefined,
                        BalanceType: Balance.Type || undefined,
                        Units: Balance.Value?.Static || undefined,
                        ExpiryTime: part.ExpirationString || undefined,
                        BalanceWeight: Balance.Weight || undefined,
                        // Convert DestinationIDs object to semicolon-separated string if not already a string
                        DestinationIDs: typeof Balance.DestinationIDs === 'object'
                            ? Object.keys(Balance.DestinationIDs).join(';')
                            : Balance.DestinationIDs || undefined,
                    }
                    : {};

                return {
                    Identifier: part.Identifier || part.ActionType, // Ensure Identifier is set
                    ExtraParameters: part.ExtraParameters || undefined,
                    Filters: part.Filters || undefined,
                    ExpirationString: part.ExpirationString || undefined,
                    Weight: part.Weight || undefined,
                    ...balanceData, // Include formatted balance data
                };
            });

            const query = {
                method: 'ApierV1.SetActions',
                params: [
                    {
                        ActionsId: selectedAction[0].Id,
                        Tenant: searchParams.tenant || 'default_tenant',
                        Overwrite: true,
                        Actions: updatedActions,
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
                console.log('Action saved successfully');
                fetchActions(); // Refresh actions list
                setShowModal(false); // Close modal
            }
        } catch (error) {
            console.error('Error saving action:', error);
            setError('Error saving action: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };


    const handleCreateNewAction = () => {
        const newAction = [{
            Id: '',
            ActionType: '',
            ExtraParameters: '',
            Filters: '',
            ExpirationString: '',
            Weight: 0,
            Balance: {
                Uuid: '',
                ID: '',
                Type: '',
                Value: { Static: 0 },
                ExpirationDate: '',
                Weight: 0,
                DestinationIDs: {},
                RatingSubject: '',
                Categories: {},
                SharedGroups: {},
                TimingIDs: {},
                Timings: null,
                Disabled: null,
                Factors: null,
                Blocker: null,
            },
        }];
        setSelectedAction(newAction);
        setShowModal(true);
        setIsEditing(true); // Enable editing for new action
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedAction(null);
        setError('');
    };

    return (
        <Container>
            <h2>Manage Actions</h2>
            <Form onSubmit={(e) => { e.preventDefault(); fetchActions(); }} className="mt-4">
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
                    <Col md={12} className="d-flex align-items-end">
                        <Button type="submit" className="w-100">Fetch Actions</Button>
                    </Col>
                </Row>
            </Form>

            <Button className="mt-3" variant="primary" onClick={handleCreateNewAction}>
                Create New Action
            </Button>

            {isLoading ? (
                <div className="text-center mt-4">
                    <Spinner animation="border" role="status">
                        <span className="sr-only">Loading...</span>
                    </Spinner>
                </div>
            ) : (
                error && <p className="text-danger mt-3">{error}</p>
            )}

            {actions.length > 0 && (
                <Table striped bordered hover className="mt-4">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Action ID</th>
                            <th>Number of Parts</th>
                        </tr>
                    </thead>
                    <tbody>
                        {actions.map((action, index) => (
                            <tr key={index} onClick={() => handleRowClick(action.details)} style={{ cursor: 'pointer' }}>
                                <td>{index + 1}</td>
                                <td>{action.id}</td>
                                <td>{action.details.length}</td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}

            <Modal show={showModal} onHide={handleCloseModal} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>
                        {isEditing ? 'Edit Action' : 'Action Details'}
                        {selectedAction && selectedAction[0]?.Id ? ` for ${selectedAction[0].Id}` : ''}
                    </Modal.Title>

                </Modal.Header>
                <Modal.Body>
                    {selectedAction && selectedAction.map((part, index) => (
                        <div key={index} className="mb-4">
                            <h5>Part {index + 1}</h5>
                            <ListGroup>
                                <ListGroup.Item>
                                    <strong>ActionType:</strong>
                                    {isEditing ? (
                                        <Form.Control
                                            as="select"
                                            value={part.ActionType}
                                            onChange={(e) => handleEditChange(index, 'ActionType', e.target.value)}
                                        >
                                            {actionTypes.map((type, idx) => (
                                                <option key={idx} value={type}>
                                                    {type}
                                                </option>
                                            ))}
                                        </Form.Control>
                                    ) : (
                                        part.ActionType
                                    )}
                                </ListGroup.Item>

                                <ListGroup.Item>
                                    <strong>DestinationIDs:</strong>
                                    {isEditing ? (
                                        <Form.Control
                                            type="text"
                                            value={part.Balance?.DestinationIDs || ''}
                                            onChange={(e) => handleEditChange(index, 'Balance.DestinationIDs', e.target.value)}
                                        />
                                    ) : (
                                        part.Balance?.DestinationIDs || 'N/A'
                                    )}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>Filters:</strong>
                                    {isEditing ? (
                                        <Form.Control
                                            type="text"
                                            value={part.Filters}
                                            onChange={(e) => handleEditChange(index, 'Filters', e.target.value)}
                                        />
                                    ) : (
                                        part.Filters || 'N/A'
                                    )}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>Expiration:</strong>
                                    {isEditing ? (
                                        <Form.Control
                                            type="text"
                                            value={part.ExpirationString}
                                            onChange={(e) => handleEditChange(index, 'ExpirationString', e.target.value)}
                                        />
                                    ) : (
                                        part.ExpirationString || 'N/A'
                                    )}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>Weight:</strong>
                                    {isEditing ? (
                                        <Form.Control
                                            type="number"
                                            value={part.Weight}
                                            onChange={(e) => handleEditChange(index, 'Weight', e.target.value)}
                                        />
                                    ) : (
                                        part.Weight
                                    )}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>Balance ID:</strong>
                                    {isEditing ? (
                                        <Form.Control
                                            type="text"
                                            value={part.Balance?.ID || ''}
                                            onChange={(e) => handleEditChange(index, 'Balance.ID', e.target.value)}
                                        />
                                    ) : (
                                        part.Balance?.ID || 'N/A'
                                    )}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>Balance Type:</strong>
                                    {isEditing ? (
                                        <Form.Control
                                            type="text"
                                            value={part.Balance.Type}
                                            onChange={(e) => handleEditChange(index, 'Balance.Type', e.target.value)}
                                        />
                                    ) : (
                                        part.Balance.Type || 'N/A'
                                    )}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>Balance Value:</strong>
                                    {isEditing ? (
                                        <Form.Control
                                            type="text" // Temporarily switch to "text" for easier debugging
                                            value={part.Balance?.Value?.Static?.toString() || ''} // Convert to string for form input
                                            onChange={(e) => handleEditChange(index, 'Balance.Value.Static', e.target.value)}
                                        />
                                    ) : (
                                        part.Balance?.Value?.Static || 0
                                    )}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>Balance Expiration Date:</strong>
                                    {isEditing ? (
                                        <Form.Control
                                            type="text"
                                            value={part.Balance.ExpirationDate}
                                            onChange={(e) => handleEditChange(index, 'Balance.ExpirationDate', e.target.value)}
                                        />
                                    ) : (
                                        part.Balance.ExpirationDate || 'N/A'
                                    )}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>Extra Parameters:</strong>
                                    {isEditing ? (
                                        <Form.Control
                                            as="textarea"
                                            rows={3}
                                            value={part.ExtraParameters ? JSON.stringify(JSON.parse(part.ExtraParameters), null, 2) : ''} // Parse JSON and pretty print
                                            onChange={(e) => handleEditChange(index, 'ExtraParameters', e.target.value)}
                                        />
                                    ) : (
                                        <pre>{part.ExtraParameters ? JSON.stringify(JSON.parse(part.ExtraParameters), null, 2) : 'N/A'}</pre> // Pretty print JSON
                                    )}
                                </ListGroup.Item>
                                {/* Add a "Remove Part" button */}
                                {isEditing && (
                                    <Button variant="danger" onClick={() => handleRemovePart(index)} className="mt-2">
                                        Remove Part
                                    </Button>
                                )}
                            </ListGroup>
                        </div>
                    ))}
                    {isEditing && (
                        <Button variant="primary" onClick={handleAddPart} className="mt-3">
                            Add New Part
                        </Button>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    {isEditing ? (
                        <Button variant="primary" onClick={handleSaveAction}>
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
    );
};

export default ActionsPage;
