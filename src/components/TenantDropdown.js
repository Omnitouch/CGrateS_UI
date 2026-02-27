import React from 'react';
import { Form } from 'react-bootstrap';

/**
 * Reusable tenant dropdown component.
 * Use with the useTenant hook for automatic config sync.
 *
 * @param {string} value - Current selected tenant
 * @param {function} onChange - Callback when tenant changes (receives tenant string)
 * @param {string[]} tenantList - List of available tenants
 * @param {string} [label] - Optional label (defaults to "Tenant")
 */
const TenantDropdown = ({ value, onChange, tenantList, label = "Tenant" }) => {
  const handleChange = (e) => {
    onChange(e.target.value);
  };

  return (
    <Form.Group controlId="formTenant">
      <Form.Label>{label}</Form.Label>
      <Form.Control
        as="select"
        name="tenant"
        value={value}
        onChange={handleChange}
      >
        {tenantList.map((tenant, index) => (
          <option key={index} value={tenant}>
            {tenant}
          </option>
        ))}
      </Form.Control>
    </Form.Group>
  );
};

export default TenantDropdown;
