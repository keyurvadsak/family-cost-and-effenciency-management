import { Navigate } from 'react-router-dom';

/**
 * DashboardPortal has been refactored into dedicated modular pages:
 * - /dashboard -> DashboardPage
 * - /dashboard/expenses -> ExpensesPage
 * - /dashboard/business -> BusinessPage
 * - /dashboard/admin -> AdminPage
 */
export default function DashboardPortal() {
  return <Navigate to="/dashboard" replace />;
}
