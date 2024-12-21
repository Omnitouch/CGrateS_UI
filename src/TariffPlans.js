import React, { useState, useEffect } from 'react';
import {
  Container,
  Table,
  Button,
  Spinner,
  Modal,
} from 'react-bootstrap';

const TariffPlans = ({ cgratesConfig }) => {
  const [tpids, setTPIDs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // For confirmations / results
  const [actionInProgress, setActionInProgress] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  // Fetch TPIDs on load
  useEffect(() => {
    const fetchTPIDs = async () => {
      setIsLoading(true);
      setError('');

      // JSON-RPC request object
      const requestBody = {
        method: 'APIerSv1.GetTPIds',
        params: [],
        id: 1,
        jsonrpc: '2.0',
      };

      try {
        const response = await fetch(`${cgratesConfig.url}/jsonrpc`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.result) {
          setTPIDs(data.result);
        } else if (data.error) {
          setError(data.error.message || 'Failed to fetch TPIDs.');
        }
      } catch (err) {
        setError('Error fetching TPIDs: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTPIDs();
  }, [cgratesConfig.url]);

  // Common JSON-RPC call wrapper
  const callJSONRPC = async (methodName, params, successMsg) => {
    setIsLoading(true);
    setError('');
    setActionInProgress(methodName);

    const requestBody = {
      method: methodName,
      params: [params], // each method typically expects an array of objects
      id: 1,
      jsonrpc: '2.0',
    };

    try {
      const response = await fetch(`${cgratesConfig.url}/jsonrpc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.result) {
        setModalMessage(successMsg || `Success calling ${methodName}`);
        setShowModal(true);
      } else if (data.error) {
        setError(data.error.message || 'JSON-RPC call failed.');
      }
    } catch (err) {
      setError('Error calling JSON-RPC: ' + err.message);
    } finally {
      setIsLoading(false);
      setActionInProgress('');
    }
  };

  // Handlers for each action
  const handleRemTP = (tpid) => {
    callJSONRPC(
      'APIerSv1.RemTP',
      { TPid: tpid },
      `Successfully removed Tariff Plan: ${tpid}`
    );
  };

  const handleLoadTariffPlanFromStorDb = (tpid) => {
    callJSONRPC(
      'APIerSv1.LoadTariffPlanFromStorDb',
      // Adjust parameters if your API requires more than just TPid
      { TPid: tpid },
      `Successfully loaded Tariff Plan from StorDB for: ${tpid}`
    );
  };

  const handleExportTPToFolder = (tpid) => {
    callJSONRPC(
      'APIerSv1.ExportTPToFolder',
      // Adjust parameters if your API requires a folder path, etc.
      { TPid: tpid, FolderPath: '/tmp' },
      `Successfully exported Tariff Plan to folder for: ${tpid}`
    );
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setModalMessage('');
  };

  return (
    <Container className="mt-4">
      <h2>Tariff Plans</h2>

      {isLoading && (
        <div className="my-3 text-center">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      )}

      {error && <p className="text-danger">{error}</p>}

      {!isLoading && !error && tpids.length === 0 && (
        <p>No TPIDs found.</p>
      )}

      {tpids.length > 0 && (
        <Table striped bordered hover className="mt-3">
          <thead>
            <tr>
              <th>#</th>
              <th>TPID</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tpids.map((tpid, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{tpid}</td>
                <td>
                  <Button
                    variant="danger"
                    size="sm"
                    className="me-2"
                    disabled={actionInProgress !== '' && actionInProgress !== 'APIerSv1.RemTP'}
                    onClick={() => handleRemTP(tpid)}
                  >
                    RemTP
                  </Button>
                  <Button
                    variant="info"
                    size="sm"
                    className="me-2"
                    disabled={
                      actionInProgress !== '' && actionInProgress !== 'APIerSv1.LoadTariffPlanFromStorDb'
                    }
                    onClick={() => handleLoadTariffPlanFromStorDb(tpid)}
                  >
                    LoadTariffPlanFromStorDb
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={
                      actionInProgress !== '' && actionInProgress !== 'APIerSv1.ExportTPToFolder'
                    }
                    onClick={() => handleExportTPToFolder(tpid)}
                  >
                    ExportTPToFolder
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {/* Modal to show action success messages */}
      <Modal show={showModal} onHide={handleCloseModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Result</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>{modalMessage}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default TariffPlans;
