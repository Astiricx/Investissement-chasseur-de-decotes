/* Structure des données du portefeuille (format JSON, version 1) et remise en forme
   de tout ce qui vient de l'extérieur (sauvegarde restaurée, import CSV, saisie). */
(function (racine) {
  "use strict";
  const VERSION = 1;

  /* Format :
     {
       version: 1,
       parametres: { capitalDepart, cash, relais },
       lignes:  [{ id, nom, code, place, enveloppe, quantite, prixRevient, cours, dateCours, objectif,
                   solvabilite, bilanSolide, dateResultats, notes }],
       journal: [{ id, date, type, nom, code, quantite, prix, frais, total, plusValue, note }],
       coursActualisesLe: "2027-01-04T10:00:00.000Z" | null,
       modifieLe: "2027-01-04T10:00:00.000Z"
     }
     Tous les montants sont en euros. `place` est une clé de PLACES (place de cotation).
     Les champs ajoutés après la version 1 ont une valeur par défaut : les anciennes sauvegardes restent lisibles. */

  /** Places de cotation reconnues. Les codes propres à chaque fournisseur de cours sont dans reseau.js. */
  const PLACES = Object.freeze({
    XPAR: "Euronext Paris",
    XBRU: "Euronext Bruxelles",
    XAMS: "Euronext Amsterdam",
    XMIL: "Euronext Milan",
    XLIS: "Euronext Lisbonne",
    XOSL: "Oslo",
    XETR: "Francfort (Xetra)",
    XLON: "Londres",
    XSWX: "Zurich (SIX)",
    XTKS: "Tokyo",
    XNYS: "États-Unis (NYSE, Nasdaq)",
    AUTRE: "Autre (code Yahoo complet)",
  });
  const PLACE_DEFAUT = "XPAR";
  const RELAIS = Object.freeze(["", "corsproxy"]);
  const TYPES_OPERATION = Object.freeze(["achat", "vente", "dividende"]);

  function identifiant() {
    const c = racine.crypto;
    if (c && c.randomUUID) return c.randomUUID();
    const o = new Uint8Array(16); c.getRandomValues(o);
    return Array.from(o, (x) => x.toString(16).padStart(2, "0")).join("");
  }
  const texte = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "");
  const nombre = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const positif = (v) => (nombre(v) !== null && v >= 0 ? v : null);
  const date = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);
  const simplifier = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  /** « Euronext Paris », « XPAR », « Oslo Børs »… → clé de PLACES, ou null si inconnu. */
  function placeDepuisTexte(v) {
    const brut = texte(v, 60);
    if (!brut) return null;
    if (Object.prototype.hasOwnProperty.call(PLACES, brut.toUpperCase())) return brut.toUpperCase();
    const s = simplifier(brut);
    const correspondances = [
      [/paris|euronext growth|alternext/, "XPAR"], [/bruxelles|brussels/, "XBRU"], [/amsterdam/, "XAMS"],
      [/milan|borsa italiana/, "XMIL"], [/lisbonne|lisbon/, "XLIS"], [/oslo|norv/, "XOSL"],
      [/xetra|francfort|frankfurt|allemagne/, "XETR"], [/londres|london|lse/, "XLON"],
      [/zurich|six|suisse/, "XSWX"], [/tokyo|japon|japan|tse/, "XTKS"], [/nyse|nasdaq|new york|etats unis|usa/, "XNYS"],
    ];
    for (const [motif, cle] of correspondances) if (motif.test(s)) return cle;
    return null;
  }

  function normaliserLigne(l) {
    l = l && typeof l === "object" ? l : {};
    return {
      id: texte(l.id, 64) || identifiant(),
      nom: texte(l.nom, 120),
      // Lettres, chiffres, point et tiret uniquement : le code part dans une adresse web.
      code: texte(l.code, 24).toUpperCase().replace(/[^A-Z0-9.\-]/g, ""),
      place: placeDepuisTexte(l.place) || PLACE_DEFAUT,
      enveloppe: ["PEA", "CTO"].includes(texte(l.enveloppe, 8).toUpperCase()) ? texte(l.enveloppe, 8).toUpperCase() : "PEA",
      quantite: positif(l.quantite),
      prixRevient: positif(l.prixRevient),
      cours: positif(l.cours),
      dateCours: date(l.dateCours),
      objectif: positif(l.objectif),
      solvabilite: nombre(l.solvabilite),
      bilanSolide: typeof l.bilanSolide === "boolean" ? l.bilanSolide : null,
      dateResultats: date(l.dateResultats),
      notes: texte(l.notes, 2000),
    };
  }

  function normaliserOperation(o) {
    o = o && typeof o === "object" ? o : {};
    return {
      id: texte(o.id, 64) || identifiant(),
      date: date(o.date),
      type: TYPES_OPERATION.includes(o.type) ? o.type : "achat",
      nom: texte(o.nom, 120), code: texte(o.code, 24).toUpperCase().replace(/[^A-Z0-9.\-]/g, ""),
      quantite: positif(o.quantite), prix: positif(o.prix), frais: positif(o.frais),
      total: nombre(o.total), plusValue: nombre(o.plusValue),
      note: texte(o.note, 500),
    };
  }

  function nouveauPortefeuille() {
    return {
      version: VERSION, parametres: { capitalDepart: 10000, cash: 10000, relais: "" },
      lignes: [], journal: [], coursActualisesLe: null, modifieLe: new Date().toISOString(),
    };
  }

  /** Vérifie et nettoie un portefeuille lu depuis le stockage ou une sauvegarde. */
  function normaliser(o) {
    if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error("Le contenu n'est pas un portefeuille.");
    if (typeof o.version !== "number" || o.version > VERSION) throw new Error("Cette sauvegarde vient d'une version plus récente de l'outil.");
    const par = o.parametres && typeof o.parametres === "object" ? o.parametres : {};
    const horodatage = (v) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v.slice(0, 40) : null);
    return {
      version: VERSION,
      parametres: {
        capitalDepart: positif(par.capitalDepart) ?? 10000,
        cash: positif(par.cash) ?? 0,
        relais: RELAIS.includes(par.relais) ? par.relais : "",
      },
      lignes: (Array.isArray(o.lignes) ? o.lignes : []).slice(0, 500).map(normaliserLigne).filter((l) => l.nom),
      journal: (Array.isArray(o.journal) ? o.journal : []).slice(0, 5000).map(normaliserOperation),
      coursActualisesLe: horodatage(o.coursActualisesLe),
      modifieLe: horodatage(o.modifieLe) || new Date().toISOString(),
    };
  }

  /** Ajoute des lignes importées. Une ligne dont le code existe déjà n'est pas ajoutée. */
  function ajouterLignes(portefeuille, nouvelles) {
    const codes = new Set(portefeuille.lignes.map((l) => l.code).filter(Boolean));
    let ajoutees = 0; const doublons = [];
    for (const brute of nouvelles) {
      const l = normaliserLigne(brute);
      if (!l.nom) continue;
      if (l.code && codes.has(l.code)) { doublons.push(l.nom); continue; }
      if (l.code) codes.add(l.code);
      portefeuille.lignes.push(l); ajoutees++;
    }
    return { ajoutees, doublons };
  }

  const api = { VERSION, PLACES, PLACE_DEFAUT, RELAIS, TYPES_OPERATION, placeDepuisTexte,
    nouveauPortefeuille, normaliser, normaliserLigne, normaliserOperation, ajouterLignes };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else racine.DecotesDonnees = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
