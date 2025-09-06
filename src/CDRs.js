import React, { useState, useEffect, useMemo } from "react";
import {
  Form,
  Button,
  Container,
  Row,
  Col,
  Table,
  Pagination,
  Modal,
  Spinner,
} from "react-bootstrap";
import Datetime from "react-datetime";
import moment from "moment";

// Options for the "Past X" dropdown
const pastOptions = [
  { label: "Past 15 minutes", value: 15 },
  { label: "Past 30 minutes", value: 30 },
  { label: "Past 1 hour", value: 60 },
  { label: "Past 2 hours", value: 120 },
  { label: "Past 6 hours", value: 360 },
  { label: "Past 1 day", value: 1440 },
  { label: "Past 2 days", value: 2880 },
  { label: "Past 1 week", value: 10080 },
  { label: "Past 1 month", value: 43200 },
  { label: "Past 3 months", value: 129600 },
  { label: "Past 6 months", value: 259200 },
  { label: "Past 1 year", value: 525600 },
  { label: "Past 2 years", value: 1051200 },
];

// Options for the "Category" dropdown
const categoryOptions = [
  { label: "Call", value: "call" },
  { label: "SMS", value: "sms" },
  { label: "SMS A2P", value: "sms_a2p" },
  { label: "Data", value: "data" },
];

const formatNsToHMS = (nanoseconds) => {
  const totalSeconds = Math.floor((Number(nanoseconds) || 0) / 1e9);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
};

const bytesToMB = (bytes) => (Number(bytes) || 0) / (1024 * 1024);

