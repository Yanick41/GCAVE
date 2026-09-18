/**
 * Lecture d'un fichier CSV de clients — analyseur PARTAGÉ client/serveur.
 *
 * Écrit après la perte de données du 2026-09-18 : ressaisir des centaines de
 * fiches une par une dans un formulaire n'était pas tenable. Le commerçant
 * tient déjà ses clients dans un tableur ou sur un cahier ; on lui demande donc
 * un fichier, pas des heures de frappe.
 *
 * Fonctions PURES, sans accès réseau ni DOM : le navigateur s'en sert pour
 * l'aperçu avant import, et elles restent éprouvables en dehors de lui.
 *
 * Le tableur français est la norme ici : séparateur « ; », virgule décimale,
 * espaces comme séparateurs de milliers, et un BOM en tête de fichier qu'Excel
 * ajoute sans le dire. Tout cela est absorbé silencieusement.
 */

/** Champ de la fiche client reconnu dans l'en-tête du fichier. */
export type ChampClient = "nom" | "telephone" | "email" | "adresse" | "soldeInitial";

export interface ClientImporte {
  nom: string;
  telephone: string;
  email?: string;
  adresse?: string;
  soldeInitial?: number;
}

export interface RejetImport {
  /** Numéro de ligne dans le fichier, en-tête comprise : celui qu'affiche le tableur. */
  ligne: number;
  valeurs: string[];
  motif: "NOM_MANQUANT" | "TELEPHONE_MANQUANT" | "DOUBLON_FICHIER" | "LIGNE_VIDE";
}

export interface ImportAnalyse {
  entetes: string[];
  /** Colonnes reconnues → indice dans la ligne. */
  colonnes: Partial<Record<ChampClient, number>>;
  clients: ClientImporte[];
  rejets: RejetImport[];
}

/**
 * Séparateur du fichier, déduit de la ligne d'en-tête : celui qui y apparaît le
 * plus souvent. Deviner vaut mieux qu'imposer — un tableur francophone écrit
 * « ; », un export anglophone « , », un copier-coller depuis un tableau « \t ».
 */
export function detecterSeparateur(entete: string): string {
  const candidats = [";", ",", "\t"];
  let meilleur = ";";
  let max = -1;
  for (const c of candidats) {
    const n = entete.split(c).length - 1;
    if (n > max) {
      max = n;
      meilleur = c;
    }
  }
  return max > 0 ? meilleur : ";";
}

/**
 * Découpe un CSV en lignes de cellules, en respectant les guillemets : une
 * adresse contenant le séparateur (« Abidjan, Cocody ») ne doit pas exploser en
 * deux colonnes. Un guillemet doublé à l'intérieur d'un champ vaut un guillemet.
 */
export function analyserCsv(texte: string, separateur?: string): string[][] {
  // BOM d'Excel : invisible, mais il colle au premier en-tête et le rend
  // méconnaissable (« ﻿nom » ne vaut pas « nom »).
  const net = texte.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const sep = separateur ?? detecterSeparateur(net.split("\n")[0] ?? "");

  const lignes: string[][] = [];
  let cellule = "";
  let ligne: string[] = [];
  let entreGuillemets = false;

  for (let i = 0; i < net.length; i++) {
    const c = net[i];
    if (entreGuillemets) {
      if (c === '"') {
        if (net[i + 1] === '"') {
          cellule += '"';
          i++;
        } else entreGuillemets = false;
      } else cellule += c;
      continue;
    }
    if (c === '"') entreGuillemets = true;
    else if (c === sep) {
      ligne.push(cellule);
      cellule = "";
    } else if (c === "\n") {
      ligne.push(cellule);
      lignes.push(ligne);
      ligne = [];
      cellule = "";
    } else cellule += c;
  }
  ligne.push(cellule);
  lignes.push(ligne);
  return lignes;
}

