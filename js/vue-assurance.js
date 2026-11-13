/* Vue « assurance anti-krach » (tableau de bord) : simulateur de puts hors de la monnaie.
   Calculs dans methodes.js (Black-Scholes, scénarios, comparaison sur 10 ans) ; dessin par graphiques.js. */
(function (racine) {
  "use strict";

  function creer(ctx) {
    const { $, el, G, M, estNombre, fEur0 } = ctx;
    const fPct1 = new Intl.NumberFormat("fr-FR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const fPct2 = new Intl.NumberFormat("fr-FR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fPct0 = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });
    const fFois = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
    const fCompact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
    let valeurSaisie = false, valeurPortefeuille = 0;

    const lirePct = (id, defaut) => { const v = ctx.lireChamp($(id)); return estNombre(v) ? v / 100 : defaut; };

    function lire() {
      const v = valeurSaisie ? ctx.lireChamp($("as-valeur")) : valeurPortefeuille;
      return {
        valeur: estNombre(v) && v > 0 ? v : 0,
        budget: Number($("as-budget").value) / 100,
        distance: Number($("as-distance").value) / 100,
        volatilite: lirePct("as-vol", 0.30),
        taux: lirePct("as-taux", 0.03),
        primeObservee: (() => { const p = ctx.lireChamp($("as-prime")); return estNombre(p) && p > 0 ? p / 100 : null; })(),
        rendementMarche: lirePct("as-rendement", 0.08),
        rendementCash: lirePct("as-cash", 0.02),
        krach: lirePct("as-krach", 0.40),
        anneeKrach: 5, annees: 10,
      };
    }

    function afficher() {
      const o = lire();
      $("as-budget-valeur").textContent = fPct2.format(o.budget).replace(",00", "");
      $("as-distance-valeur").textContent = fPct0.format(o.distance);
      if (!(o.valeur > 0)) {
        $("as-resultats").replaceChildren(el("p", { class: "note", texte: "Indiquez la valeur à protéger." }));
        return;
      }
      const a = M.assurance(o);
      const tuile = (titre, valeur, detail) => el("div", { class: "indic" }, [el("p", { class: "indic-titre", texte: titre }), el("p", { class: "indic-valeur", texte: valeur }), el("p", { class: "indic-detail", texte: detail })]);
      const tuiles = el("div", { class: "indicateurs trois" }, [
        tuile("Coût par an", fEur0.format(a.cout), `${fPct2.format(o.budget)} du portefeuille, perdu les années sans krach`),
        tuile("Prix d'un put", a.prime ? fPct2.format(a.prime) : "–", a.primeEstimee ? `du nominal, estimé (Black-Scholes, volatilité ${fPct0.format(o.volatilite)})` : "du nominal, prime observée saisie"),
        tuile("Nominal couvert", a.couverture ? `× ${fFois.format(a.couverture)}` : "–", `la valeur du portefeuille, strike ${fPct0.format(o.distance)} sous le cours`),
      ]);

      // Valeur du portefeuille dans un an selon la variation du marché : la convexité se voit sous le strike.
      const graphe = G.courbe({
        series: [
          { nom: "Avec les puts", couleur: "v1", points: a.courbe.map((p) => ({ x: p.variation, y: p.avec * o.valeur })) },
          { nom: "Sans protection", couleur: "v-muet", points: a.courbe.map((p) => ({ x: p.variation, y: p.sans * o.valeur })) },
        ],
        zero: true, hauteur: 230,
        formatX: (x) => (x > 0 ? "+" : "") + fPct0.format(x), titreX: (x) => `Marché ${(x > 0 ? "+" : "") + fPct0.format(x)} sur un an`,
        formatY: (v) => (o.valeur * 1.5 >= 10000 ? fCompact.format(v) + " €" : fEur0.format(v)), formatValeur: (v) => fEur0.format(v),
        libelle: "Valeur du portefeuille dans un an selon la variation du marché, avec et sans puts",
      });

      const ligne = (cells, entete) => el("tr", {}, cells.map((c, i) => el(entete ? "th" : "td", { class: i ? "num" : null, scope: entete ? "col" : null, texte: c })));
      const scenarios = el("table", { class: "table-simple" }, [
        el("thead", {}, ligne(["Marché sur un an", "Sans protection", "Avec les puts", "Gain des puts"], true)),
        el("tbody", {}, a.scenarios.map((s) => ligne([fPct0.format(s.variation), fEur0.format(s.sans * o.valeur), fEur0.format(s.avec * o.valeur),
          s.gain > 0 ? `${fEur0.format(s.gain * o.valeur)} (× ${fFois.format(s.multiple)} la prime)` : "0 € (au-dessus du strike)"]))),
      ]);

      const dix = (t) => [t.sans, t.assure, t.cash];
      const noms = ["100 % investi, sans protection", `100 % investi, ${fPct2.format(o.budget).replace(",00", "")} par an en puts`, "85 % investi, 15 % de cash"];
      const sk = dix(a.sansKrach), ak = dix(a.avecKrach);
      const meilleur = (t) => noms[t.indexOf(Math.max(...t))];
      const comparaison = el("table", { class: "table-simple" }, [
        el("thead", {}, ligne(["Stratégie sur 10 ans", `Sans krach (marché +${fPct0.format(o.rendementMarche)}/an)`, `Krach de −${fPct0.format(o.krach)} l'année 5`], true)),
        el("tbody", {}, noms.map((nom, i) => ligne([nom, fEur0.format(sk[i]), fEur0.format(ak[i])]))),
      ]);

      $("as-resultats").replaceChildren(
        tuiles,
        el("h3", { texte: "Valeur du portefeuille dans un an" }), graphe,
        el("div", { class: "tableau-cadre" }, scenarios),
        el("h3", { texte: "Assurance permanente ou poche de cash : la comparaison sur 10 ans" }),
        el("div", { class: "tableau-cadre" }, comparaison),
        el("p", { texte: `Sans krach, la meilleure stratégie est « ${meilleur(sk)} » ; avec un krach, « ${meilleur(ak)} ». ` +
          "L'argument des intérêts composés en faveur de l'assurance ne tient que si un krach assez profond survient pendant la période et si la prime reste raisonnable : testez vos propres hypothèses." }),
        el("p", { class: "note", texte: `Hypothèses : puts à 12 mois renouvelés chaque année ; les années sans krach, l'indice finit au-dessus du strike et les puts expirent sans valeur ; cash rémunéré ${fPct1.format(o.rendementCash)}, poche rééquilibrée chaque année ; ni frais ni impôts.` }),
      );
    }

    function installer() {
      $("f-assurance").addEventListener("submit", (e) => e.preventDefault());
      $("as-valeur").addEventListener("input", () => { valeurSaisie = $("as-valeur").value.trim() !== ""; afficher(); });
      $("f-assurance").addEventListener("input", (e) => { if (e.target.id !== "as-valeur") afficher(); });
      // Le contenu n'est calculé qu'à l'ouverture du bloc (repli fermé par défaut).
      $("bloc-assurance").addEventListener("toggle", () => { if ($("bloc-assurance").open) afficher(); });
    }

    function actualiser(total) {
      valeurPortefeuille = total;
      if (!valeurSaisie) $("as-valeur").value = ctx.versChamp(Math.round(total));
      if ($("bloc-assurance").open) afficher();
    }

    function reinitialiser() {
      valeurSaisie = false; valeurPortefeuille = 0;
      $("as-valeur").value = ""; $("as-resultats").replaceChildren();
      $("bloc-assurance").open = false;
    }

    return { installer, actualiser, reinitialiser };
  }

  racine.DecotesVueAssurance = { creer };
})(typeof globalThis !== "undefined" ? globalThis : this);
