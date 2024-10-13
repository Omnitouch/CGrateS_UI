import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Table, Spinner, Modal, Accordion } from 'react-bootstrap';

const DestinationRates = ({ cgratesConfig }) => {
  const [tpids, setTPIDs] = useState([]);
  const [selectedTPID, setSelectedTPID] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [expandedRateId, setExpandedRateId] = useState(null);
  const [expandedDestinationId, setExpandedDestinationId] = useState(null);
  const [destinationDetails, setDestinationDetails] = useState(null);
  const [rateDetails, setRateDetails] = useState(null);

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

  const fetchResults = async () => {
    if (!selectedTPID) return;
    setIsLoading(true);
    setResults([]);

    const newQuery = {
      jsonrpc: '2.0',
      method: 'ApierV1.GetTPDestinationRateIds',
      params: [{
        TPid: selectedTPID,
      }],
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
        setResults(data.result);
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
      console.error('Error fetching destination rate data:', error);
    }
  };

  const fetchDestinationDetails = async (tpid, destinationId) => {
    const newQuery = {
      jsonrpc: '2.0',
      method: 'ApierV1.GetTPDestination',
      params: [{
        TPid: tpid,
        ID: destinationId,
      }],
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
        setDestinationDetails(data.result);
      }
    } catch (error) {
      console.error('Error fetching destination details:', error);
    }
  };

  const fetchRateDetails = async (tpid, rateId) => {
    const newQuery = {
      jsonrpc: '2.0',
      method: 'ApierV1.GetTPRate',
      params: [{
        TPid: tpid,
        ID: rateId,
      }],
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
        setRateDetails(data.result);
      }
    } catch (error) {
      console.error('Error fetching rate details:', error);
    }
  };

  const toggleRateDetails = (rateId) => {
    if (rateId === expandedRateId) {
      setExpandedRateId(null);
      setRateDetails(null);
    } else {
      setExpandedRateId(rateId);
      fetchRateDetails(selectedTPID, rateId);
    }
  };

  const toggleDestinationDetails = (destinationId) => {
    if (destinationId === expandedDestinationId) {
      setExpandedDestinationId(null);
      setDestinationDetails(null);
    } else {
      setExpandedDestinationId(destinationId);
      fetchDestinationDetails(selectedTPID, destinationId);
    }
  };

  const handleRowClick = (rateID) => {
    fetchModalData(selectedTPID, rateID);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    fetchResults();
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
          <Modal.Title>Destination Rate Details: {modalData?.ID}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalData ? (
            <div>
              <p><strong>TPID:</strong> {modalData.TPid}</p>
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
                    <tr key={index}>
                      <td
                        onClick={() => toggleDestinationDetails(rate.DestinationId)}
                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        {rate.DestinationId}
                      </td>
                      <td
                        onClick={() => toggleRateDetails(rate.RateId)}
                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        {rate.RateId}
                      </td>
                      <td>{rate.RoundingMethod}</td>
                      <td>{rate.RoundingDecimals}</td>
                      <td>{rate.MaxCost}</td>
                      <td>{rate.MaxCostStrategy}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <Accordion>
                {expandedDestinationId && (
                  <Accordion.Item eventKey="0">
                    <Accordion.Header>
                      Destination Details (ID: {expandedDestinationId})
                    </Accordion.Header>
                    <Accordion.Body>
                      {destinationDetails ? (
                        <div>
                          <p><strong>Destination ID:</strong> {destinationDetails.ID}</p>
                          <p><strong>Prefixes:</strong> {destinationDetails.Prefixes.join(', ')}</p>
                        </div>
                      ) : (
                        <Spinner animation="border" role="status">
                          <span className="sr-only">Loading...</span>
                        </Spinner>
                      )}
                    </Accordion.Body>
                  </Accordion.Item>
                )}
                {expandedRateId && (
                  <Accordion.Item eventKey="1">
                    <Accordion.Header>
                      Rate Details (ID: {expandedRateId})
                    </Accordion.Header>
                    <Accordion.Body>
                      {rateDetails ? (
                        <pre>{JSON.stringify(rateDetails, null, 2)}</pre>
                      ) : (
                        <Spinner animation="border" role="status">
                          <span className="sr-only">Loading...</span>
                        </Spinner>
                      )}
                    </Accordion.Body>
                  </Accordion.Item>
                )}
              </Accordion>
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
    </div>
  );
};

export default DestinationRates;