/** Sans accents, sans ponctuation, en minuscules : « Téléphone » = « telephone ». */
function normaliser(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const SYNONYMES: Record<ChampClient, string[]> = {
  nom: ["nom", "client", "nomclient", "name", "raisonsociale", "nomduclient"],
  telephone: ["telephone", "tel", "phone", "contact", "numero", "mobile", "portable"],
  email: ["email", "mail", "courriel", "adresseemail"],
  adresse: ["adresse", "address", "localisation", "quartier", "ville"],
  soldeInitial: ["soldeinitial", "solde", "dette", "creance", "anciensolde", "montantdu", "du"],
};

/** Associe chaque colonne du fichier au champ de la fiche client. */
export function reconnaitreColonnes(entetes: string[]): Partial<Record<ChampClient, number>> {
  const colonnes: Partial<Record<ChampClient, number>> = {};
  entetes.forEach((brut, i) => {
    const e = normaliser(brut);
    for (const [champ, mots] of Object.entries(SYNONYMES) as [ChampClient, string[]][]) {
      if (colonnes[champ] === undefined && mots.includes(e)) colonnes[champ] = i;
    }
  });
  return colonnes;
}

/**
 * Montant écrit à la main ou par un tableur : « 15 000,50 », « 15000.5 ».
 * Un séparateur de milliers pris pour une décimale diviserait la créance par
 * mille — on retire donc espaces et apostrophes avant toute chose.
 */
export function nombreDepuisTexte(texte: string): number {
  const net = (texte ?? "").replace(/[\s  ']/g, "").replace(",", ".");
  const n = parseFloat(net);
  return Number.isFinite(n) ? n : 0;
}

/** Deux numéros ne diffèrent pas par leurs espaces ou leurs tirets. */
const cleTelephone = (t: string) => t.replace(/[^0-9+]/g, "");

/**
 * Analyse complète d'un fichier : colonnes reconnues, fiches valides, et
 * lignes écartées AVEC leur motif — une ligne rejetée en silence serait un
 * client perdu sans que personne ne le sache.
 */
export function analyserImportClients(texte: string): ImportAnalyse {
  const lignes = analyserCsv(texte);
  const entetes = (lignes[0] ?? []).map((e) => e.trim());
  const colonnes = reconnaitreColonnes(entetes);

  const clients: ClientImporte[] = [];
  const rejets: RejetImport[] = [];
  const vus = new Set<string>();

  const cellule = (l: string[], champ: ChampClient) => {
    const i = colonnes[champ];
    return i === undefined ? "" : (l[i] ?? "").trim();
  };

  for (let i = 1; i < lignes.length; i++) {
    const l = lignes[i];
    const numero = i + 1; // 1 pour l'en-tête, comme dans le tableur
    if (l.every((c) => c.trim() === "")) continue; // ligne vide en fin de fichier

    const nom = cellule(l, "nom");
    const telephone = cellule(l, "telephone");
    if (!nom) {
      rejets.push({ ligne: numero, valeurs: l, motif: "NOM_MANQUANT" });
      continue;
    }
    if (!telephone) {
      rejets.push({ ligne: numero, valeurs: l, motif: "TELEPHONE_MANQUANT" });
      continue;
    }
    const cle = cleTelephone(telephone);
    if (vus.has(cle)) {
      rejets.push({ ligne: numero, valeurs: l, motif: "DOUBLON_FICHIER" });
      continue;
    }
    vus.add(cle);

    const email = cellule(l, "email");
    const adresse = cellule(l, "adresse");
    const solde = cellule(l, "soldeInitial");
    clients.push({
      nom,
      telephone,
      // Un email mal formé ne doit pas faire perdre la fiche entière : il est
      // simplement omis, le reste de la fiche vaut mieux que rien.
      ...(email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? { email } : {}),
      ...(adresse ? { adresse } : {}),
      ...(solde ? { soldeInitial: nombreDepuisTexte(solde) } : {}),
    });
  }

  return { entetes, colonnes, clients, rejets };
}
