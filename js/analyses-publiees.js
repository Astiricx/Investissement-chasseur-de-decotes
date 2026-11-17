/* Analyses publiées : fiches d'analyse de sociétés réelles, chargeables dans les outils (onglet Analyse).
   Données publiques uniquement (comptes publiés par les sociétés) : aucune donnée personnelle.
   Chaque analyse a sa page de synthèse dans le dossier analyses/. Les tests vérifient que ces fiches
   redonnent exactement les chiffres annoncés sur la page. */
(function (racine) {
  "use strict";

  // Showa Paxxs : huit exercices clos fin mars (millions de yens ; dividende et cours en yens).
  // Sources : IR Bank (comptes des rapports annuels) ; cours de fin mars : Kabutan (ajustés).
  const ANNEES = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
  const CA = [21819.1, 21434.9, 19938.4, 21598.6, 22277.1, 21651.7, 23316.7, 23563.9];
  const FRAIS = [2635.1, 2632.3, 2480.3, 2579.2, 2622.9, 2796.1, 2888.2, 2779.2];
  const COUT = [17661.4, 17440.7, 16288.0, 17616.6, 18538.7, 17834.0, 19050.7, 19152.3];
  const STOCKS = [2264.7, 2297.6, 2168.0, 2286.6, 2632.0, 3014.7, 3058.6, 3227.7];
  const BPA_ACTIF_NET = [3512.81, 3669.20, 4150.31, 4367.75, 4614.07, 5190.43, 5341.87, 6084.82]; // BPS publié
  const ACTIONS = [4.4401, 4.4399, 4.4400, 4.4401, 4.4400, 4.4401, 4.390006, 4.390006];       // millions, hors autocontrôle
  const DIVIDENDES = [38, 38, 38, 40, 40, 40, 40, 50];
  const COURS_MARS = [1704, 1769, 1860, 1507, 1593, 1875, 1854, 2980];

  const rapp = { nom: "Showa Paxxs (3954.T)", devise: "JPY", tsr: 0.02768 };
  ANNEES.forEach((a, i) => {
    Object.assign(rapp, {
      [`a${i}_annee`]: a, [`a${i}_actions`]: ACTIONS[i], [`a${i}_chiffreAffaires`]: CA[i], [`a${i}_fraisGeneraux`]: FRAIS[i],
      [`a${i}_coutVentes`]: COUT[i], [`a${i}_stocks`]: STOCKS[i], [`a${i}_fondsPropres`]: Math.round(BPA_ACTIF_NET[i] * ACTIONS[i] * 10) / 10,
      [`a${i}_dividende`]: DIVIDENDES[i], [`a${i}_cours`]: COURS_MARS[i],
    });
  });

  // Sun A. Kaken : huit exercices clos fin mars (millions de yens ; dividende et cours en yens).
  // Sources : rapports annuels (yuho) via IR Bank pour le CA, le coût des ventes, les frais, les stocks et
  // les fonds propres part du groupe (株主資本 + autres éléments du résultat global) ; valeur comptable par
  // action publiée (BPS) via IR Bank et Kabutan ; nombre d'actions = fonds propres ÷ BPS ; cours de fin mars : Kabutan.
  const SAK = {
    annees: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    ca: [31195.9, 29698.0, 29986.2, 28674.2, 27870.4, 27521.4, 29430.1, 30358.1],
    frais: [3117.4, 3036.3, 3097.9, 3162.5, 3051.2, 3059.6, 3391.9, 3351.9],
    cout: [27752.3, 26480.3, 26275.0, 24769.7, 25287.7, 24656.8, 26072.6, 26168.9],
    stocks: [3338.5, 3274.5, 3605.9, 4269.4, 4987.8, 4841.0, 5019.6, 5040.3],
    fondsPropres: [19238.9, 17196.6, 18753.8, 19969.1, 19528.3, 20619.7, 20098.1, 22295.0],
    bps: [1753.03, 1566.94, 1708.83, 1819.57, 1821.57, 1955.38, 2085.12, 2314.69],
    dividendes: [18, 18, 18, 20.5, 20.5, 18, 18, 18],
    cours: [493, 399, 543, 536, 469, 535, 559, 733],
  };
  const rappSak = { nom: "Sun A. Kaken (4234.T)", devise: "JPY", tsr: 0.02768 };
  SAK.annees.forEach((a, i) => {
    Object.assign(rappSak, {
      [`a${i}_annee`]: a, [`a${i}_actions`]: Math.round((SAK.fondsPropres[i] / SAK.bps[i]) * 1e4) / 1e4, [`a${i}_chiffreAffaires`]: SAK.ca[i],
      [`a${i}_fraisGeneraux`]: SAK.frais[i], [`a${i}_coutVentes`]: SAK.cout[i], [`a${i}_stocks`]: SAK.stocks[i],
      [`a${i}_fondsPropres`]: SAK.fondsPropres[i], [`a${i}_dividende`]: SAK.dividendes[i], [`a${i}_cours`]: SAK.cours[i],
    });
  });

  const PUBLIEES = Object.freeze([
    {
      id: "4234-sun-a-kaken",
      societe: "Sun A. Kaken",
      code: "4234", place: "XTKS", devise: "JPY",
      date: "2026-11-17",
      page: "analyses/4234-sun-a-kaken.html",
      resume: "Net-Estate : cours de 1 170 ¥ = 60,6 % de la VANE (seuil 70 %), objectif VANT 2 419 ¥.",
      fiches: {
        // Bilan consolidé au 30 septembre 2026 (rapport semestriel du 13 novembre 2026), millions de yens.
        // Immeubles : terrains (2 462,7) + bâtiments et constructions bruts au 31 mars 2026 (12 954,4).
        vann: {
          nom: "Sun A. Kaken (4234.T)", devise: "JPY", cours: 1170, nbActions: 9.659207, chiffreAffaires: 30358.1,
          tresorerie: 6100.3, creances: 12766.6, stocks: 5709.0, autresActifsCourants: 117.2,
          immeublesPrixAchat: 15417.1, incorporels: 267.5, goodwill: 356.2, impotsDifferesActifs: 0,
          totalBilan: 42358.3, capitauxPropres: 23988.2, minoritaires: 968.7, provisions: 0, dettesTotales: 17401.4,
          decoteStocks: 0, decoteCreances: 0,
        },
        rapp: rappSak,
      },
    },
    {
      id: "3954-showa-paxxs",
      societe: "Showa Paxxs",
      code: "3954", place: "XTKS", devise: "JPY",
      date: "2026-11-16",
      page: "analyses/3954-showa-paxxs.html",
      resume: "Net-Estate à la limite : cours de 2 992 ¥ = 69,7 % de la VANE (seuil 70 %), objectif VANT 6 440 ¥.",
      fiches: {
        // Bilan consolidé au 30 septembre 2026 (rapport semestriel du 10 novembre 2026), millions de yens.
        vann: {
          nom: "Showa Paxxs (3954.T)", devise: "JPY", cours: 2992, nbActions: 4.389975, chiffreAffaires: 23563.9,
          tresorerie: 10292.8, creances: 7699.5, stocks: 3047.2, autresActifsCourants: 259.4,
          immeublesPrixAchat: 10860.9, incorporels: 135.8, goodwill: 0, impotsDifferesActifs: 73.6,
          totalBilan: 39021.8, capitauxPropres: 28481.0, minoritaires: 308.1, provisions: 0, dettesTotales: 10232.7,
          decoteStocks: 0.20, decoteCreances: 0,
        },
        rapp,
      },
    },
  ]);

  if (typeof module !== "undefined" && module.exports) module.exports = PUBLIEES;
  else racine.DecotesAnalysesPubliees = PUBLIEES;
})(typeof globalThis !== "undefined" ? globalThis : this);
