import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Pencil, Phone, Plus, Receipt, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { avatarColor, initials } from "../../lib/avatar";
import { archiveClient, fetchClients } from "./api";

export function ClientsListPage() {
  const { t } = useTranslation(["clients", "common"]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(id);
  }, [search]);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients", debounced],
    queryFn: () => fetchClients(debounced),
  });

  const archive = useMutation({
    mutationFn: archiveClient,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });

  const handleArchive = (id: string) => {
    if (confirm(t("clients:detail.archiveConfirm"))) archive.mutate(id);
  };

  const count = clients?.length ?? 0;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-white">
            <Users size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("clients:title")}</h1>
            <p className="text-sm text-slate-400">
              {count} {t("clients:title").toLowerCase()}
            </p>
          </div>
        </div>
        <Link
          to="/clients/new"
          className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-700"
        >
          <Plus size={18} /> {t("clients:new")}
        </Link>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("clients:searchPlaceholder")}
        className="mb-4 w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
      />

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-semibold">{t("clients:columns.name")}</th>
              <th className="px-5 py-3 font-semibold">{t("clients:columns.phone")}</th>
              <th className="px-5 py-3 font-semibold">{t("clients:columns.email")}</th>
              <th className="px-5 py-3 text-center font-semibold">
                {t("clients:detail.orders")}
              </th>
              <th className="px-5 py-3 text-right font-semibold">
                {t("clients:columns.actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                  {t("common:common.loading")}
                </td>
              </tr>
            ) : count === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                  {debounced ? t("clients:noResults") : t("clients:empty")}
                </td>
              </tr>
            ) : (
              clients!.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link
                      to={`/clients/${c.id}`}
                      className="flex items-center gap-3"
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${avatarColor(c.nom)}`}
                      >
                        {initials(c.nom)}
                      </span>
                      <span className="font-semibold text-slate-800 hover:underline">
                        {c.nom}
                      </span>
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2 text-slate-600">
                      <Phone size={14} className="text-slate-400" />
                      {c.telephone}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {c.email ? (
                      <span className="flex items-center gap-2 text-blue-600">
                        <Mail size={14} className="text-slate-400" />
                        {c.email}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      <Receipt size={12} />
                      {c._count?.commandes ?? 0}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => navigate(`/clients/${c.id}/edit`)}
                        title={t("common:actions.edit")}
                        className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleArchive(c.id)}
                        title={t("common:actions.delete")}
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
