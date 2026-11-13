/* Structure des données du portefeuille (format JSON, version 1) et remise en forme
   de tout ce qui vient de l'extérieur (sauvegarde restaurée, import CSV, saisie). */
(function (racine) {
  "use strict";
  const VERSION = 1;

  /* Format :
     {
       version: 1,
       parametres: { capitalDepart, cash },
       lignes:  [{ id, nom, code, enveloppe, quantite, prixRevient, cours, objectif,
                   solvabilite, bilanSolide, dateResultats, notes }],
       journal: [{ id, date, type, nom, code, quantite, prix, frais, note }],
       modifieLe: "2027-01-04T10:00:00.000Z"
     } */

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

  function normaliserLigne(l) {
    l = l && typeof l === "object" ? l : {};
    return {
      id: texte(l.id, 64) || identifiant(),
      nom: texte(l.nom, 120),
      code: texte(l.code, 24).toUpperCase(),
      enveloppe: ["PEA", "CTO"].includes(texte(l.enveloppe, 8).toUpperCase()) ? texte(l.enveloppe, 8).toUpperCase() : "PEA",
      quantite: positif(l.quantite),
      prixRevient: positif(l.prixRevient),
      cours: positif(l.cours),
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
      type: ["achat", "vente", "dividende"].includes(o.type) ? o.type : "achat",
      nom: texte(o.nom, 120), code: texte(o.code, 24).toUpperCase(),
      quantite: positif(o.quantite), prix: positif(o.prix), frais: positif(o.frais),
      note: texte(o.note, 500),
    };
  }

  function nouveauPortefeuille() {
    return { version: VERSION, parametres: { capitalDepart: 10000, cash: 10000 }, lignes: [], journal: [], modifieLe: new Date().toISOString() };
  }

  /** Vérifie et nettoie un portefeuille lu depuis le stockage ou une sauvegarde. */
  function normaliser(o) {
    if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error("Le contenu n'est pas un portefeuille.");
    if (typeof o.version !== "number" || o.version > VERSION) throw new Error("Cette sauvegarde vient d'une version plus récente de l'outil.");
    const par = o.parametres && typeof o.parametres === "object" ? o.parametres : {};
    return {
      version: VERSION,
      parametres: { capitalDepart: positif(par.capitalDepart) ?? 10000, cash: positif(par.cash) ?? 0 },
      lignes: (Array.isArray(o.lignes) ? o.lignes : []).slice(0, 500).map(normaliserLigne).filter((l) => l.nom),
      journal: (Array.isArray(o.journal) ? o.journal : []).slice(0, 5000).map(normaliserOperation),
      modifieLe: typeof o.modifieLe === "string" ? o.modifieLe.slice(0, 40) : new Date().toISOString(),
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

  const api = { VERSION, nouveauPortefeuille, normaliser, normaliserLigne, normaliserOperation, ajouterLignes };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else racine.DecotesDonnees = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
