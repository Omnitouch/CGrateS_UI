import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Modal, Button, Navbar, Nav, Container, Form } from 'react-bootstrap';
import CDRs from './CDRs';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';

function App() {
  const [cgrates_URL, setcgrates_URL] = useState('');
  const [cgrates_Tenants, setcgrates_Tenants] = useState('');
  const [cgrates_Username, setcgrates_Username] = useState('');
  const [cgrates_Password, setcgrates_Password] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Check for the API key and API user in local storage
  useEffect(() => {
    const storedcgrates_URL = localStorage.getItem('cgrates_URL');
    if (storedcgrates_URL) {
      setcgrates_URL(storedcgrates_URL);
    } else {
      setShowModal(true); // Show modal if no API key or API user is found
    }
  }, []);

  // Update the API key and API user in local storage whenever they change
  useEffect(() => {
    if (cgrates_URL) {
      localStorage.setItem('cgrates_URL', cgrates_URL);
    }
  }, [cgrates_URL]);

  // Handle API key change from the modal input
  const handlecgrates_URLChange = (event) => {
    setcgrates_URL(event.target.value);
  };

  // Handle CGrateS Tenants change from the modal input
  const handlecgrates_TenantsChange = (event) => {
    setcgrates_Tenants(event.target.value);
  };

  // Handle API user change from the modal input
  const handlecgrates_UsernameChange = (event) => {
    setcgrates_Username(event.target.value);
  };

  // Handle API password change from the modal input
  const handlecgrates_Password = (event) => {
    setcgrates_Password(event.target.value);
  };

  // Handle opening the modal to change the API key
  const handleOpenModal = () => {
    setShowModal(true);
  };

  return (
    <Router basename="/">
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container>
          <Navbar.Brand as={Link} to="/">Omnitouch CGrateS UI</Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link as={Link} to="/sms-request">View CDRs</Nav.Link>
            </Nav>
            <Button variant="outline-info" onClick={handleOpenModal}>Link to CGrateS</Button>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container>
        <Routes>
          <Route path="/sms-request" element={<CDRs cgrates_URL={cgrates_URL} />} />
        </Routes>
      </Container>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Enter CGrateS Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Label>API Key</Form.Label>
              <Form.Control
                type="text"
                defaultValue="http://localhost:2080"
                value={cgrates_URL}
                onChange={handlecgrates_URLChange}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Tenants</Form.Label>
              <Form.Control
                type="text"
                defaultValue="cgrates.org;test"
                value={cgrates_Tenants}
                onChange={handlecgrates_TenantsChange}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Basic Auth - Username</Form.Label>
              <Form.Control
                type="text"
                defaultValue=""
                value={cgrates_Username}
                onChange={handlecgrates_UsernameChange}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Basic Auth - Password</Form.Label>
              <Form.Control
                type="text"
                defaultValue=""
                value={cgrates_Password}
                onChange={handlecgrates_Password}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Close</Button>
          <Button variant="primary" onClick={() => { setcgrates_URL(cgrates_URL); setShowModal(false); }}>Save Changes</Button>
        </Modal.Footer>
      </Modal>
      <small>
        Currently using API key: {cgrates_URL}
      </small>
    </Router>
  );
}

export default App;
