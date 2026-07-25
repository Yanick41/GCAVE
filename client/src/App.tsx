import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { SoonPage } from "./components/SoonPage";
import { LoginPage } from "./features/auth/LoginPage";
import { ProtectedRoute } from "./features/auth/ProtectedRoute";
import { BonDetailPage } from "./features/bons/BonDetailPage";
import { BonFormPage } from "./features/bons/BonFormPage";
import { BonsListPage } from "./features/bons/BonsListPage";
import { ClientDetailPage } from "./features/clients/ClientDetailPage";
import { ClientFormPage } from "./features/clients/ClientFormPage";
import { ClientsListPage } from "./features/clients/ClientsListPage";
import { OrderDetailPage } from "./features/commandes/OrderDetailPage";
import { OrderFormPage } from "./features/commandes/OrderFormPage";
import { OrdersListPage } from "./features/commandes/OrdersListPage";
import { PaiementsListPage } from "./features/paiements/PaiementsListPage";
import { RappelsPage } from "./features/rappels/RappelsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/clients" replace />} />

            <Route path="/bons" element={<BonsListPage />} />
            <Route path="/bons/new" element={<BonFormPage />} />
            <Route path="/bons/:bonId/edit" element={<BonFormPage />} />
            <Route path="/bons/:id" element={<BonDetailPage />} />

            <Route path="/clients" element={<ClientsListPage />} />
            <Route path="/clients/new" element={<ClientFormPage />} />
            <Route path="/clients/:id" element={<ClientDetailPage />} />
            <Route path="/clients/:id/edit" element={<ClientFormPage />} />
            <Route path="/clients/:id/commandes/new" element={<OrderFormPage />} />
            <Route path="/clients/:id/bons/new" element={<BonFormPage />} />

            <Route path="/commandes" element={<OrdersListPage />} />
            <Route path="/commandes/new" element={<OrderFormPage />} />
            <Route path="/commandes/:orderId/edit" element={<OrderFormPage />} />
            <Route path="/commandes/:id" element={<OrderDetailPage />} />

            <Route path="/paiements" element={<PaiementsListPage />} />
            <Route path="/rappels" element={<RappelsPage />} />
            <Route path="/parametres" element={<SoonPage titleKey="nav.settings" />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/clients" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
