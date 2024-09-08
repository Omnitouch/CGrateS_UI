import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Modal, Button, Navbar, Nav, Container, Form } from 'react-bootstrap';
import CDRs from './CDRs';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';

function App() {
  const [cgratesConfig, setCgratesConfig] = useState({
    url: 'http://localhost:2080',
    tenants: 'cgrates.org;test',
    username: '',
    password: ''
  });
  const [showModal, setShowModal] = useState(false);

  // Check for the CGrateS configuration in local storage
  useEffect(() => {
    const storedConfig = localStorage.getItem('cgratesConfig');
    if (storedConfig) {
      setCgratesConfig(JSON.parse(storedConfig));
    } else {
      setShowModal(true); // Show modal if no config is found
    }
  }, []);

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

  return (
    <Router basename="/">
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container>
          <Navbar.Brand as={Link} to="/">Omnitouch CGrateS UI</Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link as={Link} to="/cdrs">View CDRs</Nav.Link>
            </Nav>
            <Button variant="outline-info" onClick={handleOpenModal}>Link to CGrateS</Button>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container>
        <Routes>
          <Route path="/cdrs" element={<CDRs cgratesConfig={cgratesConfig} />} />
        </Routes>
      </Container>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Enter CGrateS Details</Modal.Title>
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
                URL of CGrateS instance (default is <pre>http://localhost:2080</pre>
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
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Close</Button>
          <Button variant="primary" onClick={() => setShowModal(false)}>Save Changes</Button>
        </Modal.Footer>
      </Modal>

      <small>
        Currently using CGrateS URL: <pre>{cgratesConfig.url}</pre>
        Tenants: <pre>{splitTenants.join(', ')}</pre>
      </small>
    </Router>
  );
}

export default App;
