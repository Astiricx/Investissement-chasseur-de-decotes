/* Lecture d'un fichier CSV sans bibliothèque : découpage, nombres et dates à la française,
   reconnaissance des colonnes du fichier Excel de suivi. */
(function (racine) {
  "use strict";

  /** Décode le fichier : UTF-8 si possible, sinon l'encodage Windows d'Excel. */
  function decoder(tampon) {
    let t;
    try { t = new TextDecoder("utf-8", { fatal: true }).decode(tampon); }
    catch (e) { t = new TextDecoder("windows-1252").decode(tampon); }
    return t.replace(/^﻿/, "");
  }

  /** Découpe un texte CSV en lignes de cellules (guillemets, guillemets doublés, retours à la ligne dans une cellule). */
  function decouper(texte, separateur) {
    const lignes = []; let ligne = []; let cellule = ""; let entreGuillemets = false;
    for (let i = 0; i < texte.length; i++) {
      const c = texte[i];
      if (entreGuillemets) {
        if (c === '"') { if (texte[i + 1] === '"') { cellule += '"'; i++; } else entreGuillemets = false; }
        else cellule += c;
      } else if (c === '"' && cellule === "") entreGuillemets = true;
      else if (c === separateur) { ligne.push(cellule); cellule = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && texte[i + 1] === "\n") i++;
        ligne.push(cellule); lignes.push(ligne); ligne = []; cellule = "";
      } else cellule += c;
    }
    if (cellule !== "" || ligne.length) { ligne.push(cellule); lignes.push(ligne); }
    return lignes;
  }

  /** Excel français sépare par des points-virgules, les autres outils par des virgules ou des tabulations. */
  function detecterSeparateur(texte) {
    const debut = texte.slice(0, 5000).replace(/"[^"]*"/g, "");
    let meilleur = ";", max = -1;
    for (const s of [";", ",", "\t"]) { const n = debut.split(s).length - 1; if (n > max) { max = n; meilleur = s; } }
    return meilleur;
  }

  /** « 1 234,50 € », « 3,5 », « 1,234.50 » → nombre. Cellule vide ou illisible → null. */
  function lireNombre(v) {
    let t = String(v ?? "").replace(/[\s  €$%]/g, "");
    if (t === "") return null;
    const virgule = t.lastIndexOf(","), point = t.lastIndexOf(".");
    if (virgule > -1 && point > -1) t = virgule > point ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
    else if (virgule > -1) t = t.replace(",", ".");
    return /^-?\d*\.?\d+$/.test(t) ? Number(t) : null;
  }

  /** « 14/01/2027 » ou « 2027-01-14 » → « 2027-01-14 ». Sinon null. */
  function lireDate(v) {
    const t = String(v ?? "").trim();
    let m = t.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    let a, mo, j;
    if (m) { j = +m[1]; mo = +m[2]; a = +m[3]; }
    else if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})/))) { a = +m[1]; mo = +m[2]; j = +m[3]; }
    else return null;
    const d = new Date(a, mo - 1, j);
    if (d.getFullYear() !== a || d.getMonth() !== mo - 1 || d.getDate() !== j) return null;
    return `${a}-${String(mo).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
  }

  const simplifier = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  // Intitulés reconnus (après simplification : minuscules, sans accents ni ponctuation).
  const COLONNES = {
    nom: /^(societe|nom|libelle|valeur|titre)$/,
    code: /^(code|code bourse|ticker|symbole|mnemonique|mnemo|isin|code isin)$/,
    quantite: /^(quantite|qte|nombre|nombre d actions|nombre de titres)$/,
    prixRevient: /^(prix de revient|prix de revient unitaire|pru|prix d achat|prix achat|cours d achat)$/,
    objectif: /^objectif( de vente)?$/,
    cours: /^(cours|cours actuel|dernier cours)$/,
    enveloppe: /^(enveloppe|compte)$/,
    place: /^(place de cotation|place|marche|bourse)$/,
    classe: /^(classe|classe d actif|type d actif|famille|categorie)$/,
    bilanSolide: /^bilan toujours solide$/,
    dateResultats: /^(prochaine publication|date des resultats|date resultats)$/,
    notes: /^(these et notes|notes|these|commentaire|commentaires)$/,
  };
  const INTITULES = { nom: "Société", code: "Code", quantite: "Quantité", prixRevient: "Prix de revient", objectif: "Objectif",
    cours: "Cours", enveloppe: "Enveloppe", place: "Place de cotation", classe: "Classe d'actif", bilanSolide: "Bilan solide", dateResultats: "Prochaine publication", notes: "Notes" };

  /**
   * Extrait les lignes de portefeuille d'un texte CSV.
   * Renvoie { lignes, ignorees: [{ numero, raison }], colonnes: [intitulés reconnus], erreur }.
   */
  function lirePortefeuille(texte) {
    const tableau = decouper(texte, detecterSeparateur(texte));
    // La ligne d'en-têtes n'est pas forcément la première (titre au-dessus dans le fichier Excel).
    let position = -1, index = null;
    for (let i = 0; i < Math.min(tableau.length, 30) && position < 0; i++) {
      const trouve = {};
      tableau[i].forEach((cellule, j) => {
        const s = simplifier(cellule.replace(/\([^)]*\)/g, ""));
        for (const [cle, motif] of Object.entries(COLONNES)) if (!(cle in trouve) && motif.test(s)) trouve[cle] = j;
      });
      if ("nom" in trouve && "quantite" in trouve) { position = i; index = trouve; }
    }
    if (position < 0) {
      return { lignes: [], ignorees: [], colonnes: [], erreur: "Colonnes introuvables : le fichier doit contenir au moins une colonne « Société » (ou « Nom ») et une colonne « Quantité » (ou « Nombre d'actions »)." };
    }
    const lignes = [], ignorees = [];
    for (let i = position + 1; i < tableau.length; i++) {
      const c = (cle) => (cle in index ? String(tableau[i][index[cle]] ?? "").trim() : "");
      const nom = c("nom");
      if (!nom) continue;
      const numero = i + 1;
      if (c("code").toUpperCase() === "EXEMPLE") { ignorees.push({ numero, raison: `${nom} : ligne d'exemple` }); continue; }
      const quantite = lireNombre(c("quantite"));
      if (quantite === null || quantite <= 0) { ignorees.push({ numero, raison: `${nom} : quantité absente ou illisible` }); continue; }
      const solide = simplifier(c("bilanSolide"));
      lignes.push({
        nom, code: c("code"), place: c("place"), classe: c("classe"), enveloppe: c("enveloppe"), quantite,
        prixRevient: lireNombre(c("prixRevient")), objectif: lireNombre(c("objectif")), cours: lireNombre(c("cours")),
        bilanSolide: solide === "oui" ? true : solide === "non" ? false : null,
        dateResultats: lireDate(c("dateResultats")), notes: c("notes"),
      });
    }
    return { lignes, ignorees, colonnes: Object.keys(index).map((k) => INTITULES[k]), erreur: null };
  }

  const api = { decoder, decouper, detecterSeparateur, lireNombre, lireDate, lirePortefeuille };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else racine.DecotesCSV = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
