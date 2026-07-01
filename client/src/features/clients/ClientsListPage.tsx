import { formatMoney, type Lang } from "@gca/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Pencil, Phone, Plus, Receipt, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { avatarColor, initials } from "../../lib/avatar";
import { archiveClient, fetchClients, type SortKey } from "./api";

export function ClientsListPage() {
  const { t, i18n } = useTranslation(["clients", "common"]);
  const lang = (i18n.resolvedLanguage as Lang) ?? "fr";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(id);
  }, [search]);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients", debounced, sort],
    queryFn: () => fetchClients(debounced, sort),
  });

  const archive = useMutation({
    mutationFn: archiveClient,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });

  const handleArchive = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(t("clients:detail.archiveConfirm"))) archive.mutate(id);
  };
  const handleEdit = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/clients/${id}/edit`);
  };

  const count = clients?.length ?? 0;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-white">
            <Users size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("clients:title")}</h1>
            <p className="text-sm text-slate-400">{t("clients:count", { count })}</p>
          </div>
        </div>
        <Link
          to="/clients/new"
          className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-700"
        >
          <Plus size={18} /> {t("clients:new")}
        </Link>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("clients:searchPlaceholder")}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        >
          <option value="recent">{t("clients:sort.recent")}</option>
          <option value="nom">{t("clients:sort.nom")}</option>
          <option value="solde">{t("clients:sort.solde")}</option>
        </select>
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-slate-400">{t("common:common.loading")}</p>
      ) : count === 0 ? (
        <p className="rounded-xl border border-dashed bg-white dark:bg-slate-900 py-12 text-center text-slate-400">
          {debounced ? t("clients:noResults") : t("clients:empty")}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients!.map((c) => (
            <Link
              key={c.id}
              to={`/clients/${c.id}`}
              className="group relative rounded-xl border bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition group-hover:opacity-100">
                <button
                  onClick={(e) => handleEdit(e, c.id)}
                  title={t("common:actions.edit")}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={(e) => handleArchive(e, c.id)}
                  title={t("common:actions.delete")}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="mb-4 flex items-center gap-3">
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold ${avatarColor(c.nom)}`}
                >
                  {initials(c.nom)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{c.nom}</p>
                  <p className="flex items-center gap-1 text-xs text-slate-400">
                    <Phone size={11} /> {c.telephone}
                  </p>
                </div>
              </div>

              {c.adresse && (
                <p className="mb-3 flex items-center gap-1 truncate text-xs text-slate-400">
                  <MapPin size={11} /> {c.adresse}
                </p>
              )}

              <div className="flex items-end justify-between border-t pt-3">
                <div>
                  <p className="text-xs text-slate-400">{t("clients:solde")}</p>
                  <p
                    className={`text-lg font-bold tabular-nums ${c.solde > 0 ? "text-rose-600" : "text-emerald-600"}`}
                  >
                    {formatMoney(c.solde, lang)}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  <Receipt size={12} /> {c.nbCommandes} {t("clients:orders")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
