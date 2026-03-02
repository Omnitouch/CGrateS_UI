import React, { useState } from "react";
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
  Card,
  Badge,
  InputGroup,
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
];

// Common request methods for autocomplete
const commonMethods = [
  "APIerSv1.GetAccounts",
  "APIerSv1.SetAccount",
  "APIerSv1.RemoveAccount",
  "APIerSv1.GetAccountActionPlan",
  "APIerSv1.SetActions",
  "APIerSv1.SetActionPlan",
  "APIerSv1.ExecuteAction",
  "APIerSv1.GetCost",
  "APIerSv1.SetTPDestination",
  "APIerSv1.SetAttributeProfile",
  "APIerSv1.GetAttributeProfile",
  "APIerSv1.SetChargerProfile",
  "APIerSv1.GetChargerProfile",
  "APIerSv1.SetFilter",
  "APIerSv1.GetFilter",
  "APIerSv1.SetStatQueueProfile",
  "APIerSv1.GetStatQueueProfileIDs",
  "APIerSv1.SetThresholdProfile",
  "APIerSv1.SetResourceProfile",
  "APIerSv1.SetRouteProfile",
  "APIerSv1.ExportCDRs",
  "APIerSv1.RemoveCDRs",
  "APIerSv2.GetAccounts",
  "AttributeSv1.ProcessEvent",
  "AttributeSv1.GetAttributeForEvent",
  "CDRsV1.ProcessCDR",
  "CDRsV1.ProcessEvent",
  "CDRsV1.StoreSessionCost",
  "CDRsV2.GetCDRs",
  "ChargerSv1.ProcessEvent",
  "ConfigSv1.GetConfigAsJSON",
  "CoreSv1.Ping",
  "CoreSv1.Status",
  "GuardianSv1.RemoteLock",
  "GuardianSv1.RemoteUnlock",
  "Responder.GetCost",
  "Responder.GetMaxSessionTime",
  "Responder.Debit",
  "RouteSv1.GetRoutes",
  "SessionSv1.AuthorizeEvent",
  "SessionSv1.InitiateSession",
  "SessionSv1.UpdateSession",
  "SessionSv1.TerminateSession",
  "SessionSv1.ProcessCDR",
  "SessionSv1.GetActiveSessions",
  "SessionSv1.ForceDisconnect",
  "StatSv1.ProcessEvent",
  "StatSv1.GetStatQueuesForEvent",
  "ThresholdSv1.ProcessEvent",
  "ResourceSv1.AuthorizeResources",
  "ResourceSv1.AllocateResources",
  "ResourceSv1.ReleaseResources",
];

// Encoding options
const encodingOptions = [
  { label: "Any", value: "" },
  { label: "JSON", value: "*json" },
  { label: "GOB", value: "*gob" },
  { label: "Internal", value: "*internal" },
  { label: "BIRPC JSON", value: "*birpc_json" },
];

// Content filter types
const contentFilterTypes = [
  { label: "String Equals", value: "*string" },
  { label: "String Prefix", value: "*prefix" },
  { label: "String Suffix", value: "*suffix" },
  { label: "Not String", value: "*notstring" },
  { label: "Greater Than", value: "*gt" },
  { label: "Greater or Equal", value: "*gte" },
  { label: "Less Than", value: "*lt" },
  { label: "Less or Equal", value: "*lte" },
  { label: "Exists", value: "*exists" },
  { label: "Not Exists", value: "*notexists" },
];

// Content filter paths
const contentFilterPaths = [
  { label: "Request Field", value: "*req" },
  { label: "Reply Field", value: "*rep" },
  { label: "API Options", value: "*opts" },
  { label: "Header Field", value: "*hdr" },
];

// Helper to format Reply/ReplyError for display in table (handles objects)
const formatReplyForDisplay = (reply) => {
  if (reply === null || reply === undefined) return "-";
  if (typeof reply === "string") {
    // Check if it's a JSON string
    if ((reply.startsWith("{") || reply.startsWith("[")) && reply.length > 50) {
      return "{JSON...}";
    }
    return reply;
  }
  if (typeof reply === "object") {
    if (Array.isArray(reply)) {
      return `[Array: ${reply.length} items]`;
    }
    const keys = Object.keys(reply);
    if (keys.length === 0) return "{}";
    return `{${keys.slice(0, 3).join(", ")}${keys.length > 3 ? "..." : ""}}`;
  }
  return String(reply);
};

