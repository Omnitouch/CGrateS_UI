import React, { useState, useEffect, useMemo } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Modal, Button, Navbar, Nav, Container, Form, Alert, Offcanvas } from 'react-bootstrap';
import { BrowserRouter as Router, Route, Routes, Link, useLocation } from 'react-router-dom';
import { marked } from 'marked';

import CDRs from './CDRs';
import Accounts from './Accounts';
import ActionPlans from './ActionPlans';
import ActionTriggers from './ActionTriggers.js';
import Actions from './Actions';
import Attributes from './Attributes';
import Filters from './Filters';
import RouteS from './RouteS';
import Config from './Config';
import SessionS from './SessionS';
import Resources from './Resources';
import DestinationRates from './DestinationRates';
import RatingPlans from './RatingPlans';
import RatingProfiles from './RatingProfile';
import Timings from './Timing.js';
import TariffPlans from './TariffPlans.js';
import GetCostView from './GetCost';
import Chargers from './Chargers.js';
import StatsS from './Stats.js';
import EventReader from './EventReader.js';
import RouteProfiles from './RouteProfiles.js';
import ExportedCDRs from './ExportedCDRs.js';
import ChargingTester from './ChargeTester.js';

// --- helpers ---
function normalizeTenants(tenants) {
  if (!tenants) return '';
  if (Array.isArray(tenants)) return tenants.join(';');
  return tenants;
}

function parseTenantsToArray(tenants) {
  if (!tenants) return [];
  if (Array.isArray(tenants)) return tenants;
  return tenants
    .split(';')
    .map((t) => t.trim())
    .filter(Boolean);
}

function TitleUpdater() {
  const location = useLocation();
  useEffect(() => {
    const pageTitles = {
      '/': 'Home - Omnitouch CGrateS UI',
      '/cdrs': 'CDRs - Omnitouch CGrateS UI',
      '/accounts': 'Accounts - Omnitouch CGrateS UI',
      '/sessions': 'Sessions - Omnitouch CGrateS UI',
      '/resources': 'Resources - Omnitouch CGrateS UI',
      '/action-plans': 'Action Plans - Omnitouch CGrateS UI',
      '/action-triggers': 'Action Triggers - Omnitouch CGrateS UI',
      '/actions': 'Actions - Omnitouch CGrateS UI',
      '/routes': 'Routes - Omnitouch CGrateS UI',
      '/attributes': 'Attributes - Omnitouch CGrateS UI',
      '/filters': 'Filters - Omnitouch CGrateS UI',
      '/chargers': 'Chargers - Omnitouch CGrateS UI',
      '/destinationrates': 'DestinationRates - Omnitouch CGrateS UI',
      '/ratingplans': 'RatingPlans - Omnitouch CGrateS UI',
      '/ratingprofiles': 'RatingProfiles - Omnitouch CGrateS UI',
      '/timings': 'Timings - Omnitouch CGrateS UI',
      '/stats': 'Stats - Omnitouch CGrateS UI',
      '/routeprofiles': 'Route Profiles - Omnitouch CGrateS UI',
      '/tariffplans': 'TariffPlans - Omnitouch CGrateS UI',
      '/getcost': 'GetCost - Omnitouch CGrateS UI',
      '/event-reader': 'Event Reader - Omnitouch CGrateS UI',
      '/exported-cdrs': 'Exported CDRs - Omnitouch CGrateS UI',
      '/charging_tester': 'Charge Tester - Omnitouch CGrateS UI',
      '/config': 'Config - Omnitouch CGrateS UI',
      '/CGrateS_UI/': 'Home - Omnitouch CGrateS UI',
    };
    const defaultTitle = 'Omnitouch CGrateS UI';
    document.title = pageTitles[location.pathname] || defaultTitle;
  }, [location]);
  return null;
}

