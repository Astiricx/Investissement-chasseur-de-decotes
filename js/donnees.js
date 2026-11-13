/* Structure des données du portefeuille (format JSON, version 1) et remise en forme
   de tout ce qui vient de l'extérieur (sauvegarde restaurée, import CSV, saisie). */
(function (racine) {
  "use strict";
  const VERSION = 1;

  /* Format :
     {
       version: 1,
       parametres: { capitalDepart, cash, relais },
       lignes:  [{ id, nom, code, classe, place, enveloppe, quantite, prixRevient, cours, dateCours, objectif,
                   solvabilite, bilanSolide, dateResultats, notes }],
       journal: [{ id, date, type, nom, code, quantite, prix, frais, total, plusValue, note }],
       historique: [{ date, titres, cash }]          (un point par jour, pour la courbe d'évolution)
       analyses: [{ id, outil, nom, valeurs, modifieLe }]   (fiches enregistrées des outils d'analyse)
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
  /** Classes d'actifs. Le cash est suivi à part (paramètre « cash disponible »). */
  const CLASSES = Object.freeze({ decote: "Actions décotées", etf: "ETF", or: "Or et matières premières" });
  const OUTILS = Object.freeze(["vann", "rapp", "holding", "mine"]);
  const MAX_HISTORIQUE = 3700, MAX_ANALYSES = 300;
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

  /** « ETF », « Or physique », « Mines d'or », « Net-Estate (VANE) »… → clé de CLASSES, ou null. */
  function classeDepuisTexte(v) {
    const brut = texte(v, 60);
    if (!brut) return null;
    if (Object.prototype.hasOwnProperty.call(CLASSES, brut)) return brut;
    const s = simplifier(brut);
    if (/etf|tracker|fonds indiciel|indice/.test(s)) return "etf";
    if (/\bor\b|gold|argent|silver|mine|matiere|metal|commodit/.test(s)) return "or";
    return "decote";
  }

  function normaliserLigne(l) {
    l = l && typeof l === "object" ? l : {};
    return {
      id: texte(l.id, 64) || identifiant(),
      nom: texte(l.nom, 120),
      // Lettres, chiffres, point et tiret uniquement : le code part dans une adresse web.
      code: texte(l.code, 24).toUpperCase().replace(/[^A-Z0-9.\-=]/g, ""),
      classe: classeDepuisTexte(l.classe) || "decote",
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

  function normaliserPoint(h) {
    h = h && typeof h === "object" ? h : {};
    const d = date(h.date), titres = positif(h.titres), cash = positif(h.cash);
    return d && titres !== null && cash !== null ? { date: d, titres, cash } : null;
  }

  /** Fiche d'analyse : valeurs plates (nombre, texte court ou vide), clés simples. */
  function normaliserAnalyse(a) {
    a = a && typeof a === "object" ? a : {};
    if (!OUTILS.includes(a.outil)) return null;
    const valeurs = {};
    const source = a.valeurs && typeof a.valeurs === "object" && !Array.isArray(a.valeurs) ? a.valeurs : {};
    for (const [k, v] of Object.entries(source).slice(0, 200)) {
      if (!/^[A-Za-z0-9_]{1,40}$/.test(k)) continue;
      if (nombre(v) !== null) valeurs[k] = v;
      else if (typeof v === "string") valeurs[k] = v.slice(0, 200);
    }
    const nom = texte(a.nom, 120);
    return nom ? { id: texte(a.id, 64) || identifiant(), outil: a.outil, nom, valeurs, modifieLe: typeof a.modifieLe === "string" ? a.modifieLe.slice(0, 40) : new Date().toISOString() } : null;
  }

  /** Enregistre (ou remplace) le point du jour de l'historique de valeur. */
  function noterHistorique(pf, jour, titres, cash) {
    const point = normaliserPoint({ date: jour, titres, cash });
    if (!point) return;
    const i = pf.historique.findIndex((h) => h.date === point.date);
    if (i >= 0) pf.historique[i] = point; else pf.historique.push(point);
    pf.historique.sort((a, b) => a.date.localeCompare(b.date));
    if (pf.historique.length > MAX_HISTORIQUE) pf.historique.splice(0, pf.historique.length - MAX_HISTORIQUE);
  }

  function nouveauPortefeuille() {
    return {
      version: VERSION, parametres: { capitalDepart: 10000, cash: 10000, relais: "" },
      lignes: [], journal: [], historique: [], analyses: [], coursActualisesLe: null, modifieLe: new Date().toISOString(),
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
      historique: (Array.isArray(o.historique) ? o.historique : []).slice(-MAX_HISTORIQUE).map(normaliserPoint).filter(Boolean)
        .sort((a, b) => a.date.localeCompare(b.date)).filter((h, i, t) => i === t.length - 1 || h.date !== t[i + 1].date),
      analyses: (Array.isArray(o.analyses) ? o.analyses : []).slice(0, MAX_ANALYSES).map(normaliserAnalyse).filter(Boolean),
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

  const api = { VERSION, PLACES, PLACE_DEFAUT, RELAIS, TYPES_OPERATION, CLASSES, OUTILS, placeDepuisTexte, classeDepuisTexte,
    normaliserAnalyse, noterHistorique, MAX_ANALYSES,
    nouveauPortefeuille, normaliser, normaliserLigne, normaliserOperation, ajouterLignes };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else racine.DecotesDonnees = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
