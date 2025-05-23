import React, { useState } from 'react';
import { Form, Button, Container, Row, Col, Table, Modal, Spinner } from 'react-bootstrap';
import Datetime from 'react-datetime';
import moment from 'moment';
import { useEffect } from 'react';

const SessionS = ({ cgratesConfig }) => {
  const [searchParams, setSearchParams] = useState({
    tenant: cgratesConfig.tenants.split(';')[0], // Default to the first tenant
  });
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [terminateLoading, setTerminateLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });

  // Utility function to format Usage based on ToR
  const formatUsage = (usage, tor) => {
    if (tor === '*data') {
      const mb = (usage / (1024 * 1024)).toFixed(2);
      return (
        <>
          {`${mb} MB`}
          <br />
          {`(${usage} bytes)`}
        </>
      );
    } else if (tor === '*voice') {
      const totalSeconds = Math.floor(usage / 1e9); // Convert nanoseconds to seconds
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const timeFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      return (
        <>
          {timeFormatted}
          <br />
          {`(${usage} ns)`}
        </>
      );
    }
    return usage; // Default case, no formatting
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setSearchParams({ ...searchParams, [name]: value });
  };

  const fetchSessions = async () => {
    setIsLoading(true);
    setResults([]); // Clear current results

    const newQuery = {
      method: 'SessionSv1.GetActiveSessions',
      params: [{
        Limit: null,
        Filters: null,
        Tenant: searchParams.tenant,
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

  useEffect(() => {
    let interval;

    if (showModal && selectedSession) {
      interval = setInterval(async () => {
        try {
          const fetchSingleSessionQuery = {
            method: 'SessionSv1.GetActiveSessions',
            params: [{
              Limit: null,
              Filters: [
                "*string:~*req.CGRID:" + selectedSession.CGRID,
              ],
              Tenant: selectedSession.Tenant,
              Tenant: selectedSession.Tenant,
              APIOpts: {}
            }],
            id: 3
          };

          const response = await fetch(cgratesConfig.url + '/jsonrpc', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(fetchSingleSessionQuery),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          if (data && data.result && data.result.length > 0) {
            setSelectedSession(data.result[0]);
          }
        } catch (error) {
          console.error('Error fetching session details in modal:', error);
        }
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showModal, selectedSession, cgratesConfig.url]);


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
              <td>
                {key === 'Usage' ? formatUsage(value, session.ToR) :
                  (typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : String(value))}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  };

  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedResults = React.useMemo(() => {
    let sortableResults = [...results];
    if (sortConfig.key !== null) {
      sortableResults.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableResults;
  }, [results, sortConfig]);

  return (
    <div className="App">
      <Container>
        <Form onSubmit={handleSubmit} className="mt-4">
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
                <th onClick={() => handleSort('#')}>#</th>
                <th onClick={() => handleSort('Tenant')}>Tenant</th>
                <th onClick={() => handleSort('Account')}>Account</th>
                <th onClick={() => handleSort('Category')}>Category</th>
                <th onClick={() => handleSort('SetupTime')}>Setup Time</th>
                <th onClick={() => handleSort('Destination')}>Destination</th>
                <th onClick={() => handleSort('Subject')}>Subject</th>
                <th onClick={() => handleSort('Usage')}>Usage</th>
                <th onClick={() => handleSort('LoopIndex')}>LoopIndex</th>
              </tr>
            </thead>
            <tbody>
              {sortedResults && sortedResults.length > 0 ? sortedResults.map((result, index) => (
                <tr key={index} onClick={() => handleRowClick(result)} style={{ cursor: 'pointer' }}>
                  <td>{index + 1}</td>
                  <td>{result.Tenant}</td>
                  <td>{result.Account}</td>
                  <td>{result.Category}</td>
                  <td>
                    {moment(result.SetupTime).format('YYYY-MM-DD HH:mm:ss')}
                    <br />
                    <small>({moment().diff(moment(result.SetupTime), 'minutes')} minutes ago)</small>
                  </td>
                  <td>{result.Destination}</td>
                  <td>{result.Subject}</td>
                  <td>{formatUsage(result.Usage, result.ToR)}</td>
                  <td>{result.LoopIndex}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="9" className="text-center">No results available</td>
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