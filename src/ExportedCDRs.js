import React from 'react';
import { Container } from 'react-bootstrap';

const ExportedCDRs = ({ cgratesConfig }) => {
  const baseUrl = cgratesConfig.url.replace(/:(?!.*:).*/, ''); // Extract base URL, removing everything after the last colon

  return (
    <Container className="mt-4">
      <h1>Exported CDRs</h1>
      <p>Exported CDRs are available for download in CSV format - For this to work your exports must go to the /tmp directory on your CGrateS machine and your Apache / NGINX config must be setup to allow access to these CSV files (be safe!).</p>
      <iframe
        src={`${baseUrl}/csv/`}
        style={{ width: '100%', height: '80vh', border: 'none' }}
        title="Exported CDRs"
      ></iframe>
    </Container>
  );
};

export default ExportedCDRs;