import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Table, Modal, Spinner, ListGroup } from 'react-bootstrap';

const StatsS = ({ cgratesConfig }) => {
    const [searchParams, setSearchParams] = useState({
        tenant: cgratesConfig.tenants.split(';')[0],
    });
    const [profiles, setProfiles] = useState([]);
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [metricsDetails, setMetricsDetails] = useState(null);
    const [editProfile, setEditProfile] = useState({});
    const [showModal, setShowModal] = useState(false);
    const [showMetricsModal, setShowMetricsModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [responseTime, setResponseTime] = useState(null);
    const [genericMetricInput, setGenericMetricInput] = useState({});

    const metricsOptions = [
        { value: '*asr', label: 'Answer-seizure ratio' },
        { value: '*acd', label: 'Average call duration' },
        { value: '*tcd', label: 'Total call duration' },
        { value: '*acc', label: 'Average call cost' },
        { value: '*tcc', label: 'Total call cost' },
        { value: '*pdd', label: 'Post dial delay' },
        { value: '*ddc', label: 'Distinct destination count' },
        { value: '*sum', label: 'Generic sum' },
        { value: '*average', label: 'Generic average' },
        { value: '*distinct', label: 'Generic distinct' },
    ];

    useEffect(() => {
        setSearchParams({ tenant: cgratesConfig.tenants.split(';')[0] });
    }, [cgratesConfig]);

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setSearchParams({ ...searchParams, [name]: value });
    };

    const getMetricLabel = (metricID) => {
        const metric = metricsOptions.find((option) => option.value === metricID);
        return metric ? metric.label : metricID; // Fallback to the raw MetricID if not found
    };

    const fetchProfiles = async () => {
        setIsLoading(true);
        setProfiles([]);
        const startTime = Date.now();

        try {
            const query = {
                method: 'APIerSv1.GetStatQueueProfileIDs',
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

            const data = await response.json();
            const endTime = Date.now();
            setResponseTime(((endTime - startTime) / 1000).toFixed(2));

            if (data.result) {
                // Sort profiles alphabetically
                const sortedProfiles = data.result.sort((a, b) => a.localeCompare(b));
                setProfiles(sortedProfiles);
            }
        } catch (error) {
            console.error('Error fetching profiles:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchProfileDetails = async (profileId) => {
        setIsLoading(true);
        try {
            const query = {
                method: 'APIerSv1.GetStatQueueProfile',
                params: [{ Tenant: searchParams.tenant, ID: profileId }],
                id: 2,
            };

            const response = await fetch(cgratesConfig.url + '/jsonrpc', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(query),
            });

            const data = await response.json();

            if (data.result) {
                const profile = data.result;

                // Parse metrics to separate metric type and generic value
                const parsedMetrics = profile.Metrics.map((metric) => {
                    const [metricType, genericValue] = metric.MetricID.split('#');
                    return {
                        ...metric,
                        MetricID: metricType, // Strip the # and value
                        genericValue: genericValue || '', // Store the generic value
                    };
                });

                setSelectedProfile(profile);
                setEditProfile({ ...profile, Metrics: parsedMetrics });

                // Set generic metric input values
                const genericInputs = parsedMetrics.reduce((acc, metric, index) => {
                    if (metric.genericValue) {
                        acc[index] = metric.genericValue;
                    }
                    return acc;
                }, {});
                setGenericMetricInput(genericInputs);

                setShowModal(true);
                setIsEditing(false);
            }
        } catch (error) {
            console.error('Error fetching profile details:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRowClick = (profileId) => {
        fetchProfileDetails(profileId);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedProfile(null);
        setIsEditing(false);
    };

    const handleEditChange = (event) => {
        const { name, value } = event.target;
        setEditProfile({ ...editProfile, [name]: value });
    };

    const handleGenericInputChange = (index, value) => {
        setGenericMetricInput({ ...genericMetricInput, [index]: value });
    };

    const handleMetricChange = (index, newValue) => {
        const updatedMetrics = [...editProfile.Metrics];
        updatedMetrics[index].MetricID = newValue;

        // Reset the generic input if the metric is not generic
        if (!newValue.startsWith('*sum') && !newValue.startsWith('*average') && !newValue.startsWith('*distinct')) {
            setGenericMetricInput({ ...genericMetricInput, [index]: '' });
        }

        setEditProfile({ ...editProfile, Metrics: updatedMetrics });
    };

    const addMetric = () => {
        const updatedMetrics = [...(editProfile.Metrics || [])];
        updatedMetrics.push({ MetricID: metricsOptions[0].value }); // Default to first metric
        setEditProfile({ ...editProfile, Metrics: updatedMetrics });
    };

    const removeMetric = (index) => {
        const updatedMetrics = [...editProfile.Metrics];
        updatedMetrics.splice(index, 1);
        setEditProfile({ ...editProfile, Metrics: updatedMetrics });
    };

    const saveProfile = async () => {
        setIsLoading(true);
        try {
            // Sanitize the profile data
            const sanitizedProfile = {
                ...editProfile,
                TTL: parseInt(editProfile.TTL, 10),
                QueueLength: parseInt(editProfile.QueueLength, 10),
                FilterIDs: editProfile.FilterIDs || [],
                Metrics: (editProfile.Metrics || []).map((metric, index) => {
                    let metricID = metric.MetricID;

                    // Append generic input value if applicable
                    if (
                        (metricID.startsWith('*sum') || metricID.startsWith('*average') || metricID.startsWith('*distinct')) &&
                        genericMetricInput[index]
                    ) {
                        metricID = `${metricID}#${genericMetricInput[index]}`;
                    }

                    return {
                        ...metric,
                        MetricID: metricID,
                        FilterIDs: metric.FilterIDs || [],
                    };
                }),
            };

            const query = {
                method: 'APIerSv1.SetStatQueueProfile',
                params: [sanitizedProfile],
            };

            const response = await fetch(cgratesConfig.url + '/jsonrpc', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(query),
            });

            const data = await response.json();

            if (data.result) {
                fetchProfiles();
                handleCloseModal();
            }
        } catch (error) {
            console.error('Error saving profile:', error);
        } finally {
            setIsLoading(false);
        }
    };


    const removeProfile = async (profileId) => {
        if (!window.confirm('Are you sure you want to remove this profile?')) return;

        setIsLoading(true);
        try {
            const query = {
                method: 'APIerSv1.RemoveStatQueueProfile',
                params: [{ Tenant: searchParams.tenant, ID: profileId }],
                id: 3,
            };

            const response = await fetch(cgratesConfig.url + '/jsonrpc', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(query),
            });

            const data = await response.json();

            if (data.result) {
                fetchProfiles();
            }
        } catch (error) {
            console.error('Error removing profile:', error);
        } finally {
            setIsLoading(false);
        }
    };



    const fetchMetrics = async (profileId) => {
        setIsLoading(true);
        try {
            const query = {
                method: 'StatSv1.GetQueueStringMetrics',
                params: [{ Tenant: searchParams.tenant, ID: profileId, APIOpts: {} }],
                id: 12,
            };

            const response = await fetch(cgratesConfig.url + '/jsonrpc', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(query),
            });

            const data = await response.json();

            if (data.result) {
                setMetricsDetails(data.result);
                setShowMetricsModal(true);
            }
        } catch (error) {
            console.error('Error fetching metrics:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCloseMetricsModal = () => {
        setShowMetricsModal(false);
        setMetricsDetails(null);
    };


    const clearStat = async (profileId) => {
        setIsLoading(true);
        try {
            const query = {
                method: 'StatSv1.ResetStatQueue',
                params: [{ Tenant: searchParams.tenant, ID: profileId }],
                id: 4,
            };

            const response = await fetch(cgratesConfig.url + '/jsonrpc', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(query),
            });

            const data = await response.json();

            if (data.result) {
                console.log('Stat cleared successfully.');
            }
        } catch (error) {
            console.error('Error clearing stat:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const clearAllStats = async () => {
        if (!window.confirm('Are you sure you want to clear ALL stats? This will reset all stat queues.')) {
            return;
        }

        setIsLoading(true);
        let successCount = 0;
        let failCount = 0;

        try {
            for (const profile of profiles) {
                try {
                    const query = {
                        method: 'StatSv1.ResetStatQueue',
                        params: [{ Tenant: searchParams.tenant, ID: profile }],
                        id: 4,
                    };

                    const response = await fetch(cgratesConfig.url + '/jsonrpc', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(query),
                    });

                    const data = await response.json();

                    if (data.result) {
                        successCount++;
                    } else {
                        failCount++;
                    }
                } catch (error) {
                    console.error(`Error clearing stat ${profile}:`, error);
                    failCount++;
                }
            }

            alert(`Cleared ${successCount} stats successfully. ${failCount > 0 ? `Failed to clear ${failCount} stats.` : ''}`);
        } catch (error) {
            console.error('Error clearing all stats:', error);
            alert('An error occurred while clearing stats.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleNewProfile = () => {
        setEditProfile({
            Tenant: searchParams.tenant,
            ID: '',
            QueueLength: 0,
            TTL: -1,
            MinItems: 0,
            Metrics: [],
        });
        setIsEditing(true);
        setShowModal(true);
    };

    const handleFilterChange = (index, value) => {
        const updatedFilters = [...editProfile.FilterIDs];
        updatedFilters[index] = value;
        setEditProfile({ ...editProfile, FilterIDs: updatedFilters });
    };

    const removeFilter = (index) => {
        const updatedFilters = [...editProfile.FilterIDs];
        updatedFilters.splice(index, 1);
        setEditProfile({ ...editProfile, FilterIDs: updatedFilters });
    };

    const addFilter = () => {
        const updatedFilters = [...(editProfile.FilterIDs || [])];
        updatedFilters.push(''); // Add a new empty filter
        setEditProfile({ ...editProfile, FilterIDs: updatedFilters });
    };


    return (
        <div>
            <Container>
                <h2>Stat Queue Profiles</h2>
                <Form onSubmit={(e) => e.preventDefault()}>
                    <Row>
                        <Col>
                            <Form.Group controlId="tenant">
                                <Form.Label>Tenant</Form.Label>
                                <Form.Control
                                    as="select"
                                    name="tenant"
                                    value={searchParams.tenant}
                                    onChange={handleInputChange}
                                >
                                    {cgratesConfig.tenants.split(';').map((tenant) => (
                                        <option key={tenant}>{tenant}</option>
                                    ))}
                                </Form.Control>
                            </Form.Group>
                        </Col>
                        <Col>
                            <Button onClick={fetchProfiles} className="me-2">Fetch Profiles</Button>
                            <Button onClick={handleNewProfile} variant="success" className="me-2">Create Stat</Button>
                            <Button
                                onClick={clearAllStats}
                                variant="danger"
                                className="me-2"
                                disabled={profiles.length === 0 || isLoading}
                            >
                                Clear All Stats
                            </Button>
                        </Col>
                    </Row>
                </Form>
                <Table striped bordered hover className="mt-4">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {profiles.map((profile) => (
                            <tr key={profile} onClick={() => handleRowClick(profile)} style={{ cursor: 'pointer' }}>
                                <td>{profile}</td>
                                <td>
                                    <Button
                                        className="me-2"
                                        variant="info"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            fetchMetrics(profile);
                                        }}
                                    >
                                        View Metrics
                                    </Button>
                                    <Button
                                        className="me-2"
                                        variant="primary"
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            await fetchProfileDetails(profile);
                                            setIsEditing(true);
                                        }}
                                    >
                                        Edit Stats
                                    </Button>
                                    <Button
                                        className="me-2"
                                        variant="danger"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeProfile(profile);
                                        }}
                                    >
                                        Remove
                                    </Button>
                                    <Button
                                        className="me-2"
                                        variant="warning"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            clearStat(profile);
                                        }}
                                    >
                                        Clear Stat
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </Container>

            {/* Profile Modal */}
            <Modal show={showModal} onHide={handleCloseModal}>
                <Modal.Header closeButton>
                    <Modal.Title>
                        {isEditing ? 'Edit Profile' : 'View Profile'}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {isEditing ? (
                        <>
                            <Form.Group>
                                <Form.Label>ID</Form.Label>
                                <Form.Control
                                    type="text"
                                    name="ID"
                                    value={editProfile.ID}
                                    onChange={handleEditChange}
                                />
                            </Form.Group>
                            <Form.Group>
                                <Form.Label>Queue Length</Form.Label>
                                <Form.Control
                                    type="number"
                                    name="QueueLength"
                                    value={editProfile.QueueLength}
                                    onChange={handleEditChange}
                                />
                            </Form.Group>
                            <Form.Group>
                                <Form.Label>TTL</Form.Label>
                                <Form.Control
                                    type="number"
                                    name="TTL"
                                    value={editProfile.TTL}
                                    onChange={(e) => {
                                        const ttlValue = parseInt(e.target.value, 10);
                                        setEditProfile({ ...editProfile, TTL: isNaN(ttlValue) ? '' : ttlValue });
                                    }}
                                />
                            </Form.Group>

                            <Form.Group>
                                <Form.Label>Filters</Form.Label>
                                {(editProfile.FilterIDs || []).map((filter, index) => (
                                    <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            value={filter}
                                            onChange={(e) => handleFilterChange(index, e.target.value)}
                                            style={{ marginRight: '10px' }}
                                        />
                                        <Button
                                            variant="danger"
                                            onClick={() => removeFilter(index)}
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                ))}
                                <Button variant="success" onClick={addFilter}>Add Filter</Button>
                            </Form.Group>

                            <Form.Group>
                                <Form.Label>Metrics</Form.Label>
                                {(editProfile.Metrics || []).map((metric, index) => (
                                    <div key={index} style={{ marginBottom: '15px' }}>
                                        <Form.Label>Metric: {metric.MetricID}</Form.Label>
                                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                                            <Form.Control
                                                as="select"
                                                value={metric.MetricID}
                                                onChange={(e) => handleMetricChange(index, e.target.value)}
                                                style={{ marginRight: '10px' }}
                                            >
                                                {metricsOptions.map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </Form.Control>
                                        </div>

                                        {/* Render input field for generic metrics */}
                                        {(metric.MetricID.startsWith('*sum') || metric.MetricID.startsWith('*average') || metric.MetricID.startsWith('*distinct')) && (
                                            <Form.Group>
                                                <Form.Label>Input Value</Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    value={genericMetricInput[index] || ''}
                                                    onChange={(e) => handleGenericInputChange(index, e.target.value)}
                                                    placeholder="Enter value (e.g., 1234)"
                                                />
                                            </Form.Group>
                                        )}

                                        {/* Render filters for the metric */}
                                        {(metric.FilterIDs || []).map((filter, filterIndex) => (
                                            <div key={filterIndex} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                                                <Form.Control
                                                    type="text"
                                                    value={filter}
                                                    onChange={(e) => {
                                                        const updatedMetrics = [...editProfile.Metrics];
                                                        updatedMetrics[index].FilterIDs[filterIndex] = e.target.value;
                                                        setEditProfile({ ...editProfile, Metrics: updatedMetrics });
                                                    }}
                                                    style={{ marginRight: '10px' }}
                                                />
                                                <Button
                                                    variant="danger"
                                                    onClick={() => {
                                                        const updatedMetrics = [...editProfile.Metrics];
                                                        updatedMetrics[index].FilterIDs.splice(filterIndex, 1);
                                                        setEditProfile({ ...editProfile, Metrics: updatedMetrics });
                                                    }}
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                        ))}
                                        <Button
                                            variant="success"
                                            onClick={() => {
                                                const updatedMetrics = [...editProfile.Metrics];
                                                updatedMetrics[index].FilterIDs = [...(updatedMetrics[index].FilterIDs || []), ''];
                                                setEditProfile({ ...editProfile, Metrics: updatedMetrics });
                                            }}
                                        >
                                            Add Filter
                                        </Button>
                                    </div>
                                ))}
                                <Button onClick={addMetric}>Add Metric</Button>
                            </Form.Group>
                        </>
                    ) : (
                        selectedProfile && (
                            <>
                                <ListGroup>
                                    <ListGroup.Item>
                                        <strong>ID:</strong> {selectedProfile.ID}
                                    </ListGroup.Item>
                                    <ListGroup.Item>
                                        <strong>Queue Length:</strong> {selectedProfile.QueueLength}
                                    </ListGroup.Item>
                                    <ListGroup.Item>
                                        <strong>TTL:</strong> {selectedProfile.TTL}
                                    </ListGroup.Item>
                                    <ListGroup.Item>
                                        <strong>Filters:</strong>
                                        <ul>
                                            {(selectedProfile.FilterIDs || []).length > 0 ? (
                                                selectedProfile.FilterIDs.map((filter, index) => (
                                                    <li key={index}>{filter}</li>
                                                ))
                                            ) : (
                                                <li>No filters available</li>
                                            )}
                                        </ul>
                                    </ListGroup.Item>
                                    <ListGroup.Item>
                                        <strong>Metrics:</strong>
                                        <ul>
                                            {selectedProfile.Metrics.map((metric, index) => (
                                                <li key={index}>
                                                    <strong>Metric ID:</strong> {metric.MetricID}<br />
                                                    <strong>Filters:</strong>
                                                    <ul>
                                                        {(metric.FilterIDs || []).length > 0 ? (
                                                            metric.FilterIDs.map((filter, idx) => (
                                                                <li key={idx}>{filter}</li>
                                                            ))
                                                        ) : (
                                                            <li>No filters available</li>
                                                        )}
                                                    </ul>
                                                </li>
                                            ))}
                                        </ul>
                                    </ListGroup.Item>
                                </ListGroup>
                            </>
                        )
                    )}
                </Modal.Body>
                <Modal.Footer>
                    {isEditing ? (
                        <Button variant="primary" onClick={saveProfile}>
                            Save
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
            <Modal show={showMetricsModal} onHide={handleCloseMetricsModal}>
                <Modal.Header closeButton>
                    <Modal.Title>Metrics Details</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {metricsDetails ? (
                        <ListGroup>
                            {Object.entries(metricsDetails).map(([key, value], index) => {
                                // Extract the metric type and value (e.g., "*sum#1" => ["*sum", "1"])
                                const [metricType, metricValue] = key.split('#');
                                const metricLabel = getMetricLabel(metricType);

                                // Format the display string (e.g., "Generic Sum: 1")
                                const displayText = metricValue ? `${metricLabel} of field #${metricValue}` : metricLabel;

                                return (
                                    <ListGroup.Item key={index}>
                                        <strong>{displayText}:</strong> {value}
                                    </ListGroup.Item>
                                );
                            })}
                        </ListGroup>
                    ) : (
                        <p>No metrics available.</p>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseMetricsModal}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default StatsS;
