import React, { useState, useMemo, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Spinner, Alert, Collapse } from 'react-bootstrap';
import AccountDropdown from './AccountDropdown'; // Updated AccountDropdown expects `tenant`
import { v4 as uuidv4 } from 'uuid';

let globalRequestId = 3;

const ChargingTester = ({ cgratesConfig }) => {
  const [tenant, setTenant] = useState(cgratesConfig.tenants.split(';')[0]);
  const [account, setAccount] = useState(null); // { tenant, account } from AccountDropdown
  const [direction, setDirection] = useState('*out');
  const [category, setCategory] = useState('sms');
  const [tor, setTor] = useState('');
  const [destination, setDestination] = useState('');
  const [subject, setSubject] = useState('');
  const [usage, setUsage] = useState(1);
  const [requestType, setRequestType] = useState('*prepaid');
  const [response, setResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showRequest, setShowRequest] = useState(false);

  const [flags, setFlags] = useState({
    ProcessStatQueues: false,
    ProcessThresholds: false,
    ReleaseResources: false,
    AllocateResources: false,
    AuthorizeResources: false,
    GetSuppliers: false,
    GetAttributes: true,
    GetMaxUsage: true,
  });

  const usagePresets = {
    sms: [1, 2, 3],
    data: [1, 1024 * 1024, 10 * 1024 * 1024, 100 * 1024 * 1024, 1024 * 1024 * 1024],
    call: [1e9, 10e9, 60e9, 600e9],
  };

  const usageLabels = {
    sms: ['1', '2', '3'],
    data: ['1 Byte', '1 MB', '10 MB', '100 MB', '1 GB'],
    call: ['1 second', '10 seconds', '1 minute', '10 minutes'],
  };

  const requestTypes = ['*prepaid', '*postpaid', '*rated'];

  const handleCategoryChange = (value) => {
    setCategory(value);
    setUsage(usagePresets[value][0]);
  };

  const handleFlagChange = (key) => {
    setFlags({ ...flags, [key]: !flags[key] });
  };

  // Clear account/subject/response when tenant changes so dropdown refetches cleanly
  useEffect(() => {
    setAccount(null);
    setSubject('');
    setTor('');
    setResponse(null);
  }, [tenant]);

  const requestObject = useMemo(() => {
    return {
      method: 'SessionSv1.ProcessCDR',
      params: [
        {
          Tenant: tenant,
          ...flags,
          Event: {
            OriginHost: 'CGrateS_UI',
            OriginID: uuidv4(),
            Direction: direction,
            Category: category,
             ...(tor ? { ToR: tor } : {}),
            Destination: destination,
            Source: 'CGrateS_UI',
            Subject: subject || account?.account || '',
            RequestType: requestType,
            Account: account?.account || '',
            Tenant: tenant,
            Usage: usage,
            AnswerTime: '*now',
            SetupTime: '*now',
          },
        },
      ],
      id: globalRequestId,
    };
  }, [tenant, flags, direction, category, tor, destination, subject, requestType, account, usage]);

  const handleSubmit = async () => {
    if (!account || !tenant) return;
    setIsLoading(true);
    setResponse(null);

    const req = {
      ...requestObject,
      params: requestObject.params.map((p) => ({
        ...p,
        Event: {
          ...p.Event,
          OriginID: uuidv4(),
        },
      })),
      id: globalRequestId++,
    };

    try {
      const res = await fetch(`${cgratesConfig.url}/jsonrpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });

      const data = await res.json();
      setResponse(data);
    } catch (err) {
      setResponse({ error: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container>
      <h2>Charging Tester</h2>
      <Form>
        <Row>
          <Col md={6}>
            <Form.Group>
              <Form.Label>Tenant</Form.Label>
              <Form.Control
                as="select"
                value={tenant}
                onChange={(e) => setTenant(e.target.value)}
              >
                {cgratesConfig.tenants.split(';').map((t, idx) => (
                  <option key={idx} value={t}>
                    {t}
                  </option>
                ))}
              </Form.Control>
            </Form.Group>
          </Col>
          <Col md={6} className="d-flex align-items-end">
            <AccountDropdown
              key={tenant}                   // force remount on tenant switch
              cgratesConfig={cgratesConfig}
              tenant={tenant}                // pass current tenant to dropdown
              onSelect={setAccount}
            />
          </Col>
        </Row>
        <Row className="mt-3">
          <Col md={4}>
            <Form.Group>
              <Form.Label>Direction</Form.Label>
              <Form.Control
                as="select"
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
              >
                <option value="*out">*out</option>
                <option value="*in">*in</option>
              </Form.Control>
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label>Usage</Form.Label>
              <Form.Control
                as="select"
                value={usage}
                onChange={(e) => setUsage(Number(e.target.value))}
              >
                {usagePresets[category].map((val, idx) => (
                  <option key={idx} value={val}>
                    {val} ({usageLabels[category][idx]})
                  </option>
                ))}
              </Form.Control>
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label>Request Type</Form.Label>
              <Form.Control
                as="select"
                value={requestType}
                onChange={(e) => setRequestType(e.target.value)}
              >
                {requestTypes.map((type, idx) => (
                  <option key={idx} value={type}>
                    {type}
                  </option>
                ))}
              </Form.Control>
            </Form.Group>
          </Col>
        </Row>
        <Row className="mt-3">
          <Col md={4}>
            <Form.Group>
              <Form.Label>Category</Form.Label>
              <Form.Control
                as="select"
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
              >
                <option value="sms">sms</option>
                <option value="data">data</option>
                <option value="call">call</option>
              </Form.Control>
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label>ToR</Form.Label>
              <Form.Control
                type="text"
                value={tor}
                onChange={(e) => setTor(e.target.value)}
              />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label>Subject</Form.Label>
              <Form.Control
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </Form.Group>
          </Col>
        </Row>
        <Row className="mt-3">
          <Col md={12}>
            <Form.Group>
              <Form.Label>Destination</Form.Label>
              <Form.Control
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </Form.Group>
          </Col>
        </Row>
        <Row className="mt-3">
          {Object.keys(flags).map((key, idx) => (
            <Col md={3} key={idx}>
              <Form.Check
                type="checkbox"
                label={key}
                checked={flags[key]}
                onChange={() => handleFlagChange(key)}
              />
            </Col>
          ))}
        </Row>
        <Button className="mt-3" onClick={handleSubmit} disabled={isLoading || !account}>
          {isLoading ? <Spinner animation="border" size="sm" /> : 'Submit CDR'}
        </Button>
      </Form>

      <Button
        variant="link"
        className="mt-4"
        onClick={() => setShowRequest(!showRequest)}
        aria-controls="request-box"
        aria-expanded={showRequest}
      >
        {showRequest ? 'Hide Request JSON' : 'Show Request JSON'}
      </Button>
      <Collapse in={showRequest}>
        <div id="request-box">
          <Alert variant="light">
            <h5>Request:</h5>
            <pre>{JSON.stringify(requestObject, null, 2)}</pre>
          </Alert>
        </div>
      </Collapse>

      {response && (
        <Alert variant="light" className="mt-4">
          <h5>Response:</h5>
          <pre>{JSON.stringify(response, null, 2)}</pre>
        </Alert>
      )}
    </Container>
  );
};

export default ChargingTester;
