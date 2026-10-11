import { Navigate } from "react-router-dom";

// Pembatas di sisi tampilan saja. Pengaman sebenarnya ada di backend (require_super_admin),
// jadi admin biasa yang mengubah localStorage tetap tidak bisa memakai endpoint-nya.
export default function SuperAdminRoute({ children }) {
  const role = localStorage.getItem("admin_role");
  if (role !== "super_admin") {
    return <Navigate to="/" replace />;
  }
  return children;
}
