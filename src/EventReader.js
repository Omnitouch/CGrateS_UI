import React, { useEffect, useState } from 'react';
import { Container, Table, Spinner, Modal, Button } from 'react-bootstrap';

const EventReader = ({ cgratesConfig }) => {
  const [readers, setReaders] = useState([]); // State to store readers
  const [isLoading, setIsLoading] = useState(true); // Loading state
  const [selectedReader, setSelectedReader] = useState(null); // State for selected reader (modal)
  const [showModal, setShowModal] = useState(false); // State to toggle modal
  const [isRunning, setIsRunning] = useState(false); // State to handle running reader
  const [runResult, setRunResult] = useState(null); // State for run result

  useEffect(() => {
    // Extract readers from config
    if (cgratesConfig.json_config && cgratesConfig.json_config.ers && cgratesConfig.json_config.ers.readers) {
      setReaders(cgratesConfig.json_config.ers.readers);
    }
    setIsLoading(false);
  }, [cgratesConfig]);

  const handleRowClick = (reader) => {
    setSelectedReader(reader);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setSelectedReader(null);
    setShowModal(false);
    setRunResult(null);
  };

  const handleRunReader = async () => {
    if (!selectedReader) return;

    setIsRunning(true);
    setRunResult(null);

    const runQuery = {
      method: 'ErSv1.RunReader',
      params: [{
        ID: selectedReader.id,
        ReaderID: selectedReader.id
      }]
    };

    try {
      const response = await fetch(cgratesConfig.url + '/jsonrpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(runQuery),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setRunResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setRunResult(`Error: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Container className="mt-4">
      <h2>Event Reader</h2>

      {isLoading ? (
        <div className="text-center mt-4">
          <Spinner animation="border" role="status">
            <span className="sr-only">Loading...</span>
          </Spinner>
          <p>Loading readers, please wait...</p>
        </div>
      ) : (
        <Table striped bordered hover className="mt-4">
          <thead>
            <tr>
              <th>#</th>
              <th>Reader ID</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {readers.length > 0 ? (
              readers.map((reader, index) => (
                <tr key={index} onClick={() => handleRowClick(reader)} style={{ cursor: 'pointer' }}>
                  <td>{index + 1}</td>
                  <td>{reader.id}</td>
                  <td>{reader.type || 'N/A'}</td>
                  <td>{reader.description || 'No description available'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="text-center">No readers found</td>
              </tr>
            )}
          </tbody>
        </Table>
      )}

      {/* Modal for Reader Details */}
      <Modal show={showModal} onHide={handleCloseModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Reader Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedReader ? (
            <div>
              <p><strong>ID:</strong> {selectedReader.id}</p>
              <p><strong>Type:</strong> {selectedReader.type || 'N/A'}</p>
              <p><strong>Description:</strong> {selectedReader.description || 'No description available'}</p>
              <p><strong>Config:</strong></p>
              <pre>{JSON.stringify(selectedReader.config, null, 2)}</pre>

              <Button
                variant="primary"
                onClick={handleRunReader}
                disabled={isRunning}
                className="mt-3"
              >
                {isRunning ? 'Running...' : 'Run Event Reader'}
              </Button>

              {runResult && (
                <pre className="mt-3">{runResult}</pre>
              )}
            </div>
          ) : (
            <p>No details available</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>Close</Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default EventReader;
