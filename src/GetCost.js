import React, { useState } from 'react';
import { Form, Button, Container, Row, Col, Spinner, Alert } from 'react-bootstrap';

const GetCostView = ({ cgratesConfig }) => {
    // Helper function to get the current UTC date and time in the required format (YYYY-MM-DDTHH:MM:SSZ)
    const getCurrentDateTimeUTC = () => {
        const now = new Date();
        const year = now.getUTCFullYear();
        const month = String(now.getUTCMonth() + 1).padStart(2, '0');
        const day = String(now.getUTCDate()).padStart(2, '0');
        const hours = String(now.getUTCHours()).padStart(2, '0');
        const minutes = String(now.getUTCMinutes()).padStart(2, '0');
        const seconds = String(now.getUTCSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
    };

    const [formData, setFormData] = useState({
        Tenant: 'cgrates.org',
        Category: 'call',
        Subject: '',
        AnswerTime: getCurrentDateTimeUTC(), // Default AnswerTime to the current UTC date and time
        Destination: '',
        Usage: '60', // Default Usage to 60 seconds
    });
    const [costResult, setCostResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setFormData({ ...formData, [name]: value });
    };

    const fetchCost = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        setCostResult(null);

        try {
            // Modify the AnswerTime to append the "Z" for UTC if necessary
            let answerTimeWithZ = formData.AnswerTime;
            if (!answerTimeWithZ.endsWith('Z')) {
                answerTimeWithZ += 'Z';
            }

            const query = {
                method: 'APIerSv1.GetCost',
                params: [
                    {
                        Tenant: formData.Tenant,
                        Category: formData.Category,
                        Subject: formData.Subject,
                        AnswerTime: answerTimeWithZ,
                        Destination: formData.Destination,
                        Usage: formData.Usage,
                        APIOpts: {},
                    },
                ],
                id: 0,
            };

            const response = await fetch(cgratesConfig.url + '/jsonrpc', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(query),
            });

            const data = await response.json();

            if (data.error) {
                // If the error is a string, display it directly
                setErrorMessage(typeof data.error === 'string' ? data.error : data.error.message);
            } else {
                setCostResult(data.result);
            }
        } catch (error) {
            console.error('Error fetching cost:', error);
            setErrorMessage('An unexpected error occurred while fetching the cost.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        fetchCost();
    };

    return (
        <div className="App">
            <Container>
                <h2>Get Cost</h2>
                <Form onSubmit={handleSubmit} className="mt-4">
                    <Row>
                        <Col md={6}>
                            <Form.Group controlId="formTenant">
                                <Form.Label>Tenant</Form.Label>
                                <Form.Control as="select" name="tenant" value={formData.Tenant} onChange={handleInputChange}>
                                    <option value="">Select Tenant</option>
                                    {cgratesConfig.tenants.split(';').map((tenant, index) => (
                                        <option key={index} value={tenant}>{tenant}</option>
                                    ))}
                                </Form.Control>
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group controlId="formCategory">
                                <Form.Label>Category</Form.Label>
                                <Form.Control
                                    type="text"
                                    name="Category"
                                    value={formData.Category}
                                    onChange={handleInputChange}
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Row>
                        <Col md={6}>
                            <Form.Group controlId="formSubject">
                                <Form.Label>Subject</Form.Label>
                                <Form.Control
                                    type="text"
                                    name="Subject"
                                    value={formData.Subject}
                                    onChange={handleInputChange}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group controlId="formAnswerTime">
                                <Form.Label>Answer Time</Form.Label>
                                <Form.Control
                                    type="datetime-local"
                                    name="AnswerTime"
                                    value={formData.AnswerTime.slice(0, 16)} // For datetime-local, remove the "Z"
                                    onChange={handleInputChange}
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Row>
                        <Col md={6}>
                            <Form.Group controlId="formDestination">
                                <Form.Label>Destination</Form.Label>
                                <Form.Control
                                    type="text"
                                    name="Destination"
                                    value={formData.Destination}
                                    onChange={handleInputChange}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group controlId="formUsage">
                                <Form.Label>Usage (in seconds)</Form.Label>
                                <Form.Control
                                    type="text"
                                    name="Usage"
                                    value={formData.Usage}
                                    onChange={handleInputChange}
                                />
                            </Form.Group>
                        </Col>
                    </Row>

                    <Button variant="primary" type="submit" className="mt-3 w-100">
                        {isLoading ? <Spinner as="span" animation="border" size="sm" /> : 'Fetch Cost'}
                    </Button>
                </Form>

                {/* Display error message if present */}
                {errorMessage && <Alert variant="danger" className="mt-4">{errorMessage}</Alert>}

                {/* Display the cost result in a styled box */}
                {costResult && (
                    <div className="mt-4">
                        <h4>Cost Result:</h4>
                        <div style={{ border: '1px solid #ddd', padding: '10px', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
                            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {JSON.stringify(costResult, null, 2)}
                            </pre>
                        </div>
                    </div>
                )}
            </Container>
        </div>
    );
};

export default GetCostView;
