/* Journal des opérations : logique pure (aucun accès à la page ni au réseau).
   Une opération se fait en deux temps :
     1. preparer(portefeuille, saisie) calcule l'aperçu sans rien modifier :
        montant, effet sur la ligne (quantité, prix de revient), effet sur le cash, plus-value réalisée ;
     2. appliquer(portefeuille, apercu, choix) enregistre l'opération et, si l'utilisateur l'a accepté,
        met à jour la ligne et le cash.
   Conventions : le prix de revient unitaire (PRU) inclut les frais d'achat ; une vente ne change pas le PRU. */
(function (racine) {
  "use strict";
  const Donnees = typeof module !== "undefined" && module.exports ? require("./donnees.js") : racine.DecotesDonnees;

  const estNombre = (v) => typeof v === "number" && Number.isFinite(v);
  const centimes = (v) => Math.round(v * 100) / 100;
  const centimes4 = (v) => Math.round(v * 10000) / 10000;
  const simplifier = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

  /** Retrouve la ligne concernée : par code bourse d'abord, sinon par nom. */
  function trouverLigne(pf, code, nom) {
    if (code) {
      const parCode = pf.lignes.find((l) => l.code && l.code === code);
      if (parCode) return parCode;
    }
    const n = simplifier(nom);
    return n ? pf.lignes.find((l) => simplifier(l.nom) === n) || null : null;
  }

  /** Date du jour au format AAAA-MM-JJ (heure locale). */
  function aujourdhui(d) {
    d = d || new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  /**
   * Calcule l'aperçu d'une opération. Ne modifie rien.
   * saisie : { type, date, nom, code, place, enveloppe, quantite, prix, frais, note }
   * Renvoie { op, erreurs[], avertissements[], ligne: { cible, action, avant, apres, probleme }, cash: { avant, apres }, plusValue }
   *   ligne.action : "modifier" | "creer" | "solder" | null (aucune mise à jour possible ou utile)
   */
  function preparer(pf, saisie, maintenant) {
    const op = Donnees.normaliserOperation(saisie);
    op.frais = op.frais ?? 0;
    const erreurs = [], avertissements = [];
    if (!op.date) erreurs.push("Indiquez la date de l'opération.");
    else if (op.date > aujourdhui(maintenant)) avertissements.push("La date est dans le futur.");
    if (!op.nom && !op.code) erreurs.push("Indiquez la société.");
    if (!(op.quantite > 0)) erreurs.push(op.type === "dividende" ? "Indiquez le nombre de titres concernés." : "Indiquez le nombre de titres.");
    if (!(op.prix > 0)) erreurs.push(op.type === "dividende" ? "Indiquez le dividende par action." : "Indiquez le prix unitaire.");

    const resultat = { op, place: saisie.place, enveloppe: saisie.enveloppe, classe: saisie.classe, objectif: saisie.objectif, solvabilite: saisie.solvabilite, erreurs, avertissements, ligne: { cible: null, action: null, avant: null, apres: null, probleme: null }, cash: null, plusValue: null };
    if (erreurs.length) return resultat;

    const brut = op.quantite * op.prix;
    // Achat : on décaisse le prix et les frais. Vente et dividende : on encaisse, moins les frais ou prélèvements.
    op.total = centimes(op.type === "achat" ? brut + op.frais : brut - op.frais);
    const signe = op.type === "achat" ? -1 : 1;
    const cashAvant = estNombre(pf.parametres.cash) ? pf.parametres.cash : 0;
    resultat.cash = { avant: cashAvant, apres: centimes(cashAvant + signe * op.total) };
    if (resultat.cash.apres < 0) avertissements.push("Le cash disponible deviendrait négatif : vérifiez le montant ou le cash saisi dans les paramètres.");
    if (op.type !== "achat" && op.total < 0) avertissements.push("Les frais dépassent le montant de l'opération.");

    const ligne = trouverLigne(pf, op.code, op.nom);
    const L = resultat.ligne;
    L.cible = ligne;
    if (ligne) { op.nom = op.nom || ligne.nom; op.code = op.code || ligne.code; }

    if (op.type === "achat") {
      if (!ligne) {
        L.action = "creer";
        L.apres = { quantite: op.quantite, prixRevient: centimes4((brut + op.frais) / op.quantite) };
      } else {
        const q0 = estNombre(ligne.quantite) ? ligne.quantite : 0;
        const pru0 = ligne.prixRevient;
        L.action = "modifier";
        L.avant = { quantite: q0, prixRevient: pru0 };
        const q1 = q0 + op.quantite;
        let pru1;
        if (q0 === 0) pru1 = (brut + op.frais) / op.quantite;
        else if (estNombre(pru0)) pru1 = (q0 * pru0 + brut + op.frais) / q1;
        else { pru1 = null; avertissements.push("Le prix de revient actuel de la ligne est inconnu : il ne pourra pas être recalculé."); }
        L.apres = { quantite: q1, prixRevient: pru1 === null ? null : centimes4(pru1) };
      }
    } else if (op.type === "vente") {
      if (!ligne) L.probleme = "Aucune ligne du portefeuille ne correspond : seuls le journal et le cash peuvent être mis à jour.";
      else if (!estNombre(ligne.quantite) || ligne.quantite < op.quantite) {
        L.probleme = `La ligne ne compte que ${estNombre(ligne.quantite) ? ligne.quantite : 0} titre(s) : impossible d'en retirer ${op.quantite}.`;
      } else {
        const q1 = ligne.quantite - op.quantite;
        L.action = q1 === 0 ? "solder" : "modifier";
        L.avant = { quantite: ligne.quantite, prixRevient: ligne.prixRevient };
        L.apres = { quantite: q1, prixRevient: ligne.prixRevient };
      }
      if (ligne && estNombre(ligne.prixRevient)) {
        resultat.plusValue = centimes((op.prix - ligne.prixRevient) * op.quantite - op.frais);
        op.plusValue = resultat.plusValue;
      } else avertissements.push("Prix de revient inconnu : la plus-value réalisée ne peut pas être calculée.");
    }
    if (L.probleme) avertissements.push(L.probleme);
    return resultat;
  }

  /**
   * Enregistre l'opération préparée. choix : { majLigne: bool, majCash: bool }.
   * Renvoie l'opération ajoutée au journal.
   */
  function appliquer(pf, apercu, choix) {
    if (apercu.erreurs.length) throw new Error("Opération incomplète.");
    const op = Object.assign({}, apercu.op);
    const L = apercu.ligne;
    if (choix.majLigne && L.action) {
      if (L.action === "creer") {
        pf.lignes.push(Donnees.normaliserLigne({
          nom: op.nom || op.code, code: op.code, place: apercu.place, enveloppe: apercu.enveloppe, classe: apercu.classe,
          quantite: L.apres.quantite, prixRevient: L.apres.prixRevient, cours: op.prix, dateCours: op.date,
          objectif: apercu.objectif, solvabilite: apercu.solvabilite, notes: choix.carnet && choix.carnet.these,
        }));
      } else {
        const i = pf.lignes.indexOf(L.cible);
        if (i < 0) throw new Error("La ligne a changé entre-temps : recommencez la saisie.");
        if (L.action === "solder") pf.lignes.splice(i, 1);
        else pf.lignes[i] = Object.assign({}, L.cible, { quantite: L.apres.quantite, prixRevient: L.apres.prixRevient });
      }
    }
    if (choix.majCash && apercu.cash) pf.parametres.cash = apercu.cash.apres;
    pf.journal.push(op);
    // Carnet de bord : la thèse (achat) ou la raison (vente) accompagne l'opération.
    if (choix.carnet && pf.carnet) {
      const e = Donnees.normaliserCarnet(Object.assign({ date: op.date, type: op.type, nom: op.nom, code: op.code }, choix.carnet));
      if (e) pf.carnet.push(e);
    }
    return op;
  }

  // ---------------------------------------------------------------- Carnet de bord
  /** Une thèse écrite avant tout achat : pourquoi acheter, quand vendre, ce qui donnerait tort. Longueurs minimales. */
  const THESE = Object.freeze([
    { cle: "these", titre: "Pourquoi acheter ?", aide: "Méthode et valeur retenues (VANN, VANE, RAPP…), prix maximal, raison de la décote, catalyseur.", min: 60 },
    { cle: "sortie", titre: "Quand vendre ?", aide: "Objectif de vente, potentiel restant sous 20 %, signaux qui invalideraient la thèse.", min: 30 },
    { cle: "contre", titre: "Qu'est-ce qui me donnerait tort ?", aide: "Les meilleurs arguments contraires que vous avez cherchés et lus.", min: 30 },
  ]);
  const RAISONS_VENTE = Object.freeze({
    objectif: "Objectif atteint (VANT)", potentiel: "Potentiel restant sous 20 %", invalidee: "Thèse invalidée",
    opportunite: "Meilleure opportunité ailleurs", liquidites: "Besoin de liquidités", autre: "Autre",
  });

  /** Vérifie une thèse : renvoie la liste des parties trop courtes. */
  function verifierThese(t) {
    t = t || {};
    return THESE.filter((p) => String(t[p.cle] || "").trim().length < p.min)
      .map((p) => `« ${p.titre} » : ${p.min} caractères au moins (${String(t[p.cle] || "").trim().length} saisis).`);
  }

  /** Dernière thèse écrite pour une société (par code, sinon par nom), ou null. */
  function derniereThese(carnet, code, nom) {
    const n = simplifier(nom);
    const e = (carnet || []).filter((x) => x.type === "achat" && ((code && x.code === code) || (n && simplifier(x.nom) === n)))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
    return e || null;
  }

  /**
   * Rotation du portefeuille sur 12 mois = min(achats, ventes) ÷ valeur moyenne du portefeuille.
   * Repère du cours : environ 20 % par an quand le processus est strict.
   */
  function rotation(journal, historique, valeurActuelle, maintenant) {
    const d = maintenant || new Date();
    const debut = aujourdhui(new Date(d.getFullYear() - 1, d.getMonth(), d.getDate()));
    const recentes = journal.filter((o) => o.date && o.date > debut && estNombre(o.total));
    const achats = recentes.filter((o) => o.type === "achat").reduce((s, o) => s + o.total, 0);
    const ventes = recentes.filter((o) => o.type === "vente").reduce((s, o) => s + o.total, 0);
    const points = (historique || []).filter((h) => h.date > debut).map((h) => h.titres + h.cash);
    const moyenne = points.length >= 2 ? points.reduce((s, v) => s + v, 0) / points.length : valeurActuelle;
    const taux = moyenne > 0 ? Math.min(achats, ventes) / moyenne : null;
    return { achats: centimes(achats), ventes: centimes(ventes), valeurMoyenne: moyenne, taux, repere: 0.20,
      depasse: taux !== null && taux > 0.25, base: points.length >= 2 ? "historique" : "valeur actuelle" };
  }

  /** Journal trié du plus récent au plus ancien, et totaux par type. */
  function synthese(journal) {
    // Du plus récent au plus ancien ; à date égale, la dernière saisie d'abord.
    const trie = journal.map((o, i) => [o, i]).sort((a, b) => (b[0].date || "").localeCompare(a[0].date || "") || b[1] - a[1]).map(([o]) => o);
    const totaux = { achat: 0, vente: 0, dividende: 0, plusValues: 0, frais: 0 };
    for (const o of journal) {
      if (estNombre(o.total)) totaux[o.type] += o.total;
      if (estNombre(o.plusValue)) totaux.plusValues += o.plusValue;
      if (estNombre(o.frais)) totaux.frais += o.frais;
    }
    for (const k of Object.keys(totaux)) totaux[k] = centimes(totaux[k]);
    return { operations: trie, totaux };
  }

  const api = { preparer, appliquer, synthese, trouverLigne, aujourdhui, THESE, RAISONS_VENTE, verifierThese, derniereThese, rotation };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else racine.DecotesJournal = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
