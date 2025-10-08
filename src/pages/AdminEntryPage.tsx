import AdminDashboard from "@/components/AdminDashboard";
import AdminLogin from "./AdminLogin";

const AdminEntryPage = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
  // If not authenticated, show login
  if (!token) {
    return <AdminLogin />;
  }
  // If authenticated, show dashboard
  return <AdminDashboard />;
};

export default AdminEntryPage;
