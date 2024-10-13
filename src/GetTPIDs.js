import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Table, Pagination, Modal, Spinner } from 'react-bootstrap';

const GetTPIDs = ({ cgratesConfig }) => {
  const [tpids, setTPIDs] = useState([]); // Store TPIDs fetched from API
  const [selectedTPID, setSelectedTPID] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState(null); // State to store data for the modal
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [destinationData, setDestinationData] = useState(null); // State to store data for the destination modal

  useEffect(() => {
    // Fetch the TPIDs when the component mounts
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
        console.log('TPIDs fetched successfully:', data);

        if (data && data.result) {
          setTPIDs(data.result); // Store the fetched TPIDs in state
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

  const fetchResults = async () => {
    if (!selectedTPID) return;
    setIsLoading(true);
    setResults([]); // Clear the current results

    const newQuery = {
      jsonrpc: '2.0',
      method: 'ApierV1.GetTPDestinationRateIds',
      params: [{
        TPid: selectedTPID,
      }],
    };

    console.log(`Fetching destination rate IDs for TPID: ${selectedTPID}`);

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
      console.log('Destination rate IDs fetched successfully:', data);

      if (data && data.result) {
        setResults(data.result); // Handle the fetched results
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchModalData = async (tpid, id) => {
    const newQuery = {
      jsonrpc: '2.0',
      method: 'ApierV1.GetTPDestinationRate',
      params: [{
        TPid: tpid,
        ID: id,
      }],
    };

    console.log(`Fetching destination rate data for TPID: ${tpid}, ID: ${id}`);

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
      console.log('Destination rate data fetched successfully:', data);

      if (data && data.result) {
        setModalData(data.result); // Store the fetched data in state
        setShowModal(true); // Show the modal
      }
    } catch (error) {
      console.error('Error fetching destination rate data:', error);
    }
  };

  const fetchDestinationData = async (tpid, destinationId) => {
    const newQuery = {
      jsonrpc: '2.0',
      method: 'ApierV1.GetTPDestination',
      params: [{
        TPid: tpid,
        ID: destinationId,
      }],
    };

    console.log(`Fetching destination data for TPID: ${tpid}, Destination ID: ${destinationId}`);

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
      console.log('Destination data fetched successfully:', data);

      if (data && data.result) {
        setDestinationData(data.result); // Store the fetched data in state
        setShowDestinationModal(true); // Show the destination modal
      }
    } catch (error) {
      console.error('Error fetching destination data:', error);
    }
  };

  const handleRowClick = (rateID) => {
    fetchModalData(selectedTPID, rateID);
  };

  const handleDestinationClick = (destinationId) => {
    fetchDestinationData(selectedTPID, destinationId);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    fetchResults();
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setModalData(null);
  };

  const handleCloseDestinationModal = () => {
    setShowDestinationModal(false);
    setDestinationData(null);
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
              <Button type="submit" className="w-100">Search</Button>
            </Col>
          </Row>
        </Form>

        {isLoading ? (
          <div className="text-center mt-4">
            <Spinner animation="border" role="status">
              <span className="sr-only">Loading...</span>
            </Spinner>
            <p>Loading Destination Rate IDs, please wait...</p>
          </div>
        ) : (
          <div>
            <Table striped bordered hover className="mt-4">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Destination Rate ID</th>
                </tr>
              </thead>
              <tbody>
                {results && results.length > 0 ? results.map((result, index) => (
                  <tr key={index} onClick={() => handleRowClick(result)} style={{ cursor: 'pointer' }}>
                    <td>{index + 1}</td>
                    <td>{result}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="2" className="text-center">No results available</td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        )}
      </Container>

      {/* Modal for Destination Rate Data */}
      <Modal show={showModal} onHide={handleCloseModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Destination Rate Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalData ? (
            <div>
              <p><strong>TPID:</strong> {modalData.TPid}</p>
              <p><strong>ID:</strong> {modalData.ID}</p>
              <p><strong>Destination Rates:</strong></p>
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>Destination ID</th>
                    <th>Rate ID</th>
                    <th>Rounding Method</th>
                    <th>Rounding Decimals</th>
                    <th>Max Cost</th>
                    <th>Max Cost Strategy</th>
                  </tr>
                </thead>
                <tbody>
                  {modalData.DestinationRates.map((rate, index) => (
                    <tr key={index} onClick={() => handleDestinationClick(rate.DestinationId)} style={{ cursor: 'pointer' }}>
                      <td>{rate.DestinationId}</td>
                      <td>{rate.RateId}</td>
                      <td>{rate.RoundingMethod}</td>
                      <td>{rate.RoundingDecimals}</td>
                      <td>{rate.MaxCost}</td>
                      <td>{rate.MaxCostStrategy}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <p>No data available for this destination rate.</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal for Destination Data */}
      <Modal show={showDestinationModal} onHide={handleCloseDestinationModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Destination Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {destinationData ? (
            <div>
              <p><strong>TPID:</strong> {destinationData.TPid}</p>
              <p><strong>ID:</strong> {destinationData.ID}</p>
              <p><strong>Prefixes:</strong></p>
              <ul>
                {destinationData.Prefixes.map((prefix, index) => (
                  <li key={index}>{prefix}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p>No data available for this destination.</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseDestinationModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default GetTPIDs;