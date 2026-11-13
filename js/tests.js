/* Tests unitaires : exécutés à chaque chargement de la page et par `node js/tests.js`. */
(function (racine) {
  "use strict";
  const D = typeof module !== "undefined" && module.exports ? require("./calc.js") : racine.Decotes;
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

  const reussis = resultats.filter((r) => r.ok).length;
  const bilan = { resultats, reussis, total: resultats.length, ok: reussis === resultats.length };
  console.log(`Tests de la logique : ${reussis}/${resultats.length} réussis`);
  if (typeof module !== "undefined" && module.exports) {
    resultats.filter((r) => !r.ok).forEach((r) => console.error("ÉCHEC", r));
    process.exit(bilan.ok ? 0 : 1);
  } else racine.DecotesTests = bilan;
})(typeof globalThis !== "undefined" ? globalThis : this);
