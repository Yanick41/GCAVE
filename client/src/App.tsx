import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { SoonPage } from "./components/SoonPage";
import { LoginPage } from "./features/auth/LoginPage";
import { ProtectedRoute } from "./features/auth/ProtectedRoute";
import { ClientDetailPage } from "./features/clients/ClientDetailPage";
import { ClientFormPage } from "./features/clients/ClientFormPage";
import { ClientsListPage } from "./features/clients/ClientsListPage";
import { OrderDetailPage } from "./features/commandes/OrderDetailPage";
import { OrderFormPage } from "./features/commandes/OrderFormPage";
import { OrdersListPage } from "./features/commandes/OrdersListPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { PaiementsListPage } from "./features/paiements/PaiementsListPage";
import { RapportsPage } from "./features/rapports/RapportsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />

            <Route path="/clients" element={<ClientsListPage />} />
            <Route path="/clients/new" element={<ClientFormPage />} />
            <Route path="/clients/:id" element={<ClientDetailPage />} />
            <Route path="/clients/:id/edit" element={<ClientFormPage />} />
            <Route path="/clients/:id/commandes/new" element={<OrderFormPage />} />

            <Route path="/commandes" element={<OrdersListPage />} />
            <Route path="/commandes/new" element={<OrderFormPage />} />
            <Route path="/commandes/:id" element={<OrderDetailPage />} />

            <Route path="/paiements" element={<PaiementsListPage />} />
            <Route path="/rapports" element={<RapportsPage />} />
            <Route path="/parametres" element={<SoonPage titleKey="nav.settings" />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