const CDRs = ({ cgratesConfig }) => {
  const [searchParams, setSearchParams] = useState({
    setupTimeStart: "",
    setupTimeEnd: "",
    tenant: cgratesConfig.tenants.split(";")[0], // Default to the first tenant
    account: "",
    past: "",
    cgratesInstance: "",
    subject: "",
    category: [], // multiple categories
    destination: "",
    limit: 50, // NEW: default Limit
  });

  const [query, setQuery] = useState(null); // API query object
  const [apiQuery, setApiQuery] = useState("");
  const [results, setResults] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [offset, setOffset] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedRowData, setSelectedRowData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [responseTime, setResponseTime] = useState(null);
  const [exportResult, setExportResult] = useState(null);
  const [selectedExporter, setSelectedExporter] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportApiQuery, setExportApiQuery] = useState("");
  const [exporterOptions, setExporterOptions] = useState([]);
  const [isVerbose, setIsVerbose] = useState(true); // Default to true

  const handleVerboseChange = (event) => {
    setIsVerbose(event.target.value === "true");
  };

  const formatWithTimezone = (momentObj) => {
    return momentObj ? momentObj.toISOString(true) : "";
  };

  const handleDateChange = (type, value) => {
    const momentValue =
      moment.isMoment(value) && value.isValid() ? value : null;
    setSearchParams((prev) => ({
      ...prev,
      [type]: formatWithTimezone(momentValue),
    }));
  };

  useEffect(() => {
    // Populate exporter options dynamically from cgratesConfig.json_config
    if (
      cgratesConfig.json_config &&
      cgratesConfig.json_config.ees &&
      cgratesConfig.json_config.ees.exporters
    ) {
      const exporters = cgratesConfig.json_config.ees.exporters;
      const options = exporters.map((exporter) => ({
        label: exporter.id,
        value: exporter.id,
      }));
      setExporterOptions(options);
    }
  }, [cgratesConfig]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setSearchParams((prev) => ({ ...prev, [name]: value }));
  };

  const handleLimitChange = (event) => {
    const value = event.target.value;
    const numeric = parseInt(value, 10);
    setSearchParams((prev) => ({
      ...prev,
      limit: Number.isFinite(numeric) && numeric > 0 ? numeric : "",
    }));
  };

  const handleCategoryChange = (event) => {
    const selectedOptions = Array.from(event.target.selectedOptions).map(
      (option) => option.value
    );
    setSearchParams((prev) => ({ ...prev, category: selectedOptions }));
  };

  const handlePastChange = (event) => {
    const value = event.target.value;
    const end = moment();
    const start = moment().subtract(value, "minutes");
    setSearchParams((prev) => ({
      ...prev,
      setupTimeStart: formatWithTimezone(start),
      setupTimeEnd: formatWithTimezone(end),
      past: value,
    }));
  };

  const fetchResults = async (page = 1, offsetValue = 0) => {
    setIsLoading(true);
    setResults([]); // Clear current results
    const startTime = Date.now();

    const effectiveLimit =
      Number.isFinite(Number(searchParams.limit)) &&
      Number(searchParams.limit) > 0
        ? Number(searchParams.limit)
        : 50;

    const newQuery = {
      method: "CDRsV2.GetCDRs",
      params: [
        {
          SetupTimeStart: searchParams.setupTimeStart,
          SetupTimeEnd: searchParams.setupTimeEnd,
          Limit: effectiveLimit, // <-- use UI Limit
          Offset: offsetValue,
        },
      ],
      id: 0,
    };

    if (searchParams.tenant) {
      newQuery.params[0].Tenants = [searchParams.tenant];
    }
    if (searchParams.account) {
      const accounts = searchParams.account.includes(",")
        ? searchParams.account.split(",").map((acc) => acc.trim())
        : [searchParams.account];
      newQuery.params[0].Accounts = accounts;
    }
    if (searchParams.subject) {
      const subjects = searchParams.subject.includes(",")
        ? searchParams.subject.split(",").map((s) => s.trim())
        : [searchParams.subject];
      newQuery.params[0].Subjects = subjects;
    }
    if (searchParams.category && searchParams.category.length > 0) {
      newQuery.params[0].Categories = searchParams.category;
    }
    if (searchParams.destination) {
      const destinations = searchParams.destination.includes(",")
        ? searchParams.destination.split(",").map((d) => d.trim())
        : [searchParams.destination];
      newQuery.params[0].DestinationPrefixes = destinations;
    }

    setQuery(newQuery);
    setApiQuery(JSON.stringify(newQuery, null, 2));

    try {
      const response = await fetch(cgratesConfig.url + "/jsonrpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        setResults(data.result);
      } else {
        console.warn("Data format unexpected:", data);
        setResults([]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setResults([]);
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
    const effectiveLimit =
      Number.isFinite(Number(searchParams.limit)) &&
      Number(searchParams.limit) > 0
        ? Number(searchParams.limit)
        : 50;

    const newOffset = offset + effectiveLimit;
    setOffset(newOffset);
    setCurrentPage((p) => p + 1);
    fetchResults(currentPage + 1, newOffset);
  };

  const handlePreviousPage = () => {
    const effectiveLimit =
      Number.isFinite(Number(searchParams.limit)) &&
      Number(searchParams.limit) > 0
        ? Number(searchParams.limit)
        : 50;

    const newOffset = Math.max(0, offset - effectiveLimit);
    setOffset(newOffset);
    setCurrentPage((p) => Math.max(1, p - 1));
    fetchResults(Math.max(1, currentPage - 1), newOffset);
  };

  const handleRowClick = (rowData) => {
    setSelectedRowData(rowData);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedRowData(null);
  };

  // Utility function to format Usage based on ToR (row-wise)
  const formatUsage = (usage, tor) => {
    if (tor === "*data") {
      const mb = bytesToMB(usage).toFixed(2);
      return (
        <>
          {`${mb} MB`}
          <br />
          {`(${usage} bytes)`}
        </>
      );
    } else if (tor === "*voice") {
      const timeFormatted = formatNsToHMS(usage);
      return (
        <>
          {timeFormatted}
          <br />
          {`(${usage} ns)`}
        </>
      );
    }
    return usage; // default
  };

  const handleExport = async () => {
    if (!query) {
      console.error("No query available for export");
      return;
    }
    setIsExporting(true);

    // Remove Limit/Offset for export but keep the rest, add exporter + verbose
    const exportQuery = {
      ...query,
      method: "APIerSv1.ExportCDRs",
      params: [
        {
          ...query.params[0],
          Limit: undefined,
          Offset: undefined,
          ExporterIDs: [selectedExporter],
          Verbose: isVerbose,
        },
      ],
      id: 2,
    };

    setExportApiQuery(JSON.stringify(exportQuery, null, 2));

    try {
      const response = await fetch(cgratesConfig.url + "/jsonrpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exportQuery),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setExportResult(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Error exporting data:", error);
      setExportResult(`Error: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportModalOpen = () => setShowExportModal(true);
  const handleExportModalClose = () => {
    setShowExportModal(false);
    setExportResult(null);
    setSelectedExporter("");
    setExportApiQuery("");
  };

  const categoryTotals = useMemo(() => {
    // Structure: { [category]: { cost: number, usage: number } }
    const acc = {};
    for (const row of results || []) {
      const cat = (row.Category || "unknown").toString();
      const cost = Number(row.Cost) || 0;
      const usage = Number(row.Usage) || 0;

      if (!acc[cat]) {
        acc[cat] = { cost: 0, usage: 0 };
      }
      // Only add cost if it's non-negative
      if (cost >= 0) {
        acc[cat].cost += cost;
      }
      acc[cat].usage += usage;
    }
    return acc;
  }, [results]);

  const formatCategoryUsageTotal = (category, totalUsage) => {
    const lc = category.toLowerCase();
    if (lc === "data") {
      const mb = bytesToMB(totalUsage).toFixed(2);
      return `${mb} MB (${totalUsage} bytes)`;
    }
    if (lc.includes("call")) {
      return `${formatNsToHMS(totalUsage)} (${totalUsage} ns)`;
    }
    // For SMS / SMS A2P or others, show raw number
    return String(totalUsage);
  };

  const grandTotals = useMemo(() => {
    let totalCost = 0;
    let totalUsage = 0;
    for (const cat of Object.keys(categoryTotals)) {
      totalCost += categoryTotals[cat].cost;
      totalUsage += categoryTotals[cat].usage;
    }
    return { totalCost, totalUsage };
  }, [categoryTotals]);

  const effectiveLimit =
    Number.isFinite(Number(searchParams.limit)) &&
    Number(searchParams.limit) > 0
      ? Number(searchParams.limit)
      : 50;

  const nextDisabled = results.length < effectiveLimit; // if fewer than limit fetched, likely no next page

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
                  onChange={(m) => handleDateChange("setupTimeStart", m)}
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
                  onChange={(m) => handleDateChange("setupTimeEnd", m)}
                  dateFormat="YYYY-MM-DD"
                  timeFormat="HH:mm:ss"
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group controlId="formPast">
                <Form.Label>Past</Form.Label>
                <Form.Control
                  as="select"
                  name="past"
                  value={searchParams.past}
                  onChange={handlePastChange}
                >
                  <option value="">Select Interval</option>
                  {pastOptions.map((option, index) => (
                    <option key={index} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Form.Control>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group controlId="formTenant">
                <Form.Label>Tenant</Form.Label>
                <Form.Control
                  as="select"
                  name="tenant"
                  value={searchParams.tenant}
                  onChange={handleInputChange}
                >
                  {cgratesConfig.tenants.split(";").map((tenant, index) => (
                    <option key={index} value={tenant}>
                      {tenant}
                    </option>
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
                <Form.Text muted>
                  Separate multiple accounts with commas.
                </Form.Text>
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
                <Form.Text muted>
                  Separate multiple subjects with commas.
                </Form.Text>
              </Form.Group>
            </Col>

            <Col md={3}>
              <Form.Group controlId="formDestination">
                <Form.Label>Destination</Form.Label>
                <Form.Control
                  type="text"
                  name="destination"
                  value={searchParams.destination}
                  onChange={handleInputChange}
                />
                <Form.Text muted>
                  Separate multiple destinations with commas.
                </Form.Text>
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
                  multiple
                >
                  {categoryOptions.map((option, index) => (
                    <option key={index} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Form.Control>
                <Form.Text muted>
                  Hold Ctrl (Cmd on Mac) to select multiple categories.
                </Form.Text>
              </Form.Group>
            </Col>

            {/* NEW: Limit control */}
            <Col md={3}>
              <Form.Group controlId="formLimit">
                <Form.Label>Limit</Form.Label>
                <Form.Control
                  type="number"
                  name="limit"
                  min={1}
                  step={1}
                  value={searchParams.limit}
                  onChange={handleLimitChange}
                />
                <Form.Text muted>
                  Number of CDRs per page (default 50).
                </Form.Text>
              </Form.Group>
            </Col>

            <Col md={12} className="d-flex align-items-end mt-3">
              <Button type="submit" className="w-100">
                Search
              </Button>
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
          <pre className="mt-4 text-left">{apiQuery}</pre>
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
            {results && results.length > 0 ? (
              results.map((result, index) => (
                <tr
                  key={index}
                  onClick={() => handleRowClick(result)}
                  style={{ cursor: "pointer" }}
                >
                  <td>{index + 1 + (currentPage - 1) * effectiveLimit}</td>
                  <td>
                    {moment(result.SetupTime).format("YYYY-MM-DD HH:mm:ss")}
                  </td>
                  <td>
                    {moment(result.AnswerTime).format("YYYY-MM-DD HH:mm:ss")}
                  </td>
                  <td>{result.Tenant}</td>
                  <td>{result.Account}</td>
                  <td>{result.Category}</td>
                  <td>{result.Subject}</td>
                  <td>{result.Cost}</td>
                  <td>{formatUsage(result.Usage, result.ToR)}</td>
                  <td>{result.Destination}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="10" className="text-center">
                  No results available
                </td>
              </tr>
            )}
          </tbody>
        </Table>

        <Pagination className="justify-content-center mt-4">
          <Pagination.Prev
            disabled={offset === 0 || isLoading}
            onClick={handlePreviousPage}
          />
          <Pagination.Next
            disabled={nextDisabled || isLoading}
            onClick={handleNextPage}
          />
        </Pagination>

        {results.length > 0 && (
          <Button
            variant="primary"
            onClick={handleExportModalOpen}
            className="mt-3"
          >
            Export
          </Button>
        )}

        {results.length > 0 && (
          <div className="mt-4">
            <h5>Totals by Category (current page)</h5>
            <Table bordered hover size="sm">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Total Cost</th>
                  <th>Total Usage</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(categoryTotals)
                  .sort((a, b) => a.localeCompare(b))
                  .map((cat) => (
                    <tr key={cat}>
                      <td>{cat}</td>
                      <td>{categoryTotals[cat].cost}</td>
                      <td>
                        {formatCategoryUsageTotal(
                          cat,
                          categoryTotals[cat].usage
                        )}
                      </td>
                    </tr>
                  ))}
                <tr>
                  <th>Grand Total</th>
                  <th>{grandTotals.totalCost}</th>
                  <th>
                    {/* Grand usage is shown raw to avoid mixing units between categories */}
                    {grandTotals.totalUsage}
                  </th>
                </tr>
              </tbody>
            </Table>
            <p className="text-muted">
              Note: Usage formatting per category — Data in MB (and bytes), Call
              in HH:MM:SS (and ns), others raw.
            </p>
          </div>
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
              <p>
                <strong>Setup Time:</strong> {selectedRowData.SetupTime}
              </p>
              <p>
                <strong>Answer Time:</strong> {selectedRowData.AnswerTime}
              </p>
              <p>
                <strong>Tenant:</strong> {selectedRowData.Tenant}
              </p>
              <p>
                <strong>Account:</strong> {selectedRowData.Account}
              </p>
              <p>
                <strong>Category:</strong> {selectedRowData.Category}
              </p>
              <p>
                <strong>Subject:</strong> {selectedRowData.Subject}
              </p>
              <p>
                <strong>Cost:</strong> {selectedRowData.Cost}
              </p>
              <p>
                <strong>Usage:</strong> {selectedRowData.Usage}
              </p>
              <p>
                <strong>Destination:</strong> {selectedRowData.Destination}
              </p>
              <p>
                <pre>{JSON.stringify(selectedRowData, null, 2)}</pre>
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
            <Form.Control
              as="select"
              value={selectedExporter}
              onChange={(e) => setSelectedExporter(e.target.value)}
            >
              <option value="">Select Exporter</option>
              {exporterOptions.map((option, index) => (
                <option key={index} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Form.Control>
          </Form.Group>

          <Form.Group controlId="formVerbose">
            <Form.Label>Verbose</Form.Label>
            <br />
            <Form.Text muted>
              Enabling Verbose output is much slower - This may timeout some
              browsers
            </Form.Text>
            <Form.Check
              type="radio"
              id="verbose-true"
              name="verbose"
              value="true"
              label="True"
              checked={isVerbose === true}
              onChange={handleVerboseChange}
            />
            <Form.Check
              type="radio"
              id="verbose-false"
              name="verbose"
              value="false"
              label="False"
              checked={isVerbose === false}
              onChange={handleVerboseChange}
            />
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
          <Button
            variant="primary"
            onClick={handleExport}
            disabled={isExporting || !selectedExporter}
          >
            Export
          </Button>
          <Button
            variant="secondary"
            onClick={handleExportModalClose}
            disabled={isExporting}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CDRs;
