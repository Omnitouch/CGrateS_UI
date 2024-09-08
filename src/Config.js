import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Table, Modal, Spinner, Accordion, Card, ListGroup } from 'react-bootstrap';

const Config = ({ cgratesConfig }) => {
  //render cgratesConfig.json_config
  return (
    <pre>
      {JSON.stringify(cgratesConfig.json_config, null, 2)}
    </pre>
  );
};

export default Config;
