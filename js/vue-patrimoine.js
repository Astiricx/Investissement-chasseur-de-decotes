/* Vue « patrimoine » du tableau de bord : répartition par classe d'actifs, jauge du cash,
   courbe d'évolution de la valeur totale et simulateur d'intérêts composés.
   Ce module ne calcule rien lui-même : il met en forme les résultats de calc.js et methodes.js
   et délègue le dessin à graphiques.js. */
(function (racine) {
  "use strict";

  function creer(ctx) {
    const { $, el, G, M, Donnees, P, fEur, fEur0, fPct0, estNombre } = ctx;
    const fCompact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
    const fMois = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" });
    const fJour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
    const fJourAn = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const versDate = (iso) => { const [a, m, j] = iso.split("-").map(Number); return new Date(a, m - 1, j); };

    /** Graduations en euros : toutes complètes sous 10 000 €, toutes compactes au-delà (un seul style par axe). */
    const formatAxeEuros = (max) => (v) => (max >= 10000 ? fCompact.format(v) + " €" : fEur0.format(v));

    // Ordre fixe des classes : la couleur suit la classe, jamais son rang (palette validée dans cet ordre).
    const CLASSES_AFFICHEES = [
      { cle: "decote", nom: Donnees.CLASSES.decote, couleur: "v1" },
      { cle: "etf", nom: Donnees.CLASSES.etf, couleur: "v2" },
      { cle: "cash", nom: "Cash", couleur: "v3" },
      { cle: "or", nom: Donnees.CLASSES.or, couleur: "v4" },
    ];

    // ---------------------------------------------------------------- Répartition
    function afficherRepartition(s) {
      const parts = CLASSES_AFFICHEES.map((c) => ({ nom: c.nom, couleur: c.couleur, valeur: c.cle === "cash" ? s.cash : s.parClasse[c.cle] || 0 }));
      $("graphe-repartition").replaceChildren(G.repartition(parts, {
        formatMontant: (v) => fEur0.format(v), formatPart: (p) => fPct0.format(p), libelle: "Répartition du portefeuille par classe d'actifs",
      }));
      $("repartition-note").textContent = `Total : ${fEur0.format(s.total)}`;
    }

    // ---------------------------------------------------------------- Jauge du cash (5 % à 15 %)
    function jaugeCash(s) {
      const etat = s.zoneCash;
      const texte = etat === "bas" ? `Sous ${fPct0.format(P.cashMin)} : peu de réserve pour les opportunités.`
        : etat === "haut" ? `Au-dessus de ${fPct0.format(P.cashCible)} : des liquidités restent à investir.`
        : etat === "ok" ? `Dans la zone visée (${fPct0.format(P.cashMin)} à ${fPct0.format(P.cashCible)}).` : "";
      return el("div", {}, [
        G.jauge({ part: s.partCash || 0, min: P.cashMin, max: P.cashCible, echelleMax: Math.max(0.3, Math.min(1, (s.partCash || 0) * 1.15)), etat,
          libelle: `Cash : ${s.partCash === null ? "inconnu" : fPct0.format(s.partCash)} du total, zone visée ${fPct0.format(P.cashMin)} à ${fPct0.format(P.cashCible)}` }),
        el("p", { class: "etat-cash" + (etat === "bas" ? " attention" : ""), texte: (etat === "bas" ? "⚠ " : "") + texte }),
      ]);
    }

    // ---------------------------------------------------------------- Évolution
    function afficherEvolution(pf, s, aujourdhui) {
      const points = pf.historique.slice();
      // Le point du jour reflète toujours l'état affiché, même avant l'enregistrement.
      const dernier = points[points.length - 1];
      const jour = { date: aujourdhui, titres: s.valeurTitres, cash: s.cash };
      if (dernier && dernier.date === aujourdhui) points[points.length - 1] = jour; else if (s.total > 0) points.push(jour);
      const conteneur = $("graphe-evolution");
      if (points.length < 2) {
        conteneur.replaceChildren(el("p", { class: "g-vide-texte", texte: "La courbe se construit au fil des jours : un point est enregistré chaque jour où vous ouvrez ou modifiez le portefeuille." }));
        $("evolution-note").textContent = "";
        return;
      }
      const serie = points.map((p) => ({ x: versDate(p.date).getTime(), y: p.titres + p.cash }));
      const max = Math.max(...serie.map((p) => p.y));
      const duree = serie[serie.length - 1].x - serie[0].x;
      const formatX = duree <= 62 * 864e5 ? (x) => fJour.format(new Date(x)) : (x) => fMois.format(new Date(x));
      conteneur.replaceChildren(G.courbe({
        series: [{ nom: "Valeur totale", couleur: "v1", points: serie }],
        aire: true, hauteur: 210,
        formatX, titreX: (x) => fJourAn.format(new Date(x)),
        formatY: formatAxeEuros(max), formatValeur: (v) => fEur0.format(v),
        infos: (i) => [{ valeur: fEur0.format(points[i].titres), nom: "en titres" }, { valeur: fEur0.format(points[i].cash), nom: "en cash" }],
        libelle: `Évolution de la valeur totale du ${fJourAn.format(new Date(serie[0].x))} à aujourd'hui`,
      }));
      const variation = serie[0].y > 0 ? serie[serie.length - 1].y / serie[0].y - 1 : null;
      $("evolution-note").textContent = variation === null ? "" : `Depuis le ${fJour.format(new Date(serie[0].x))} : ${variation > 0 ? "+" : ""}${new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(variation)}`;
    }

    // ---------------------------------------------------------------- Simulateur
    let capitalSaisi = false; // tant que l'utilisateur n'a rien saisi, le capital suit la valeur du portefeuille
    let totalActuel = 0;

    function lireSimulation() {
      const capital = capitalSaisi ? ctx.lireChamp($("sim-capital")) : totalActuel;
      const versement = ctx.lireChamp($("sim-versement"));
      return {
        capital: estNombre(capital) ? capital : 0,
        versement: estNombre(versement) ? versement : 0,
        taux: Number($("sim-taux").value) / 100,
        annees: Number($("sim-duree").value),
      };
    }

    function afficherSimulation() {
      const o = lireSimulation();
      $("sim-taux-valeur").textContent = fPct1(o.taux);
      const bas = Math.max(0, o.taux - 0.03), haut = o.taux + 0.03;
      const central = M.projection(o.capital, o.taux, o.annees, o.versement);
      const pBas = M.projection(o.capital, bas, o.annees, o.versement);
      const pHaut = M.projection(o.capital, haut, o.annees, o.versement);
      const fin = central[central.length - 1];
      if (!(o.capital > 0) && !(o.versement > 0)) {
        $("sim-resume").textContent = "Indiquez un capital de départ ou un versement mensuel.";
        $("graphe-simulation").replaceChildren();
        return;
      }
      const multiple = fin.verse > 0 ? fin.valeur / fin.verse : null;
      $("sim-resume").replaceChildren(
        el("span", { texte: `Dans ${o.annees} ans à ${fPct1(o.taux)} par an : ` }),
        el("strong", { texte: fEur0.format(fin.valeur) }),
        el("span", { texte: ` pour ${fEur0.format(fin.verse)} versés${multiple ? ` (× ${multiple.toFixed(1).replace(".", ",")})` : ""}. ` +
          `Entre ${fPct1(bas)} et ${fPct1(haut)} : de ${fEur0.format(pBas[pBas.length - 1].valeur)} à ${fEur0.format(pHaut[pHaut.length - 1].valeur)}.` }),
      );
      $("graphe-simulation").replaceChildren(G.courbe({
        series: [
          { nom: `Rendement de ${fPct1(o.taux)}`, couleur: "v1", points: central.map((p) => ({ x: p.annee, y: p.valeur })) },
          { nom: "Sommes versées", couleur: "v-muet", points: central.map((p) => ({ x: p.annee, y: p.verse })) },
        ],
        bande: { nom: `Fourchette de ${fPct1(bas)} à ${fPct1(haut)}`, couleur: "v1", points: central.map((p, i) => ({ x: p.annee, bas: pBas[i].valeur, haut: pHaut[i].valeur })) },
        zero: true, hauteur: 240,
        formatX: (x) => (x === 0 ? "Auj." : `${x} ans`), titreX: (x) => (x === 0 ? "Aujourd'hui" : `Dans ${x} an${x > 1 ? "s" : ""}`),
        formatY: formatAxeEuros(pHaut[pHaut.length - 1].valeur), formatValeur: (v) => fEur0.format(v),
        libelle: `Projection sur ${o.annees} ans à ${fPct1(o.taux)} par an`,
      }));
    }
    const fPct1 = (t) => new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(t);

    function installerSimulateur() {
      $("f-simulation").addEventListener("submit", (e) => e.preventDefault());
      $("sim-capital").addEventListener("input", () => { capitalSaisi = $("sim-capital").value.trim() !== ""; afficherSimulation(); });
      for (const id of ["sim-versement", "sim-taux", "sim-duree"]) $(id).addEventListener("input", afficherSimulation);
    }

    function afficher(pf, s, aujourdhui) {
      afficherRepartition(s);
      afficherEvolution(pf, s, aujourdhui);
      totalActuel = s.total;
      if (!capitalSaisi) $("sim-capital").value = ctx.versChamp(Math.round(s.total));
      afficherSimulation();
    }

    function reinitialiser() {
      capitalSaisi = false; totalActuel = 0;
      for (const id of ["graphe-repartition", "graphe-evolution", "graphe-simulation", "sim-resume"]) $(id).replaceChildren();
      $("sim-capital").value = ""; $("sim-versement").value = "0";
    }

    return { afficher, jaugeCash, installerSimulateur, reinitialiser, CLASSES_AFFICHEES };
  }

  racine.DecotesVuePatrimoine = { creer };
})(typeof globalThis !== "undefined" ? globalThis : this);
