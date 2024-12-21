import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Table, Modal, Spinner, ListGroup } from 'react-bootstrap';

const Timings = ({ cgratesConfig }) => {
    const [tpids, setTPIDs] = useState([]); // Store TPIDs for dropdown
    const [searchParams, setSearchParams] = useState({
        tpid: '', // Selected TPID for Timings
    });
    const [timings, setTimings] = useState([]); // Store the list of timings
    const [selectedTiming, setSelectedTiming] = useState(null); // Store the selected timing's details
    const [isEditing, setIsEditing] = useState(false); // Track if editing is active
    const [showModal, setShowModal] = useState(false); // Control the modal display
    const [isLoading, setIsLoading] = useState(false); // Handle loading state
    const [error, setError] = useState(''); // Handle error messages
    const [isActiveResult, setIsActiveResult] = useState(null); // Store the result of TimingIsActiveAt test

    useEffect(() => {
        const fetchTPIDs = async () => {
            const newQuery = {
                method: 'APIerSv1.GetTPIds',
                params: [],
            };

            try {
                const response = await fetch(cgratesConfig.url + '/jsonrpc', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(newQuery),
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                if (data && data.result) {
                    setTPIDs(data.result);
                }
            } catch (error) {
                console.error('Error fetching TPIDs:', error);
                setTPIDs([]);
            }
        };

        fetchTPIDs();
    }, [cgratesConfig.url]);

    const handleTPIDChange = (event) => {
        setSearchParams({ ...searchParams, tpid: event.target.value });
    };

    const fetchTimings = async () => {
        setIsLoading(true);
        try {
            const query = {
                method: 'GetTPTimingIds',
                params: searchParams.tpid ? [{ TPid: searchParams.tpid }] : [{}], // Fetch timings for the specified TPID
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
            if (data.result && data.result.length > 0) {
                setTimings(data.result);
            } else {
                setError('No timings found.');
            }
        } catch (error) {
            console.error('Error fetching timings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRowClick = async (timingId) => {
        setIsLoading(true);
        try {
            const query = {
                method: 'GetTiming',
                params: [{ TPid: searchParams.tpid, ID: timingId }],
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
                setSelectedTiming(data.result);
                setShowModal(true);
                setIsEditing(false);
            } else {
                setError('Failed to retrieve timing details.');
            }
        } catch (error) {
            console.error('Error fetching timing details:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditChange = (field, value) => {
        setSelectedTiming({ ...selectedTiming, [field]: value });
    };

    const handleSaveTiming = async () => {
        setIsLoading(true);
        setError('');

        try {
            const query = {
                method: 'ApierV2.SetTPTiming',
                params: [
                    {
                        TPid: searchParams.tpid,
                        ID: selectedTiming.ID,
                        Years: selectedTiming.Years || '*any',
                        Months: selectedTiming.Months || '*any',
                        MonthDays: selectedTiming.MonthDays || '*any',
                        WeekDays: selectedTiming.WeekDays || '*any',
                        Time: selectedTiming.Time || '*any',
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
                console.log('Timing saved successfully');
                fetchTimings(); // Refresh timings list
                setShowModal(false); // Close modal
            } else {
                throw new Error(data.error?.message || 'Failed to save timing');
            }
        } catch (error) {
            console.error('Error saving timing:', error);
            setError('Error saving timing: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateNewTiming = () => {
        setSelectedTiming({
            ID: '',
            Years: '*any',
            Months: '*any',
            MonthDays: '*any',
            WeekDays: '*any',
            Time: '*any',
        });
        setShowModal(true);
        setIsEditing(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedTiming(null);
        setError('');
    };

    const handleTestTiming = async (timingId, time) => {
        setIsLoading(true);
        setIsActiveResult(null);
        try {
            const query = {
                method: 'APIerSv1.TimingIsActiveAt',
                params: [{ TimingID: timingId, Time: time }],
                id: 4,
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
                setIsActiveResult(data.result);
            } else {
                setError('Failed to test timing activity.');
            }
        } catch (error) {
            console.error('Error testing timing activity:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Container>
            <h2>Manage Timings</h2>
            <Form onSubmit={(e) => { e.preventDefault(); fetchTimings(); }} className="mt-4">
                <Row>
                    <Col md={6}>
                        <Form.Group controlId="formTPID">
                            <Form.Label>TPID</Form.Label>
                            <Form.Control
                                as="select"
                                value={searchParams.tpid}
                                onChange={handleTPIDChange}
                            >
                                <option value="">Select TPID</option>
                                {tpids.map((tpid, index) => (
                                    <option key={index} value={tpid}>{tpid}</option>
                                ))}
                            </Form.Control>
                        </Form.Group>
                    </Col>
                    <Col md={12} className="d-flex align-items-end">
                        <Button type="submit" className="w-100">Fetch Timings</Button>
                    </Col>
                </Row>
            </Form>

            <Button className="mt-3" variant="primary" onClick={handleCreateNewTiming}>
                Create New Timing
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

            {timings.length > 0 && (
                <Table striped bordered hover className="mt-4">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Timing ID</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {timings.map((timingId, index) => (
                            <tr key={index}>
                                <td>{index + 1}</td>
                                <td onClick={() => handleRowClick(timingId)} style={{ cursor: 'pointer' }}>{timingId}</td>
                                <td>
                                    <Button
                                        variant="info"
                                        onClick={() => handleTestTiming(timingId, '*now')}
                                        className="me-2"
                                    >
                                        Test Now
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        onClick={() => handleTestTiming(timingId, '2024-09-17T12:00:00Z')}
                                    >
                                        Test Specific Time
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}

            {isActiveResult && (
                <div className="mt-4">
                    <h4>Timing Test Result</h4>
                    <pre>{JSON.stringify(isActiveResult, null, 2)}</pre>
                </div>
            )}

            <Modal show={showModal} onHide={handleCloseModal} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>
                        {isEditing ? 'Edit Timing' : 'Timing Details'}
                        {selectedTiming?.ID ? ` for ${selectedTiming.ID}` : ''}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedTiming && (
                        <ListGroup>
                            <ListGroup.Item>
                                <strong>ID:</strong>
                                {isEditing ? (
                                    <Form.Control
                                        type="text"
                                        value={selectedTiming.ID}
                                        onChange={(e) => handleEditChange('ID', e.target.value)}
                                    />
                                ) : (
                                    selectedTiming.ID
                                )}
                            </ListGroup.Item>
                            <ListGroup.Item>
                                <strong>Years:</strong>
                                {isEditing ? (
                                    <Form.Control
                                        type="text"
                                        value={selectedTiming.Years}
                                        onChange={(e) => handleEditChange('Years', e.target.value)}
                                    />
                                ) : (
                                    selectedTiming.Years
                                )}
                            </ListGroup.Item>
                            <ListGroup.Item>
                                <strong>Months:</strong>
                                {isEditing ? (
                                    <Form.Control
                                        type="text"
                                        value={selectedTiming.Months}
                                        onChange={(e) => handleEditChange('Months', e.target.value)}
                                    />
                                ) : (
                                    selectedTiming.Months
                                )}
                            </ListGroup.Item>
                            <ListGroup.Item>
                                <strong>Month Days:</strong>
                                {isEditing ? (
                                    <Form.Control
                                        type="text"
                                        value={selectedTiming.MonthDays}
                                        onChange={(e) => handleEditChange('MonthDays', e.target.value)}
                                    />
                                ) : (
                                    selectedTiming.MonthDays
                                )}
                            </ListGroup.Item>
                            <ListGroup.Item>
                                <strong>Week Days:</strong>
                                {isEditing ? (
                                    <Form.Control
                                        type="text"
                                        value={selectedTiming.WeekDays}
                                        onChange={(e) => handleEditChange('WeekDays', e.target.value)}
                                    />
                                ) : (
                                    selectedTiming.WeekDays
                                )}
                            </ListGroup.Item>
                            <ListGroup.Item>
                                <strong>Time:</strong>
                                {isEditing ? (
                                    <Form.Control
                                        type="text"
                                        value={selectedTiming.Time}
                                        onChange={(e) => handleEditChange('Time', e.target.value)}
                                    />
                                ) : (
                                    selectedTiming.Time
                                )}
                            </ListGroup.Item>
                        </ListGroup>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    {isEditing ? (
                        <Button variant="primary" onClick={handleSaveTiming}>
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

export default Timings;
