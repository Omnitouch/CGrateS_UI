import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Table, Modal, Spinner, ListGroup, Accordion } from 'react-bootstrap';

const RatingProfiles = ({ cgratesConfig }) => {
  const [searchParams, setSearchParams] = useState({
    tenant: '', // Tenant selection
  });
  const [ratingProfiles, setRatingProfiles] = useState([]); // Store the list of rating profiles
  const [selectedProfile, setSelectedProfile] = useState(null); // Store the selected rating profile's details
  const [showModal, setShowModal] = useState(false); // Control the modal display
  const [isLoading, setIsLoading] = useState(false); // Handle loading state
  const [responseTime, setResponseTime] = useState(null); // API response time

  // Handle input change for tenant selection
  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setSearchParams({ ...searchParams, [name]: value });
  };

  // Fetch all rating profile IDs based on the selected tenant
  const fetchRatingProfiles = async () => {
    setIsLoading(true);
    setRatingProfiles([]); // Clear previous results
    const startTime = Date.now();

    try {
      const query = {
        method: 'ApierV1.GetRatingProfileIDs',
        params: [{ tenant: searchParams.tenant }] // Fetch based on the selected tenant
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
        setRatingProfiles(data.result); // Set the fetched rating profile IDs
      } else {
        console.warn('No rating profiles found.');
      }
    } catch (error) {
      console.error('Error fetching rating profile IDs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch details of a selected rating profile
  const fetchRatingProfileDetails = async (profileId) => {
    setIsLoading(true);
    try {
      const query = {
        method: 'ApierV1.GetRatingProfile',
        params: [{ tenant: searchParams.tenant, Id: profileId }]
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
        setSelectedProfile(data.result); // Set the fetched rating profile details
        setShowModal(true); // Show the modal with details
      }
    } catch (error) {
      console.error('Error fetching rating profile details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowClick = (profileId) => {
    fetchRatingProfileDetails(profileId); // Fetch the details when a profile is clicked
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedProfile(null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    fetchRatingProfiles(); // Fetch rating profiles based on the selected tenant
  };

  return (
    <div className="App">
      <Container>
        <h2>Rating Profiles</h2>
        <Form onSubmit={handleSubmit} className="mt-4">
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
            <Col md={6} className="d-flex align-items-end">
              <Button type="submit" className="w-100">Fetch Rating Profiles</Button>
            </Col>
          </Row>
        </Form>

        {isLoading ? (
          <div className="text-center mt-4">
            <Spinner animation="border" role="status">
              <span className="sr-only">Loading...</span>
            </Spinner>
            <p>Loading rating profiles, please wait...</p>
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
          </>
        )}

        {/* Modal for displaying rating profile details */}
        <Modal show={showModal} onHide={handleCloseModal} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>Rating Profile Details</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {selectedProfile ? (
              <>
                <h5>General Information</h5>
                <ListGroup className="mb-3">
                  <ListGroup.Item><strong>Tenant:</strong> {selectedProfile.Tenant}</ListGroup.Item>
                  <ListGroup.Item><strong>ID:</strong> {selectedProfile.ID}</ListGroup.Item>
                </ListGroup>

                <h5>Rating Details</h5>
                <Accordion defaultActiveKey="0">
                  {selectedProfile.Attributes.map((attr, index) => (
                    <Accordion.Item eventKey={index.toString()} key={index}>
                      <Accordion.Header><strong>Path:</strong> {attr.Path}</Accordion.Header>
                      <Accordion.Body>
                        <ListGroup variant="flush">
                          <ListGroup.Item><strong>Path:</strong> {attr.Path}</ListGroup.Item>
                          <ListGroup.Item><strong>Type:</strong> {attr.Type}</ListGroup.Item>
                          <ListGroup.Item>
                            {attr.Value.map((valueObj, idx) => (
                              <div key={idx}>
                                <p><strong>Rules:</strong> {valueObj.Rules}</p>
                              </div>
                            ))}
                          </ListGroup.Item>
                        </ListGroup>
                      </Accordion.Body>
                    </Accordion.Item>
                  ))}
                </Accordion>
              </>
            ) : (
              <p>No details available</p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </div>
  );
};

export default RatingProfiles;
