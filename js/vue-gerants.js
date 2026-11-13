/* Vue « Gérants » (Smart Money) : mouvements des gérants de référence, agrégés par société et par thème.
   Logique dans gerants.js ; ce module affiche, relie la saisie, l'import CSV et l'envoi vers l'analyse. */
(function (racine) {
  "use strict";

  function creer(ctx) {
    const { $, el, G, Donnees, estNombre } = ctx;
    const Gerants = racine.DecotesGerants;
    const fJour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
    const versDate = (iso) => { const [a, m, j] = iso.split("-").map(Number); return new Date(a, m - 1, j); };
    const jour = (iso) => (iso ? fJour.format(versDate(iso)) : "date non précisée");
    const PERIODES = [[90, "90 jours"], [365, "12 mois"], [null, "Tout"]];
    let periode = 365;
    let aImporter = null;

    function message(texte, info) {
      const b = $("bandeau-gerants");
      b.hidden = !texte; b.textContent = texte || "";
      b.classList.toggle("info", !!info); b.classList.toggle("alerte", !!texte && !info);
    }

    function afficher() {
      const pf = ctx.etat.pf; if (!pf) return;
      $("periode-gerants").replaceChildren(...PERIODES.map(([j, nom]) => {
        const b = el("button", { type: "button", "aria-pressed": String(periode === j), texte: nom });
        b.addEventListener("click", () => { periode = j; afficher(); });
        return b;
      }));
      const s = Gerants.synthese(pf.gerants, periode, new Date());
      const theme = s.themes.find((t) => t.solde > 0);
      const tuile = (titre, valeur, detail) => el("div", { class: "indic" }, [el("p", { class: "indic-titre", texte: titre }), el("p", { class: "indic-valeur", texte: valeur }), el("p", { class: "indic-detail", texte: detail })]);
      $("gerants-indicateurs").replaceChildren(
        tuile("Mouvements", String(s.mouvements.length), `sur ${PERIODES.find((p) => p[0] === periode)[1].toLowerCase()}`),
        tuile("Fonds suivis", String(s.fonds.length), s.fonds.slice(0, 3).join(", ") + (s.fonds.length > 3 ? "…" : "")),
        tuile("Consensus", String(s.consensus), "sociétés achetées par au moins deux fonds, sans vendeur"),
        tuile("Thème le plus acheté", theme ? theme.theme : "–", theme ? `${theme.achats} achat${theme.achats > 1 ? "s" : ""} · ${theme.ventes} vente${theme.ventes > 1 ? "s" : ""}` : "aucun solde acheteur"),
      );
      const vide = s.mouvements.length === 0;
      $("gerants-vide").hidden = !vide;
      for (const id of ["bloc-societes-gerants", "bloc-themes-gerants"]) $(id).hidden = vide;

      // Sociétés : solde acheteurs − vendeurs.
      const codesDetenus = new Set(pf.lignes.map((l) => l.code).filter(Boolean));
      const nomsDetenus = new Set(pf.lignes.map((l) => l.nom.toLowerCase()));
      const cellule = (titre, texte, classe) => el("td", { "data-titre": titre, class: classe || "num", texte });
      $("societes-gerants").tBodies[0].replaceChildren(...s.societes.map((x) => {
        const analyser = el("button", { type: "button", class: "lien", texte: "Analyser", "aria-label": "Analyser " + x.societe });
        analyser.addEventListener("click", () => ctx.analyserSociete(x.societe));
        const detenue = (x.code && codesDetenus.has(x.code)) || nomsDetenus.has(x.societe.toLowerCase());
        return el("tr", {}, [
          el("td", { class: "c-soc" }, [el("div", { class: "soc-nom", texte: x.societe }),
            el("div", { class: "soc-code", texte: [x.code, x.theme, detenue ? "dans mon portefeuille" : null].filter(Boolean).join(" · ") })]),
          cellule("Fonds acheteurs", x.acheteurs.join(", ") || "–", "texte-court"),
          cellule("Fonds vendeurs", x.vendeurs.join(", ") || "–", "texte-court"),
          cellule("Solde", (x.solde > 0 ? "+" : "") + x.solde, "num " + (x.solde > 0 ? "hausse" : x.solde < 0 ? "baisse" : "")),
          cellule("Dernier mouvement", jour(x.dernier)),
          el("td", { class: "c-statut" }, x.consensus ? el("span", { class: "statut s-renforcer", texte: "CONSENSUS" }) : null),
          el("td", { class: "c-actions" }, analyser),
        ]);
      }));

      // Thèmes : les rotations de fond (énergie, cuivre…), en barres d'une seule teinte.
      $("themes-gerants").replaceChildren(G.barresClassees(s.themes.map((t) => ({ nom: t.theme, valeur: t.achats, texte: `${t.achats} achat${t.achats > 1 ? "s" : ""} · ${t.ventes} vente${t.ventes > 1 ? "s" : ""}` })), "Achats par thème"));

      // Liste des mouvements.
      $("mouvements-gerants").tBodies[0].replaceChildren(...s.mouvements.map((m) => {
        const suppr = el("button", { type: "button", class: "lien", texte: "Supprimer", "aria-label": `Supprimer le mouvement ${m.societe}` });
        suppr.addEventListener("click", () => {
          if (!window.confirm(`Supprimer le mouvement « ${Donnees.MOUVEMENTS[m.mouvement]} ${m.societe} » ?`)) return;
          pf.gerants = pf.gerants.filter((x) => x.id !== m.id); ctx.enregistrer(); afficher();
        });
        return el("tr", {}, [
          el("td", { class: "c-soc" }, [el("div", { class: "soc-nom", texte: m.societe }), el("div", { class: "soc-code", texte: [m.code, m.theme].filter(Boolean).join(" · ") })]),
          el("td", { class: "c-statut" }, [el("span", { class: "type t-" + (Gerants.ACHATS.includes(m.mouvement) ? "achat" : "vente"), texte: Donnees.MOUVEMENTS[m.mouvement] }), el("span", { class: "soc-code", texte: " · " + jour(m.date) })]),
          cellule("Fonds", [m.fonds, m.gerant].filter(Boolean).join(" · "), "texte-court"),
          cellule("Source", m.source || "–", "texte-court source"),
          el("td", { class: "c-actions" }, suppr),
        ]);
      }));
      $("nb-mouvements").textContent = `${s.mouvements.length} mouvement${s.mouvements.length > 1 ? "s" : ""} sur la période`;
    }

    // ---------------------------------------------------------------- Saisie, import, exemple
    function ouvrirSaisie() {
      $("f-mouvement").reset();
      const pf = ctx.etat.pf;
      $("mv-fonds-liste").replaceChildren(...[...new Set(pf.gerants.map((m) => m.fonds))].map((f) => el("option", { value: f })));
      $("mv-theme-liste").replaceChildren(...[...new Set(pf.gerants.map((m) => m.theme).filter(Boolean))].map((t) => el("option", { value: t })));
      ctx.message("mv-message", "");
      $("dlg-mouvement").showModal();
    }

    function enregistrerSaisie(e) {
      e.preventDefault();
      const m = Donnees.normaliserMouvement({
        date: $("mv-date").value || null, fonds: $("mv-fonds").value, gerant: $("mv-gerant").value, societe: $("mv-societe").value,
        code: $("mv-code").value, mouvement: $("mv-mouvement").value, theme: $("mv-theme").value, source: $("mv-source").value, note: $("mv-note").value,
      });
      if (!m) return ctx.message("mv-message", "Indiquez au moins le fonds, la société et le mouvement.");
      if (ctx.etat.pf.gerants.length >= Donnees.MAX_GERANTS) return ctx.message("mv-message", "Limite de mouvements atteinte : supprimez les plus anciens.");
      ctx.etat.pf.gerants.push(m); ctx.enregistrer();
      $("dlg-mouvement").close(); afficher();
      message(`Mouvement ajouté : ${Donnees.MOUVEMENTS[m.mouvement].toLowerCase()} ${m.societe} (${m.fonds}).`, true);
    }

    async function choisirCSV(e) {
      const fichier = e.target.files[0]; e.target.value = "";
      if (!fichier) return;
      if (fichier.size > 5 * 1024 * 1024) return message("Fichier trop volumineux (5 Mo au maximum).");
      const tampon = await fichier.arrayBuffer();
      const lu = Gerants.lireCSV(racine.DecotesCSV.decoder(tampon));
      if (lu.erreur || !lu.mouvements.length) { aImporter = null; return message(lu.erreur || "Aucun mouvement exploitable dans ce fichier."); }
      aImporter = lu.mouvements;
      $("gerants-import").hidden = false;
      $("gerants-import-texte").textContent = `${fichier.name} : ${lu.mouvements.length} mouvement${lu.mouvements.length > 1 ? "s" : ""} à importer` +
        (lu.ignores.length ? `, ${lu.ignores.length} ligne${lu.ignores.length > 1 ? "s" : ""} ignorée${lu.ignores.length > 1 ? "s" : ""} (${lu.ignores.slice(0, 3).map((i) => "ligne " + i.numero).join(", ")}).` : ".");
    }

    function importer() {
      if (!aImporter) return;
      const place = Donnees.MAX_GERANTS - ctx.etat.pf.gerants.length;
      const ajout = aImporter.slice(0, Math.max(0, place));
      ctx.etat.pf.gerants.push(...ajout); ctx.enregistrer();
      aImporter = null; $("gerants-import").hidden = true; afficher();
      message(`${ajout.length} mouvement${ajout.length > 1 ? "s" : ""} importé${ajout.length > 1 ? "s" : ""}.`, true);
    }

    function chargerExemple() {
      const pf = ctx.etat.pf;
      const deja = new Set(pf.gerants.map((m) => `${m.fonds}|${m.societe}|${m.mouvement}`));
      const nouveaux = Gerants.EXEMPLE.map(Donnees.normaliserMouvement).filter((m) => m && !deja.has(`${m.fonds}|${m.societe}|${m.mouvement}`));
      pf.gerants.push(...nouveaux); ctx.enregistrer();
      periode = null; afficher();
      message(nouveaux.length ? `Exemple Indépendance AM ajouté (${nouveaux.length} mouvements). Deux d'entre eux sont à vérifier : voir la colonne Source.` : "L'exemple est déjà dans la liste.", true);
    }

    function installer() {
      $("ajouter-mouvement").addEventListener("click", ouvrirSaisie);
      $("f-mouvement").addEventListener("submit", enregistrerSaisie);
      $("mv-annuler").addEventListener("click", () => $("dlg-mouvement").close());
      $("fichier-gerants").addEventListener("change", choisirCSV);
      $("gerants-importer").addEventListener("click", importer);
      $("gerants-annuler-import").addEventListener("click", () => { aImporter = null; $("gerants-import").hidden = true; });
      $("exemple-gerants").addEventListener("click", chargerExemple);
      $("mv-mouvement").replaceChildren(...Object.entries(Donnees.MOUVEMENTS).map(([k, v]) => el("option", { value: k, texte: v })));
    }

    function reinitialiser() {
      periode = 365; aImporter = null;
      for (const id of ["societes-gerants", "mouvements-gerants"]) $(id).tBodies[0].replaceChildren();
      $("gerants-indicateurs").replaceChildren(); $("themes-gerants").replaceChildren();
      $("gerants-import").hidden = true; message("");
    }

    return { installer, afficher, reinitialiser };
  }

  racine.DecotesVueGerants = { creer };
})(typeof globalThis !== "undefined" ? globalThis : this);
