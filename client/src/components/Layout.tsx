import {
  BarChart3,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { avatarColor, initials } from "../lib/avatar";
import { InstallButton } from "./InstallButton";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";

const navItems = [
  { to: "/dashboard", key: "nav.dashboard", Icon: LayoutDashboard },
  { to: "/clients", key: "nav.clients", Icon: Users },
  { to: "/commandes", key: "nav.orders", Icon: Package },
  { to: "/paiements", key: "nav.payments", Icon: Wallet },
  { to: "/rapports", key: "nav.reports", Icon: BarChart3 },
  { to: "/parametres", key: "nav.settings", Icon: Settings },
];

export function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const name = user?.nom ?? "—";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside className="flex w-60 flex-col border-r bg-white dark:bg-slate-900">
        <div className="border-b px-5 py-4">
          <p className="text-lg font-bold leading-tight">{t("app.name")}</p>
          <p className="text-xs text-slate-400">{t("app.tagline")}</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map(({ to, key, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/commandes/new"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-slate-800 text-white dark:bg-slate-700"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`
              }
            >
              <Icon size={18} />
              {t(key)}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end gap-4 border-b bg-white px-6 py-3 dark:bg-slate-900">
          <InstallButton />
          <ThemeToggle />
          <LanguageSwitcher />
          <div className="flex items-center gap-2">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${avatarColor(name)}`}
            >
              {initials(name)}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">{name}</p>
              <p className="text-xs text-slate-400">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title={t("nav.logout")}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800"
          >
            <LogOut size={18} />
          </button>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
