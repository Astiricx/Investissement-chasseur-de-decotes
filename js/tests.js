/* Tests unitaires : exécutés à chaque chargement de la page et par `node js/tests.js`. */
(function (racine) {
  "use strict";
  const sousNode = typeof module !== "undefined" && module.exports;
  const D = sousNode ? require("./calc.js") : racine.Decotes;
  const Donnees = sousNode ? require("./donnees.js") : racine.DecotesDonnees;
  const Coffre = sousNode ? require("./coffre.js") : racine.DecotesCoffre;
  const CSV = sousNode ? require("./csv.js") : racine.DecotesCSV;
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

  // 7. Coffre chiffré (itérations réduites pour que le test reste instantané).
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

  const pret = testsCoffre().catch((e) => verifier("Coffre : exécution sans erreur (" + e.message + ")", false, true)).then(() => {
    const reussis = resultats.filter((r) => r.ok).length;
    const bilan = { resultats, reussis, total: resultats.length, ok: reussis === resultats.length };
    console.log(`Tests de la logique : ${reussis}/${resultats.length} réussis`);
    return bilan;
  });
  if (sousNode) pret.then((bilan) => { bilan.resultats.filter((r) => !r.ok).forEach((r) => console.error("ÉCHEC", r)); process.exit(bilan.ok ? 0 : 1); });
  else racine.DecotesTests = { pret };
})(typeof globalThis !== "undefined" ? globalThis : this);
