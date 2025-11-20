import { Outlet } from "react-router-dom";
import AdminSidebar from "./Sidebar";

const AdminLayout = () => {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <AdminSidebar />
      <div className="flex flex-1 flex-col">
        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-white via-slate-50 to-emerald-50/40">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