function App() {
  // Start uninitialized; hydrate from config.json => localStorage => safe defaults
  const [cgratesConfig, setCgratesConfig] = useState(null);
  const [configReady, setConfigReady] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [configError, setConfigError] = useState('');
  const [readmeContent, setReadmeContent] = useState('');
  const [showOffcanvas, setShowOffcanvas] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [showRateDropdown, setShowRateDropdown] = useState(false);

  const handleToggleOffcanvas = () => setShowOffcanvas((s) => !s);
  const handleOpenModal = () => setShowModal(true);
  const handleCloseModal = () => setShowModal(false);

  // README (non-blocking)
  useEffect(() => {
    const fetchReadme = async () => {
      try {
        const response = await fetch('https://raw.githubusercontent.com/Omnitouch/CGrateS_UI/main/README.md');
        if (!response.ok) throw new Error(`Failed to fetch README.md: ${response.statusText}`);
        const text = await response.text();
        const htmlContent = marked(text);
        setReadmeContent(htmlContent);
      } catch (error) {
        console.error('Failed to load README.md:', error);
        setReadmeContent('<p>Error loading README content</p>');
      }
    };
    fetchReadme();
  }, []);

  // Config load: try ./config.json -> localStorage -> empty defaults (and prompt)
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('./config.json', { cache: 'no-store' });
        if (response.ok) {
          const cfg = await response.json();
          const normalized = {
            url: cfg.url || '',
            tenants: normalizeTenants(cfg.tenants || cfg.tenant || ''),
            username: cfg.username || '',
            password: cfg.password || '',
            json_config: null,
          };
          setCgratesConfig(normalized);
          setConfigReady(true);
          return;
        }
        throw new Error(`Failed to load config.json: ${response.statusText}`);
      } catch (e) {
        console.warn('config.json not available, falling back to localStorage…', e);
      }

      try {
        const ls = localStorage.getItem('cgratesConfig');
        if (ls) {
          const parsed = JSON.parse(ls);
          const normalized = {
            url: parsed.url || '',
            tenants: normalizeTenants(parsed.tenants || ''),
            username: parsed.username || '',
            password: parsed.password || '',
            json_config: null,
          };
          setCgratesConfig(normalized);
          setConfigReady(true);
          return;
        }
      } catch (e) {
        console.warn('localStorage cgratesConfig parse failed:', e);
      }

      const fallback = {
        url: '',
        tenants: '',
        username: '',
        password: '',
        json_config: null,
      };
      setCgratesConfig(fallback);
      setConfigReady(true);
      setShowModal(true); // prompt user to fill in details
    };

    loadConfig();
  }, []);

  // Persist config when ready
  useEffect(() => {
    if (configReady && cgratesConfig) {
      localStorage.setItem('cgratesConfig', JSON.stringify(cgratesConfig));
    }
  }, [configReady, cgratesConfig]);

  // Fetch remote JSON config once URL is known
  useEffect(() => {
    const fetchInitialConfig = async () => {
      if (!configReady || !cgratesConfig?.url) return;
      await fetchConfig(cgratesConfig.url);
    };
    fetchInitialConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configReady, cgratesConfig?.url]);

  const splitTenants = useMemo(() => parseTenantsToArray(cgratesConfig?.tenants), [cgratesConfig]);

  const handleConfigChange = (key, value) => {
    setCgratesConfig((prev) => ({
      ...(prev || {}),
      [key]: key === 'tenants' ? normalizeTenants(value) : value,
    }));
  };

  const handleTestConnection = async () => {
    if (!cgratesConfig?.url) {
      setTestResult('Please set API URL first.');
      return;
    }
    const cgratesURL = cgratesConfig.url;
    const newQuery = {
      method: 'ConfigSv1.GetConfigAsJSON',
      params: [{}],
    };

    setIsTesting(true);
    setTestResult('');
    setConfigError('');

    try {
      const response = await fetch(cgratesURL + '/jsonrpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newQuery),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          const parsedJSON = JSON.parse(data.result);
          setCgratesConfig((prev) => ({ ...(prev || {}), json_config: parsedJSON }));
          setTestResult('Connection successful and config loaded.');
        } else {
          setTestResult('Connection successful, but no config found.');
        }
      } else {
        setTestResult('Connection failed: ' + response.statusText);
      }
    } catch (error) {
      setTestResult('Connection error: ' + error.message);
    } finally {
      setIsTesting(false);
    }
  };

  const fetchConfig = async (url) => {
    const query = {
      method: 'ConfigSv1.GetConfigAsJSON',
      params: [{}],
    };

    try {
      const response = await fetch(url + '/jsonrpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          const parsedJSON = JSON.parse(data.result);
          setCgratesConfig((prev) => ({ ...(prev || {}), json_config: parsedJSON }));
          setTestResult('Connection successful');
        } else {
          setConfigError('No configuration found.');
          setTestResult('Connection failed: No config found.');
        }
      } else {
        setConfigError('Failed to fetch configuration: ' + response.statusText);
        setTestResult('Connection failed: ' + response.statusText);
      }
    } catch (error) {
      setConfigError('Error fetching configuration: ' + error.message);
      setTestResult('Connection error: ' + error.message);
    }
  };

  if (!configReady || !cgratesConfig) {
    return <div style={{ padding: 16 }}>Loading configuration…</div>;
  }

  return (
    <Router basename="/">
      <TitleUpdater />

      <Navbar bg="dark" variant="dark" expand={false} fixed="top">
        <Container>
          <Navbar.Brand as={Link} to="/">Omnitouch CGrateS UI</Navbar.Brand>
          <Button variant="outline-info" onClick={handleOpenModal}>
            Connection to CGrateS: {testResult ? (testResult.includes('successful') ? 'Connected' : 'Disconnected') : 'Unknown'}
            <span
              style={{
                backgroundColor: testResult.includes('successful') ? 'green' : 'red',
                color: 'white',
                padding: '5px 10px',
                borderRadius: '10px',
                marginLeft: '10px',
              }}
            />
          </Button>
          <Button variant="outline-light" onClick={() => setShowOffcanvas((s) => !s)}>☰</Button>
        </Container>
      </Navbar>

      <Offcanvas show={showOffcanvas} onHide={() => setShowOffcanvas(false)} placement="end">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Navigation</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <Nav className="flex-column">
            <Nav.Link as={Link} to="/" onClick={() => setShowOffcanvas(false)}>Home</Nav.Link>
            <Nav.Link as={Link} to="/cdrs" onClick={() => setShowOffcanvas(false)}>CDRs</Nav.Link>
            <Nav.Link as={Link} to="/accounts" onClick={() => setShowOffcanvas(false)}>Accounts</Nav.Link>
            <Nav.Link as={Link} to="/sessions" onClick={() => setShowOffcanvas(false)}>Sessions</Nav.Link>
            <Nav.Link as={Link} to="/resources" onClick={() => setShowOffcanvas(false)}>Resources</Nav.Link>
            <Nav.Link as={Link} to="/stats" onClick={() => setShowOffcanvas(false)}>Stats</Nav.Link>
            <Nav.Link as={Link} to="/filters" onClick={() => setShowOffcanvas(false)}>Filters</Nav.Link>
            <Nav.Link as={Link} to="/event-reader" onClick={() => setShowOffcanvas(false)}>Event Reader</Nav.Link>

            <div>
              <Button
                variant="link"
                className="dropdown-toggle"
                onClick={() => setShowActionsDropdown((s) => !s)}
                aria-expanded={showActionsDropdown}
              >
                Actions & ActionPlans
              </Button>
              {showActionsDropdown && (
                <div style={{ paddingLeft: '1rem', borderLeft: '2px solid #ccc', marginTop: '0.5rem' }}>
                  <Nav.Link as={Link} to="/action-triggers" onClick={() => setShowOffcanvas(false)}>Action Triggers</Nav.Link>
                  <Nav.Link as={Link} to="/action-plans" onClick={() => setShowOffcanvas(false)}>Action Plans</Nav.Link>
                  <Nav.Link as={Link} to="/actions" onClick={() => setShowOffcanvas(false)}>Actions</Nav.Link>
                </div>
              )}
            </div>

            <Nav.Link as={Link} to="/attributes" onClick={() => setShowOffcanvas(false)}>Attributes</Nav.Link>
            <Nav.Link as={Link} to="/event-reader" onClick={() => setShowOffcanvas(false)}>ERS</Nav.Link>

            <div>
              <Button
                variant="link"
                className="dropdown-toggle"
                onClick={() => setShowRateDropdown((s) => !s)}
                aria-expanded={showRateDropdown}
              >
                Rate Plans & Profiles
              </Button>
              {showRateDropdown && (
                <div style={{ paddingLeft: '1rem', borderLeft: '2px solid #ccc', marginTop: '0.5rem' }}>
                  <Nav.Link as={Link} to="/chargers" onClick={() => setShowOffcanvas(false)}>Chargers</Nav.Link>
                  <Nav.Link as={Link} to="/destinationrates" onClick={() => setShowOffcanvas(false)}>DestinationRates</Nav.Link>
                  <Nav.Link as={Link} to="/ratingplans" onClick={() => setShowOffcanvas(false)}>RatingPlans</Nav.Link>
                  <Nav.Link as={Link} to="/ratingprofiles" onClick={() => setShowOffcanvas(false)}>RatingProfiles</Nav.Link>
                  <Nav.Link as={Link} to="/timings" onClick={() => setShowOffcanvas(false)}>Timings</Nav.Link>
                  <Nav.Link as={Link} to="/getcost" onClick={() => setShowOffcanvas(false)}>GetCost</Nav.Link>
                  <Nav.Link as={Link} to="/routes" onClick={() => setShowOffcanvas(false)}>Routes</Nav.Link>
                  <Nav.Link as={Link} to="/routeprofiles" onClick={() => setShowOffcanvas(false)}>RouteProfiles</Nav.Link>
                  <Nav.Link as={Link} to="/tariffplans" onClick={() => setShowOffcanvas(false)}>TariffPlans</Nav.Link>
                  <Nav.Link as={Link} to="/charging_tester" onClick={() => setShowOffcanvas(false)}>Charge Tester</Nav.Link>
                </div>
              )}
            </div>
            <Nav.Link as={Link} to="/exported-cdrs" onClick={() => setShowOffcanvas(false)}>Exported CDRs</Nav.Link>
            <Nav.Link as={Link} to="/config" onClick={() => setShowOffcanvas(false)}>Config</Nav.Link>
          </Nav>
        </Offcanvas.Body>
      </Offcanvas>

      <Container style={{ paddingTop: '70px' }}>
        <Routes>
          <Route path="/" element={<div dangerouslySetInnerHTML={{ __html: readmeContent }} />} />
          <Route path="/CGrateS_UI/" element={<div dangerouslySetInnerHTML={{ __html: readmeContent }} />} />

          <Route path="/cdrs" element={<CDRs cgratesConfig={cgratesConfig} />} />
          <Route path="/accounts" element={<Accounts cgratesConfig={cgratesConfig} />} />
          <Route path="/sessions" element={<SessionS cgratesConfig={cgratesConfig} />} />
          <Route path="/resources" element={<Resources cgratesConfig={cgratesConfig} />} />
          <Route path="/action-triggers" element={<ActionTriggers cgratesConfig={cgratesConfig} />} />
          <Route path="/action-plans" element={<ActionPlans cgratesConfig={cgratesConfig} />} />
          <Route path="/actions" element={<Actions cgratesConfig={cgratesConfig} />} />
          <Route path="/routes" element={<RouteS cgratesConfig={cgratesConfig} />} />
          <Route path="/attributes" element={<Attributes cgratesConfig={cgratesConfig} />} />
          <Route path="/filters" element={<Filters cgratesConfig={cgratesConfig} />} />
          <Route path="/chargers" element={<Chargers cgratesConfig={cgratesConfig} />} />
          <Route path="/destinationrates" element={<DestinationRates cgratesConfig={cgratesConfig} />} />
          <Route path="/ratingplans" element={<RatingPlans cgratesConfig={cgratesConfig} />} />
          <Route path="/ratingprofiles" element={<RatingProfiles cgratesConfig={cgratesConfig} />} />
          <Route path="/timings" element={<Timings cgratesConfig={cgratesConfig} />} />
          <Route path="/stats" element={<StatsS cgratesConfig={cgratesConfig} />} />
          <Route path="/routeprofiles" element={<RouteProfiles cgratesConfig={cgratesConfig} />} />
          <Route path="/getcost" element={<GetCostView cgratesConfig={cgratesConfig} />} />
          <Route path="/tariffplans" element={<TariffPlans cgratesConfig={cgratesConfig} />} />
          <Route path="/event-reader" element={<EventReader cgratesConfig={cgratesConfig} />} />
          <Route path="/exported-cdrs" element={<ExportedCDRs cgratesConfig={cgratesConfig} />} />
          <Route path="/charging_tester" element={<ChargingTester cgratesConfig={cgratesConfig} />} />
          <Route path="/config" element={<Config cgratesConfig={cgratesConfig} />} />
        </Routes>
      </Container>

      <Modal show={showModal} onHide={handleCloseModal}>
        <Modal.Header closeButton>
          <Modal.Title>Enter CGrateS Connection Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>API URL</Form.Label>
              <Form.Control
                type="text"
                placeholder={cgratesConfig.url || 'http://localhost:2080'}
                value={cgratesConfig.url}
                onChange={(e) => handleConfigChange('url', e.target.value)}
              />
              <Form.Text className="text-muted">
                URL of CGrateS instance
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Tenants (separate by ;)</Form.Label>
              <Form.Control
                type="text"
                placeholder={cgratesConfig.tenants || 'cgrates.org;test'}
                value={cgratesConfig.tenants}
                onChange={(e) => handleConfigChange('tenants', e.target.value)}
              />
              <Form.Text className="text-muted">
                Enter one or more tenants separated by semicolons (;)
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Basic Auth - Username</Form.Label>
              <Form.Control
                type="text"
                placeholder="(optional)"
                value={cgratesConfig.username}
                onChange={(e) => handleConfigChange('username', e.target.value)}
              />
              <Form.Text className="text-muted">
                Only required if CGrateS is configured with basic auth
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Basic Auth - Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="(optional)"
                value={cgratesConfig.password}
                onChange={(e) => handleConfigChange('password', e.target.value)}
              />
              <Form.Text className="text-muted">
                Only required if CGrateS is configured with basic auth
              </Form.Text>
            </Form.Group>
          </Form>

          <Button variant="secondary" onClick={handleTestConnection} disabled={isTesting}>
            {isTesting ? 'Testing...' : 'Test Connection'}
          </Button>

          {testResult && (
            <Alert variant={testResult.includes('successful') ? 'success' : 'danger'} className="mt-3">
              {testResult}
            </Alert>
          )}

          {configError && (
            <Alert variant="warning" className="mt-3">
              {configError}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>Close</Button>
          <Button variant="primary" onClick={handleCloseModal}>Save Changes</Button>
        </Modal.Footer>
      </Modal>

      <small>
        Currently using CGrateS URL: <pre>{cgratesConfig.url}</pre>
        Tenants: <pre>{splitTenants.join(', ')}</pre>
        <div>
          Status:
          <span
            style={{
              backgroundColor: testResult.includes('successful') ? 'green' : 'red',
              color: 'white',
              padding: '5px 10px',
              borderRadius: '10px',
              marginLeft: '10px',
            }}
          >
            {testResult ? (testResult.includes('successful') ? 'Connected' : 'Disconnected') : 'Unknown'}
          </span>
        </div>
      </small>
    </Router>
  );
}

export default App;
