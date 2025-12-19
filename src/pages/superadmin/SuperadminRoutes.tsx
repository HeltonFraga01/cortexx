import { Routes, Route, Navigate } from 'react-router-dom';
import SuperadminLayout from '@/components/superadmin/SuperadminLayout';
import SuperadminDashboard from './SuperadminDashboard';
import TenantManagement from './TenantManagement';
import TenantDetails from './TenantDetails';
import SuperadminSettings from './SuperadminSettings';

/**
 * SuperadminRoutes Component
 * Requirements: 1.1, 1.3, 4.3 - Nested routing with layout
 */
const SuperadminRoutes = () => {
  return (
    <SuperadminLayout>
      <Routes>
        <Route path="dashboard" element={<SuperadminDashboard />} />
        <Route path="tenants" element={<TenantManagement />} />
        <Route path="tenants/new" element={<TenantManagement />} />
        <Route path="tenants/:id" element={<TenantDetails />} />
        <Route path="settings" element={<SuperadminSettings />} />
        <Route path="*" element={<Navigate to="/superadmin/dashboard" replace />} />
      </Routes>
    </SuperadminLayout>
  );
};

export default SuperadminRoutes;
