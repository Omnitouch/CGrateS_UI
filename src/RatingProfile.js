import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Table, Modal, Spinner, Alert } from 'react-bootstrap';

const RatingProfiles = ({ cgratesConfig }) => {
    const [searchParams, setSearchParams] = useState({ tenant: '' });
    const [ratingProfiles, setRatingProfiles] = useState([]);
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [responseTime, setResponseTime] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        Category: '',
        Subject: '',
        RatingPlanActivations: [{ ActivationTime: '', RatingPlanId: '', FallbackSubjects: '' }]
    });
    const [errorMessage, setErrorMessage] = useState(null);
    const [ratingPlanOptions, setRatingPlanOptions] = useState([]);

    useEffect(() => {
        fetchTPIdsAndRatingPlans();
    }, []);

    const fetchTPIdsAndRatingPlans = async () => {
        setIsLoading(true);
        try {
            // Fetch all TPIds
            const tpIdQuery = { method: 'APIerSv1.GetTPIds', params: [] };
            const tpIdResponse = await fetch(cgratesConfig.url + '/jsonrpc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tpIdQuery),
            });
            const tpIdData = await tpIdResponse.json();

            if (tpIdData.result) {
                let allRatingPlans = [];

                // For each TPid, fetch RatingPlanIds
                for (const TPid of tpIdData.result) {
                    const ratingPlanQuery = {
                        jsonrpc: '2.0',
                        method: 'ApierV1.GetTPRatingPlanIds',
                        params: [{ TPid }]
                    };
                    const ratingPlanResponse = await fetch(cgratesConfig.url + '/jsonrpc', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(ratingPlanQuery),
                    });
                    const ratingPlanData = await ratingPlanResponse.json();
                    
                    if (ratingPlanData.result) {
                        allRatingPlans = allRatingPlans.concat(ratingPlanData.result);
                    }
                }
                setRatingPlanOptions(allRatingPlans);
            }
        } catch (error) {
            console.error('Error fetching TPIds or RatingPlanIds:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setSearchParams({ ...searchParams, [name]: value });
    };

    const handleFormChange = (event) => {
        const { name, value } = event.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleActivationChange = (index, event) => {
        const { name, value } = event.target;
        const updatedActivations = [...formData.RatingPlanActivations];
        updatedActivations[index] = { ...updatedActivations[index], [name]: value };
        setFormData({ ...formData, RatingPlanActivations: updatedActivations });
    };

    const addActivation = () => {
        setFormData({
            ...formData,
            RatingPlanActivations: [
                ...formData.RatingPlanActivations,
                { ActivationTime: '', RatingPlanId: '', FallbackSubjects: '' }
            ]
        });
    };

    const removeActivation = (index) => {
        const updatedActivations = formData.RatingPlanActivations.filter((_, i) => i !== index);
        setFormData({ ...formData, RatingPlanActivations: updatedActivations });
    };

    const fetchRatingProfiles = async () => {
        setIsLoading(true);
        setRatingProfiles([]);
        const startTime = Date.now();

        try {
            const query = {
                method: 'ApierV1.GetRatingProfileIDs',
                params: [{ tenant: searchParams.tenant }]
            };

            const response = await fetch(cgratesConfig.url + '/jsonrpc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(query),
            });

            const data = await response.json();
            const endTime = Date.now();
            const timeTaken = ((endTime - startTime) / 1000).toFixed(2);
            setResponseTime(timeTaken);

            if (data.result) {
                setRatingProfiles(data.result);
            }
        } catch (error) {
            console.error('Error fetching rating profile IDs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchRatingProfileDetails = async (profileString) => {
        setIsLoading(true);
        const [category, subject] = profileString.split(':');

        try {
            const query = {
                method: 'ApierV1.GetRatingProfile',
                params: [{ Tenant: searchParams.tenant, Category: category, Subject: subject }],
                id: 0
            };

            const response = await fetch(cgratesConfig.url + '/jsonrpc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(query),
            });

            const data = await response.json();
            if (data.result) {
                setSelectedProfile(data.result);
                setFormData({
                    Category: category,
                    Subject: subject,
                    RatingPlanActivations: data.result.RatingPlanActivations || []
                });
                setShowModal(true);
            }
        } catch (error) {
            console.error('Error fetching rating profile details:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const saveRatingProfile = async () => {
        setIsLoading(true);
        setErrorMessage(null);

        try {
            const query = {
                method: 'APIerSv1.SetRatingProfile',
                params: [{
                    Overwrite: true,
                    Tenant: searchParams.tenant,
                    Category: formData.Category,
                    Subject: formData.Subject,
                    RatingPlanActivations: formData.RatingPlanActivations
                }]
            };

            const response = await fetch(cgratesConfig.url + '/jsonrpc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(query),
            });

            const data = await response.json();

            if (data.error) {
                setErrorMessage(data.error.message);
            } else {
                setShowModal(false);
            }
        } catch (error) {
            console.error('Error saving rating profile:', error);
            setErrorMessage('An unexpected error occurred while saving the profile.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRowClick = (profileString) => {
        setIsEditing(true);
        fetchRatingProfileDetails(profileString);
    };

    const handleCreateNew = () => {
        setIsEditing(false);
        setFormData({ Category: '', Subject: '', RatingPlanActivations: [{ ActivationTime: '', RatingPlanId: '', FallbackSubjects: '' }] });
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedProfile(null);
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        fetchRatingProfiles();
    };

    return (
        <div className="App">
            <Container>
                <h2>Rating Profiles</h2>
                <Form onSubmit={(e) => { e.preventDefault(); fetchRatingProfiles(); }} className="mt-4">
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
                            <Button type="submit" className="w-100">Fetch Rating Profiles</Button>
                        </Col>
                    </Row>
                </Form>

                <Button variant="primary" className="mt-4" onClick={handleCreateNew}>Create New Rating Profile</Button>

                {isLoading ? (
                    <div className="text-center mt-4">
                        <Spinner animation="border" role="status">
                            <span className="sr-only">Loading...</span>
                        </Spinner>
                    </div>
                ) : (
                    <Table striped bordered hover className="mt-4">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Rating Profile ID</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ratingProfiles.length > 0 ? ratingProfiles.map((profile, index) => (
                                <tr key={index} onClick={() => handleRowClick(profile)} style={{ cursor: 'pointer' }}>
                                    <td>{index + 1}</td>
                                    <td>{profile}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="2" className="text-center">No rating profiles available</td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                )}

                <Modal show={showModal} onHide={handleCloseModal} size="lg">
                    <Modal.Header closeButton>
                        <Modal.Title>{isEditing ? 'Edit Rating Profile' : 'Create New Rating Profile'}</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}

                        <Form>
                            <Form.Group controlId="formCategory">
                                <Form.Label>Category</Form.Label>
                                <Form.Control type="text" name="Category" value={formData.Category} onChange={handleFormChange} />
                            </Form.Group>
                            <Form.Group controlId="formSubject">
                                <Form.Label>Subject</Form.Label>
                                <Form.Control type="text" name="Subject" value={formData.Subject} onChange={handleFormChange} />
                            </Form.Group>
                            <h5>Rating Plan Activations</h5>
                            {formData.RatingPlanActivations.map((activation, index) => (
                                <div key={index} className="mb-3">
                                    <Form.Group controlId={`formActivationTime${index}`}>
                                        <Form.Label>Activation Time</Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="ActivationTime"
                                            value={activation.ActivationTime}
                                            onChange={(e) => handleActivationChange(index, e)}
                                        />
                                    </Form.Group>
                                    <Form.Group controlId={`formRatingPlanId${index}`}>
                                        <Form.Label>Rating Plan ID</Form.Label>
                                        <Form.Control
                                            as="select"
                                            name="RatingPlanId"
                                            value={activation.RatingPlanId}
                                            onChange={(e) => handleActivationChange(index, e)}
                                        >
                                            <option value="">Select Rating Plan ID</option>
                                            {ratingPlanOptions.map((planId, idx) => (
                                                <option key={idx} value={planId}>{planId}</option>
                                            ))}
                                        </Form.Control>
                                    </Form.Group>
                                    <Form.Group controlId={`formFallbackSubjects${index}`}>
                                        <Form.Label>Fallback Subjects</Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="FallbackSubjects"
                                            value={activation.FallbackSubjects}
                                            onChange={(e) => handleActivationChange(index, e)}
                                        />
                                    </Form.Group>
                                    <Button variant="danger" onClick={() => removeActivation(index)}>Remove Activation</Button>
                                </div>
                            ))}
                            <Button variant="success" onClick={addActivation}>Add Activation</Button>
                        </Form>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowModal(false)}>Close</Button>
                        <Button variant="primary" onClick={saveRatingProfile}>{isEditing ? 'Save Changes' : 'Create Profile'}</Button>
                    </Modal.Footer>
                </Modal>
            </Container>
        </div>
    );
};

export default RatingProfiles;
