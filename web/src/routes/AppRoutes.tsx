import { Navigate, useRoutes } from "react-router-dom";

import AdminLayout from "@/components/admin/AdminLayout";
import CollaboratorLayout from "@/components/collaborator/CollaboratorLayout";
import { Dashboard } from "@/pages/admin";
import {
  Dashboard as CollaboratorDashboard,
} from "@/pages/collaborator";
import {
  CollaboratorRequest,
  Details,
  Home,
  LandmarkMap,
  NotFoundPage,
  Profile,
  SignIn,
  SignUp,
} from "@/pages/normal-user";

const AppRoutes = () => {
  return useRoutes([
    {
      path: "/admin",
      element: <AdminLayout />,
      children: [
        { index: true, element: <Navigate to="dashboard" replace /> },
        { path: "dashboard", element: <Dashboard /> },
        { path: "*", element: <NotFoundPage /> },
      ],
    },
    {
      path: "/collaborator",
      element: <CollaboratorLayout />,
      children: [
        { index: true, element: <Navigate to="dashboard" replace /> },
        { path: "dashboard", element: <CollaboratorDashboard /> },
        { path: "*", element: <NotFoundPage /> },
      ],
    },
    { path: "/", element: <Home /> },
    { path: "/sign-in", element: <SignIn /> },
    { path: "/sign-up", element: <SignUp /> },
    { path: "/profile", element: <Profile /> },
    { path: "/collaborator-request", element: <CollaboratorRequest /> },
    { path: "/landmark-map", element: <LandmarkMap /> },
    { path: "/landmark-map/:cityId", element: <LandmarkMap /> },
    { path: "/:cityId/details", element: <Details /> },
    { path: "*", element: <NotFoundPage /> },
  ]);
};

export default AppRoutes;
