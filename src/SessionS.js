import React, { useState } from 'react';
import { Form, Button, Container, Row, Col, Table, Modal, Spinner } from 'react-bootstrap';

const SessionS = ({ cgratesConfig }) => {
  const [tenant, setTenant] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [terminateLoading, setTerminateLoading] = useState(false);

  const handleTenantChange = (event) => {
    setTenant(event.target.value);
  };

  const fetchSessions = async () => {
    setIsLoading(true);
    setResults([]); // Clear current results

    const newQuery = {
      method: 'SessionSv1.GetActiveSessions',
      params: [{
        Limit: null,
        Filters: null,
        Tenant: tenant || 'mnc040.mcc738.3gppnetwork.org',
        APIOpts: {}
      }],
      id: 2
    };

    console.log(`Fetching sessions from: ${cgratesConfig.url}`);

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
      console.log('Data fetched successfully:', data);

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

  const handleSubmit = (event) => {
    event.preventDefault();
    fetchSessions();
  };

  const handleRowClick = (session) => {
    setSelectedSession(session);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedSession(null);
  };

  const handleTerminateSession = async () => {
    if (!selectedSession) return;

    setTerminateLoading(true);

    const terminateQuery = {
      method: 'SessionSv1.TerminateSession',
      params: [{
        TerminateSession: true,
        ForceDuration: false,
        ReleaseResources: false,
        ProcessThresholds: false,
        ProcessStats: false,
        ThresholdIDs: null,
        StatIDs: null,
        Tenant: selectedSession.Tenant,
        ID: selectedSession.CGRID,
        Time: selectedSession.SetupTime,
        Event: {
          // ACD: selectedSession.ExtraFields?.ACD || 0,
          Account: selectedSession.Account,
          // AnswerTime: selectedSession.AnswerTime,
          Category: selectedSession.Category,
          // Cost: -1,
          Destination: selectedSession.Destination,
          DisconnectCause: selectedSession.ExtraFields?.DisconnectCause || "",
          FsConnID: selectedSession.ExtraFields?.FsConnID || 0,
          OriginHost: selectedSession.OriginHost,
          OriginID: selectedSession.OriginID,
          // PDD: selectedSession.ExtraFields?.PDD || 0,
          RequestType: selectedSession.RequestType,
          // Route: selectedSession.ExtraFields?.Route || "",
          SetupTime: selectedSession.SetupTime,
          Source: selectedSession.Source,
          Subject: selectedSession.Subject,
          Tenant: selectedSession.Tenant,
          ToR: selectedSession.ToR,
          // Usage: selectedSession.Usage
        },
        Opts: {}
      }],
      id: 4
    };

    console.log(`Terminating session: ${selectedSession.CGRID}`);

    try {
      const response = await fetch(cgratesConfig.url + '/jsonrpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(terminateQuery),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Session terminated successfully:', data);

      // Refresh results after terminating a session
      fetchSessions();
      handleCloseModal();
    } catch (error) {
      console.error('Error terminating session:', error);
    } finally {
      setTerminateLoading(false);
    }
  };

  const renderSessionDetails = (session) => {
    return (
      <Table striped bordered hover>
        <thead>
          <tr>
            <th>Property</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(session).map(([key, value], index) => (
            <tr key={index}>
              <td>{key}</td>
              <td>{typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : String(value)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  };

  return (
    <div className="App">
      <Container>
        <Form onSubmit={handleSubmit} className="mt-4">
          <Row>
            <Col md={6}>
              <Form.Group controlId="formTenant">
                <Form.Label>Tenant</Form.Label>
                <Form.Control as="select" name="tenant" value={tenant} onChange={handleTenantChange}>
                  {cgratesConfig.tenants.split(';').map((tenantOption, index) => (
                    <option key={index} value={tenantOption}>{tenantOption}</option>
                  ))}
                </Form.Control>
              </Form.Group>
            </Col>
            <Col md={12} className="d-flex align-items-end mt-3">
              <Button type="submit" className="w-100">Search Active Sessions</Button>
            </Col>
          </Row>
        </Form>

        {isLoading ? (
          <div className="text-center mt-4">
            <Spinner animation="border" role="status">
              <span className="sr-only">Loading...</span>
            </Spinner>
            <p>Loading Sessions, please wait...</p>
          </div>
        ) : (
          <Table striped bordered hover className="mt-4">
            <thead>
              <tr>
                <th>#</th>
                <th>Tenant</th>
                <th>Account</th>
                <th>Category</th>
                <th>Setup Time</th>
                <th>Destination</th>
                <th>Usage</th>
              </tr>
            </thead>
            <tbody>
              {results && results.length > 0 ? results.map((result, index) => (
                <tr key={index} onClick={() => handleRowClick(result)} style={{ cursor: 'pointer' }}>
                  <td>{index + 1}</td>
                  <td>{result.Tenant}</td>
                  <td>{result.Account}</td>
                  <td>{result.Category}</td>
                  <td>{result.SetupTime}</td>
                  <td>{result.Destination}</td>
                  <td>{result.Usage}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="7" className="text-center">No results available</td>
                </tr>
              )}
            </tbody>
          </Table>
        )}
      </Container>

      {/* Modal for Session Details */}
      <Modal show={showModal} onHide={handleCloseModal} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>Session Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedSession ? (
            renderSessionDetails(selectedSession)
          ) : (
            <p>No session details available.</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="danger" onClick={handleTerminateSession} disabled={terminateLoading}>
            {terminateLoading ? 'Terminating...' : 'Terminate Session'}
          </Button>
          <Button variant="secondary" onClick={handleCloseModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default SessionS;