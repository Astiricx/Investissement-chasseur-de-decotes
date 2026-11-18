/* Génère les pages de synthèse des trois sociétés coréennes analysées le 18 novembre 2026.
   Usage : node outils/analyses-coree.js
   Chiffres : fiches de js/analyses-publiees.js (bilans DART au 30/09/2026, rapports annuels 2018-2025) ;
   les textes ci-dessous ne contiennent que des faits relevés dans les documents cités en sources. */
const path = require("path");
const { genererPage } = require("./modele-analyse.js");
const racine = process.argv[2] || path.join(__dirname, "..");

const EUR = 1468.36; // BCE, 17/11/2026
const dart = (rcp, texte) => `<a href="https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rcp}">${texte}</a>`;
const commun = {
  unite: "₩", uniteLongue: "wons", eur: EUR,
  tauxSansRisque: "obligation d'État coréenne à 10 ans, 3,97 % (clôture du 17 novembre 2026)",
  noteRapp: "Exercices clos fin décembre, en millions de wons sauf mention (dividende et cours en wons). Chiffres des rapports annuels déposés sur DART. Fonds propres = part du groupe ; actions = actions en circulation hors autocontrôle à la clôture.",
  sourcesCommunes: [
    `<a href="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-krw.en.html">BCE : 1 € = 1 468,36 ₩ (17/11/2026)</a>`,
    `<a href="https://supple.kr/news/cmwkf9miopwcrjkunnuvbghf7">Taux coréen à 10 ans : 3,966 % (clôture du 17/11/2026)</a>`,
    `<a href="https://sodali.com/resources/insights/koreas-new-treasury-share-rules-and-what-they-mean-for-companies">Réforme coréenne : annulation obligatoire des actions auto-détenues (en vigueur le 06/03/2026)</a>`,
  ],
};
const reformeAutocontrole = "La réforme du droit des sociétés en vigueur depuis le 6 mars 2026 impose d'annuler les actions auto-détenues (délai de six mois pour celles déjà détenues), sauf plan de conservation approuvé chaque année par l'assemblée des actionnaires.";

