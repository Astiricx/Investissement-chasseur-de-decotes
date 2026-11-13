/* Logique métier pure (aucun accès à la page) : méthode Net-Net / Daubasses.
   Utilisable dans le navigateur (objet global Decotes) et sous Node (tests). */
(function (racine) {
  "use strict";

  /** Paramètres par défaut : ceux du fichier Excel de suivi. */
  const PARAMETRES = Object.freeze({
    capitalDepart: 10000,        // €
    achatMaxPctValeur: 0.70,     // acheter à 70 % ou moins de la VANN (ou de la VANE)
    seuilVentePotentiel: 0.20,   // vendre si le potentiel restant passe sous 20 %
    seuilRenforcement: -0.20,    // envisager de renforcer à −20 % depuis l'achat
    tailleMaxLigne: 0.05,        // une ligne ne dépasse pas 5 % du portefeuille
    cashCible: 0.15,             // 15 % de liquidités
    solvabiliteMin: 0.40,        // solvabilité maison minimale
    caMinPctVann: 0.05,          // chiffre d'affaires minimal, en % de la VANN
    immeublesRetenus: 0.80,      // 80 % du prix d'achat historique des immeubles
    joursAlerteResultats: 14,
  });

  const STATUTS = Object.freeze({
    A_COMPLETER: "À COMPLÉTER",
    REEXAMINER: "RÉEXAMINER",
    VENDRE: "VENDRE",
    RENFORCER: "RENFORCER ?",
    GARDER: "GARDER",
  });

  const estNombre = (v) => typeof v === "number" && Number.isFinite(v);
  const n = (v) => (estNombre(v) ? v : 0);
  const EPS = 1e-9; // tolérance d'arrondi pour les seuils atteints exactement
  const diviser = (a, b) => (estNombre(a) && estNombre(b) && b !== 0 ? a / b : null);

  /**
   * Analyse d'une société à partir de son bilan (montants en millions, cours en €).
   * Renvoie les valeurs, les filtres de sécurité et le verdict.
   */
  function analyser(s, params) {
    const p = Object.assign({}, PARAMETRES, params);

    const actifCourant = n(s.tresorerie) + n(s.creances) + n(s.stocks) + n(s.autresActifsCourants);
    const fondsDeRoulementNet = actifCourant - n(s.dettesTotales);
    const actifCourantRetraite =
      n(s.tresorerie) +
      n(s.creances) * (1 - n(s.decoteCreances)) +
      n(s.stocks) * (1 - n(s.decoteStocks)) +
      n(s.autresActifsCourants);

    // VANN = actif courant retraité − total du passif − provisions − intérêts minoritaires
    const vann = actifCourantRetraite - n(s.dettesTotales) - n(s.provisions) - n(s.minoritaires);
    // VANE = VANN + 80 % du prix d'achat historique des immeubles
    const vane = vann + n(s.immeublesPrixAchat) * p.immeublesRetenus;
    // VANT = capitaux propres − incorporels − goodwill − impôts différés actifs
    const vant = n(s.capitauxPropres) - n(s.incorporels) - n(s.goodwill) - n(s.impotsDifferesActifs);

    const vannParAction = diviser(vann, s.nbActions);
    const vaneParAction = diviser(vane, s.nbActions);
    const vantParAction = diviser(vant, s.nbActions);

    const coursSurVann = vannParAction > 0 ? diviser(s.cours, vannParAction) : null;
    const coursSurVane = vaneParAction > 0 ? diviser(s.cours, vaneParAction) : null;
    const potentiel = vantParAction !== null && s.cours > 0 ? vantParAction / s.cours - 1 : null;

    // Solvabilité maison = fonds propres consolidés ÷ (total du bilan − liquidités)
    const fondsPropres = n(s.capitauxPropres) + n(s.minoritaires);
    const solvabilite = diviser(fondsPropres, n(s.totalBilan) - n(s.tresorerie));
    const solvabiliteClassique = diviser(fondsPropres, s.totalBilan);

    const filtres = {
      fondsDeRoulementPositif: fondsDeRoulementNet > 0,
      solvabiliteSuffisante: solvabilite !== null && solvabilite >= p.solvabiliteMin,
      chiffreAffairesSuffisant: vann <= 0 || n(s.chiffreAffaires) >= p.caMinPctVann * vann,
      decoteNetNet: coursSurVann !== null && coursSurVann <= p.achatMaxPctValeur + EPS,
      decoteNetEstate: coursSurVane !== null && coursSurVane <= p.achatMaxPctValeur + EPS,
    };

    const securite = filtres.fondsDeRoulementPositif && filtres.solvabiliteSuffisante && filtres.chiffreAffairesSuffisant;
    let verdict;
    if (!securite) verdict = { code: "exclue", texte: "Exclue : un filtre de sécurité n'est pas passé" };
    else if (filtres.decoteNetNet) verdict = { code: "net-net", texte: "Net-Net : achat possible, objectif = VANT" };
    else if (filtres.decoteNetEstate) verdict = { code: "net-estate", texte: "Net-Estate : achat possible, objectif = VANT" };
    else verdict = { code: "attendre", texte: "Décote insuffisante : attendre un meilleur prix" };

    return {
      capitalisation: estNombre(s.cours) && estNombre(s.nbActions) ? s.cours * s.nbActions : null,
      fondsDeRoulementNet, actifCourantRetraite,
      vann, vane, vant, vannParAction, vaneParAction, vantParAction,
      prixMaxNetNet: vannParAction === null ? null : vannParAction * p.achatMaxPctValeur,
      prixMaxNetEstate: vaneParAction === null ? null : vaneParAction * p.achatMaxPctValeur,
      coursSurVann, coursSurVane, potentiel, solvabilite, solvabiliteClassique,
      filtres, verdict,
    };
  }

  /**
   * Statut d'une ligne du portefeuille.
   * ligne : { quantite, prixRevient, cours, objectif, solvabilite }
   * L'ordre des règles est celui du fichier Excel.
   */
  function statutLigne(ligne, params) {
    const p = Object.assign({}, PARAMETRES, params);
    const { quantite, prixRevient, cours, objectif, solvabilite } = ligne;
    if (![quantite, prixRevient, cours, objectif].every((v) => estNombre(v) && v > 0)) return STATUTS.A_COMPLETER;
    // Bilan dégradé : on réexamine le dossier avant toute autre décision.
    if (estNombre(solvabilite) && solvabilite < p.solvabiliteMin) return STATUTS.REEXAMINER;
    if (cours >= objectif || objectif / cours - 1 < p.seuilVentePotentiel - EPS) return STATUTS.VENDRE;
    if (cours / prixRevient - 1 <= p.seuilRenforcement + EPS) {
      // On ne propose de renforcer que si la solvabilité est connue et suffisante.
      return estNombre(solvabilite) ? STATUTS.RENFORCER : STATUTS.REEXAMINER;
    }
    return STATUTS.GARDER;
  }

  /** Synthèse du portefeuille : valeurs, poids, alertes. `aujourdhui` est une Date. */
  function synthese(lignes, cash, params, aujourdhui) {
    const p = Object.assign({}, PARAMETRES, params);
    const jour = 24 * 3600 * 1000;
    const debut = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate()).getTime();
    const valeurTitres = lignes.reduce((t, l) => t + n(l.quantite) * n(l.cours), 0);
    const total = valeurTitres + n(cash);
    const detail = lignes.map((l) => {
      const valeur = n(l.quantite) * n(l.cours);
      const poids = total > 0 ? valeur / total : null;
      let joursAvantResultats = null;
      if (l.dateResultats) {
        const d = new Date(l.dateResultats + "T00:00:00").getTime();
        if (!Number.isNaN(d)) joursAvantResultats = Math.round((d - debut) / jour);
      }
      return {
        ligne: l, valeur, poids,
        statut: statutLigne(l, p),
        performance: diviser(n(l.cours) - n(l.prixRevient), l.prixRevient),
        potentiel: estNombre(l.objectif) && l.cours > 0 ? l.objectif / l.cours - 1 : null,
        tropLourde: poids !== null && poids > p.tailleMaxLigne,
        resultatsProches: joursAvantResultats !== null && joursAvantResultats >= 0 && joursAvantResultats <= p.joursAlerteResultats,
        joursAvantResultats,
      };
    });
    return {
      detail, valeurTitres, cash: n(cash), total,
      partCash: total > 0 ? n(cash) / total : null,
      compte: (statut) => detail.filter((d) => d.statut === statut).length,
      lignesTropLourdes: detail.filter((d) => d.tropLourde).length,
      resultatsProches: detail.filter((d) => d.resultatsProches).length,
    };
  }

  /** Cas d'école du cours (chapitre 15). Société fictive, montants en millions d'euros. */
  const ALPHA_INDUSTRIE = Object.freeze({
    nom: "Alpha Industrie (exemple fictif)",
    cours: 3.5, nbActions: 4, chiffreAffaires: 70,
    tresorerie: 18, creances: 12, stocks: 14, autresActifsCourants: 0,
    immeublesPrixAchat: 9, incorporels: 3, goodwill: 2, impotsDifferesActifs: 1,
    totalBilan: 60, capitauxPropres: 36, minoritaires: 1, provisions: 2, dettesTotales: 21,
    decoteStocks: 0.20, decoteCreances: 0,
  });

  const api = { PARAMETRES, STATUTS, ALPHA_INDUSTRIE, analyser, statutLigne, synthese };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else racine.Decotes = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