// Helper to parse reply into an object for the JSON viewer
const parseReplyForViewer = (reply) => {
  if (reply === null || reply === undefined) return null;

  // If it's a string, check if it's a JSON string that should be parsed
  if (typeof reply === "string") {
    const trimmed = reply.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        // Not valid JSON, return as plain string
        return reply;
      }
    }
    // Plain string (like "NOT_FOUND"), return as-is
    return reply;
  }

  // Already an object
  return reply;
};

// Collapsible JSON Viewer Component
const CollapsibleJSON = ({ data, initialExpanded = true }) => {
  const [expandedPaths, setExpandedPaths] = useState(new Set(initialExpanded ? ["root"] : []));
  const [allExpanded, setAllExpanded] = useState(initialExpanded);

  const togglePath = (path) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const expandAll = () => {
    const paths = new Set();
    const collectPaths = (obj, path) => {
      paths.add(path);
      if (obj && typeof obj === "object") {
        Object.keys(obj).forEach((key) => {
          collectPaths(obj[key], `${path}.${key}`);
        });
      }
    };
    collectPaths(data, "root");
    setExpandedPaths(paths);
    setAllExpanded(true);
  };

  const collapseAll = () => {
    setExpandedPaths(new Set(["root"]));
    setAllExpanded(false);
  };

  const renderValue = (value, path, key = null, isLast = true) => {
    const indent = (path.split(".").length - 1) * 16;

    if (value === null) {
      return (
        <div style={{ marginLeft: indent }}>
          {key !== null && <span style={{ color: "#881391" }}>"{key}"</span>}
          {key !== null && ": "}
          <span style={{ color: "#1c00cf" }}>null</span>
          {!isLast && ","}
        </div>
      );
    }

    if (typeof value === "boolean") {
      return (
        <div style={{ marginLeft: indent }}>
          {key !== null && <span style={{ color: "#881391" }}>"{key}"</span>}
          {key !== null && ": "}
          <span style={{ color: "#1c00cf" }}>{value.toString()}</span>
          {!isLast && ","}
        </div>
      );
    }

    if (typeof value === "number") {
      return (
        <div style={{ marginLeft: indent }}>
          {key !== null && <span style={{ color: "#881391" }}>"{key}"</span>}
          {key !== null && ": "}
          <span style={{ color: "#1c00cf" }}>{value}</span>
          {!isLast && ","}
        </div>
      );
    }

    if (typeof value === "string") {
      return (
        <div style={{ marginLeft: indent }}>
          {key !== null && <span style={{ color: "#881391" }}>"{key}"</span>}
          {key !== null && ": "}
          <span style={{ color: "#c41a16" }}>"{value}"</span>
          {!isLast && ","}
        </div>
      );
    }

    if (Array.isArray(value)) {
      const isExpanded = expandedPaths.has(path);
      const isEmpty = value.length === 0;

      if (isEmpty) {
        return (
          <div style={{ marginLeft: indent }}>
            {key !== null && <span style={{ color: "#881391" }}>"{key}"</span>}
            {key !== null && ": "}
            <span>[]</span>
            {!isLast && ","}
          </div>
        );
      }

      return (
        <div style={{ marginLeft: indent }}>
          <span
            onClick={() => togglePath(path)}
            style={{ cursor: "pointer", userSelect: "none" }}
          >
            {isExpanded ? "▼" : "▶"}{" "}
          </span>
          {key !== null && <span style={{ color: "#881391" }}>"{key}"</span>}
          {key !== null && ": "}
          {!isExpanded ? (
            <>
              <span style={{ color: "#666" }}>[{value.length} items]</span>
              {!isLast && ","}
            </>
          ) : (
            <>
              <span>[</span>
              {value.map((item, index) => (
                <div key={index}>
                  {renderValue(item, `${path}[${index}]`, null, index === value.length - 1)}
                </div>
              ))}
              <div style={{ marginLeft: indent }}>]{!isLast && ","}</div>
            </>
          )}
        </div>
      );
    }

    if (typeof value === "object") {
      const isExpanded = expandedPaths.has(path);
      const keys = Object.keys(value);
      const isEmpty = keys.length === 0;

      if (isEmpty) {
        return (
          <div style={{ marginLeft: indent }}>
            {key !== null && <span style={{ color: "#881391" }}>"{key}"</span>}
            {key !== null && ": "}
            <span>{"{}"}</span>
            {!isLast && ","}
          </div>
        );
      }

      return (
        <div style={{ marginLeft: indent }}>
          <span
            onClick={() => togglePath(path)}
            style={{ cursor: "pointer", userSelect: "none" }}
          >
            {isExpanded ? "▼" : "▶"}{" "}
          </span>
          {key !== null && <span style={{ color: "#881391" }}>"{key}"</span>}
          {key !== null && ": "}
          {!isExpanded ? (
            <>
              <span style={{ color: "#666" }}>
                {"{"}
                {keys.slice(0, 3).join(", ")}
                {keys.length > 3 ? ", ..." : ""}
                {"}"}
              </span>
              {!isLast && ","}
            </>
          ) : (
            <>
              <span>{"{"}</span>
              {keys.map((k, index) => (
                <div key={k}>
                  {renderValue(value[k], `${path}.${k}`, k, index === keys.length - 1)}
                </div>
              ))}
              <div style={{ marginLeft: indent }}>{"}"}{!isLast && ","}</div>
            </>
          )}
        </div>
      );
    }

    return <div style={{ marginLeft: indent }}>{String(value)}</div>;
  };

  // Handle non-object data (plain strings, etc.)
  if (data === null || data === undefined) {
    return <span style={{ color: "#666" }}>null</span>;
  }

  if (typeof data !== "object") {
    return (
      <pre
        style={{
          backgroundColor: "#f8f9fa",
          padding: "1rem",
          borderRadius: "4px",
          fontSize: "12px",
          margin: 0,
        }}
      >
        {String(data)}
      </pre>
    );
  }

  return (
    <div>
      <div className="mb-2">
        <Button variant="outline-secondary" size="sm" onClick={expandAll} className="me-2">
          Expand All
        </Button>
        <Button variant="outline-secondary" size="sm" onClick={collapseAll}>
          Collapse All
        </Button>
      </div>
      <pre
        style={{
          backgroundColor: "#f8f9fa",
          padding: "1rem",
          borderRadius: "4px",
          maxHeight: "400px",
          overflow: "auto",
          fontSize: "12px",
          margin: 0,
          fontFamily: "Monaco, Consolas, 'Courier New', monospace",
        }}
      >
        {renderValue(data, "root")}
      </pre>
    </div>
  );
};

