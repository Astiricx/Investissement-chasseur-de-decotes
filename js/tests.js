/* Tests unitaires : exécutés à chaque chargement de la page et par `node js/tests.js`. */
(function (racine) {
  "use strict";
  const sousNode = typeof module !== "undefined" && module.exports;
  const D = sousNode ? require("./calc.js") : racine.Decotes;
  const Donnees = sousNode ? require("./donnees.js") : racine.DecotesDonnees;
  const Coffre = sousNode ? require("./coffre.js") : racine.DecotesCoffre;
  const CSV = sousNode ? require("./csv.js") : racine.DecotesCSV;
  const Reseau = sousNode ? require("./reseau.js") : racine.DecotesReseau;
  const Journal = sousNode ? require("./journal.js") : racine.DecotesJournal;
  const M = sousNode ? require("./methodes.js") : racine.DecotesMethodes;
  const Gerants = sousNode ? require("./gerants.js") : racine.DecotesGerants;
  const Publiees = sousNode ? require("./analyses-publiees.js") : racine.DecotesAnalysesPubliees;
  const resultats = [];
  const arrondi = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
  function verifier(nom, obtenu, attendu) {
    const ok = obtenu === attendu;
    resultats.push({ nom, ok, obtenu, attendu });
    console.assert(ok, `Test échoué : ${nom} (obtenu ${obtenu}, attendu ${attendu})`);
  }

  // 1. Cas d'école Alpha Industrie : les valeurs du corrigé du cours.
  const a = D.analyser(D.ALPHA_INDUSTRIE);
  verifier("Alpha : VANN par action = 4,30 €", arrondi(a.vannParAction, 2), 4.3);
  verifier("Alpha : VANE par action = 6,10 €", arrondi(a.vaneParAction, 2), 6.1);
  verifier("Alpha : VANT par action = 7,50 €", arrondi(a.vantParAction, 2), 7.5);
  verifier("Alpha : solvabilité maison = 88,1 %", arrondi(a.solvabilite, 3), 0.881);
  verifier("Alpha : VANN = 17,2 M€", arrondi(a.vann, 2), 17.2);
  verifier("Alpha : prix maximal Net-Net = 3,01 €", arrondi(a.prixMaxNetNet, 2), 3.01);
  verifier("Alpha : prix maximal Net-Estate = 4,27 €", arrondi(a.prixMaxNetEstate, 2), 4.27);
  verifier("Alpha : verdict Net-Estate", a.verdict.code, "net-estate");

  // 2. Filtres et verdicts.
  const avec = (modifs) => D.analyser(Object.assign({}, D.ALPHA_INDUSTRIE, modifs));
  verifier("Cours à 3,00 € : verdict Net-Net", avec({ cours: 3 }).verdict.code, "net-net");
  verifier("Cours à 3,01 € : limite Net-Net incluse", avec({ cours: 3.01 }).verdict.code, "net-net");
  verifier("Cours à 5,00 € : décote insuffisante", avec({ cours: 5 }).verdict.code, "attendre");
  verifier("Dettes > actif courant : exclue", avec({ dettesTotales: 50 }).verdict.code, "exclue");
  verifier("Solvabilité < 40 % : exclue", avec({ capitauxPropres: 12, minoritaires: 0 }).verdict.code, "exclue");
  verifier("Nombre d'actions manquant : pas de valeur par action", avec({ nbActions: null }).vannParAction, null);

  // 3. Statut d'une ligne du portefeuille.
  const S = D.STATUTS;
  const base = { quantite: 100, prixRevient: 3.5, cours: 3.8, objectif: 7.5, solvabilite: 0.88 };
  const statut = (modifs) => D.statutLigne(Object.assign({}, base, modifs));
  verifier("Statut : GARDER", statut({}), S.GARDER);
  verifier("Statut : À COMPLÉTER sans cours", statut({ cours: null }), S.A_COMPLETER);
  verifier("Statut : À COMPLÉTER sans objectif", statut({ objectif: null }), S.A_COMPLETER);
  verifier("Statut : VENDRE au-dessus de l'objectif", statut({ cours: 7.6 }), S.VENDRE);
  verifier("Statut : VENDRE à l'objectif", statut({ cours: 7.5 }), S.VENDRE);
  verifier("Statut : VENDRE si potentiel < 20 %", statut({ cours: 6.5 }), S.VENDRE);
  verifier("Statut : GARDER si potentiel = 25 %", statut({ cours: 6 }), S.GARDER);
  verifier("Statut : RENFORCER ? à −20 %", statut({ cours: 2.8 }), S.RENFORCER);
  verifier("Statut : GARDER à −19 %", statut({ cours: 2.84 }), S.GARDER);
  verifier("Statut : RÉEXAMINER si solvabilité < 40 %", statut({ cours: 2.8, solvabilite: 0.3 }), S.REEXAMINER);
  verifier("Statut : RÉEXAMINER prime sur VENDRE", statut({ cours: 7.6, solvabilite: 0.3 }), S.REEXAMINER);
  verifier("Statut : pas de renfort sans solvabilité connue", statut({ cours: 2.8, solvabilite: null }), S.REEXAMINER);
  verifier("Statut : renfort si bilan jugé solide", statut({ cours: 2.8, solvabilite: null, bilanSolide: true }), S.RENFORCER);
  verifier("Statut : RÉEXAMINER si bilan jugé non solide", statut({ bilanSolide: false }), S.REEXAMINER);

  // 4. Synthèse : poids des lignes et alertes.
  const jour = new Date(2027, 0, 4);
  const s = D.synthese(
    [
      { quantite: 100, prixRevient: 3.5, cours: 4, objectif: 7.5, solvabilite: 0.88, dateResultats: "2027-01-14" },
      { quantite: 100, prixRevient: 8, cours: 10, objectif: 20, solvabilite: 0.6, dateResultats: "2027-03-01" },
    ],
    8600, null, jour);
  verifier("Synthèse : valeur totale = 10 000 €", s.total, 10000);
  verifier("Synthèse : part de cash = 86 %", arrondi(s.partCash, 2), 0.86);
  verifier("Synthèse : ligne à 4 % non signalée", s.detail[0].tropLourde, false);
  verifier("Synthèse : ligne à 10 % trop lourde", s.detail[1].tropLourde, true);
  verifier("Synthèse : résultats dans 10 jours signalés", s.detail[0].resultatsProches, true);
  verifier("Synthèse : résultats dans 56 jours non signalés", s.detail[1].resultatsProches, false);

  // 5. Lecture d'un CSV exporté d'Excel (titre au-dessus, point-virgule, nombres à la française).
  const csv = [
    "Portefeuille;;;;;;;;;",
    "Société;Code bourse;Enveloppe;Nombre d'actions;Prix d'achat (€);Cours actuel (€);Objectif de vente (€);Bilan toujours solide ?;Prochaine publication;Thèse et notes",
    "Alpha Industrie (exemple fictif);EXEMPLE;PEA;100;3,50 €;3,80 €;7,50 €;Oui;10/03/2027;exemple",
    "Bêta Textile;beta;PEA;1 250;9,20;15,4;16,00 €;Non;14/01/2027;\"Note avec ; point-virgule,\nsur deux lignes et \"\"guillemets\"\"\"",
    "Gamma Outillage;GAMM;CTO;abc;4,10;;;;;",
    ";;;;;;;;;",
    "Delta Négoce;DELT;CTO;60;6;;;;;",
  ].join("\r\n");
  const lu = CSV.lirePortefeuille(csv);
  verifier("CSV : deux lignes importées", lu.lignes.length, 2);
  verifier("CSV : deux lignes ignorées (exemple, quantité illisible)", lu.ignorees.length, 2);
  verifier("CSV : quantité avec espace des milliers", lu.lignes[0].quantite, 1250);
  verifier("CSV : prix à virgule", lu.lignes[0].prixRevient, 9.2);
  verifier("CSV : objectif avec symbole €", lu.lignes[0].objectif, 16);
  verifier("CSV : bilan solide « Non »", lu.lignes[0].bilanSolide, false);
  verifier("CSV : date française", lu.lignes[0].dateResultats, "2027-01-14");
  verifier("CSV : cellule entre guillemets", lu.lignes[0].notes, "Note avec ; point-virgule,\nsur deux lignes et \"guillemets\"");
  verifier("CSV : cellule vide = valeur absente", lu.lignes[1].objectif, null);
  verifier("CSV : séparateur virgule reconnu", CSV.lirePortefeuille("Nom,Ticker,Quantité,PRU,Objectif\nAlpha,ALPH,100,3.5,7.5\n").lignes[0].prixRevient, 3.5);
  verifier("CSV : colonnes manquantes signalées", CSV.lirePortefeuille("a;b\n1;2").erreur !== null, true);
  verifier("CSV : nombre anglais 1,234.50", CSV.lireNombre("1,234.50"), 1234.5);
  verifier("CSV : date impossible refusée", CSV.lireDate("31/02/2027"), null);
  verifier("CSV : fichier Windows-1252 décodé", CSV.decoder(new Uint8Array([0x53, 0x6f, 0x63, 0x69, 0xe9, 0x74, 0xe9]).buffer), "Société");

  // 6. Structure des données.
  const pf = Donnees.nouveauPortefeuille();
  const ajout = Donnees.ajouterLignes(pf, lu.lignes.concat([{ nom: "Doublon", code: "BETA", quantite: 1 }]));
  verifier("Données : lignes ajoutées", ajout.ajoutees, 2);
  verifier("Données : doublon de code écarté", ajout.doublons.length, 1);
  verifier("Données : code mis en majuscules", pf.lignes[0].code, "BETA");
  const sale = Donnees.normaliser({ version: 1, parametres: { cash: "beaucoup" }, lignes: [{ nom: "X", quantite: -5, cours: "3", enveloppe: "zzz" }, { nom: "" }], journal: "non" });
  verifier("Données : valeurs invalides neutralisées", JSON.stringify([sale.parametres.cash, sale.lignes.length, sale.lignes[0].quantite, sale.lignes[0].cours, sale.lignes[0].enveloppe, sale.journal.length]), JSON.stringify([0, 1, null, null, "PEA", 0]));
  let refus = false; try { Donnees.normaliser({ version: 99 }); } catch (e) { refus = true; }
  verifier("Données : version future refusée", refus, true);


  // 7. Journal : achats, ventes, dividendes.
  const pfJ = () => Donnees.normaliser({ version: 1, parametres: { capitalDepart: 10000, cash: 5000 }, lignes: [
    { nom: "Alpha Industrie", code: "ALPH", quantite: 100, prixRevient: 3.5, cours: 3.8, objectif: 7.5 },
    { nom: "Bêta Textile", code: "BETA", quantite: 40, prixRevient: null, cours: 15 },
  ] });
  let pj = pfJ();
  let ap = Journal.preparer(pj, { type: "achat", date: "2027-01-10", code: "alph", quantite: 50, prix: 3, frais: 1.5 }, new Date(2027, 0, 12));
  verifier("Journal : achat sans erreur", ap.erreurs.length, 0);
  verifier("Journal : achat, total décaissé = 151,50 €", ap.op.total, 151.5);
  verifier("Journal : achat, quantité 100 → 150", ap.ligne.apres.quantite, 150);
  verifier("Journal : achat, PRU pondéré frais inclus = 3,3433 €", ap.ligne.apres.prixRevient, 3.3433);
  verifier("Journal : achat, cash 5 000 → 4 848,50 €", ap.cash.apres, 4848.5);
  verifier("Journal : achat, nom repris de la ligne", ap.op.nom, "Alpha Industrie");
  Journal.appliquer(pj, ap, { majLigne: true, majCash: true });
  verifier("Journal : achat appliqué à la ligne et au cash", JSON.stringify([pj.lignes[0].quantite, pj.lignes[0].prixRevient, pj.parametres.cash, pj.journal.length]), JSON.stringify([150, 3.3433, 4848.5, 1]));
  pj = pfJ();
  ap = Journal.preparer(pj, { type: "achat", date: "2027-01-10", nom: "Alpha Industrie", quantite: 10, prix: 3, frais: 0 }, new Date(2027, 0, 12));
  Journal.appliquer(pj, ap, { majLigne: false, majCash: false });
  verifier("Journal : refus de mise à jour respecté", JSON.stringify([pj.lignes[0].quantite, pj.parametres.cash, pj.journal.length]), JSON.stringify([100, 5000, 1]));
  pj = pfJ();
  ap = Journal.preparer(pj, { type: "achat", date: "2027-01-10", nom: "Zeta Fonderie", code: "ZETA", place: "Oslo", enveloppe: "CTO", quantite: 20, prix: 10, frais: 2 }, new Date(2027, 0, 12));
  verifier("Journal : achat d'une nouvelle société → création", ap.ligne.action, "creer");
  Journal.appliquer(pj, ap, { majLigne: true, majCash: true });
  const zeta = pj.lignes[2];
  verifier("Journal : nouvelle ligne créée (PRU 10,10 €, Oslo, CTO)", JSON.stringify([zeta.nom, zeta.quantite, zeta.prixRevient, zeta.place, zeta.enveloppe, zeta.cours]), JSON.stringify(["Zeta Fonderie", 20, 10.1, "XOSL", "CTO", 10]));
  pj = pfJ();
  ap = Journal.preparer(pj, { type: "vente", date: "2027-01-10", code: "ALPH", quantite: 40, prix: 7, frais: 2 }, new Date(2027, 0, 12));
  verifier("Journal : vente partielle, 100 → 60 titres, PRU inchangé", JSON.stringify([ap.ligne.action, ap.ligne.apres.quantite, ap.ligne.apres.prixRevient]), JSON.stringify(["modifier", 60, 3.5]));
  verifier("Journal : vente, total encaissé = 278 €", ap.op.total, 278);
  verifier("Journal : vente, plus-value réalisée = 138 €", ap.plusValue, 138);
  ap = Journal.preparer(pj, { type: "vente", date: "2027-01-10", code: "ALPH", quantite: 100, prix: 7, frais: 0 }, new Date(2027, 0, 12));
  Journal.appliquer(pj, ap, { majLigne: true, majCash: true });
  verifier("Journal : vente totale → ligne retirée", pj.lignes.some((l) => l.code === "ALPH"), false);
  verifier("Journal : plus-value conservée dans le journal", pj.journal[0].plusValue, 350);
  ap = Journal.preparer(pfJ(), { type: "vente", date: "2027-01-10", code: "ALPH", quantite: 150, prix: 7 }, new Date(2027, 0, 12));
  verifier("Journal : vente supérieure à la quantité détenue bloquée", JSON.stringify([ap.ligne.action, ap.ligne.probleme !== null]), JSON.stringify([null, true]));
  ap = Journal.preparer(pfJ(), { type: "vente", date: "2027-01-10", code: "BETA", quantite: 10, prix: 16 }, new Date(2027, 0, 12));
  verifier("Journal : vente sans PRU connu → pas de plus-value", ap.plusValue, null);
  ap = Journal.preparer(pfJ(), { type: "dividende", date: "2027-01-10", code: "ALPH", quantite: 100, prix: 0.2, frais: 6 }, new Date(2027, 0, 12));
  verifier("Journal : dividende, 20 € − 6 € de prélèvements = 14 €, ligne inchangée", JSON.stringify([ap.op.total, ap.cash.apres, ap.ligne.action]), JSON.stringify([14, 5014, null]));
  ap = Journal.preparer(pfJ(), { type: "achat", date: "", nom: "", quantite: 0, prix: 0 }, new Date(2027, 0, 12));
  verifier("Journal : saisie incomplète refusée (4 erreurs)", ap.erreurs.length, 4);
  ap = Journal.preparer(pfJ(), { type: "achat", date: "2027-01-10", code: "ALPH", quantite: 2000, prix: 3 }, new Date(2027, 0, 12));
  verifier("Journal : cash négatif signalé", ap.avertissements.some((a) => a.includes("négatif")), true);
  ap = Journal.preparer(pfJ(), { type: "achat", date: "2027-02-10", code: "ALPH", quantite: 1, prix: 3 }, new Date(2027, 0, 12));
  verifier("Journal : date future signalée", ap.avertissements.some((a) => a.includes("futur")), true);
  const sj = Journal.synthese([{ type: "achat", date: "2027-01-02", total: 100, frais: 1 }, { type: "vente", date: "2027-03-01", total: 80, plusValue: 12, frais: 1 }, { type: "dividende", date: "2027-02-01", total: 5, frais: 0 }]);
  verifier("Journal : tri du plus récent au plus ancien", sj.operations.map((o) => o.date).join(","), "2027-03-01,2027-02-01,2027-01-02");
  verifier("Journal : à date égale, dernière saisie d'abord", Journal.synthese([{ type: "achat", date: "2027-01-02", nom: "A" }, { type: "vente", date: "2027-01-02", nom: "B" }]).operations[0].nom, "B");
  verifier("Journal : totaux", JSON.stringify(sj.totaux), JSON.stringify({ achat: 100, vente: 80, dividende: 5, plusValues: 12, frais: 2 }));

  // 8. Places de cotation et ancien format.
  verifier("Place : « Euronext Paris » → XPAR", Donnees.placeDepuisTexte("Euronext Paris"), "XPAR");
  verifier("Place : « Oslo Børs » → XOSL", Donnees.placeDepuisTexte("Oslo Børs"), "XOSL");
  verifier("Place : inconnue → Paris par défaut", Donnees.normaliserLigne({ nom: "X", place: "Mars" }).place, "XPAR");
  verifier("Code : caractères dangereux retirés (« = » gardé pour GC=F)", Donnees.normaliserLigne({ nom: "X", code: "ab/../c?d&=1" }).code, "AB..CD=1");
  verifier("Ancienne sauvegarde sans relais ni place lisible", JSON.stringify([Donnees.normaliser({ version: 1, lignes: [{ nom: "X" }] }).parametres.relais, Donnees.normaliser({ version: 1, lignes: [{ nom: "X" }] }).lignes[0].place]), JSON.stringify(["", "XPAR"]));
  verifier("CSV : colonne « Place de cotation » lue", Donnees.normaliserLigne(CSV.lirePortefeuille("Société;Code;Place de cotation;Quantité\nAlpha;ALPH;Oslo;10").lignes[0]).place, "XOSL");


  // 11. Patrimoine : classes d'actifs, plus-values latentes, cash.
  const lignesP = [
    { nom: "Alpha", quantite: 100, prixRevient: 3.5, cours: 4, objectif: 7.5, solvabilite: 0.88 },
    { nom: "ETF Small Cap Value", classe: "etf", quantite: 10, prixRevient: 50, cours: 60 },
    { nom: "Or", classe: "or", quantite: 2, prixRevient: 1800, cours: 2000 },
    { nom: "ETF sans cours", classe: "etf", quantite: 5, prixRevient: 20, cours: null },
  ];
  const sp = D.synthese(lignesP, 500, null, new Date(2027, 0, 4));
  verifier("Patrimoine : ETF au statut SUIVI", sp.detail[1].statut, S.SUIVI);
  verifier("Patrimoine : ligne non décotée sans cours → À COMPLÉTER", sp.detail[3].statut, S.A_COMPLETER);
  verifier("Patrimoine : valeur par classe", JSON.stringify(sp.parClasse), JSON.stringify({ decote: 400, etf: 600, or: 4000 }));
  verifier("Patrimoine : plus-value latente totale = 50 + 100 + 400", sp.pvLatente, 550);
  verifier("Patrimoine : or à 72 % non signalé comme ligne trop lourde", sp.detail[2].tropLourde, false);
  verifier("Patrimoine : action à 7,3 % signalée", sp.detail[0].tropLourde, true);
  verifier("Patrimoine : cash à 9 % dans la zone 5-15 %", sp.zoneCash, "ok");
  verifier("Patrimoine : cash à 2 % sous la zone", D.synthese(lignesP, 100, null, new Date()).zoneCash, "bas");
  verifier("Patrimoine : cash à 50 % au-dessus de la zone", D.synthese(lignesP, 5000, null, new Date()).zoneCash, "haut");
  verifier("Classe : texte du fichier Excel reconnu", JSON.stringify(["Net-Estate (VANE)", "ETF Monde", "Mines d'or", "Or physique", ""].map(Donnees.classeDepuisTexte)), JSON.stringify(["decote", "etf", "or", "or", null]));
  verifier("Classe : ancienne ligne sans classe = action décotée", Donnees.normaliserLigne({ nom: "X" }).classe, "decote");

  // 12. Historique et fiches d'analyse.
  const ph = Donnees.nouveauPortefeuille();
  Donnees.noterHistorique(ph, "2027-01-04", 1000, 9000);
  Donnees.noterHistorique(ph, "2027-01-03", 900, 9000);
  Donnees.noterHistorique(ph, "2027-01-04", 1100, 9000);
  verifier("Historique : un point par jour, trié, dernier gardé", JSON.stringify(ph.historique.map((h) => [h.date, h.titres])), JSON.stringify([["2027-01-03", 900], ["2027-01-04", 1100]]));
  const fiche = Donnees.normaliserAnalyse({ outil: "rapp", nom: "Bêta", valeurs: { a0_actions: 5, "mauvaise clé": 1, note: "x".repeat(500), objet: { a: 1 } } });
  verifier("Fiche : valeurs nettoyées", JSON.stringify([Object.keys(fiche.valeurs), fiche.valeurs.note.length]), JSON.stringify([["a0_actions", "note"], 200]));
  verifier("Fiche : outil inconnu refusé", Donnees.normaliserAnalyse({ outil: "autre", nom: "X" }), null);

  // 13. RAPP : l'exemple du cours.
  const rp = M.rapp(M.EXEMPLE_RAPP.annees, 0.03);
  const ratio = (cle) => rp.ratios.find((r) => r.cle === cle);
  verifier("RAPP : actions 5,0 → 4,7 M (rachats)", JSON.stringify([ratio("actions").debut, ratio("actions").fin, ratio("actions").verdict]), JSON.stringify([5, 4.7, "ok"]));
  verifier("RAPP : frais 8,5 % → 8,2 %", JSON.stringify([arrondi(ratio("frais").debut, 3), arrondi(ratio("frais").fin, 3), ratio("frais").verdict]), JSON.stringify([0.085, 0.082, "ok"]));
  verifier("RAPP : stockage 42 → 38 jours", JSON.stringify([Math.round(ratio("stocks").debut), Math.round(ratio("stocks").fin), ratio("stocks").verdict]), JSON.stringify([42, 38, "ok"]));
  verifier("RAPP : création de valeur (20 − 12) + 4 = 12 €", JSON.stringify([ratio("creation").debut, ratio("creation").fin, arrondi(ratio("creation").dividendes, 2), arrondi(ratio("creation").creation, 2)]), JSON.stringify([12, 20, 4, 12]));
  verifier("RAPP : rendement 10,4 %/an > 3 % + 3 points, et > hausse du cours 4,0 %/an", JSON.stringify([arrondi(ratio("creation").rendement, 3), arrondi(ratio("creation").hausseCours, 3), ratio("creation").verdict]), JSON.stringify([0.104, 0.04, "ok"]));
  verifier("RAPP : 4 ratios au vert", rp.synthese.ok, 4);
  const degrade = M.EXEMPLE_RAPP.annees.map((a, i) => Object.assign({}, a, { actions: a.actions * (1 + i * 0.02), fraisGeneraux: a.chiffreAffaires * (0.085 + i * 0.006), stocks: a.coutVentes * (42 + i * 8) / 365 }));
  const rd = M.rapp(degrade, 0.03);
  verifier("RAPP : dilution, frais et stocks qui dérivent → alertes", rd.ratios.slice(0, 3).map((r) => r.verdict).join(","), "alerte,alerte,alerte");
  verifier("RAPP : décote sur les stocks suggérée", rd.ratios[2].decoteSuggeree, true);
  verifier("RAPP : rendement > taux sans risque mais < hausse du cours → vigilance", M.rapp(M.EXEMPLE_RAPP.annees.map((a, i) => Object.assign({}, a, { cours: 5 * Math.pow(1.2, i) })), 0.03).ratios[3].verdict, "vigilance");
  verifier("RAPP : taux sans risque de 9 % → alerte", M.rapp(M.EXEMPLE_RAPP.annees, 0.12).ratios[3].verdict, "alerte");
  verifier("RAPP : un seul exercice → incomplet", M.rapp([M.EXEMPLE_RAPP.annees[0]], 0.03).synthese.incomplet, 4);
  verifier("RAPP : société sans stocks → sans objet", M.rapp(M.EXEMPLE_RAPP.annees.map((a) => Object.assign({}, a, { stocks: 0 })), 0.03).ratios[2].verdict, "na");

  // 14. Holding et mine.
  const ho = M.holding(M.EXEMPLE_HOLDING);
  verifier("Holding : ANR = 435 + 40 − 25 = 450 M€, soit 45 € par action", JSON.stringify([ho.anr, ho.anrParAction]), JSON.stringify([450, 45]));
  verifier("Holding : décote de 33 % → achat possible, prix maximal 31,50 €", JSON.stringify([arrondi(ho.decote, 3), arrondi(ho.prixMax, 2), ho.verdict.code]), JSON.stringify([0.333, 31.5, "achat"]));
  verifier("Holding : cours à 40 € → attendre", M.holding(Object.assign({}, M.EXEMPLE_HOLDING, { cours: 40 })).verdict.code, "attendre");
  verifier("Holding : dettes > participations → exclue", M.holding(Object.assign({}, M.EXEMPLE_HOLDING, { dettes: 600 })).verdict.code, "exclue");
  const mi = M.mine(M.EXEMPLE_MINE);
  verifier("Mine : réserves retenues 2 + 0,5 + 0 = 2,5 Moz", mi.reservesRetenues, 2.5);
  verifier("Mine : marge nette par once (2 000 × 0,7 − 1 000) × 0,6 = 240", arrondi(mi.margeNette, 6), 240);
  verifier("Mine : valeur prudente 299,7 M, soit 3,00 par action", JSON.stringify([arrondi(mi.valeurFinale, 4), arrondi(mi.parAction, 3)]), JSON.stringify([299.7, 2.997]));
  verifier("Mine : cours de l'or implicite ≈ 1 824", Math.round(mi.coursOrImplicite), 1824);
  verifier("Mine : vérification, à 1 824 la valeur égale la capitalisation", arrondi(M.mine(Object.assign({}, M.EXEMPLE_MINE, { coursOr: mi.coursOrImplicite })).valeurFinale, 4), 150);
  verifier("Mine : coût > or décoté → exclue", M.mine(Object.assign({}, M.EXEMPLE_MINE, { coutProduction: 1500 })).verdict.code, "exclue");

  // 15. Projection (intérêts composés).
  const pj10 = M.projection(10000, 0.10, 10, 0);
  verifier("Projection : 10 000 € à 10 % sur 10 ans = 25 937,42 €", arrondi(pj10[10].valeur, 2), 25937.42);
  const pj20 = M.projection(10000, 0.07, 20, 250);
  verifier("Projection : + 250 €/mois à 7 % sur 20 ans = 165 580,94 €", JSON.stringify([arrondi(pj20[20].valeur, 2), pj20[20].verse, pj20.length]), JSON.stringify([165580.94, 70000, 21]));


  // 16. Qualité « action idéale » : Apple, exercice 2025 (10-K).
  const qa = M.qualite(M.EXEMPLE_APPLE);
  const crit = (cle) => qa.criteres.find((c) => c.cle === cle);
  verifier("Apple : marge brute 46,9 % (> 40 %)", JSON.stringify([arrondi(crit("margeBrute").valeur, 3), crit("margeBrute").respecte]), JSON.stringify([0.469, true]));
  verifier("Apple : marge nette 26,9 % (> 10 %)", JSON.stringify([arrondi(crit("margeNette").valeur, 3), crit("margeNette").respecte]), JSON.stringify([0.269, true]));
  verifier("Apple : croissance du résultat net 4,3 %/an sur 4 ans (< 15 %)", JSON.stringify([arrondi(crit("croissance").valeur, 3), crit("croissance").respecte]), JSON.stringify([0.043, false]));
  verifier("Apple : dette LT = 0,7 année de bénéfice (< 4)", JSON.stringify([arrondi(crit("detteLT").valeur, 2), crit("detteLT").respecte]), JSON.stringify([0.7, true]));
  verifier("Apple : dettes ÷ capitaux propres 3,87 (> 0,8)", JSON.stringify([arrondi(crit("dettesCP").valeur, 2), crit("dettesCP").respecte]), JSON.stringify([3.87, false]));
  verifier("Apple : R&D 17,7 % du brut (> 5 %), capex 10,9 % du BN (< 25 %)", JSON.stringify([arrondi(crit("rd").valeur, 3), crit("rd").respecte, arrondi(crit("capex").valeur, 3), crit("capex").respecte]), JSON.stringify([0.177, false, 0.109, true]));
  verifier("Apple : intérêts non publiés → non évalué ; 5 critères sur 8", JSON.stringify([crit("interets").respecte, qa.respectes, qa.evalues]), JSON.stringify([null, 5, 8]));
  verifier("Qualité : score plafonné à 2, seuil = 1", JSON.stringify([crit("margeNette").score, arrondi(M.qualite({ chiffreAffaires: 100, resultatBrut: 40 }).criteres[2].score, 6)]), JSON.stringify([2, 1]));

  // 17. Assurance anti-krach.
  verifier("Put Black-Scholes : S 100, K 65, 1 an, vol 30 %, taux 3 % = 0,638", arrondi(M.prixPut(100, 65, 1, 0.30, 0.03), 3), 0.638);
  verifier("Put à la monnaie : S = K = 100, vol 20 %, taux 0 = 7,966", arrondi(M.prixPut(100, 100, 1, 0.2, 0), 3), 7.966);
  const as = M.assurance({ valeur: 10000, budget: 0.02, distance: 0.35, volatilite: 0.30, taux: 0.03, rendementMarche: 0.08, rendementCash: 0.02, krach: 0.4, anneeKrach: 5 });
  verifier("Assurance : 2 % de budget couvrent 3,1 fois le portefeuille", arrondi(as.couverture, 2), 3.14);
  const sc = (v) => as.scenarios.find((s) => s.variation === v);
  verifier("Assurance : à −30 %, au-dessus du strike, les puts ne paient rien", sc(-0.3).gain, 0);
  verifier("Assurance : à −50 %, puts × 23,5 la prime ; portefeuille 0,96 au lieu de 0,50", JSON.stringify([arrondi(sc(-0.5).multiple, 1), arrondi(sc(-0.5).avec, 2), sc(-0.5).sans]), JSON.stringify([23.5, 0.96, 0.5]));
  verifier("Assurance : 10 ans sans krach, la prime coûte (17 640 € contre 21 589 € sans protection)", JSON.stringify([Math.round(as.sansKrach.assure), Math.round(as.sansKrach.sans)]), JSON.stringify([17640, 21589]));
  verifier("Assurance : 10 ans avec un krach de −40 %, l'assuré finit devant le cash et le non-assuré", as.avecKrach.assure > as.avecKrach.cash && as.avecKrach.cash > as.avecKrach.sans, true);
  verifier("Assurance : prime observée prioritaire sur l'estimation", M.assurance(Object.assign({}, { valeur: 1, budget: 0.02, distance: 0.3, volatilite: 0.3, taux: 0, primeObservee: 0.01, rendementMarche: 0, krach: 0.4 })).couverture, 2);

  // 18. Carnet de bord et rotation.
  verifier("Thèse : trois parties trop courtes signalées", Journal.verifierThese({ these: "pas cher", sortie: "", contre: "rien" }).length, 3);
  const theseOK = { these: "Cotée à 57 % de sa VANE : immeubles achetés 9 M€, inscrits 4 M€ au bilan. Prix maximal 4,27 €.", sortie: "Vente à la VANT (7,50 €) ou si la solvabilité passe sous 40 %.", contre: "Les stocks pourraient être invendables ; la famille contrôle le capital." };
  verifier("Thèse : complète acceptée", Journal.verifierThese(theseOK).length, 0);
  const pc = Donnees.nouveauPortefeuille();
  const apc = Journal.preparer(pc, { type: "achat", date: "2027-01-10", nom: "Alpha", code: "ALPH", quantite: 10, prix: 3.5, frais: 0 }, new Date(2027, 0, 12));
  Journal.appliquer(pc, apc, { majLigne: true, majCash: true, carnet: theseOK });
  verifier("Carnet : la thèse est enregistrée avec l'achat", JSON.stringify([pc.carnet.length, pc.carnet[0].type, pc.carnet[0].code, pc.carnet[0].date]), JSON.stringify([1, "achat", "ALPH", "2027-01-10"]));
  verifier("Carnet : dernière thèse retrouvée par code", Journal.derniereThese(pc.carnet, "ALPH", "").these.slice(0, 9), "Cotée à 5");
  const rot = Journal.rotation([
    { type: "achat", date: "2026-03-01", total: 3000 }, { type: "vente", date: "2026-06-01", total: 2000 },
    { type: "vente", date: "2025-06-01", total: 9000 }, { type: "dividende", date: "2026-06-01", total: 50 },
  ], [{ date: "2026-02-01", titres: 9000, cash: 1000 }, { date: "2026-10-01", titres: 9000, cash: 1000 }], 10000, new Date(2026, 10, 13));
  verifier("Rotation : min(achats 3 000, ventes 2 000) ÷ 10 000 = 20 % sur 12 mois", JSON.stringify([rot.achats, rot.ventes, rot.taux, rot.depasse]), JSON.stringify([3000, 2000, 0.2, false]));

  // 19. Données : carnet, gérants, momentum.
  const pd = Donnees.normaliser({ version: 1, carnet: [{ type: "achat", nom: "A", these: "x" }, { type: "autre", nom: "B" }],
    gerants: [{ fonds: "F", societe: "S", mouvement: "Achat" }, { fonds: "F", societe: "", mouvement: "entree" }],
    parametres: { momentum: { actif: true } }, lignes: [{ nom: "X", momentum: 0.12, dateMomentum: "2027-01-04" }] });
  verifier("Données : entrées de carnet valides gardées", pd.carnet.length, 1);
  verifier("Données : mouvement « Achat » lu comme une entrée ; incomplet écarté", JSON.stringify(pd.gerants.map((g) => g.mouvement)), JSON.stringify(["entree"]));
  verifier("Données : momentum sans date d'acceptation refusé", pd.parametres.momentum.actif, false);
  verifier("Données : momentum de la ligne conservé", pd.lignes[0].momentum, 0.12);

  // 20. Smart Money.
  const mv = [
    { date: "2026-10-01", fonds: "Fonds A", societe: "SEB", code: "SK", mouvement: "entree", theme: "Consommation" },
    { date: "2026-09-15", fonds: "Fonds B", societe: "Seb", code: "SK", mouvement: "renforcement", theme: "Consommation" },
    { date: "2026-08-01", fonds: "Fonds A", societe: "Technip Energies", code: "TE", mouvement: "entree", theme: "Énergie" },
    { date: "2026-07-01", fonds: "Fonds C", societe: "Technip Energies", code: "TE", mouvement: "sortie", theme: "Énergie" },
    { date: "2025-01-01", fonds: "Fonds C", societe: "Vieille", code: "OLD", mouvement: "entree", theme: "Industrie" },
  ].map(Donnees.normaliserMouvement);
  const sg = Gerants.synthese(mv, 365, new Date(2026, 10, 13));
  verifier("Smart Money : 12 mois → 4 mouvements, 3 fonds", JSON.stringify([sg.mouvements.length, sg.fonds.length]), JSON.stringify([4, 3]));
  verifier("Smart Money : SEB achetée par 2 fonds = consensus, en tête", JSON.stringify([sg.societes[0].code, sg.societes[0].solde, sg.societes[0].consensus, sg.consensus]), JSON.stringify(["SK", 2, true, 1]));
  verifier("Smart Money : Technip, 1 acheteur et 1 vendeur → solde 0", sg.societes.find((s) => s.code === "TE").solde, 0);
  verifier("Smart Money : thèmes (Consommation +2, Énergie 0)", sg.themes.map((x) => `${x.theme}:${x.solde}`).join(","), "Consommation:2,Énergie:0");
  const lc = Gerants.lireCSV("Date;Fonds;Gérant;Société;Code;Mouvement;Thème\n12/10/2026;Indépendance;W. Higgons;Seb;SK;Achat;Conso\n13/10/2026;X;;Y;;bof;\n");
  verifier("Smart Money : CSV lu (1 mouvement, 1 ignoré)", JSON.stringify([lc.mouvements.length, lc.ignores.length, lc.mouvements[0].date, lc.mouvements[0].mouvement]), JSON.stringify([1, 1, "2026-10-12", "entree"]));
  verifier("Smart Money : exemple Higgons, entrées SEB et ÉS signalées à vérifier", Gerants.EXEMPLE.filter((m) => /à vérifier/.test(m.source)).length, 2);

  // 21. Momentum 12-1.
  verifier("Momentum : clôture du mois dernier ÷ il y a 12 mois − 1", arrondi(Reseau.momentum([100, 102, 104, 106, 108, 110, 112, 114, 116, 118, 120, 125, 130]), 2), 0.25);
  verifier("Momentum : historique trop court → inconnu", Reseau.momentum([100, 110]), null);

  // 22. Analyses publiées : les fiches redonnent exactement les chiffres de la page de synthèse.
  const showa = Publiees.find((x) => x.id === "3954-showa-paxxs");
  const sv = D.analyser(showa.fiches.vann);
  verifier("Showa Paxxs : VANN 2 312 ¥ par action (stocks décotés de 20 %)", Math.round(sv.vannParAction), 2312);
  verifier("Showa Paxxs : VANE 4 291 ¥, VANT 6 440 ¥", JSON.stringify([Math.round(sv.vaneParAction), Math.round(sv.vantParAction)]), JSON.stringify([4291, 6440]));
  verifier("Showa Paxxs : cours = 129,4 % de la VANN, 69,7 % de la VANE", JSON.stringify([arrondi(sv.coursSurVann, 3), arrondi(sv.coursSurVane, 3)]), JSON.stringify([1.294, 0.697]));
  verifier("Showa Paxxs : prix maximal Net-Estate 3 004 ¥, verdict Net-Estate", JSON.stringify([Math.round(sv.prixMaxNetEstate), sv.verdict.code]), JSON.stringify([3004, "net-estate"]));
  verifier("Showa Paxxs : solvabilité maison 100,2 %, potentiel +115 %", JSON.stringify([arrondi(sv.solvabilite, 3), arrondi(sv.potentiel, 3)]), JSON.stringify([1.002, 1.152]));
  const sr = M.rapp(Array.from({ length: 8 }, (_, i) => Object.fromEntries(["annee", "actions", "chiffreAffaires", "fraisGeneraux", "coutVentes", "stocks", "fondsPropres", "dividende", "cours"].map((k) => [k, showa.fiches.rapp[`a${i}_${k}`]]))), showa.fiches.rapp.tsr);
  verifier("Showa Paxxs : RAPP 3 ratios conformes, stocks à surveiller (décote suggérée)", JSON.stringify([sr.synthese.ok, sr.synthese.vigilance, sr.ratios[2].verdict, sr.ratios[2].decoteSuggeree]), JSON.stringify([3, 1, "vigilance", true]));
  verifier("Showa Paxxs : création de valeur 8,9 %/an contre 8,3 %/an pour le cours", JSON.stringify([arrondi(sr.ratios[3].rendement, 3), arrondi(sr.ratios[3].hausseCours, 3)]), JSON.stringify([0.089, 0.083]));

  const sak = Publiees.find((x) => x.id === "4234-sun-a-kaken");
  const kv = D.analyser(sak.fiches.vann);
  verifier("Sun A. Kaken : VANN 655 ¥, VANE 1 931 ¥, VANT 2 419 ¥ par action", JSON.stringify([Math.round(kv.vannParAction), Math.round(kv.vaneParAction), Math.round(kv.vantParAction)]), JSON.stringify([655, 1931, 2419]));
  verifier("Sun A. Kaken : cours = 178,7 % de la VANN, 60,6 % de la VANE", JSON.stringify([arrondi(kv.coursSurVann, 3), arrondi(kv.coursSurVane, 3)]), JSON.stringify([1.787, 0.606]));
  verifier("Sun A. Kaken : prix maximal Net-Estate 1 352 ¥, verdict Net-Estate", JSON.stringify([Math.round(kv.prixMaxNetEstate), kv.verdict.code]), JSON.stringify([1352, "net-estate"]));
  verifier("Sun A. Kaken : solvabilité maison 68,8 %, potentiel +107 %", JSON.stringify([arrondi(kv.solvabilite, 3), arrondi(kv.potentiel, 3)]), JSON.stringify([0.688, 1.067]));
  const kr = M.rapp(Array.from({ length: 8 }, (_, i) => Object.fromEntries(["annee", "actions", "chiffreAffaires", "fraisGeneraux", "coutVentes", "stocks", "fondsPropres", "dividende", "cours"].map((k) => [k, sak.fiches.rapp[`a${i}_${k}`]]))), sak.fiches.rapp.tsr);
  verifier("Sun A. Kaken : RAPP 2 conformes, 2 à surveiller, pas de décote suggérée sur les stocks", JSON.stringify([kr.synthese.ok, kr.synthese.vigilance, kr.ratios[2].decoteSuggeree]), JSON.stringify([2, 2, false]));
  verifier("Sun A. Kaken : création de valeur 4,9 %/an contre 5,8 %/an pour le cours", JSON.stringify([arrondi(kr.ratios[3].rendement, 3), arrondi(kr.ratios[3].hausseCours, 3)]), JSON.stringify([0.049, 0.058]));

  // 9. Coffre chiffré (itérations réduites pour que le test reste instantané).
  async function testsCoffre() {
    if (!Coffre.disponible) { verifier("Coffre : chiffrement disponible dans ce navigateur", false, true); return; }
    const { session, enveloppe } = await Coffre.creer("mot de passe d'essai", pf, { iterations: 1000 });
    const texte = JSON.stringify(enveloppe);
    verifier("Coffre : aucune donnée en clair dans l'enveloppe", texte.includes("Textile") || texte.includes("BETA"), false);
    const ouvert = await Coffre.ouvrir("mot de passe d'essai", JSON.parse(texte));
    verifier("Coffre : aller-retour identique", JSON.stringify(ouvert.donnees), JSON.stringify(pf));
    let erreur = null; try { await Coffre.ouvrir("mauvais mot de passe", enveloppe); } catch (e) { erreur = e; }
    verifier("Coffre : mauvais mot de passe refusé", erreur instanceof Coffre.ErreurMotDePasse, true);
    const altere = JSON.parse(texte); altere.donnees = (altere.donnees[0] === "A" ? "B" : "A") + altere.donnees.slice(1);
    erreur = null; try { await Coffre.ouvrir("mot de passe d'essai", altere); } catch (e) { erreur = e; }
    verifier("Coffre : fichier altéré refusé", erreur instanceof Coffre.ErreurMotDePasse, true);
    const second = await Coffre.sceller(session, pf);
    verifier("Coffre : vecteur d'initialisation neuf à chaque enregistrement", second.chiffrement.iv !== enveloppe.chiffrement.iv, true);
    verifier("Coffre : même contenu, texte chiffré différent", second.donnees !== enveloppe.donnees, true);
    erreur = null; try { Coffre.validerEnveloppe({ format: "autre" }); } catch (e) { erreur = e; }
    verifier("Coffre : fichier étranger refusé", erreur instanceof Coffre.ErreurFormat, true);
    verifier("Coffre : 600 000 itérations par défaut", Coffre.ITERATIONS, 600000);
  }


  // 10. Actualisation des cours avec des réponses simulées (aucune requête réelle).
  async function testsReseau() {
    const reponse = (status, corps) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => (corps instanceof Error ? Promise.reject(corps) : Promise.resolve(corps)) });
    const chart = (prix, devise, nom) => ({ chart: { result: [{ meta: { regularMarketPrice: prix, currency: devise, regularMarketTime: 1799229600, exchangeTimezoneName: "Europe/Paris", longName: nom } }], error: null } });
    const demandes = [];
    const fauxFetch = (url, init) => {
      demandes.push(url);
      const m = decodeURIComponent(url).match(/chart\/([^?]+)/); const s = m && m[1];
      if (init.credentials !== "omit") return Promise.reject(new Error("cookies envoyés"));
      if (s === "ALPH.PA") return reponse(200, chart(3.9, "EUR", "Alpha Industrie SA"));
      if (s === "EQNR.OL") return reponse(200, chart(300, "NOK", "Equinor ASA"));
      if (s === "NOKEUR=X") return reponse(200, chart(0.085, "EUR", "NOK/EUR"));
      if (s === "VOD.L") return reponse(200, chart(70, "GBp", "Vodafone"));
      if (s === "GBPEUR=X") return reponse(200, chart(1.17, "EUR", "GBP/EUR"));
      if (s === "ZZZZ.PA") return reponse(404, { chart: { result: null, error: { code: "Not Found", description: "No data found, symbol may be delisted" } } });
      if (s === "BAD.PA") return reponse(200, { chart: { result: [{ meta: { currency: "EUR" } }], error: null } });
      if (s === "SAUT.PA") return reponse(200, chart(9, "EUR", "Saut SA"));
      if (s === "GC=F") return reponse(200, chart(2400, "USD", "Gold"));
      if (s === "MOMT.PA") {
        const c = chart(13, "EUR", "Momentum SA");
        c.chart.result[0].indicators = { quote: [{ close: [10, 10.2, 10.4, null, 10.8, 11, 11.2, 11.4, 11.6, 11.8, 12, 12.5, 13] }] };
        return reponse(200, c);
      }
      if (s === "USDEUR=X") return reponse(200, chart(0.9, "EUR", "USD/EUR"));
      if (s === "LENT.PA") return new Promise((_, rejeter) => init.signal.addEventListener("abort", () => rejeter(Object.assign(new Error("abandon"), { name: "AbortError" }))));
      return Promise.reject(new TypeError("Failed to fetch"));
    };
    const lignes = [
      { id: "1", nom: "Alpha", code: "ALPH", place: "XPAR", cours: 3.8 },
      { id: "10", nom: "Or", code: "GC=F", place: "XPAR", cours: 1900 },
      { id: "2", nom: "Alpha (CTO)", code: "ALPH.PA", place: "XPAR", cours: 3.8 },
      { id: "3", nom: "Equinor", code: "EQNR", place: "XOSL", cours: 25 },
      { id: "4", nom: "Vodafone", code: "VOD", place: "XLON", cours: 80 },
      { id: "5", nom: "Inconnue", code: "ZZZZ", place: "XPAR", cours: 1 },
      { id: "6", nom: "Sans code", code: "", place: "XPAR", cours: 1 },
      { id: "7", nom: "Mauvaise réponse", code: "BAD", place: "XPAR", cours: 1 },
      { id: "8", nom: "Lente", code: "LENT", place: "XPAR", cours: 1 },
      { id: "9", nom: "Saut", code: "SAUT", place: "XPAR", cours: 5 },
    ];
    const r = await Reseau.actualiser(lignes, { fetch: fauxFetch, pause: 0, delai: 50 });
    const par = Object.fromEntries(r.resultats.map((x) => [x.id, x]));
    verifier("Réseau : cours en euros mis à jour", par["1"].prix, 3.9);
    verifier("Réseau : date du cours dans le fuseau de la place", par["1"].date, "2027-01-06");
    verifier("Réseau : nom renvoyé par le fournisseur", par["1"].nomFournisseur, "Alpha Industrie SA");
    verifier("Réseau : même symbole demandé une seule fois", demandes.filter((u) => u.includes("ALPH.PA")).length, 1);
    verifier("Réseau : code complet ALPH.PA accepté", par["2"].prix, 3.9);
    verifier("Réseau : Oslo converti de NOK en euros (300 × 0,085 = 25,50 €)", par["3"].prix, 25.5);
    verifier("Réseau : Londres en pence converti (70 p → 0,70 £ → 0,819 €)", par["4"].prix, 0.819);
    verifier("Réseau : code inconnu signalé, ancien cours conservé", JSON.stringify([par["5"].ok, /introuvable/.test(par["5"].erreur), par["5"].ancien]), JSON.stringify([false, true, 1]));
    verifier("Réseau : ligne sans code ignorée sans requête", JSON.stringify([par["6"].ok, r.ignorees]), JSON.stringify([false, 1]));
    verifier("Réseau : réponse sans cours refusée", /inexploitable/.test(par["7"].erreur), true);
    verifier("Réseau : délai dépassé signalé", /Pas de réponse/.test(par["8"].erreur), true);
    verifier("Réseau : variation de +80 % signalée", JSON.stringify([par["9"].ok, par["9"].alerte]), JSON.stringify([true, true]));
    verifier("Réseau : or GC=F en dollars converti (2 400 $ × 0,9 = 2 160 €)", par["10"].prix, 2160);
    verifier("Réseau : compte rendu (6 à jour, 3 échecs, 1 ignorée)", JSON.stringify([r.misAJour, r.echecs, r.ignorees, r.diagnostic]), JSON.stringify([6, 3, 1, null]));
    verifier("Réseau : les lignes elles-mêmes ne sont pas modifiées", lignes[0].cours, 3.8);
    verifier("Réseau : aucune quantité ni aucun nom dans les adresses", demandes.some((u) => /Alpha|Equinor|quantite/.test(decodeURIComponent(u))), false);

    demandes.length = 0;
    const rm = await Reseau.actualiser([{ id: "m", nom: "Momentum", code: "MOMT", place: "XPAR", cours: 12 }], { fetch: fauxFetch, pause: 0, momentum: true });
    verifier("Réseau : momentum demandé → clôtures mensuelles sur un an", JSON.stringify([demandes[0].includes("interval=1mo&range=1y"), arrondi(rm.resultats[0].momentum, 2), rm.resultats[0].prix]), JSON.stringify([true, 0.25, 13]));

    // Le navigateur bloque tout (CORS) : on s'arrête vite avec un diagnostic.
    demandes.length = 0;
    const bloque = await Reseau.actualiser(lignes.slice(2, 5).map((l, i) => Object.assign({}, l, { code: "X" + i })), { fetch: fauxFetch, pause: 0 });
    verifier("Réseau : accès refusé partout → diagnostic « reseau » et arrêt", JSON.stringify([bloque.diagnostic, bloque.misAJour, demandes.length]), JSON.stringify(["reseau", 0, 4]));
    // Relais : l'adresse Yahoo est encodée dans celle du relais.
    demandes.length = 0;
    await Reseau.actualiser([lignes[0]], { fetch: fauxFetch, pause: 0, relais: "corsproxy" });
    verifier("Réseau : relais corsproxy.io utilisé si activé", demandes[0].startsWith("https://corsproxy.io/?https%3A%2F%2Fquery1.finance.yahoo.com"), true);
    // Limitation du nombre de requêtes : arrêt immédiat.
    const limite = await Reseau.actualiser(lignes.slice(0, 3), { fetch: () => reponse(429, {}), pause: 0 });
    verifier("Réseau : limite de requêtes → arrêt et diagnostic", JSON.stringify([limite.diagnostic, limite.misAJour]), JSON.stringify(["limite", 0]));
  }

  const pret = testsCoffre().then(testsReseau).catch((e) => verifier("Coffre : exécution sans erreur (" + e.message + ")", false, true)).then(() => {
    const reussis = resultats.filter((r) => r.ok).length;
    const bilan = { resultats, reussis, total: resultats.length, ok: reussis === resultats.length };
    console.log(`Tests de la logique : ${reussis}/${resultats.length} réussis`);
    return bilan;
  });
  if (sousNode) pret.then((bilan) => { bilan.resultats.filter((r) => !r.ok).forEach((r) => console.error("ÉCHEC", r)); process.exit(bilan.ok ? 0 : 1); });
  else racine.DecotesTests = { pret };
})(typeof globalThis !== "undefined" ? globalThis : this);
