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

  // Timing Details Modal
  const [showModal, setShowModal] = useState(false);

  // Loading / Error
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // --- Test NOW logic
  const [showTestResultModal, setShowTestResultModal] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // --- Test Specific Time logic
  const [showTestTimeModal, setShowTestTimeModal] = useState(false);
  const [testTime, setTestTime] = useState('');
  const [testTimeResult, setTestTimeResult] = useState(null);
  const [timingToTest, setTimingToTest] = useState(null);

  // Fetch TPIDs on load
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

  // Handle change in TPID dropdown
  const handleTPIDChange = (event) => {
    setSearchParams({ ...searchParams, tpid: event.target.value });
  };

  // Fetch Timings for the selected tpid
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

  // Fetch & display a single timing
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
        // Convert the single "Time" field or StartTime/EndTime fields into separate strings
        let startTime = '*any';
        let endTime = '*any';

        if (data.result.StartTime && data.result.EndTime) {
          // If both are already given, just use them
          startTime = data.result.StartTime;
          endTime = data.result.EndTime;
        } else if (data.result.Time) {
          // If there's a single combined "Time" field, we parse it
          const [start, end] = data.result.Time.split(';');
          startTime = start || '*any';
          endTime = end || '*any';
        }

        // Fill out the rest
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
          StartTime: startTime,
          EndTime: endTime,
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

  // Update the selectedTiming state as user edits fields
  const handleEditChange = (field, value) => {
    setSelectedTiming((prev) => ({ ...prev, [field]: value }));
  };

  // Save changes to a timing (creates or updates)
  const handleSaveTiming = async () => {
    if (!selectedTiming) return;

    setIsLoading(true);
    setError('');

    try {
      // Combine startTime & endTime back into a single Time field
      let combinedTime = '*any';
      if (selectedTiming.StartTime || selectedTiming.EndTime) {
        combinedTime = `${selectedTiming.StartTime || '*any'};${selectedTiming.EndTime || '*any'}`;
      }

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
            Time: combinedTime,
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

  // Create a brand-new timing
  const handleCreateNewTiming = () => {
    setSelectedTiming({
      ID: '',
      Years: '*any',
      Months: '*any',
      MonthDays: '*any',
      WeekDays: '*any',
      StartTime: '*any',
      EndTime: '*any',
    });
    setShowModal(true);
    setIsEditing(true);
  };

  // Close the Timing Details modal
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedTiming(null);
    setError('');
  };

  // --- Test Timing (Now) ---
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
        setTestResult(data.result);
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

  // --- Test Timing (Specific Time) ---
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
                <strong>Start Time:</strong>
                {isEditing ? (
                  <Form.Control
                    type="text"
                    value={selectedTiming.StartTime}
                    onChange={(e) =>
                      handleEditChange('StartTime', e.target.value)
                    }
                    placeholder="e.g. 08:00:00"
                  />
                ) : (
                  selectedTiming.StartTime
                )}
              </ListGroup.Item>
              <ListGroup.Item>
                <strong>End Time:</strong>
                {isEditing ? (
                  <Form.Control
                    type="text"
                    value={selectedTiming.EndTime}
                    onChange={(e) => handleEditChange('EndTime', e.target.value)}
                    placeholder="e.g. 17:00:00"
                  />
                ) : (
                  selectedTiming.EndTime
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
          <Button
            variant="secondary"
            onClick={() => setShowTestResultModal(false)}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ------ Test Specific Time Modal ------ */}
      <Modal
        show={showTestTimeModal}
        onHide={handleCloseTestTimeModal}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Test Timing at Specific Time</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Enter a Date/Time to Test</Form.Label>
            {/* You can also use type="datetime-local" if you prefer a date/time picker */}
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
          <Button
            variant="primary"
            onClick={handleRunSpecificTimeTest}
            disabled={!testTime}
          >
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