const Analyzer = ({ cgratesConfig }) => {
  // Basic filters
  const [searchParams, setSearchParams] = useState({
    timeStart: "",
    timeEnd: "",
    past: "",
    method: "",
    encoding: "",
    source: "",
    destination: "",
    limit: 50,
  });

  // Pagination state
  const [offset, setOffset] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  // Custom methods (user-added)
  const [customMethods, setCustomMethods] = useState([]);
  const [newMethodInput, setNewMethodInput] = useState("");

  // Content filters (block-based)
  const [contentFilters, setContentFilters] = useState([]);

  // Advanced mode toggle
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [rawHeaderFilters, setRawHeaderFilters] = useState("");
  const [rawContentFilters, setRawContentFilters] = useState("");

  const [apiQuery, setApiQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedRowData, setSelectedRowData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [responseTime, setResponseTime] = useState(null);

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

  const handlePastChange = (event) => {
    const value = event.target.value;
    const end = moment();
    const start = moment().subtract(value, "minutes");
    setSearchParams((prev) => ({
      ...prev,
      timeStart: formatWithTimezone(start),
      timeEnd: formatWithTimezone(end),
      past: value,
    }));
  };

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

  // Custom method management
  const handleAddMethod = () => {
    const trimmed = newMethodInput.trim();
    if (trimmed && !commonMethods.includes(trimmed) && !customMethods.includes(trimmed)) {
      setCustomMethods((prev) => [...prev, trimmed]);
      setSearchParams((prev) => ({ ...prev, method: trimmed }));
      setNewMethodInput("");
    }
  };

  // Content filter management
  const addContentFilter = () => {
    setContentFilters((prev) => [
      ...prev,
      { id: Date.now(), type: "*string", path: "*req", field: "", value: "" },
    ]);
  };

  const updateContentFilter = (id, key, value) => {
    setContentFilters((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [key]: value } : f))
    );
  };

  const removeContentFilter = (id) => {
    setContentFilters((prev) => prev.filter((f) => f.id !== id));
  };

  // Build the query from UI inputs
  const buildHeaderFilters = () => {
    if (showAdvanced && rawHeaderFilters.trim()) {
      return rawHeaderFilters.trim();
    }

    let filters = [];

    // Time range
    if (searchParams.timeStart) {
      const startDate = moment(searchParams.timeStart).toISOString();
      filters.push(`+RequestStartTime:>="${startDate}"`);
    }
    if (searchParams.timeEnd) {
      const endDate = moment(searchParams.timeEnd).toISOString();
      filters.push(`+RequestStartTime:<="${endDate}"`);
    }

    // Method
    if (searchParams.method) {
      filters.push(`+RequestMethod:"${searchParams.method}"`);
    }

    // Encoding
    if (searchParams.encoding) {
      const escaped = searchParams.encoding.replace("*", "\\*");
      filters.push(`+RequestEncoding:${escaped}`);
    }

    // Source
    if (searchParams.source) {
      filters.push(`+RequestSource:${searchParams.source}*`);
    }

    // Destination
    if (searchParams.destination) {
      filters.push(`+RequestDestination:${searchParams.destination}*`);
    }

    return filters.join(" ");
  };

  const buildContentFilters = () => {
    if (showAdvanced && rawContentFilters.trim()) {
      return rawContentFilters
        .split(/[\n,]/)
        .map((f) => f.trim())
        .filter((f) => f.length > 0);
    }

    return contentFilters
      .filter((f) => f.field && f.value)
      .map((f) => `${f.type}:~${f.path}.${f.field}:${f.value}`);
  };

  const fetchResults = async (offsetValue = 0) => {
    setIsLoading(true);
    setResults([]);
    const startTime = Date.now();

    const headerFiltersString = buildHeaderFilters();
    const contentFiltersArray = buildContentFilters();
    const limit = Number(searchParams.limit) || 50;

    const newQuery = {
      method: "AnalyzerSv1.StringQuery",
      params: [
        {
          HeaderFilters: headerFiltersString,
          Limit: limit,
          Offset: offsetValue,
          ContentFilters: contentFiltersArray,
        },
      ],
      id: 1,
    };

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
        setTotalResults(data.result.length);
      } else if (data && data.error) {
        console.warn("API error:", data.error);
        setResults([]);
        setTotalResults(0);
      } else {
        setResults([]);
        setTotalResults(0);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setResults([]);
      setTotalResults(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setOffset(0);
    setCurrentPage(1);
    fetchResults(0);
  };

  const handleNextPage = () => {
    const limit = Number(searchParams.limit) || 50;
    const newOffset = offset + limit;
    setOffset(newOffset);
    setCurrentPage((p) => p + 1);
    fetchResults(newOffset);
  };

  const handlePreviousPage = () => {
    const limit = Number(searchParams.limit) || 50;
    const newOffset = Math.max(0, offset - limit);
    setOffset(newOffset);
    setCurrentPage((p) => Math.max(1, p - 1));
    fetchResults(newOffset);
  };

  const handleRowClick = (rowData) => {
    setSelectedRowData(rowData);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedRowData(null);
  };

  return (
    <div className="App">
      <Container>
        <h2>Analyzer</h2>
        <p className="text-muted">
          Search captured API calls. Click any row for full details.
        </p>

        <Form onSubmit={handleSubmit} className="mt-4">
          {/* Time Filters */}
          <Card className="mb-3">
            <Card.Header className="py-2">Time Range</Card.Header>
            <Card.Body className="py-2">
              <Row className="gy-2">
                <Col md={3}>
                  <Form.Group controlId="formTimeStart">
                    <Form.Label className="small mb-1">Start</Form.Label>
                    <Datetime
                      value={searchParams.timeStart}
                      onChange={(m) => handleDateChange("timeStart", m)}
                      dateFormat="YYYY-MM-DD"
                      timeFormat="HH:mm:ss"
                      inputProps={{ className: "form-control form-control-sm" }}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group controlId="formTimeEnd">
                    <Form.Label className="small mb-1">End</Form.Label>
                    <Datetime
                      value={searchParams.timeEnd}
                      onChange={(m) => handleDateChange("timeEnd", m)}
                      dateFormat="YYYY-MM-DD"
                      timeFormat="HH:mm:ss"
                      inputProps={{ className: "form-control form-control-sm" }}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group controlId="formPast">
                    <Form.Label className="small mb-1">Quick Select</Form.Label>
                    <Form.Control
                      as="select"
                      size="sm"
                      name="past"
                      value={searchParams.past}
                      onChange={handlePastChange}
                    >
                      <option value="">Select...</option>
                      {pastOptions.map((option, index) => (
                        <option key={index} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Form.Control>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group controlId="formLimit">
                    <Form.Label className="small mb-1">Results/Page</Form.Label>
                    <Form.Control
                      type="number"
                      size="sm"
                      name="limit"
                      min={1}
                      value={searchParams.limit}
                      onChange={handleLimitChange}
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Request Filters */}
          <Card className="mb-3">
            <Card.Header className="py-2">Request Filters</Card.Header>
            <Card.Body className="py-2">
              <Row className="gy-2">
                <Col md={4}>
                  <Form.Group controlId="formMethod">
                    <Form.Label className="small mb-1">Method</Form.Label>
                    <Form.Control
                      as="select"
                      size="sm"
                      name="method"
                      value={searchParams.method}
                      onChange={handleInputChange}
                    >
                      <option value="">Any Method</option>
                      {customMethods.length > 0 && (
                        <optgroup label="Custom Methods">
                          {customMethods.map((method, index) => (
                            <option key={`custom-${index}`} value={method}>
                              {method}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Common Methods">
                        {commonMethods.map((method, index) => (
                          <option key={index} value={method}>
                            {method}
                          </option>
                        ))}
                      </optgroup>
                    </Form.Control>
                    <InputGroup size="sm" className="mt-1">
                      <Form.Control
                        type="text"
                        placeholder="Add custom method..."
                        value={newMethodInput}
                        onChange={(e) => setNewMethodInput(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddMethod())}
                      />
                      <Button variant="outline-secondary" onClick={handleAddMethod}>
                        +
                      </Button>
                    </InputGroup>
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group controlId="formEncoding">
                    <Form.Label className="small mb-1">Encoding</Form.Label>
                    <Form.Control
                      as="select"
                      size="sm"
                      name="encoding"
                      value={searchParams.encoding}
                      onChange={handleInputChange}
                    >
                      {encodingOptions.map((option, index) => (
                        <option key={index} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Form.Control>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group controlId="formSource">
                    <Form.Label className="small mb-1">Source (IP)</Form.Label>
                    <Form.Control
                      type="text"
                      size="sm"
                      name="source"
                      placeholder="e.g., 127.0.0.1"
                      value={searchParams.source}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group controlId="formDestination">
                    <Form.Label className="small mb-1">Destination</Form.Label>
                    <Form.Control
                      type="text"
                      size="sm"
                      name="destination"
                      placeholder="e.g., local, CoreS"
                      value={searchParams.destination}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Content Filters */}
          <Card className="mb-3">
            <Card.Header className="py-2 d-flex justify-content-between align-items-center">
              <span>Content Filters</span>
              <Button variant="outline-primary" size="sm" onClick={addContentFilter}>
                + Add Filter
              </Button>
            </Card.Header>
            <Card.Body className="py-2">
              {contentFilters.length === 0 ? (
                <p className="text-muted small mb-0">
                  No content filters. Click "+ Add Filter" to filter by request/reply fields.
                </p>
              ) : (
                contentFilters.map((filter) => (
                  <Row key={filter.id} className="gy-1 mb-2 align-items-end">
                    <Col md={2}>
                      <Form.Control
                        as="select"
                        size="sm"
                        value={filter.type}
                        onChange={(e) =>
                          updateContentFilter(filter.id, "type", e.target.value)
                        }
                      >
                        {contentFilterTypes.map((opt, i) => (
                          <option key={i} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </Form.Control>
                    </Col>
                    <Col md={2}>
                      <Form.Control
                        as="select"
                        size="sm"
                        value={filter.path}
                        onChange={(e) =>
                          updateContentFilter(filter.id, "path", e.target.value)
                        }
                      >
                        {contentFilterPaths.map((opt, i) => (
                          <option key={i} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </Form.Control>
                    </Col>
                    <Col md={3}>
                      <Form.Control
                        type="text"
                        size="sm"
                        placeholder="Field (e.g., Event.Account)"
                        value={filter.field}
                        onChange={(e) =>
                          updateContentFilter(filter.id, "field", e.target.value)
                        }
                      />
                    </Col>
                    <Col md={4}>
                      <Form.Control
                        type="text"
                        size="sm"
                        placeholder="Value"
                        value={filter.value}
                        onChange={(e) =>
                          updateContentFilter(filter.id, "value", e.target.value)
                        }
                      />
                    </Col>
                    <Col md={1}>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => removeContentFilter(filter.id)}
                      >
                        X
                      </Button>
                    </Col>
                  </Row>
                ))
              )}
              <Form.Text className="text-muted small">
                Examples: Field "Event.Account" = "1001", Field "APIOpts.EventSource" = "*attributes"
              </Form.Text>
            </Card.Body>
          </Card>

          {/* Advanced Mode Toggle */}
          <div className="mb-3">
            <Button
              variant="link"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="p-0"
            >
              {showAdvanced ? "- Hide" : "+ Show"} Raw Query Mode
            </Button>
          </div>

          {showAdvanced && (
            <Card className="mb-3">
              <Card.Header className="py-2">Raw Query Mode</Card.Header>
              <Card.Body className="py-2">
                <Row>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="small mb-1">Header Filters (Bleve syntax)</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        size="sm"
                        placeholder='+RequestMethod:"CoreSv1.Ping" +RequestEncoding:\*json'
                        value={rawHeaderFilters}
                        onChange={(e) => setRawHeaderFilters(e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="small mb-1">Content Filters (one per line)</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        size="sm"
                        placeholder="*string:~*req.Event.Account:1001"
                        value={rawContentFilters}
                        onChange={(e) => setRawContentFilters(e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Text className="text-muted small">
                  Raw mode overrides the visual filters above. See{" "}
                  <a href="http://blevesearch.com/docs/Query-String-Query/" target="_blank" rel="noopener noreferrer">
                    Bleve docs
                  </a>{" "}
                  for header filter syntax.
                </Form.Text>
              </Card.Body>
            </Card>
          )}

          <Button type="submit" className="w-100 mb-3">
            Search
          </Button>
        </Form>

        {isLoading ? (
          <div className="text-center mt-4">
            <Spinner animation="border" role="status">
              <span className="sr-only">Loading...</span>
            </Spinner>
            <p>Searching analyzer data...</p>
          </div>
        ) : (
          <pre className="mt-3 small" style={{ maxHeight: "100px", overflow: "auto" }}>
            {apiQuery}
          </pre>
        )}

        <p className="small">
          Response from <b>{cgratesConfig.url}</b>
          {responseTime && !isLoading && ` in ${responseTime}s`}
          {totalResults > 0 && (
            <Badge bg="secondary" className="ms-2">
              {totalResults} results (page {currentPage})
            </Badge>
          )}
        </p>

        <Table striped bordered hover size="sm" className="mt-3">
          <thead>
            <tr>
              <th>#</th>
              <th>Time</th>
              <th>Method</th>
              <th>Duration</th>
              <th>Encoding</th>
              <th>Source</th>
              <th>Reply</th>
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
                  <td>{offset + index + 1}</td>
                  <td>
                    {result.RequestStartTime
                      ? moment(result.RequestStartTime).format("MM-DD HH:mm:ss")
                      : "-"}
                  </td>
                  <td>
                    <code className="small">{result.RequestMethod || "-"}</code>
                  </td>
                  <td>{result.RequestDuration || "-"}</td>
                  <td>
                    <Badge
                      bg={
                        result.RequestEncoding === "*json"
                          ? "primary"
                          : result.RequestEncoding === "*internal"
                          ? "secondary"
                          : "info"
                      }
                    >
                      {result.RequestEncoding?.replace("*", "") || "-"}
                    </Badge>
                  </td>
                  <td className="small">{result.RequestSource || "-"}</td>
                  <td>
                    {result.ReplyError ? (
                      <Badge bg="danger">{formatReplyForDisplay(result.ReplyError)}</Badge>
                    ) : (
                      <Badge bg="success">{formatReplyForDisplay(result.Reply)}</Badge>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="text-center">
                  No results available
                </td>
              </tr>
            )}
          </tbody>
        </Table>

        <Pagination className="justify-content-center mt-3">
          <Pagination.Prev
            disabled={offset === 0 || isLoading}
            onClick={handlePreviousPage}
          />
          <Pagination.Item disabled>
            Page {currentPage} {totalResults > 0 && `(${totalResults} results)`}
          </Pagination.Item>
          <Pagination.Next
            disabled={totalResults < (Number(searchParams.limit) || 50) || isLoading}
            onClick={handleNextPage}
          />
        </Pagination>
      </Container>

      {/* Modal for Row Details */}
      <Modal show={showModal} onHide={handleCloseModal} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>
            {selectedRowData?.RequestMethod || "Request Details"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedRowData ? (
            <div>
              <Row className="mb-3">
                <Col md={6}>
                  <Table size="sm" bordered>
                    <tbody>
                      <tr>
                        <th style={{ width: "40%" }}>Method</th>
                        <td><code>{selectedRowData.RequestMethod}</code></td>
                      </tr>
                      <tr>
                        <th>Request ID</th>
                        <td>{selectedRowData.RequestID}</td>
                      </tr>
                      <tr>
                        <th>Start Time</th>
                        <td>
                          {selectedRowData.RequestStartTime
                            ? moment(selectedRowData.RequestStartTime).format(
                                "YYYY-MM-DD HH:mm:ss.SSS"
                              )
                            : "-"}
                        </td>
                      </tr>
                      <tr>
                        <th>Duration</th>
                        <td>{selectedRowData.RequestDuration}</td>
                      </tr>
                    </tbody>
                  </Table>
                </Col>
                <Col md={6}>
                  <Table size="sm" bordered>
                    <tbody>
                      <tr>
                        <th style={{ width: "40%" }}>Encoding</th>
                        <td>{selectedRowData.RequestEncoding}</td>
                      </tr>
                      <tr>
                        <th>Source</th>
                        <td>{selectedRowData.RequestSource || "-"}</td>
                      </tr>
                      <tr>
                        <th>Destination</th>
                        <td>{selectedRowData.RequestDestination}</td>
                      </tr>
                      <tr>
                        <th>Reply Status</th>
                        <td>
                          {selectedRowData.ReplyError ? (
                            <Badge bg="danger">{formatReplyForDisplay(selectedRowData.ReplyError)}</Badge>
                          ) : (
                            <Badge bg="success">OK</Badge>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </Table>
                </Col>
              </Row>

              <h6>Request Parameters</h6>
              <CollapsibleJSON
                data={parseReplyForViewer(selectedRowData.RequestParams)}
                initialExpanded={false}
              />

              <h6>Reply {selectedRowData.ReplyError && <Badge bg="danger" className="ms-2">Error</Badge>}</h6>
              <div
                style={{
                  backgroundColor: selectedRowData.ReplyError ? "#fff5f5" : "#f0fff0",
                  padding: "1rem",
                  borderRadius: "4px",
                }}
              >
                <CollapsibleJSON
                  data={parseReplyForViewer(
                    selectedRowData.ReplyError || selectedRowData.Reply
                  )}
                  initialExpanded={false}
                />
              </div>
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
    </div>
  );
};

export default Analyzer;
