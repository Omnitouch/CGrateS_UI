import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Modal, Button, Navbar, Nav, Container, Form, Alert, NavDropdown, Offcanvas } from 'react-bootstrap';
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
import { BrowserRouter as Router, Route, Routes, Link, useLocation } from 'react-router-dom';
import { marked } from 'marked';


function App() {
  const [cgratesConfig, setCgratesConfig] = useState({
    url: 'http://localhost:2080',
    tenants: 'cgrates.org;test',
    username: '',
    password: '',
    json_config: null,
  });
  const [showModal, setShowModal] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [configError, setConfigError] = useState('');
  const [readmeContent, setReadmeContent] = useState('');
  const [showOffcanvas, setShowOffcanvas] = useState(false); // State for Offcanvas visibility

  const handleCloseModal = () => setShowModal(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [showRateDropdown, setShowRateDropdown] = useState(false);


  const handleToggleOffcanvas = () => setShowOffcanvas(!showOffcanvas);


  useEffect(() => {
    // Function to load the configuration from config.json
    const loadConfig = async () => {
      try {
        const response = await fetch('./config.json');
        if (!response.ok) {
          throw new Error(`Failed to load config.json: ${response.statusText}`);
        }
        const configData = await response.json();
        setCgratesConfig((prevConfig) => ({
          ...prevConfig,
          url: configData.url || prevConfig.url,
          tenants: configData.tenants || prevConfig.tenants,
          username: configData.username || prevConfig.username,
          password: configData.password || prevConfig.password,
        }));
      } catch (error) {
        console.error('Error loading config file:', error);
        setShowModal(true); // Show modal on error
      }
    };

    // Function to fetch README.md file from GitHub
    const fetchReadme = async () => {
      try {
        const response = await fetch('https://raw.githubusercontent.com/Omnitouch/CGrateS_UI/main/README.md');
        if (!response.ok) {
          throw new Error(`Failed to fetch README.md: ${response.statusText}`);
        }
        const text = await response.text(); // Get the text content
        const htmlContent = marked(text); // Convert markdown to HTML using marked
        setReadmeContent(htmlContent); // Set the HTML content in state
      } catch (error) {
        console.error('Failed to load README.md:', error);
        setReadmeContent('<p>Error loading README content</p>'); // Display error message in case of failure
      }
    };

    // Call the functions
    loadConfig();
    fetchReadme();
  }, []);


  // Fetch config on initial load and handle errors
  useEffect(() => {
    const fetchInitialConfig = async () => {
      if (cgratesConfig.url) {
        await fetchConfig(cgratesConfig.url);
      }
    };

    fetchInitialConfig();
  }, [cgratesConfig.url]);

  // Update the CGrateS configuration in local storage whenever it changes
  useEffect(() => {
    if (cgratesConfig.url) {
      localStorage.setItem('cgratesConfig', JSON.stringify(cgratesConfig));
    }
  }, [cgratesConfig]);

  // Handle input changes
  const handleConfigChange = (key, value) => {
    setCgratesConfig((prevConfig) => ({
      ...prevConfig,
      [key]: value
    }));
  };

  // Handle opening the modal to change the CGrateS config
  const handleOpenModal = () => {
    setShowModal(true);
  };

  // Split tenants by ';' and give hint in the UI
  const splitTenants = cgratesConfig.tenants.split(';');

  // Function to test the connection and get the JSON config
  const handleTestConnection = async () => {
    const cgratesURL = cgratesConfig.url;
    const newQuery = {
      method: 'ConfigSv1.GetConfigAsJSON',
      params: [{}]
    };

    setIsTesting(true); // Show loading state
    setTestResult('');  // Clear previous result
    setConfigError(''); // Clear previous error

    try {
      const response = await fetch(cgratesURL + '/jsonrpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newQuery),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          const parsedJSON = JSON.parse(data.result); // Parse the returned JSON string
          setCgratesConfig((prevConfig) => ({
            ...prevConfig,
            json_config: parsedJSON
          }));
          setTestResult('Connection successful and config loaded.');
        } else {
          setTestResult('Connection successful, but no config found.');
        }
      } else {
        setTestResult('Connection failed: ' + response.statusText);
      }
    } catch (error) {
      setTestResult('Connection error: ' + error.message);
    }

    setIsTesting(false); // Hide loading state
  };

  // Fetch config on initial load and handle errors
  const fetchConfig = async (url) => {
    const query = {
      method: 'ConfigSv1.GetConfigAsJSON',
      params: [{}]
    };

    try {
      const response = await fetch(url + '/jsonrpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(query),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          const parsedJSON = JSON.parse(data.result); // Parse the returned JSON string
          setCgratesConfig((prevConfig) => ({
            ...prevConfig,
            json_config: parsedJSON
          }));
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

  // Component to handle updating document title
  const TitleUpdater = () => {
    const location = useLocation(); // Detect the current route

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
        '/routeprofiles': 'Route PRofiles - Omnitouch CGrateS UI',
        '/tariffplans': 'TariffPlans - Omnitouch CGrateS UI',
        '/getcost': 'GetCost - Omnitouch CGrateS UI',
        '/event-reader': 'Event Reader - Omnitouch CGrateS UI',
        '/exported-cdrs': 'Exported CDRs - Omnitouch CGrateS UI',
        '/config': 'Config - Omnitouch CGrateS UI',
      };
      const defaultTitle = 'Omnitouch CGrateS UI';
      document.title = pageTitles[location.pathname] || defaultTitle;
    }, [location]);

    return null; // No visual output, only side effects
  };

  return (
    <Router basename="/">
      <TitleUpdater /> {/* Updates the document title whenever the route changes */}
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
            ></span>
          </Button>
          <Button variant="outline-light" onClick={handleToggleOffcanvas}>
            ☰
          </Button>

        </Container>
      </Navbar>

      <Offcanvas show={showOffcanvas} onHide={handleToggleOffcanvas} placement="end">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Navigation</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <Nav className="flex-column">
            <Nav.Link as={Link} to="/" onClick={handleToggleOffcanvas}>Home</Nav.Link>
            <Nav.Link as={Link} to="/cdrs" onClick={handleToggleOffcanvas}>CDRs</Nav.Link>
            <Nav.Link as={Link} to="/accounts" onClick={handleToggleOffcanvas}>Accounts</Nav.Link>
            <Nav.Link as={Link} to="/sessions" onClick={handleToggleOffcanvas}>Sessions</Nav.Link>
            <Nav.Link as={Link} to="/resources" onClick={handleToggleOffcanvas}>Resources</Nav.Link>
            <Nav.Link as={Link} to="/stats" onClick={handleToggleOffcanvas}>Stats</Nav.Link>
            <Nav.Link as={Link} to="/filters" onClick={handleToggleOffcanvas}>Filters</Nav.Link>
            <Nav.Link as={Link} to="/event-reader" onClick={handleToggleOffcanvas}>Event Reader</Nav.Link>
            {/* Custom Dropdown for Actions & ActionPlans */}
            <div>
              <Button
                variant="link"
                className="dropdown-toggle"
                onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                aria-expanded={showActionsDropdown}
              >
                Actions & ActionPlans
              </Button>
              {showActionsDropdown && (
                <div style={{ paddingLeft: '1rem', borderLeft: '2px solid #ccc', marginTop: '0.5rem' }}>
                  <Nav.Link as={Link} to="/action-triggers" onClick={handleToggleOffcanvas}>Action Triggers</Nav.Link>
                  <Nav.Link as={Link} to="/action-plans" onClick={handleToggleOffcanvas}>Action Plans</Nav.Link>
                  <Nav.Link as={Link} to="/actions" onClick={handleToggleOffcanvas}>Actions</Nav.Link>
                </div>
              )}
            </div>

            <Nav.Link as={Link} to="/attributes" onClick={handleToggleOffcanvas}>Attributes</Nav.Link>
            <Nav.Link as={Link} to="/event-reader" onClick={handleToggleOffcanvas}>ERS</Nav.Link>

            {/* Custom Dropdown for Rate Plans & Profiles */}
            <div>
              <Button
                variant="link"
                className="dropdown-toggle"
                onClick={() => setShowRateDropdown(!showRateDropdown)}
                aria-expanded={showRateDropdown}
              >
                Rate Plans & Profiles
              </Button>
              {showRateDropdown && (
                <div style={{ paddingLeft: '1rem', borderLeft: '2px solid #ccc', marginTop: '0.5rem' }}>
                  <Nav.Link as={Link} to="/chargers" onClick={handleToggleOffcanvas}>Chargers</Nav.Link>
                  <Nav.Link as={Link} to="/destinationrates" onClick={handleToggleOffcanvas}>DestinationRates</Nav.Link>
                  <Nav.Link as={Link} to="/ratingplans" onClick={handleToggleOffcanvas}>RatingPlans</Nav.Link>
                  <Nav.Link as={Link} to="/ratingprofiles" onClick={handleToggleOffcanvas}>RatingProfiles</Nav.Link>
                  <Nav.Link as={Link} to="/timings" onClick={handleToggleOffcanvas}>Timings</Nav.Link>
                  <Nav.Link as={Link} to="/getcost" onClick={handleToggleOffcanvas}>GetCost</Nav.Link>
                  <Nav.Link as={Link} to="/routes" onClick={handleToggleOffcanvas}>Routes</Nav.Link>
                  <Nav.Link as={Link} to="/routeprofiles" onClick={handleToggleOffcanvas}>RouteProfiles</Nav.Link>
                  <Nav.Link as={Link} to="/tariffplans" onClick={handleToggleOffcanvas}>TariffPlans</Nav.Link>
                </div>
              )}
            </div>
            <Nav.Link as={Link} to="/exported-cdrs" onClick={handleToggleOffcanvas}>Exported CDRs</Nav.Link>
            <Nav.Link as={Link} to="/config" onClick={handleToggleOffcanvas}>Config</Nav.Link>
          </Nav>
        </Offcanvas.Body>
      </Offcanvas>

      <Container style={{ paddingTop: '70px' }}>
        <Routes>
          {/* Home route showing the parsed Readme.md */}
          <Route
            path="/"
            element={<div dangerouslySetInnerHTML={{ __html: readmeContent }} />}
          />
          {/* Duplicate home route showing the parsed Readme.md */}
          <Route
            path="/CGrateS_UI/"
            element={<div dangerouslySetInnerHTML={{ __html: readmeContent }} />}
          />
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
          <Route path="/config" element={<Config cgratesConfig={cgratesConfig} />} />
        </Routes>
      </Container>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Enter CGrateS Connection Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Label>API URL</Form.Label>
              <Form.Control
                type="text"
                defaultValue="http://localhost:2080"
                value={cgratesConfig.url}
                onChange={(e) => handleConfigChange('url', e.target.value)}
              />
              <Form.Text className="text-muted">
                URL of CGrateS instance (default is <pre>http://localhost:2080</pre>)
              </Form.Text>
            </Form.Group>
            <Form.Group>
              <Form.Label>Tenants (separate by ;)</Form.Label>
              <Form.Control
                type="text"
                defaultValue="cgrates.org;test"
                value={cgratesConfig.tenants}
                onChange={(e) => handleConfigChange('tenants', e.target.value)}
              />
              <Form.Text className="text-muted">
                Please enter tenants separated by semicolon (;)
              </Form.Text>
            </Form.Group>
            <Form.Group>
              <Form.Label>Basic Auth - Username</Form.Label>
              <Form.Control
                type="text"
                value={cgratesConfig.username}
                onChange={(e) => handleConfigChange('username', e.target.value)}
              />
              <Form.Text className="text-muted">
                Optional - only required if CGrateS is configured with basic auth
              </Form.Text>
            </Form.Group>
            <Form.Group>
              <Form.Label>Basic Auth - Password</Form.Label>
              <Form.Control
                type="password"
                value={cgratesConfig.password}
                onChange={(e) => handleConfigChange('password', e.target.value)}
              />
              <Form.Text className="text-muted">
                Optional - only required if CGrateS is configured with basic auth
              </Form.Text>
            </Form.Group>
          </Form>
          <Button variant="secondary" onClick={handleTestConnection} disabled={isTesting}>
            {isTesting ? 'Testing...' : 'Test Connection'}
          </Button>
          {testResult && (
            <Alert variant={testResult.includes('successful') ? 'success' : 'danger'}>
              {testResult}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Close</Button>
          <Button variant="primary" onClick={() => setShowModal(false)}>Save Changes</Button>
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
