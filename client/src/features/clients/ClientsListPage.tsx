import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
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

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("clients:title")}</h1>
        <Link
          to="/clients/new"
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          + {t("clients:new")}
        </Link>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("clients:searchPlaceholder")}
        className="mb-4 w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
      />

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3">{t("clients:columns.name")}</th>
              <th className="px-4 py-3">{t("clients:columns.phone")}</th>
              <th className="px-4 py-3">{t("clients:columns.email")}</th>
              <th className="px-4 py-3 text-right">
                {t("clients:columns.actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  {t("common:common.loading")}
                </td>
              </tr>
            ) : !clients || clients.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  {debounced ? t("clients:noResults") : t("clients:empty")}
                </td>
              </tr>
            ) : (
              clients.map((c) => (
                <tr key={c.id} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/clients/${c.id}`} className="hover:underline">
                      {c.nom}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.telephone}</td>
                  <td className="px-4 py-3 text-slate-600">{c.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => navigate(`/clients/${c.id}`)}
                        className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        {t("common:actions.view")}
                      </button>
                      <button
                        onClick={() => navigate(`/clients/${c.id}/edit`)}
                        className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                      >
                        {t("common:actions.edit")}
                      </button>
                      <button
                        onClick={() => handleArchive(c.id)}
                        className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        {t("common:actions.delete")}
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