const configs = [
  // ------------------------------------------------------------------ Daewon Sanup
  {
    ...commun, id: "005710-daewon-sanup", titre: "Daewon Sanup (005710, KOSDAQ, Séoul)", titreCourt: "Daewon Sanup (005710)",
    sousTitre: ({ m, v }) => `Analyse selon la méthode des Daubasses · 18 novembre 2026 · cours de clôture du 18 novembre : ${m(v.cours)} · bilan au 30 septembre 2026`,
    verdictTexte: ({ pct, r }) => `Net-Net : le cours vaut ${pct(r.coursSurVann)} de la VANN (seuil 70 %).`,
    verdictDetail: ({ m, r, sig, v }) => `Prix d'achat maximal : <strong>${m(r.prixMaxNetNet)}</strong>, soit ${sig(r.prixMaxNetNet / v.cours - 1, 0)} au-dessus du cours. Objectif de vente (VANT) : <strong>${m(r.vantParAction)}</strong>, soit ${sig(r.potentiel, 0)}. La trésorerie seule (441 Md₩) vaut plus de deux fois la capitalisation.`,
    enBref: ({ m, r, pct, v, nb }) => [
      `<strong>Un Net-Net net de dettes :</strong> trésorerie et dépôts de 441,3 Md₩, contre 170,5 Md₩ de dettes totales (dont seulement 8,1 Md₩ d'emprunts) et une capitalisation de ${nb(v.cours * v.nbActions / 1000, 1)} Md₩. La décote ne repose ni sur les stocks (13,7 Md₩) ni sur l'immobilier.`,
      `<strong>Rentable depuis longtemps :</strong> bénéfice chaque année depuis 2018 ; 76,9 Md₩ en 2025 (3 836 ₩ par action, soit ${nb(v.cours / 3836, 1)} fois le bénéfice). Sur neuf mois 2026, le résultat net recule toutefois à 49,9 Md₩, contre 71,4 Md₩ un an plus tôt.`,
      `<strong>Direction (RAPP) :</strong> 3 ratios conformes sur 4 (aucune dilution, frais tenus, stocks très bas). La création de valeur (+12 % par an) est forte, mais le cours a monté presque aussi vite, surtout en 2025.`,
      `<strong>Dividende faible :</strong> 250 ₩ pour 2025, soit ${pct(250 / v.cours)} au cours actuel et environ 7 % du bénéfice : l'argent s'accumule au bilan.`,
      `<strong>Points de vigilance :</strong> client quasi unique (Kia en Corée), filiale en Russie (6 % des ventes), famille fondatrice à 63 %.`,
      `<strong>En pratique :</strong> environ 115 millions de wons échangés par jour (environ 78 000 €). Le titre n'est pas éligible au PEA.`,
    ],
    societe: () => `<p>Daewon Sanup (대원산업), fondée en 1968, fabrique des sièges automobiles : c'est sa seule activité. En Corée, elle équipe des modèles Kia (Carnival, Niro, Stonic, Morning) ; ses filiales produisent en Chine, en Russie et au Viêt Nam. La société mère emploie 576 personnes.</p>
    <div class="tableau-cadre"><table class="table-simple">
      <thead><tr><th scope="col">Ventes 2025 par pays</th><th scope="col" class="num">Md₩</th><th scope="col" class="num">Part</th></tr></thead>
      <tbody><tr><td>Corée</td><td class="num">917,2</td><td class="num">86,6 %</td></tr><tr><td>Russie</td><td class="num">63,3</td><td class="num">6,0 %</td></tr><tr><td>Chine</td><td class="num">47,0</td><td class="num">4,4 %</td></tr><tr><td>Viêt Nam</td><td class="num">31,4</td><td class="num">3,0 %</td></tr></tbody>
    </table></div>
    <p>Actionnariat (31 décembre 2025) : M. Huh Jae-geon 16,5 %, M. Huh Jae-hyuk 8,8 %, Okcheon Sanup 8,2 %, et de nombreux membres de la famille et sociétés liées : 63,0 % au total. Aucune action auto-détenue, aucune action de préférence ; 20 037 600 actions.</p>
    <p>Résultats : en 2025, chiffre d'affaires de 1 058,9 Md₩ (+13,7 %), résultat d'exploitation de 70,8 Md₩ et résultat net de 76,9 Md₩. Sur les neuf premiers mois de 2026, le résultat d'exploitation tombe à 41,6 Md₩ (75,0 Md₩ un an plus tôt) et le résultat net à 49,9 Md₩.</p>`,
    noteBilan: () => `Bilan consolidé au 30 septembre 2026, en millions de wons. Source : rapport trimestriel déposé sur DART le 16 novembre 2026. La valeur brute des immeubles vient du rapport annuel 2025 (note sur les immobilisations corporelles).`,
    lignesBilan: ({ v, r }) => [
      ["Trésorerie (58 175,0) et dépôts à court terme (383 084,8)", v.tresorerie],
      ["Créances clients", v.creances],
      ["Stocks", v.stocks],
      ["Autres actifs courants (actifs financiers et divers)", v.autresActifsCourants],
      ["Total de l'actif courant", v.tresorerie + v.creances + v.stocks + v.autresActifsCourants, true],
      ["Dettes totales (dont 8 126,3 d'emprunts et 12 969,2 de provisions)", v.dettesTotales],
      ["Intérêts minoritaires", v.minoritaires],
      ["Capitaux propres part du groupe", v.capitauxPropres],
      ["Immobilisations incorporelles", v.incorporels],
      ["Impôts différés actifs", v.impotsDifferesActifs],
      ["Total du bilan", v.totalBilan],
      ["Terrains (coût, au 31/12/2025)", 24754.1],
      ["Bâtiments (65 781,3) et constructions (2 659,5), valeur brute au 31/12/2025", 68440.8],
      ["Immeubles de placement (valeur nette, retenue par prudence)", 6054.4],
    ],
    noteBilan2: () => `Les provisions (garanties, notamment) figurent déjà dans les dettes : elles ne sont pas déduites une seconde fois. Hors calcul : 30,2 Md₩ de participations dans des sociétés associées et 10,9 Md₩ de titres financiers.`,
    retraitement: ({ R }) => `Aucune décote. Les stocks sont très faibles (13,7 Md₩, environ 5 jours de coût des ventes en 2025, contre ${Math.round(R.stocks.reference)} jours en moyenne auparavant) et la règle du cours ne déclenche rien. Les créances représentent environ 46 jours de ventes, un délai normal pour un fournisseur automobile.`,
    scenarios: [
      ["Retenu : aucune décote", { decoteStocks: 0 }],
      ["Stocks décotés de 50 %", { decoteStocks: 0.5 }],
      ["Créances décotées de 20 %", { decoteCreances: 0.2 }],
      ["Créances −20 % et stocks −50 %", { decoteCreances: 0.2, decoteStocks: 0.5 }],
    ],
    sensibilite: ({ m, scen, pct }) => `<p>Le verdict ne dépend ni de l'immobilier, ni des stocks : même en décotant fortement les créances et les stocks, le cours reste à ${pct(scen[3][1].coursSurVann)} de la VANN. C'est un Net-Net « de trésorerie » : 441 Md₩ de liquidités pour une capitalisation d'environ 212 Md₩.</p>`,
    constats: {
      actions: ({ nb, R }) => `${nb(R.actions.debut, 3)} → ${nb(R.actions.fin, 3)} millions : aucune émission ni rachat depuis 2018.`,
      frais: ({ pct, R }) => `${pct(R.frais.debut)} → ${pct(R.frais.fin)} du chiffre d'affaires, contre ${pct(R.frais.reference)} en moyenne : très bas et stables, malgré la hausse de 2025.`,
      stocks: ({ nb, R }) => `${nb(R.stocks.debut)} → ${nb(R.stocks.fin)} jours. La forte baisse de 2025 (stocks de 40,5 à 13,0 Md₩) n'est pas expliquée dans les extraits lus ; elle va dans le bon sens.`,
      creation: ({ nb, m, sig, pct, R, rf }) => `(${nb(R.creation.fin)} − ${nb(R.creation.debut)}) + ${nb(R.creation.dividendes)} ₩ de dividendes = ${m(R.creation.creation)} en ${R.creation.annees} ans, soit ${sig(R.creation.rendement)} par an : bien au-dessus du seuil de la méthode (${pct(rf.tsr + 0.03, 2)}). Mais le cours a progressé au même rythme (${sig(R.creation.hausseCours)} par an), à cause du doublement de 2025.`,
    },
    horsFormules: ({ nb, v }) => [
      `<strong>Réserves non comptées :</strong> 30,2 Md₩ de participations dans des sociétés associées, 10,9 Md₩ de titres et 16,8 Md₩ d'impôts différés actifs, soit environ ${nb((30248.4 + 10888.5) / v.nbActions)} ₩ par action hors impôts différés.`,
      `<strong>Pourquoi la décote :</strong> famille fondatrice à 63 %, dividende très faible au regard des bénéfices, trésorerie qui s'accumule sans usage annoncé, dépendance à un seul constructeur.`,
      `<strong>Risques :</strong> un fournisseur de sièges dépend des volumes et des prix fixés par Kia ; la filiale russe (63,3 Md₩ de ventes en 2025, en forte hausse) expose aux sanctions ; une dépréciation de 7,6 Md₩ des usines a été passée en 2024. Les bénéfices 2026 sont en net recul.`,
      `<strong>Catalyseurs possibles :</strong> dividende porté de 125 ₩ (2018-2021) à 250 ₩ (2025), pression réglementaire en Corée en faveur des actionnaires minoritaires, et une trésorerie qui finira par peser sur la direction.`,
      `<strong>Le cours a déjà doublé :</strong> 5 920 ₩ fin 2024, 12 970 ₩ fin 2025, ${nb(v.cours)} ₩ aujourd'hui. La décote reste pourtant de moitié.`,
    ],
    liquidite: () => `Environ 115 millions de wons échangés par jour (environ 10 900 actions) : une ligne de plusieurs dizaines de milliers d'euros se construit en quelques séances, toujours avec un ordre limité.`,
    planPlus: () => [`Revoir l'analyse à chaque publication trimestrielle (mi-mars, mi-mai, mi-août, mi-novembre) : trésorerie, résultats, activité russe.`],
    sources: () => [
      dart("20261116000914", "Rapport trimestriel au 30/09/2026 (DART, 16/11/2026)"),
      dart("20260312001127", "Rapport annuel 2025 (DART, 12/03/2026) : immobilisations, actionnaires, ventes par pays, dividendes"),
      "Rapports annuels 2018 à 2024 sur DART (chiffres de la RAPP)",
      `<a href="https://finance.yahoo.com/quote/005710.KQ/">Yahoo Finance : cours de clôture (18/11/2026) et cours de fin décembre</a>`,
      ...commun.sourcesCommunes,
    ],
  },

  // ------------------------------------------------------------------ SYTS
  {
    ...commun, id: "002170-syts", titre: "SYTS, ex-Samyang Tongsang (002170, KOSPI, Séoul)", titreCourt: "SYTS (002170)",
    sousTitre: ({ m, v }) => `Analyse selon la méthode des Daubasses · 18 novembre 2026 · cours de clôture du 18 novembre : ${m(v.cours)} · bilan au 30 septembre 2026`,
    verdictTexte: ({ pct, r }) => `Net-Net : le cours vaut ${pct(r.coursSurVann)} de la VANN (seuil 70 %).`,
    verdictDetail: ({ m, r, sig, v }) => `Prix d'achat maximal : <strong>${m(r.prixMaxNetNet)}</strong>, soit ${sig(r.prixMaxNetNet / v.cours - 1, 0)} au-dessus du cours. Objectif de vente (VANT) : <strong>${m(r.vantParAction)}</strong>, soit ${sig(r.potentiel, 0)}. La trésorerie nette dépasse à elle seule la capitalisation.`,
    enBref: ({ pct, v, nb }) => [
      `<strong>Un Net-Net de trésorerie :</strong> 229,4 Md₩ de liquidités et placements, contre 24,6 Md₩ de dettes (aucun emprunt) et une capitalisation de ${nb(v.cours * v.nbActions / 1000, 1)} Md₩.`,
      `<strong>Rentable chaque année :</strong> résultat net de 11 à 50 Md₩ par an depuis 2018 ; 24,0 Md₩ en 2025 (9 071 ₩ par action, soit ${nb(v.cours / 9071, 1)} fois le bénéfice). Sur neuf mois 2026 : 13,7 Md₩, contre 15,9 Md₩ un an plus tôt.`,
      `<strong>Direction (RAPP) : 3 ratios conformes sur 4.</strong> Rachats d'actions réguliers (−11 % d'actions en circulation depuis 2018), fonds propres par action en hausse de 9 % par an, dividendes compris.`,
      `<strong>Dividende généreux :</strong> 2 300 ₩ pour 2025, soit ${pct(2300 / v.cours)} au cours actuel.`,
      `<strong>Points de vigilance :</strong> la famille Huh contrôle 58,6 % du capital ; il s'échange moins de 1 000 actions par jour.`,
    ],
    societe: () => `<p>SYTS (에스와이티에스), qui s'appelait Samyang Tongsang jusqu'en avril 2026, est un tanneur : elle transforme des peaux brutes importées en cuir pour l'habillement, la maroquinerie, l'ameublement et surtout les sièges automobiles (filiale de Qingdao, en Chine). Elle loue aussi de l'immobilier à Séoul, dans la province de Gyeonggi et à Busan. 279 salariés.</p>
    <p>Actionnariat (30 septembre 2026) : M. Huh Joon-hong 45,0 % et sa famille, 58,6 % au total ; Chokwang Leather 6,1 % ; les petits porteurs détenaient 19,6 % des actions fin 2025. 3 000 000 d'actions émises, dont 449 280 auto-détenues (15,0 %) : il en reste 2 550 720 en circulation.</p>
    <p>Résultats : en 2025, chiffre d'affaires de 174,7 Md₩, résultat d'exploitation de 18,4 Md₩ et résultat net de 24,0 Md₩. Sur les neuf premiers mois de 2026 : 115,9 Md₩ de ventes et 13,7 Md₩ de résultat net. Le changement de nom s'accompagne d'un plan d'investissement (intelligence artificielle dans la production, centre de recherche, salle d'exposition d'ici fin 2026), sans montant annoncé.</p>`,
    noteBilan: () => `Bilan consolidé au 30 septembre 2026, en millions de wons. Source : rapport trimestriel déposé sur DART le 16 novembre 2026. La valeur brute des immeubles vient du rapport annuel 2025 (montants en milliers de wons convertis).`,
    lignesBilan: ({ v }) => [
      ["Trésorerie (5 911,9), dépôts (170 000,0) et placements à court terme (53 516,8)", v.tresorerie],
      ["Créances clients et autres", v.creances],
      ["Stocks (cuirs et peaux)", v.stocks],
      ["Autres actifs courants", v.autresActifsCourants],
      ["Total de l'actif courant", v.tresorerie + v.creances + v.stocks + v.autresActifsCourants, true],
      ["Dettes totales (aucun emprunt ; dont 9 914,8 d'impôts différés passifs)", v.dettesTotales],
      ["Intérêts minoritaires", v.minoritaires],
      ["Capitaux propres part du groupe", v.capitauxPropres],
      ["Immobilisations incorporelles", v.incorporels],
      ["Impôts différés actifs", v.impotsDifferesActifs],
      ["Total du bilan", v.totalBilan],
      ["Terrains (coût, au 31/12/2025)", 24410.7],
      ["Bâtiments (17 672,8), agencements (4 779,9) et constructions (9 445,5), valeur brute au 31/12/2025", 31898.2],
      ["Immeubles de placement (valeur nette, retenue par prudence)", 21223.9],
    ],
    noteBilan2: () => `Hors calcul : 65,7 Md₩ de participations dans des sociétés associées et 12,0 Md₩ de titres financiers à long terme.`,
    retraitement: ({ R, nb }) => `Aucune décote. La durée de stockage, longue par nature dans le cuir (${nb(R.stocks.fin)} jours en 2025), reste dans la moyenne des années précédentes (${nb(R.stocks.reference)} jours) : la règle du cours ne déclenche rien. Les créances représentent environ 72 jours de ventes.`,
    scenarios: [
      ["Retenu : aucune décote", { decoteStocks: 0 }],
      ["Stocks décotés de 30 %", { decoteStocks: 0.3 }],
      ["Stocks décotés de 50 %", { decoteStocks: 0.5 }],
      ["Stocks −50 % et créances −20 %", { decoteStocks: 0.5, decoteCreances: 0.2 }],
    ],
    sensibilite: ({ scen, pct }) => `<p>Même en divisant la valeur des stocks par deux et en décotant les créances, le cours reste à ${pct(scen[3][1].coursSurVann)} de la VANN. La trésorerie nette (204,8 Md₩) couvre à elle seule 1,6 fois la capitalisation.</p>`,
    constats: {
      actions: ({ nb, sig, R }) => `${nb(R.actions.debut, 3)} → ${nb(R.actions.fin, 3)} millions (${sig(R.actions.variation)}) : rachats d'actions presque chaque année ; 2,551 millions au 30 septembre 2026.`,
      frais: ({ pct, R }) => `${pct(R.frais.debut)} → ${pct(R.frais.fin)} du chiffre d'affaires, contre ${pct(R.frais.reference)} en moyenne : les frais restent faibles, mais ils montent lentement. Pour 2025, frais = marge brute − résultat d'exploitation.`,
      stocks: ({ nb, R }) => `${nb(R.stocks.debut)} → ${nb(R.stocks.fin)} jours, dans la moyenne des années précédentes. Pic en 2021-2023, puis retour progressif.`,
      creation: ({ nb, m, sig, pct, R, rf }) => `(${nb(R.creation.fin)} − ${nb(R.creation.debut)}) + ${nb(R.creation.dividendes)} ₩ de dividendes = ${m(R.creation.creation)} en ${R.creation.annees} ans, soit ${sig(R.creation.rendement)} par an : au-dessus du seuil de la méthode (${pct(rf.tsr + 0.03, 2)}) et bien au-dessus de la hausse du cours (${sig(R.creation.hausseCours)} par an).`,
    },
    horsFormules: ({ nb, v }) => [
      `<strong>Réserves non comptées :</strong> 65,7 Md₩ de participations dans des sociétés associées et 12,0 Md₩ de titres à long terme, soit environ ${nb((65680.3 + 12010.0) / v.nbActions)} ₩ par action, plus de la moitié du cours.`,
      `<strong>Actions auto-détenues :</strong> 15 % du capital. ${reformeAutocontrole} SYTS les détenait encore au 30 septembre 2026 et continuait d'en acheter (360 000 fin 2025, 449 280 fin septembre 2026). Leur annulation ferait mécaniquement monter la VANN par action.`,
      `<strong>Pourquoi la décote :</strong> contrôle familial (58,6 %), métier du cuir en déclin face à la concurrence chinoise et sud-américaine (selon la société elle-même), titre très peu échangé.`,
      `<strong>Risques :</strong> activité exposée au dollar et au prix des peaux ; recul des ventes en 2025 et 2026 ; le nouveau plan d'investissement pourrait consommer une partie de la trésorerie.`,
      `<strong>Catalyseurs possibles :</strong> dividende porté de 1 500 à 2 300 ₩ pour 2025, rachats d'actions, réforme coréenne sur les actions auto-détenues.`,
    ],
    liquidite: () => `Titre très peu liquide : environ 41 millions de wons par jour (moins de 1 000 actions). Une ligne de quelques dizaines de milliers d'euros demande plusieurs semaines, avec des ordres limités fractionnés.`,
    planPlus: () => [`Revoir l'analyse à chaque publication trimestrielle : trésorerie, sort des actions auto-détenues, montant réellement investi dans le plan annoncé.`],
    sources: () => [
      dart("20261116001742", "Rapport trimestriel au 30/09/2026 (DART, 16/11/2026) : bilan, actionnaires, actions auto-détenues"),
      dart("20260319000873", "Rapport annuel 2025 (DART, 19/03/2026) : immobilisations, activité, dividendes"),
      "Rapports annuels 2018 à 2024 sur DART (chiffres de la RAPP)",
      `<a href="https://www.asiae.co.kr/en/article/2026042216303672123">Asiae : changement de nom en SYTS et plan d'investissement (avril 2026)</a>`,
      `<a href="https://finance.yahoo.com/quote/002170.KS/">Yahoo Finance : cours de clôture (18/11/2026) et cours de fin décembre</a>`,
      ...commun.sourcesCommunes,
    ],
  },

  // ------------------------------------------------------------------ Dongil Industries
  {
    ...commun, id: "004890-dongil-industries", titre: "Dongil Industries (004890, KOSPI, Séoul)", titreCourt: "Dongil Industries (004890)",
    classeVerdict: "v-attendre",
    sousTitre: ({ m, v }) => `Analyse selon la méthode des Daubasses · 18 novembre 2026 · cours de clôture du 18 novembre : ${m(v.cours)} · bilan au 30 septembre 2026`,
    verdictTexte: ({ pct, r }) => `Net-Net très profond (${pct(r.coursSurVann)} de la VANN), mais la direction est en alerte sur deux ratios.`,
    verdictDetail: ({ m, r, sig, v }) => `Les chiffres autorisent l'achat jusqu'à <strong>${m(r.prixMaxNetNet)}</strong> (${sig(r.prixMaxNetNet / v.cours - 1, 0)} au-dessus du cours), avec un objectif VANT de <strong>${m(r.vantParAction)}</strong>. La RAPP signale toutefois des stocks qui gonflent et une création de valeur inférieure au taux sans risque : à réserver à une petite ligne, après lecture des risques.`,
    enBref: ({ pct, v, nb }) => [
      `<strong>La décote la plus forte :</strong> trésorerie et placements de 145,8 Md₩ pour 57,8 Md₩ de dettes totales et une capitalisation de ${nb(v.cours * v.nbActions / 1000, 1)} Md₩. Même avec les stocks décotés de 20 %, le cours vaut ${pct(v.cours / 122424, 1)} de la VANN.`,
      `<strong>Mais une activité en difficulté :</strong> pertes d'exploitation en 2023, 2024 et 2025 ; perte nette de 12,9 Md₩ en 2025. Neuf mois 2026 bénéficiaires (19,8 Md₩), mais résultat quasi nul au troisième trimestre.`,
      `<strong>Direction (RAPP) : 1 ratio conforme, 2 alertes.</strong> Les stocks tournent de plus en plus lentement et les fonds propres par action n'ont progressé que de 3,2 % par an, dividendes compris.`,
      `<strong>Un passé boursier agité :</strong> le titre est passé de 58 800 ₩ fin 2018 à 223 000 ₩ en avril 2023, avant de s'effondrer le 14 juin 2023 avec quatre autres titres, dans une affaire de manipulation présumée.`,
      `<strong>Dividende maintenu :</strong> 1 000 ₩ pour 2025 malgré la perte, soit ${pct(1000 / v.cours)} au cours actuel.`,
    ],
    societe: () => `<p>Dongil Industries (동일산업) produit des barres d'acier (pièces automobiles, roulements, mécanique), des ferroalliages pour les aciéries (POSCO, Hyundai Steel), des pièces moulées pour engins de chantier et, via sa filiale D-Automotive, des pièces de transmission pour Hyundai Wia. La société mère emploie 207 personnes.</p>
    <div class="tableau-cadre"><table class="table-simple">
      <thead><tr><th scope="col">Activité (2025)</th><th scope="col" class="num">Ventes (Md₩)</th><th scope="col" class="num">Résultat d'exploitation (Md₩)</th></tr></thead>
      <tbody><tr><td>Barres d'acier</td><td class="num">181,1</td><td class="num">−3,3</td></tr><tr><td>Ferroalliages</td><td class="num">76,5</td><td class="num">−4,8</td></tr><tr><td>Fonderie</td><td class="num">37,5</td><td class="num">−0,2</td></tr><tr><td>Pièces automobiles</td><td class="num">52,9</td><td class="num">+5,1</td></tr></tbody>
    </table></div>
    <p>Actionnariat (30 septembre 2026) : M. Oh Soon-taek 16,6 %, son fils Oh Seung-min 13,1 %, la famille et des sociétés liées (dont Dongil Metal 4,5 %) : 48,5 % ; s'y ajoutent 11,7 % d'actions auto-détenues. 2 425 215 actions émises, 2 141 526 en circulation.</p>
    <p>Résultats : chiffre d'affaires en baisse depuis 2022 (498,1 Md₩) jusqu'à 347,9 Md₩ en 2025, avec une perte nette de 12,9 Md₩. Sur neuf mois 2026 : 283,9 Md₩ de ventes et 19,8 Md₩ de résultat net.</p>`,
    noteBilan: () => `Bilan consolidé au 30 septembre 2026, en millions de wons. Source : rapport trimestriel déposé sur DART le 16 novembre 2026. La valeur brute des immeubles vient du rapport annuel 2025.`,
    lignesBilan: ({ v }) => [
      ["Trésorerie (52 999,6) et autres actifs financiers à court terme (92 767,5)", v.tresorerie],
      ["Créances clients et autres", v.creances],
      ["Stocks (acier, ferroalliages, en-cours)", v.stocks],
      ["Autres actifs courants", v.autresActifsCourants],
      ["Total de l'actif courant", v.tresorerie + v.creances + v.stocks + v.autresActifsCourants, true],
      ["Dettes totales (dont 9 500,0 d'emprunts)", v.dettesTotales],
      ["Intérêts minoritaires", v.minoritaires],
      ["Capitaux propres part du groupe", v.capitauxPropres],
      ["Immobilisations incorporelles", v.incorporels],
      ["Impôts différés actifs", v.impotsDifferesActifs],
      ["Total du bilan", v.totalBilan],
      ["Terrains (coût, au 31/12/2025)", 35328.9],
      ["Bâtiments, valeur brute au 31/12/2025", 48153.9],
      ["Immeubles de placement (valeur nette, retenue par prudence)", 5783.1],
    ],
    noteBilan2: () => `Hors calcul : 57,5 Md₩ d'actifs financiers à long terme et 9,9 Md₩ de participations dans des sociétés associées.`,
    retraitement: ({ R, nb }) => `Stocks décotés de 20 %. La durée de stockage est passée à ${nb(R.stocks.fin)} jours en 2025, contre ${nb(R.stocks.reference)} jours en moyenne auparavant : la règle du cours (plus de 10 % au-dessus de la moyenne) s'applique. Au 30 septembre 2026, les stocks ont encore augmenté (107,9 Md₩, environ 112 jours au rythme du troisième trimestre). Les créances (environ 89 jours de ventes) ne sont pas décotées.`,
    scenarios: [
      ["Sans décote sur les stocks", { decoteStocks: 0 }],
      ["Retenu : stocks décotés de 20 %", { decoteStocks: 0.2 }],
      ["Stocks décotés de 50 %", { decoteStocks: 0.5 }],
      ["Stocks −50 % et créances −20 %", { decoteStocks: 0.5, decoteCreances: 0.2 }],
    ],
    sensibilite: ({ scen, pct }) => `<p>La décote résiste à tous les scénarios : même avec des stocks valant moitié moins et des créances décotées, le cours reste à ${pct(scen[3][1].coursSurVann)} de la VANN. Le risque n'est pas dans le bilan d'aujourd'hui, mais dans les pertes qui pourraient l'éroder.</p>`,
    constats: {
      actions: ({ nb, sig, R }) => `${nb(R.actions.debut, 3)} → ${nb(R.actions.fin, 3)} millions (${sig(R.actions.variation)}) : petits rachats en 2019 et 2025, aucune dilution.`,
      frais: ({ pct, R }) => `${pct(R.frais.debut)} → ${pct(R.frais.fin)} du chiffre d'affaires, contre ${pct(R.frais.reference)} en moyenne : les frais pèsent plus parce que les ventes reculent.`,
      stocks: ({ nb, sig, R }) => `${nb(R.stocks.debut)} → ${nb(R.stocks.fin)} jours, ${sig(R.stocks.variation)} par rapport à la moyenne : les stocks gonflent alors que les ventes baissent, ce qui justifie la décote de 20 %.`,
      creation: ({ nb, m, sig, pct, R, rf }) => `(${nb(R.creation.fin)} − ${nb(R.creation.debut)}) + ${nb(R.creation.dividendes)} ₩ de dividendes = ${m(R.creation.creation)} en ${R.creation.annees} ans, soit ${sig(R.creation.rendement)} par an : moins que le taux sans risque (${pct(rf.tsr, 2)}). Le cours a baissé (${sig(R.creation.hausseCours)} par an), mais il partait d'un niveau gonflé.`,
    },
    horsFormules: ({ nb, v }) => [
      `<strong>Réserves non comptées :</strong> 57,5 Md₩ d'actifs financiers à long terme et 9,9 Md₩ de participations, soit environ ${nb((57507.0 + 9883.3) / v.nbActions)} ₩ par action, presque le double du cours.`,
      `<strong>L'affaire de 2023 :</strong> le 14 juin 2023, Dongil Industries, Dongil Metal, Manho Rope, Daehan Textile et Bang Rim ont chuté au plancher de la journée ; les autorités ont suspendu les cotations et soupçonné une manipulation de cours. La hausse de 2020-2023 n'était donc pas liée aux résultats ; le cours actuel (environ 34 000 ₩) en est débarrassé.`,
      `<strong>Actions auto-détenues :</strong> 11,7 % du capital. ${reformeAutocontrole} Dongil les détenait encore au 30 septembre 2026.`,
      `<strong>Pourquoi la décote :</strong> activités d'acier en perte, contrôle familial, historique boursier entaché, titre peu échangé.`,
      `<strong>Risques :</strong> poursuite des pertes d'exploitation dans l'acier et les ferroalliages, stocks en hausse, sensibilité aux prix des métaux. Une société qui perd de l'argent consomme peu à peu sa VANN : c'est le piège classique des Net-Nets.`,
    ],
    liquidite: () => `Environ 58 millions de wons échangés par jour (environ 1 700 actions). Compte tenu des alertes de la RAPP, une ligne réduite (par exemple 2 à 3 % du portefeuille) paraît plus cohérente avec la méthode.`,
    planPlus: () => [`Revoir l'analyse à chaque publication trimestrielle, en priorité les stocks et le résultat d'exploitation : deux trimestres de pertes supplémentaires ou une nouvelle hausse des stocks seraient des signaux de sortie.`],
    sources: () => [
      dart("20261116001967", "Rapport trimestriel au 30/09/2026 (DART, 16/11/2026) : bilan, actionnaires"),
      dart("20260326000328", "Rapport annuel 2025 rectifié (DART, 26/03/2026) : immobilisations, activités, dividendes"),
      "Rapports annuels 2018 à 2024 sur DART (chiffres de la RAPP)",
      `<a href="https://biz.sbs.co.kr/amp/article/20000122549">SBS Biz : cinq titres au plancher le 14/06/2023 et suspension des cotations</a>`,
      `<a href="https://finance.yahoo.com/quote/004890.KS/">Yahoo Finance : cours de clôture (18/11/2026) et cours de fin décembre</a>`,
      ...commun.sourcesCommunes,
    ],
  },
];

for (const c of configs) {
  const { r, rapp } = genererPage(racine, c);
  console.log(c.id, Math.round(r.vannParAction), r.coursSurVann.toFixed(3), r.verdict.code, JSON.stringify(rapp.synthese));
}
