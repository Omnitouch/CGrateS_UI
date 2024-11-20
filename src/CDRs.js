import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Table, Pagination, Modal, Spinner } from 'react-bootstrap';
import Datetime from 'react-datetime';
import moment from 'moment';

// Options for the "Past X" dropdown
const pastOptions = [
  { label: 'Past 15 minutes', value: 15 },
  { label: 'Past 30 minutes', value: 30 },
  { label: 'Past 1 hour', value: 60 },
  { label: 'Past 2 hours', value: 120 },
  { label: 'Past 6 hours', value: 360 },
  { label: 'Past 1 day', value: 1440 },
  { label: 'Past 2 days', value: 2880 },
  { label: 'Past 1 week', value: 10080 },
  { label: 'Past 1 month', value: 43200 },
  { label: 'Past 3 months', value: 129600 },
  { label: 'Past 6 months', value: 259200 },
  { label: 'Past 1 year', value: 525600 },
  { label: 'Past 2 years', value: 1051200 }
];

// Options for the "Category" dropdown
const categoryOptions = [
  { label: 'Call', value: 'call' },
  { label: 'SMS', value: 'sms' },
  { label: 'SMS A2P', value: 'sms_a2p' },
  { label: 'Data', value: 'data' }
];

const CDRs = ({ cgratesConfig }) => {
  const [searchParams, setSearchParams] = useState({
    setupTimeStart: '',
    setupTimeEnd: '',
    tenant: cgratesConfig.tenants.split(';')[0], // Default to the first tenant
    account: '',
    past: '',
    cgratesInstance: '',
    subject: '',
    category: [], // Update to an array to hold multiple categories
    destination: '' // New state for Destination
  });

  const [query, setQuery] = useState(null); // State to store the API query object
  const [apiQuery, setApiQuery] = useState('');
  const [results, setResults] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [offset, setOffset] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedRowData, setSelectedRowData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [responseTime, setResponseTime] = useState(null);
  const [exportResult, setExportResult] = useState(null);
  const [selectedExporter, setSelectedExporter] = useState('');
  const [isExporting, setIsExporting] = useState(false); // New state for handling export loading
  const [exportApiQuery, setExportApiQuery] = useState(''); // State to store the export API query
  const [exporterOptions, setExporterOptions] = useState([]); // Dynamically populated exporter list

  const handleDateChange = (type, moment) => {
    setSearchParams({
      ...searchParams,
      [type]: moment.format('YYYY-MM-DD HH:mm:ss')
    });
  };

  useEffect(() => {
    // Populate exporter options dynamically from cgratesConfig.json_config
    if (cgratesConfig.json_config && cgratesConfig.json_config.ees && cgratesConfig.json_config.ees.exporters) {
      const exporters = cgratesConfig.json_config.ees.exporters;
      const options = exporters.map(exporter => ({
        label: exporter.id,
        value: exporter.id
      }));
      setExporterOptions(options); // Set dynamic exporter options
    }
  }, [cgratesConfig]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setSearchParams({ ...searchParams, [name]: value });
  };

  const handleCategoryChange = (event) => {
    const selectedOptions = Array.from(event.target.selectedOptions).map(option => option.value);
    setSearchParams({ ...searchParams, category: selectedOptions });
  };

  const handlePastChange = (event) => {
    const value = event.target.value;
    const end = moment();
    const start = moment().subtract(value, 'minutes');
    setSearchParams({
      ...searchParams,
      setupTimeStart: start.format('YYYY-MM-DD HH:mm:ss'),
      setupTimeEnd: end.format('YYYY-MM-DD HH:mm:ss'),
      past: value
    });
  };

  const fetchResults = async (page = 1, offsetValue = 0) => {
    setIsLoading(true);
    setResults([]); // Clear the current results
    const startTime = Date.now();
    const newQuery = {
      method: 'CDRsV2.GetCDRs',
      params: [{
        SetupTimeStart: searchParams.setupTimeStart,
        SetupTimeEnd: searchParams.setupTimeEnd,
        RequestType: '*postpaid',
        Limit: 50,
        Offset: offsetValue
      }],
      id: 0
    };

    // Set Tenants
    if (searchParams.tenant) {
      newQuery.params[0].Tenants = [searchParams.tenant];
    }
    // Handle comma-separated Accounts
    if (searchParams.account) {
      const accounts = searchParams.account.includes(',')
        ? searchParams.account.split(',').map((acc) => acc.trim())
        : [searchParams.account];
      newQuery.params[0].Accounts = accounts;
    }
    // Handle comma-separated Subjects
    if (searchParams.subject) {
      const subjects = searchParams.subject.includes(',')
        ? searchParams.subject.split(',').map((subj) => subj.trim())
        : [searchParams.subject];
      newQuery.params[0].Subjects = subjects;
    }

    // Set Categories
    if (searchParams.category && searchParams.category.length > 0) {
      newQuery.params[0].Categories = searchParams.category;
    }
    // Set Destination
    if (searchParams.destination) {
      const destinations = searchParams.destination.includes(',')
        ? searchParams.destination.split(',').map((dest) => dest.trim())
        : [searchParams.destination];
      newQuery.params[0].Destinations = destinations;
    }

    setQuery(newQuery); // Store the query for later use in export
    setApiQuery(JSON.stringify(newQuery, null, 2));
  
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
      const endTime = Date.now();
      const timeTaken = ((endTime - startTime) / 1000).toFixed(2);
      setResponseTime(timeTaken);
  
      if (data && data.result) {
        setResults(data.result); // Handle the fetched results
      } else {
        console.warn('Data format unexpected:', data);
        setResults([]); // Reset results if data format is unexpected
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setResults([]); // Reset results on error
    } finally {
      setIsLoading(false);
    }
  };
  

  const handleSubmit = (event) => {
    event.preventDefault();
    setOffset(0);
    setCurrentPage(1);
    fetchResults(1, 0);
  };

  const handleNextPage = () => {
    const newOffset = offset + 50;
    setOffset(newOffset);
    setCurrentPage(currentPage + 1);
    fetchResults(currentPage + 1, newOffset);
  };

  const handlePreviousPage = () => {
    const newOffset = offset - 50;
    setOffset(newOffset);
    setCurrentPage(currentPage - 1);
    fetchResults(currentPage - 1, newOffset);
  };

  const handleRowClick = (rowData) => {
    setSelectedRowData(rowData);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedRowData(null);
  };

  const formatUsageTime = (nanoseconds) => {
    let seconds = Math.floor(nanoseconds / 1e9); // Convert nanoseconds to seconds
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds %= 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };
  const handleExport = async () => {
    if (!query) {
      console.error('No query available for export');
      return;
    }

    setIsExporting(true);

    // Use the existing query and add the ExporterIDs
    const exportQuery = {
      ...query,
      method: 'APIerSv1.ExportCDRs', // Change the method for export
      params: [{
        ...query.params[0], // Keep the same parameters
        // Remove Limit and Offset from the query
        Limit: undefined,
        Offset: undefined,
        ExporterIDs: [selectedExporter], // Add the ExporterIDs
        Verbose: true
      }],
      id: 2
    };

    setExportApiQuery(JSON.stringify(exportQuery, null, 2));

    try {
      const selectedInstance = "test"; // Simulating instance retrieval
      const response = await fetch(cgratesConfig.url + '/jsonrpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportQuery),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Export data received:', data);

      // Remove PositiveExports from the result
      if (data.result && data.result[selectedExporter]) {
        const { PositiveExports, ...filteredResult } = data.result[selectedExporter];
        data.result[selectedExporter] = filteredResult;
      }

      setExportResult(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error exporting data:', error);
      setExportResult(`Error: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportModalOpen = () => {
    setShowExportModal(true);
  };

  const handleExportModalClose = () => {
    setShowExportModal(false);
    setExportResult(null);
    setSelectedExporter('');
    setExportApiQuery(''); // Reset the export API query
  };

  return (
    <div className="App">
      <Container>
      <Form onSubmit={handleSubmit} className="mt-4">
          <Row>
            <Col md={3}>
              <Form.Group controlId="formSetupTimeStart">
                <Form.Label>Setup Time Start</Form.Label>
                <Datetime
                  value={searchParams.setupTimeStart}
                  onChange={(moment) => handleDateChange('setupTimeStart', moment)}
                  dateFormat="YYYY-MM-DD"
                  timeFormat="HH:mm:ss"
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group controlId="formSetupTimeEnd">
                <Form.Label>Setup Time End</Form.Label>
                <Datetime
                  value={searchParams.setupTimeEnd}
                  onChange={(moment) => handleDateChange('setupTimeEnd', moment)}
                  dateFormat="YYYY-MM-DD"
                  timeFormat="HH:mm:ss"
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group controlId="formPast">
                <Form.Label>Past</Form.Label>
                <Form.Control as="select" name="past" value={searchParams.past} onChange={handlePastChange}>
                  <option value="">Select Interval</option>
                  {pastOptions.map((option, index) => (
                    <option key={index} value={option.value}>{option.label}</option>
                  ))}
                </Form.Control>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group controlId="formTenant">
                <Form.Label>Tenant</Form.Label>
                <Form.Control as="select" name="tenant" value={searchParams.tenant} onChange={handleInputChange}>
                  {cgratesConfig.tenants.split(';').map((tenant, index) => (
                    <option key={index} value={tenant}>{tenant}</option>
                  ))}
                </Form.Control>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group controlId="formAccount">
                <Form.Label>Account</Form.Label>
                <Form.Control
                  type="text"
                  name="account"
                  value={searchParams.account}
                  onChange={handleInputChange}
                />
                <Form.Text muted>Separate multiple accounts with commas.</Form.Text>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group controlId="formSubject">
                <Form.Label>Subject</Form.Label>
                <Form.Control
                  type="text"
                  name="subject"
                  value={searchParams.subject}
                  onChange={handleInputChange}
                />
                <Form.Text muted>Separate multiple subjects with commas.</Form.Text>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group controlId="formSubject">
                <Form.Label>Destination</Form.Label>
                <Form.Control
                  type="text"
                  name="destination"
                  value={searchParams.destination}
                  onChange={handleInputChange}
                />
                <Form.Text muted>Separate multiple destinations with commas.</Form.Text>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group controlId="formCategory">
                <Form.Label>Category</Form.Label>
                <Form.Control
                  as="select"
                  name="category"
                  value={searchParams.category}
                  onChange={handleCategoryChange}
                  multiple // Enable multiple selection
                >
                  {categoryOptions.map((option, index) => (
                    <option key={index} value={option.value}>{option.label}</option>
                  ))}
                </Form.Control>
                <Form.Text muted>Hold Ctrl (Cmd on Mac) to select multiple categories.</Form.Text>
              </Form.Group>
            </Col>
            <Col md={12} className="d-flex align-items-end mt-3">
              <Button type="submit" className="w-100">Search</Button>
            </Col>
          </Row>
        </Form>

        {isLoading ? (
          <div className="text-center mt-4">
            <Spinner animation="border" role="status">
              <span className="sr-only">Loading...</span>
            </Spinner>
            <p>Loading CDRs, please wait...</p>
          </div>
        ) : (
          <pre className="mt-4 text-left">
            {apiQuery}
          </pre>
        )}

        <p>
          Response from CGrateS at <b>{cgratesConfig.url}</b>
          {responseTime && !isLoading && ` in ${responseTime} seconds`}
        </p>

        <Table striped bordered hover className="mt-4">
          <thead>
            <tr>
              <th>#</th>
              <th>Setup Time</th>
              <th>Answer Time</th>
              <th>Tenant</th>
              <th>Account</th>
              <th>Category</th>
              <th>Subject</th>
              <th>Cost</th>
              <th>Usage</th>
              <th>Destination</th>
            </tr>
          </thead>
          <tbody>
            {results && results.length > 0 ? results.map((result, index) => (
              <tr key={index} onClick={() => handleRowClick(result)} style={{ cursor: 'pointer' }}>
                <td>{index + 1 + (currentPage - 1) * 50}</td>
                <td>{result.SetupTime}</td>
                <td>{result.AnswerTime}</td>
                <td>{result.Tenant}</td>
                <td>{result.Account}</td>
                <td>{result.Category}</td>
                <td>{result.Subject}</td>
                <td>{result.Cost}</td>
                <td>{formatUsageTime(result.Usage)}</td>
                <td>{result.Destination}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan="10" className="text-center">No results available</td>
              </tr>
            )}
          </tbody>
        </Table>

        <Pagination className="justify-content-center mt-4">
          <Pagination.Prev disabled={offset === 0} onClick={handlePreviousPage} />
          <Pagination.Next onClick={handleNextPage} />
        </Pagination>

        {results.length > 0 && (
          <Button variant="primary" onClick={handleExportModalOpen} className="mt-3">Export</Button>
        )}
      </Container>

      {/* Modal for Row Details */}
      <Modal show={showModal} onHide={handleCloseModal} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>Row Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedRowData ? (
            <div>
              <p><strong>Setup Time:</strong> {selectedRowData.SetupTime}</p>
              <p><strong>Answer Time:</strong> {selectedRowData.AnswerTime}</p>
              <p><strong>Tenant:</strong> {selectedRowData.Tenant}</p>
              <p><strong>Account:</strong> {selectedRowData.Account}</p>
              <p><strong>Category:</strong> {selectedRowData.Category}</p>
              <p><strong>Subject:</strong> {selectedRowData.Subject}</p>
              <p><strong>Cost:</strong> {selectedRowData.Cost}</p>
              <p><strong>Usage:</strong> {selectedRowData.Usage}</p>
              <p><strong>Destination:</strong> {selectedRowData.Destination}</p>
              <p>
                <pre>
                  {JSON.stringify(selectedRowData, null, 2)}
                </pre>
              </p>
            </div>
          ) : (
            <p>No data available</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal for Export */}
      <Modal show={showExportModal} onHide={handleExportModalClose}>
        <Modal.Header closeButton>
          <Modal.Title>Export CDRs</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group controlId="formExporterId">
            <Form.Label>Exporter ID</Form.Label>
            <Form.Control as="select" value={selectedExporter} onChange={(e) => setSelectedExporter(e.target.value)}>
              <option value="">Select Exporter</option>
              {exporterOptions.map((option, index) => (
                <option key={index} value={option.value}>{option.label}</option>
              ))}
            </Form.Control>
          </Form.Group>

          {exportApiQuery && (
            <pre className="mt-3">API Call: {exportApiQuery}</pre>
          )}

          {isExporting ? (
            <div className="text-center mt-3">
              <Spinner animation="border" role="status">
                <span className="sr-only">Exporting...</span>
              </Spinner>
              <p>Exporting, please wait...</p>
            </div>
          ) : (
            exportResult && (
              <pre className="mt-3">API Response: {exportResult}</pre>
            )
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={handleExport} disabled={isExporting}>
            Export
          </Button>
          <Button variant="secondary" onClick={handleExportModalClose} disabled={isExporting}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CDRs;
