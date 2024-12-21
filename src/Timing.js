import React, { useState, useEffect } from 'react';
import {
  Form,
  Button,
  Container,
  Row,
  Col,
  Table,
  Modal,
  Spinner,
  ListGroup,
} from 'react-bootstrap';

const Timings = ({ cgratesConfig }) => {
  const [tpids, setTPIDs] = useState([]);
  const [searchParams, setSearchParams] = useState({ tpid: '' });
  const [timings, setTimings] = useState([]);
  const [selectedTiming, setSelectedTiming] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showModal, setShowModal] = useState(false); // For Timing Details modal
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // For "Test Now" result
  const [showTestResultModal, setShowTestResultModal] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // For "Test Specific Time"
  const [showTestTimeModal, setShowTestTimeModal] = useState(false);
  const [testTime, setTestTime] = useState('');
  const [testTimeResult, setTestTimeResult] = useState(null);
  const [timingToTest, setTimingToTest] = useState(null);

  useEffect(() => {
    const fetchTPIDs = async () => {
      const newQuery = {
        method: 'APIerSv1.GetTPIds',
        params: [],
      };

      try {
        const response = await fetch(`${cgratesConfig.url}/jsonrpc`, {
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
    setSearchParams({ ...searchParams, tpid: event.target.value });
  };

  const fetchTimings = async () => {
    setIsLoading(true);
    setError('');
    setTimings([]);

    try {
      const query = {
        method: 'ApierV1.GetTPTimingIds',
        params: searchParams.tpid ? [{ TPid: searchParams.tpid }] : [{}],
      };

      const response = await fetch(`${cgratesConfig.url}/jsonrpc`, {
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
      if (data.result && data.result.length > 0) {
        setTimings(data.result);
      } else {
        setError('No timings found.');
      }
    } catch (error) {
      console.error('Error fetching timings:', error);
      setError('Error fetching timings: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowClick = async (timingId) => {
    setIsLoading(true);
    setError('');

    try {
      const query = {
        method: 'ApierV1.GetTiming',
        params: [{ TPid: searchParams.tpid, ID: timingId }],
      };

      const response = await fetch(`${cgratesConfig.url}/jsonrpc`, {
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
        let combinedTime = '*any';
        if (data.result.StartTime && data.result.EndTime) {
          combinedTime = `${data.result.StartTime};${data.result.EndTime}`;
        } else if (data.result.Time) {
          combinedTime = data.result.Time;
        }

        const mergedTiming = {
          ID: data.result.ID || '',
          Years: data.result.Years?.length
            ? data.result.Years.join(',')
            : '*any',
          Months: data.result.Months?.length
            ? data.result.Months.join(',')
            : '*any',
          MonthDays: data.result.MonthDays?.length
            ? data.result.MonthDays.join(',')
            : '*any',
          WeekDays: data.result.WeekDays?.length
            ? data.result.WeekDays.join(',')
            : '*any',
          Time: combinedTime,
        };

        setSelectedTiming(mergedTiming);
        setShowModal(true);
        setIsEditing(false);
      } else {
        setError('Failed to retrieve timing details.');
      }
    } catch (error) {
      console.error('Error fetching timing details:', error);
      setError('Error fetching timing details: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditChange = (field, value) => {
    setSelectedTiming((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveTiming = async () => {
    setIsLoading(true);
    setError('');

    try {
      const query = {
        method: 'ApierV2.SetTPTiming',
        params: [
          {
            TPid: searchParams.tpid,
            ID: selectedTiming.ID,
            Years: selectedTiming.Years || '*any',
            Months: selectedTiming.Months || '*any',
            MonthDays: selectedTiming.MonthDays || '*any',
            WeekDays: selectedTiming.WeekDays || '*any',
            Time: selectedTiming.Time || '*any',
          },
        ],
      };

      const response = await fetch(`${cgratesConfig.url}/jsonrpc`, {
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
        console.log('Timing saved successfully.');
        fetchTimings();
        setShowModal(false);
      } else {
        throw new Error(data.error?.message || 'Failed to save timing');
      }
    } catch (error) {
      console.error('Error saving timing:', error);
      setError('Error saving timing: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNewTiming = () => {
    setSelectedTiming({
      ID: '',
      Years: '*any',
      Months: '*any',
      MonthDays: '*any',
      WeekDays: '*any',
      Time: '*any',
    });
    setShowModal(true);
    setIsEditing(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedTiming(null);
    setError('');
  };

  // --- Test Timing Logic ---

  // 1. Test Now: calls the API with "*now", then shows a simple result popup
  const handleTestNow = async (timingId) => {
    setIsLoading(true);
    setTestResult(null);
    setError('');

    try {
      const query = {
        method: 'APIerSv1.TimingIsActiveAt',
        params: [{ TimingID: timingId, Time: '*now' }],
        id: 4,
      };

      const response = await fetch(`${cgratesConfig.url}/jsonrpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (typeof data.result !== 'undefined') {
        setTestResult(data.result); // Typically true/false
        setShowTestResultModal(true);
      } else {
        setError('Failed to test timing activity.');
      }
    } catch (error) {
      console.error('Error testing timing activity:', error);
      setError('Error testing timing activity: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Test Specific Time: opens a modal to let user pick a date/time
  const handleOpenTestTimeModal = (timingId) => {
    setTimingToTest(timingId);
    setTestTime('');
    setTestTimeResult(null);
    setShowTestTimeModal(true);
  };

  const handleCloseTestTimeModal = () => {
    setShowTestTimeModal(false);
    setTimingToTest(null);
    setTestTime('');
    setTestTimeResult(null);
    setError('');
  };

  const handleRunSpecificTimeTest = async () => {
    // Call the same test method, but with user-provided testTime
    setIsLoading(true);
    setTestTimeResult(null);
    setError('');

    try {
      const query = {
        method: 'APIerSv1.TimingIsActiveAt',
        params: [{ TimingID: timingToTest, Time: testTime }],
        id: 4,
      };

      const response = await fetch(`${cgratesConfig.url}/jsonrpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (typeof data.result !== 'undefined') {
        setTestTimeResult(data.result);
      } else {
        setError('Failed to test timing activity.');
      }
    } catch (error) {
      console.error('Error testing timing activity:', error);
      setError('Error testing timing activity: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container>
      <h2>Manage Timings</h2>
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          fetchTimings();
        }}
        className="mt-4"
      >
        <Row>
          <Col md={6}>
            <Form.Group controlId="formTPID">
              <Form.Label>TPID</Form.Label>
              <Form.Control
                as="select"
                value={searchParams.tpid}
                onChange={handleTPIDChange}
              >
                <option value="">Select TPID</option>
                {tpids.map((tpid, index) => (
                  <option key={index} value={tpid}>
                    {tpid}
                  </option>
                ))}
              </Form.Control>
            </Form.Group>
          </Col>
          <Col md={12} className="d-flex align-items-end mt-3">
            <Button type="submit" className="w-100">
              Fetch Timings
            </Button>
          </Col>
        </Row>
      </Form>

      <Button className="mt-3" variant="primary" onClick={handleCreateNewTiming}>
        Create New Timing
      </Button>

      {isLoading && (
        <div className="text-center mt-4">
          <Spinner animation="border" role="status">
            <span className="sr-only">Loading...</span>
          </Spinner>
        </div>
      )}
      {!isLoading && error && <p className="text-danger mt-3">{error}</p>}

      {timings.length > 0 && (
        <Table striped bordered hover className="mt-4">
          <thead>
            <tr>
              <th>#</th>
              <th>Timing ID</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {timings.map((timingId, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td
                  onClick={() => handleRowClick(timingId)}
                  style={{ cursor: 'pointer' }}
                >
                  {timingId}
                </td>
                <td>
                  <Button
                    variant="info"
                    onClick={() => handleTestNow(timingId)}
                    className="me-2"
                  >
                    Test Now
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleOpenTestTimeModal(timingId)}
                  >
                    Test Specific Time
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {/* ------ Timing Details Modal ------ */}
      <Modal show={showModal} onHide={handleCloseModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {isEditing ? 'Edit Timing' : 'Timing Details'}
            {selectedTiming?.ID ? ` for ${selectedTiming.ID}` : ''}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedTiming && (
            <ListGroup>
              <ListGroup.Item>
                <strong>ID:</strong>
                {isEditing ? (
                  <Form.Control
                    type="text"
                    value={selectedTiming.ID}
                    onChange={(e) => handleEditChange('ID', e.target.value)}
                  />
                ) : (
                  selectedTiming.ID
                )}
              </ListGroup.Item>
              <ListGroup.Item>
                <strong>Years:</strong>
                {isEditing ? (
                  <Form.Control
                    type="text"
                    value={selectedTiming.Years}
                    onChange={(e) => handleEditChange('Years', e.target.value)}
                  />
                ) : (
                  selectedTiming.Years
                )}
              </ListGroup.Item>
              <ListGroup.Item>
                <strong>Months:</strong>
                {isEditing ? (
                  <Form.Control
                    type="text"
                    value={selectedTiming.Months}
                    onChange={(e) => handleEditChange('Months', e.target.value)}
                  />
                ) : (
                  selectedTiming.Months
                )}
              </ListGroup.Item>
              <ListGroup.Item>
                <strong>Month Days:</strong>
                {isEditing ? (
                  <Form.Control
                    type="text"
                    value={selectedTiming.MonthDays}
                    onChange={(e) =>
                      handleEditChange('MonthDays', e.target.value)
                    }
                  />
                ) : (
                  selectedTiming.MonthDays
                )}
              </ListGroup.Item>
              <ListGroup.Item>
                <strong>Week Days:</strong>
                {isEditing ? (
                  <Form.Control
                    type="text"
                    value={selectedTiming.WeekDays}
                    onChange={(e) => handleEditChange('WeekDays', e.target.value)}
                  />
                ) : (
                  selectedTiming.WeekDays
                )}
              </ListGroup.Item>
              <ListGroup.Item>
                <strong>Time:</strong> (StartTime and EndTime separated by <code>;</code>)
                {isEditing ? (
                  <Form.Control
                    type="text"
                    value={selectedTiming.Time}
                    onChange={(e) => handleEditChange('Time', e.target.value)}
                    placeholder="e.g. 00:00:00;08:59:59"
                  />
                ) : (
                  selectedTiming.Time
                )}
              </ListGroup.Item>
            </ListGroup>
          )}
        </Modal.Body>
        <Modal.Footer>
          {isEditing ? (
            <Button variant="primary" onClick={handleSaveTiming}>
              Save Changes
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          )}
          <Button variant="secondary" onClick={handleCloseModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ------ Test NOW Result Modal ------ */}
      <Modal
        show={showTestResultModal}
        onHide={() => setShowTestResultModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Timing Test Result</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          {testResult !== null
            ? `Timing active = ${testResult}`
            : 'No result yet.'}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowTestResultModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ------ Test Specific Time Modal ------ */}
      <Modal show={showTestTimeModal} onHide={handleCloseTestTimeModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Test Timing at Specific Time</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Enter a Date/Time to Test</Form.Label>
            {/* You can also use type="datetime-local" if you want a date/time picker */}
            <Form.Control
              type="text"
              placeholder="YYYY-MM-DDTHH:mm:ssZ (e.g., 2024-09-17T12:00:00Z)"
              value={testTime}
              onChange={(e) => setTestTime(e.target.value)}
            />
          </Form.Group>

          {isLoading && (
            <div className="text-center mt-3">
              <Spinner animation="border" role="status">
                <span className="sr-only">Testing...</span>
              </Spinner>
            </div>
          )}
          {testTimeResult !== null && (
            <p className="mt-3 text-center">
              Timing active = {testTimeResult.toString()}
            </p>
          )}
          {error && <p className="text-danger mt-3">{error}</p>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={handleRunSpecificTimeTest} disabled={!testTime}>
            Test Timing
          </Button>
          <Button variant="secondary" onClick={handleCloseTestTimeModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default Timings;
