import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Table, Spinner, Modal } from 'react-bootstrap';

const RatingPlans = ({ cgratesConfig }) => {
  const [tpids, setTPIDs] = useState([]);
  const [selectedTPID, setSelectedTPID] = useState('');
  const [ratingPlans, setRatingPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState(null);

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
    setSelectedTPID(event.target.value);
  };

  const fetchRatingPlans = async () => {
    if (!selectedTPID) return;
    setIsLoading(true);
    setRatingPlans([]);

    const newQuery = {
      jsonrpc: '2.0',
      method: 'ApierV1.GetTPRatingPlanIds',
      params: [{ TPid: selectedTPID }],
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
        setRatingPlans(data.result);
      } else {
        setRatingPlans([]);
      }
    } catch (error) {
      console.error('Error fetching rating plans:', error);
      setRatingPlans([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchModalData = async (tpid, id) => {
    const newQuery = {
      jsonrpc: '2.0',
      method: 'ApierV1.GetTPRatingPlan',
      params: [{ TPid: tpid, ID: id }],
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
        setModalData(data.result);
        setShowModal(true);
      }
    } catch (error) {
      console.error('Error fetching rating plan data:', error);
    }
  };

  const handleRowClick = (ratingPlanID) => {
    fetchModalData(selectedTPID, ratingPlanID);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    fetchRatingPlans();
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setModalData(null);
  };

  return (
    <div className="App">
      <Container>
        <Form onSubmit={handleSubmit} className="mt-4">
          <Row>
            <Col md={6}>
              <Form.Group controlId="formTPID">
                <Form.Label>TPID</Form.Label>
                <Form.Control as="select" value={selectedTPID} onChange={handleTPIDChange}>
                  <option value="">Select TPID</option>
                  {tpids.map((tpid, index) => (
                    <option key={index} value={tpid}>{tpid}</option>
                  ))}
                </Form.Control>
              </Form.Group>
            </Col>
            <Col md={12} className="d-flex align-items-end mt-3">
              <Button type="submit" className="w-100">Search Rating Plans</Button>
            </Col>
          </Row>
        </Form>

        {isLoading ? (
          <div className="text-center mt-4">
            <Spinner animation="border" role="status">
              <span className="sr-only">Loading...</span>
            </Spinner>
            <p>Loading Rating Plans, please wait...</p>
          </div>
        ) : (
          <div>
            <Table striped bordered hover className="mt-4">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Rating Plan ID</th>
                </tr>
              </thead>
              <tbody>
                {ratingPlans && ratingPlans.length > 0 ? ratingPlans.map((ratingPlan, index) => (
                  <tr key={index} onClick={() => handleRowClick(ratingPlan)} style={{ cursor: 'pointer' }}>
                    <td>{index + 1}</td>
                    <td>{ratingPlan}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="2" className="text-center">No rating plans available</td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        )}
      </Container>

      {/* Modal for Rating Plan Data */}
      <Modal show={showModal} onHide={handleCloseModal} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>Rating Plan Details: {modalData?.ID}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalData ? (
            <div>
              <p><strong>TPID:</strong> {modalData.TPid}</p>
              <p><strong>ID:</strong> {modalData.ID}</p>
              <p><strong>Details:</strong></p>
              <pre>{JSON.stringify(modalData, null, 2)}</pre>
            </div>
          ) : (
            <p>No data available for this rating plan.</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default RatingPlans;
