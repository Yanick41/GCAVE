/**
 * Sélecteur de client avec recherche — remplace la liste déroulante native.
 *
 * Une liste `<select>` impose de faire défiler des centaines de clients dans
 * l'ordre où la base les renvoie. Ici on tape le nom, la liste se réduit à
 * chaque frappe, et l'ordre est ALPHABÉTIQUE quoi que renvoie l'API.
 *
 * La recherche ignore accents et casse : « nene » trouve « NÉNÉ ». Sans cela
 * le filtre serait inutilisable sur des noms saisis avec ou sans accents.
 */
import { ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export interface ClientOption {
  id: string;
  nom: string;
  telephone: string;
}

/** Abaisse la casse et retire les accents, pour une comparaison tolérante. */
function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marques diacritiques combinantes
    .toLowerCase();
}

/** Libellé affiché dans le champ et dans la liste. */
function etiquette(c: ClientOption): string {
  return c.telephone ? `${c.nom} · ${c.telephone}` : c.nom;
}

export function SelecteurClient({
  clients,
  valeur,
  onChange,
  onValider,
  libelleLibre,
  placeholder,
  aucunResultat,
  champRef,
  className = "",
}: {
  clients: ClientOption[];
  /** Identifiant du client retenu ; "" = client ponctuel (saisie libre). */
  valeur: string;
  onChange: (id: string) => void;
  /** Appelé après un choix : permet d'enchaîner sur le champ suivant. */
  onValider?: () => void;
  libelleLibre: string;
  placeholder: string;
  aucunResultat: string;
  champRef?: (el: HTMLInputElement | null) => void;
  className?: string;
}) {
  // null = on affiche le client retenu ; une chaîne = recherche en cours.
  const [requete, setRequete] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [surligne, setSurligne] = useState(0);
  const conteneur = useRef<HTMLDivElement>(null);

  const selectionne = clients.find((c) => c.id === valeur) ?? null;
  const affichage = requete ?? (selectionne ? etiquette(selectionne) : "");

  // Tri alphabétique d'abord, filtrage ensuite : l'ordre ne dépend jamais de
  // celui renvoyé par l'API (qui classe par date de création).
  const resultats = useMemo(() => {
    const q = normaliser(requete ?? "");
    const chiffres = q.replace(/\D/g, "");
    return [...clients]
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }))
      .filter((c) => {
        if (!q) return true;
        if (normaliser(c.nom).includes(q)) return true;
        // Recherche par téléphone : on compare chiffre à chiffre, les
        // espaces de saisie ne doivent pas faire échouer la correspondance.
        return chiffres.length > 0 && c.telephone.replace(/\D/g, "").includes(chiffres);
      });
  }, [clients, requete]);

  // Le client ponctuel ferme toujours la liste : en tapant un nom, les vrais
  // clients remontent d'abord, et l'option reste accessible juste en dessous.
  const nbOptions = resultats.length + 1;
  const indexLibre = resultats.length;

  useEffect(() => setSurligne(0), [requete]);

  // Refermer au clic en dehors
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => {
      if (!conteneur.current?.contains(e.target as Node)) {
        setOuvert(false);
        setRequete(null);
      }
    };
    document.addEventListener("mousedown", dehors);
    return () => document.removeEventListener("mousedown", dehors);
  }, [ouvert]);

  const choisir = (id: string) => {
    onChange(id);
    setRequete(null);
    setOuvert(false);
    onValider?.();
  };

  const auClavier = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!ouvert) setOuvert(true);
      setSurligne((i) => (e.key === "ArrowDown" ? (i + 1) % nbOptions : (i - 1 + nbOptions) % nbOptions));
      return;
    }
    if (e.key === "Escape") {
      setOuvert(false);
      setRequete(null);
      return;
    }
    if (e.key === "Enter") {
      // Jamais d'envoi du formulaire : Entrée choisit, ou passe au champ suivant.
      e.preventDefault();
      if (ouvert) choisir(surligne === indexLibre ? "" : resultats[surligne].id);
      else onValider?.();
    }
  };

  return (
    <div className={`relative ${className}`} ref={conteneur}>
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          ref={champRef}
          role="combobox"
          aria-expanded={ouvert}
          aria-autocomplete="list"
          value={affichage}
          placeholder={placeholder}
          onChange={(e) => {
            setRequete(e.target.value);
            setOuvert(true);
          }}
          onFocus={() => setOuvert(true)}
          onKeyDown={auClavier}
          className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-9 outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-900"
        />
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </div>

      {ouvert && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
        >
          {resultats.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-400">{aucunResultat}</li>
          )}
          {resultats.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === surligne}
                // mousedown plutôt que click : le blur du champ refermerait la
                // liste avant que le clic n'aboutisse.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choisir(c.id);
                }}
                onMouseEnter={() => setSurligne(i)}
                className={`block w-full px-3 py-2 text-left text-sm ${
                  i === surligne
                    ? "bg-blue-600 text-white"
                    : "text-slate-700 dark:text-slate-200"
                }`}
              >
                {etiquette(c)}
              </button>
            </li>
          ))}
          <li className="mt-1 border-t border-slate-200 pt-1 dark:border-slate-700">
            <button
              type="button"
              role="option"
              aria-selected={surligne === indexLibre}
              onMouseDown={(e) => {
                e.preventDefault();
                choisir("");
              }}
              onMouseEnter={() => setSurligne(indexLibre)}
              className={`block w-full px-3 py-2 text-left text-sm italic ${
                surligne === indexLibre
                  ? "bg-blue-600 text-white"
                  : "text-slate-500 dark:text-slate-300"
              }`}
            >
              {libelleLibre}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
