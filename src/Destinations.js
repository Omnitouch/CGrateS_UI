import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Form, Button, Table, Spinner, Modal } from 'react-bootstrap';

const Destinations = ({ cgratesConfig }) => {
  const [tpids, setTPIDs] = useState([]);
  const [selectedTPID, setSelectedTPID] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [modalData, setModalData] = useState(null);

  // Fetch list of TPIDs once (or whenever URL changes)
  useEffect(() => {
    const fetchTPIDs = async () => {
      const newQuery = {
        method: 'APIerSv1.GetTPIds',
        params: [],
      };

      try {
        const response = await fetch(`${cgratesConfig.url}/jsonrpc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newQuery),
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        if (data && Array.isArray(data.result)) {
          setTPIDs(data.result);
        } else {
          setTPIDs([]);
        }
      } catch (err) {
        console.error('Error fetching TPIDs:', err);
        setTPIDs([]);
      }
    };

    fetchTPIDs();
  }, [cgratesConfig.url]);

  const handleTPIDChange = (e) => setSelectedTPID(e.target.value);

  const fetchResults = async () => {
    if (!selectedTPID) return;
    setIsLoading(true);
    setResults([]);

    const newQuery = {
      jsonrpc: '2.0',
      method: 'ApierV1.GetTPDestinationIDs',
      params: [{ TPid: selectedTPID }],
    };

    try {
      const response = await fetch(`${cgratesConfig.url}/jsonrpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newQuery),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      if (data && Array.isArray(data.result)) {
        setResults(data.result);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error('Error fetching destination IDs:', err);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchResults();
  };

  const handleRowClick = async (destId) => {
    setShowModal(true);
    setModalLoading(true);
    setModalError(null);
    setModalData(null);

    const newQuery = {
      jsonrpc: '2.0',
      method: 'ApierV1.GetTPDestination',
      params: [{ TPid: selectedTPID, ID: destId }],
    };

    try {
      const response = await fetch(`${cgratesConfig.url}/jsonrpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newQuery),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      if (data && data.result) {
        setModalData(data.result);
      } else {
        setModalError('No data returned for this destination.');
      }
    } catch (err) {
      console.error('Error fetching destination details:', err);
      setModalError('Failed to load destination details.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setModalData(null);
    setModalError(null);
  };

  return (
    <div className="App">
      <Container>
        <Form onSubmit={handleSubmit} className="mt-4">
          <Row>
            <Col md={6}>
              <Form.Group controlId="formTPID">
                <Form.Label>TPID</Form.Label>
                <Form.Select value={selectedTPID} onChange={handleTPIDChange}>
                  <option value="">Select TPID</option>
                  {tpids.map((tpid) => (
                    <option key={tpid} value={tpid}>{tpid}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={12} className="d-flex align-items-end mt-3">
              <Button type="submit" className="w-100" disabled={!selectedTPID}>
                Search
              </Button>
            </Col>
          </Row>
        </Form>

        {isLoading ? (
          <div className="text-center mt-4">
            <Spinner animation="border" role="status" />
            <p className="mt-2">Loading Destination IDs, please wait...</p>
          </div>
        ) : (
          <Table striped bordered hover className="mt-4">
            <thead>
              <tr>
                <th>#</th>
                <th>Destination ID</th>
              </tr>
            </thead>
            <tbody>
              {results && results.length > 0 ? (
                results.map((destId, idx) => (
                  <tr
                    key={destId}
                    onClick={() => handleRowClick(destId)}
                    style={{ cursor: 'pointer' }}
                    title="Click to view details"
                  >
                    <td>{idx + 1}</td>
                    <td style={{ textDecoration: 'underline' }}>{destId}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="2" className="text-center">No results available</td>
                </tr>
              )}
            </tbody>
          </Table>
        )}
      </Container>

      {/* Destination Details Modal */}
      <Modal show={showModal} onHide={handleCloseModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {modalData?.ID ? `Destination: ${modalData.ID}` : 'Destination Details'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalLoading && (
            <div className="text-center">
              <Spinner animation="border" role="status" />
              <p className="mt-2">Loading destination details…</p>
            </div>
          )}

          {!modalLoading && modalError && (
            <div className="text-danger">{modalError}</div>
          )}

          {!modalLoading && modalData && (
            <div>
              <p><strong>TPID:</strong> {modalData.TPid}</p>
              <p><strong>Destination ID:</strong> {modalData.ID}</p>
              <p>
                <strong>Prefixes:</strong>{' '}
                {Array.isArray(modalData.Prefixes) && modalData.Prefixes.length > 0
                  ? modalData.Prefixes.join(', ')
                  : '—'}
              </p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>Close</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Destinations;
