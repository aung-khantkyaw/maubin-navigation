import { Outlet } from "react-router-dom";

const CollaboratorLayout = () => {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <div className="flex flex-1 flex-col">
        <main className="flex-1 overflow-y-auto bg-white">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default CollaboratorLayout;
