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

  /** Fiche RAPP à partir de séries sur huit exercices (actions en millions, montants en millions, dividende et cours par action). */
  function ficheRapp(nom, devise, tsr, s) {
    const f = { nom, devise, tsr };
    s.annees.forEach((a, i) => Object.assign(f, {
      [`a${i}_annee`]: a, [`a${i}_actions`]: s.actions[i], [`a${i}_chiffreAffaires`]: s.ca[i], [`a${i}_fraisGeneraux`]: s.frais[i],
      [`a${i}_coutVentes`]: s.cout[i], [`a${i}_stocks`]: s.stocks[i], [`a${i}_fondsPropres`]: s.fondsPropres[i],
      [`a${i}_dividende`]: s.dividendes[i], [`a${i}_cours`]: s.cours[i],
    }));
    return f;
  }

  // Sociétés coréennes : exercices clos fin décembre 2018 à 2025, millions de wons (dividende et cours en wons).
  // Sources : rapports annuels (사업보고서) sur DART ; frais = frais de vente et d'administration ; fonds propres =
  // part du groupe ; actions = actions en circulation hors autocontrôle à la clôture ; cours de fin décembre (Yahoo Finance).
  const ANNEES_KR = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  const TSR_KR = 0.03966; // obligation d'État coréenne à 10 ans, clôture du 17 novembre 2026
  const DAEWON = {
    annees: ANNEES_KR, actions: Array(8).fill(20.0376),
    ca: [696997.7, 660965.7, 642639.9, 762636.4, 737040.6, 778642.6, 931473.1, 1058925.9],
    frais: [21071.6, 20182.6, 21114.0, 30210.7, 28842.7, 20860.9, 24718.4, 36077.8],
    cout: [645446.5, 614507.6, 593469.9, 702305.6, 676802.2, 710474.6, 831772.7, 952094.4],
    stocks: [17954.1, 21035.4, 21035.9, 41630.5, 55601.3, 46047.1, 40473.5, 12992.7],
    fondsPropres: [275238.2, 311378.1, 332306.5, 371808.4, 417662.4, 445755.8, 512394.6, 584505.6],
    dividendes: [125, 125, 125, 125, 175, 175, 200, 250],
    cours: [5810, 5380, 5600, 6150, 5640, 6110, 5920, 12970],
  };
  const SYTS = {
    annees: ANNEES_KR, actions: [2.958599, 2.854407, 2.849425, 2.849425, 2.828618, 2.784, 2.661724, 2.64],
    ca: [183198.3, 192107.5, 198417.1, 193958.6, 178800.8, 179258.4, 191310.5, 174685.1],
    frais: [5091.3, 6998.7, 7494.9, 7680.1, 8260.5, 7802.5, 8374.3, 8280.1], // 2025 : marge brute − résultat d'exploitation
    cout: [145980.7, 135672.1, 133225.6, 149891.2, 154095.1, 153771.9, 162944.4, 147962.7],
    stocks: [45032.2, 42082.8, 40856.2, 60460.4, 63518.5, 61916.9, 56901.0, 53441.6],
    fondsPropres: [292842.0, 328747.3, 375584.8, 406422.5, 417112.7, 431919.0, 434145.7, 453490.8],
    dividendes: [750, 1000, 1250, 1250, 1500, 1500, 1500, 2300],
    cours: [44500, 61700, 61500, 56300, 50900, 51000, 48400, 57100],
  };
  const DONGIL = {
    annees: ANNEES_KR, actions: [2.185347, 2.166071, 2.166071, 2.166071, 2.166071, 2.166071, 2.166071, 2.141526],
    ca: [391030.4, 354691.3, 333283.3, 464419.2, 498050.5, 441161.3, 415796.6, 347922.4],
    frais: [16135.7, 16621.7, 16031.7, 21279.3, 21110.4, 19157.6, 22571.2, 19750.3],
    cout: [357590.8, 339048.6, 315268.4, 401091.0, 454349.3, 426242.3, 397384.1, 330921.7],
    stocks: [78463.7, 72780.4, 65172.3, 93531.3, 95929.4, 90267.8, 93642.8, 94556.9],
    fondsPropres: [354937.4, 353804.8, 360482.4, 402036.8, 417277.2, 410077.1, 422764.7, 406422.0],
    dividendes: [1500, 750, 1800, 4000, 3000, 1000, 1250, 1000],
    cours: [58800, 53200, 78200, 158500, 194500, 45550, 39800, 38000],
  };

  const PUBLIEES = Object.freeze([
    {
      id: "005710-daewon-sanup", societe: "Daewon Sanup", code: "005710", place: "KOSDAQ", devise: "KRW", date: "2026-11-18",
      page: "analyses/005710-daewon-sanup.html",
      resume: "Net-Net : cours de 10 570 ₩ = 49,5 % de la VANN (seuil 70 %), trésorerie supérieure à 2 fois la capitalisation, objectif VANT 29 997 ₩.",
      fiches: {
        // Bilan consolidé au 30 septembre 2026 (rapport trimestriel DART du 13/11/2026), millions de wons.
        // Immeubles : terrains (24 754,1), bâtiments (65 781,3) et constructions (2 659,5) bruts au 31/12/2025 + immeubles de placement nets (6 054,4).
        vann: {
          nom: "Daewon Sanup (005710)", devise: "KRW", cours: 10570, nbActions: 20.0376, chiffreAffaires: 1058925.9,
          tresorerie: 441259.8, creances: 134192.7, stocks: 13729.8, autresActifsCourants: 8923.5,
          immeublesPrixAchat: 99249.3, incorporels: 939.3, goodwill: 0, impotsDifferesActifs: 16757.1,
          totalBilan: 789238.7, capitauxPropres: 618769.4, minoritaires: 0, provisions: 0, dettesTotales: 170469.3,
          decoteStocks: 0, decoteCreances: 0,
        },
        rapp: ficheRapp("Daewon Sanup (005710)", "KRW", TSR_KR, DAEWON),
      },
    },
    {
      id: "002170-syts", societe: "SYTS (ex-Samyang Tongsang)", code: "002170", place: "KOSPI", devise: "KRW", date: "2026-11-18",
      page: "analyses/002170-syts.html",
      resume: "Net-Net : cours de 48 750 ₩ = 41,1 % de la VANN (seuil 70 %), trésorerie nette supérieure à la capitalisation, objectif VANT 178 609 ₩.",
      fiches: {
        // Bilan consolidé au 30 septembre 2026 (rapport trimestriel DART), millions de wons.
        // Immeubles : terrains (24 410,7), bâtiments (17 672,8), agencements (4 779,9) et constructions (9 445,5) bruts au 31/12/2025 + immeubles de placement nets (21 223,9).
        vann: {
          nom: "SYTS (002170)", devise: "KRW", cours: 48750, nbActions: 2.55072, chiffreAffaires: 174685.1,
          tresorerie: 229428.7, creances: 34525.2, stocks: 58463.6, autresActifsCourants: 5096.0,
          immeublesPrixAchat: 77532.8, incorporels: 816.5, goodwill: 0, impotsDifferesActifs: 0,
          totalBilan: 481021.8, capitauxPropres: 456397.7, minoritaires: 0, provisions: 0, dettesTotales: 24624.1,
          decoteStocks: 0, decoteCreances: 0,
        },
        rapp: ficheRapp("SYTS (002170)", "KRW", TSR_KR, SYTS),
      },
    },
    {
      id: "004890-dongil-industries", societe: "Dongil Industries", code: "004890", place: "KOSPI", devise: "KRW", date: "2026-11-18",
      page: "analyses/004890-dongil-industries.html",
      resume: "Net-Net très profond : cours de 33 650 ₩ = 27,5 % de la VANN (stocks décotés de 20 %), mais direction à surveiller (deux alertes RAPP).",
      fiches: {
        // Bilan consolidé au 30 septembre 2026 (rapport trimestriel DART), millions de wons.
        // Immeubles : terrains (35 328,9) et bâtiments (48 153,9) bruts au 31/12/2025 + immeubles de placement nets (5 783,1).
        vann: {
          nom: "Dongil Industries (004890)", devise: "KRW", cours: 33650, nbActions: 2.141526, chiffreAffaires: 347922.4,
          tresorerie: 145767.0, creances: 84785.7, stocks: 107864.5, autresActifsCourants: 3121.4,
          immeublesPrixAchat: 89265.9, incorporels: 3379.5, goodwill: 0, impotsDifferesActifs: 7670.2,
          totalBilan: 481901.4, capitauxPropres: 424109.0, minoritaires: 0, provisions: 0, dettesTotales: 57792.4,
          decoteStocks: 0.20, decoteCreances: 0,
        },
        rapp: ficheRapp("Dongil Industries (004890)", "KRW", TSR_KR, DONGIL),
      },
    },
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
