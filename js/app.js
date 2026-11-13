/* Interface : verrouillage, tableau de bord, analyse, journal, gestion des données.
   La logique métier est dans calc.js, le chiffrement dans coffre.js, le format dans donnees.js, le CSV dans csv.js,
   les requêtes réseau dans reseau.js et la logique du journal dans journal.js. Ce fichier ne fait qu'afficher et relier. */
(function () {
  "use strict";
  const D = window.Decotes, Donnees = window.DecotesDonnees, Coffre = window.DecotesCoffre, CSV = window.DecotesCSV;
  const Reseau = window.DecotesReseau, Journal = window.DecotesJournal;
  const Methodes = window.DecotesMethodes, Graphiques = window.DecotesGraphiques;
  let patrimoine = null, analyses = null; // vues installées au démarrage (vue-patrimoine.js, vue-analyses.js)
  const P = D.PARAMETRES;
  const $ = (id) => document.getElementById(id);
  const TAILLE_MAX_FICHIER = 5 * 1024 * 1024;
  const VERROUILLAGE_AUTO_MS = 15 * 60 * 1000;

  // ---------- État de la session (en mémoire uniquement) ----------
  const etat = {
    mode: "verrou",        // "verrou" | "ouvert" | "demo"
    pf: null,              // portefeuille déchiffré
    session: null,         // clé de chiffrement dérivée du mot de passe (jamais enregistrée)
    aRestaurer: null,      // enveloppe lue dans un fichier, en attente du mot de passe
    importCSV: null,       // lignes lues dans un CSV, en attente de validation
    ligneEnCours: null,    // identifiant de la ligne ouverte dans la fiche
    actualisation: null,   // AbortController de l'actualisation des cours en cours
    apercuOperation: null, // opération préparée, en attente de confirmation
    filtreClasse: "toutes",// filtre du tableau des lignes
  };
  let stockage = null;
  try { stockage = window.localStorage; } catch (e) { stockage = null; }
  const stockageOK = !!stockage && Coffre.stockageDisponible(stockage);

  // ---------- Mise en forme ----------
  const fEur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
  const fEur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const fPct = new Intl.NumberFormat("fr-FR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fPct0 = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });
  const fNb = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  const fDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });
  const fJour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
  const fJourAn = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const fQte = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 4 });
  const vide = "–";
  const estNombre = (v) => typeof v === "number" && Number.isFinite(v);
  const fmt = (f, v) => (estNombre(v) ? f.format(v) : vide);
  const signe = (v) => (estNombre(v) ? (v > 0 ? "+" : "") + fPct.format(v) : vide);
  const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;
  /** « 2027-01-06 » → objet Date à minuit, heure locale. */
  const versDate = (iso) => { const [a, m, j] = String(iso).split("-").map(Number); return new Date(a, m - 1, j); };
  const jourCourt = (iso) => (iso ? fJour.format(versDate(iso)) : null);
  const placeCourte = (cle) => (cle && cle !== "AUTRE" && Donnees.PLACES[cle] ? Donnees.PLACES[cle].replace("Euronext ", "").replace(/ \(.*\)$/, "") : null);
  const versChamp = (v) => (estNombre(v) ? String(Math.round(v * 1e6) / 1e6).replace(".", ",") : "");

  function el(balise, attrs, enfants) {
    const e = document.createElement(balise);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "texte") e.textContent = v;
      else if (v !== null && v !== undefined) e.setAttribute(k, v);
    }
    for (const c of [].concat(enfants || [])) if (c) e.append(c);
    return e;
  }

  /** Lit un champ numérique. Renvoie null si vide, NaN si illisible (le champ est alors marqué). */
  function lireChamp(champ) {
    const brut = champ.value.trim();
    const v = brut === "" ? null : CSV.lireNombre(brut);
    const invalide = brut !== "" && (v === null || v < 0);
    champ.classList.toggle("invalide", invalide);
    return invalide ? NaN : v;
  }

  function message(id, texte, info) {
    const m = $(id);
    m.hidden = !texte; m.textContent = texte || "";
    m.classList.toggle("info", !!info);
  }

  /** Lit un fichier choisi par l'utilisateur (API FileReader). */
  function lireFichier(fichier, enTexte) {
    return new Promise((resoudre, rejeter) => {
      if (fichier.size > TAILLE_MAX_FICHIER) return rejeter(new Error("Fichier trop volumineux (5 Mo au maximum)."));
      const lecteur = new FileReader();
      lecteur.onload = () => resoudre(lecteur.result);
      lecteur.onerror = () => rejeter(new Error("Lecture du fichier impossible."));
      if (enTexte) lecteur.readAsText(fichier); else lecteur.readAsArrayBuffer(fichier);
    });
  }

  // ================= Verrouillage =================
  function coffreEnregistre() {
    if (!stockageOK) return { enveloppe: null, erreur: null };
    try { return { enveloppe: Coffre.lire(stockage), erreur: null }; }
    catch (e) { return { enveloppe: null, erreur: e.message }; }
  }

  /** Affiche l'écran de verrouillage : création, déverrouillage ou restauration. */
  function afficherVerrou(ecran, texteMessage) {
    const { enveloppe, erreur } = coffreEnregistre();
    if (!ecran) ecran = enveloppe ? "ouvrir" : "creer";
    $("appli").hidden = true; $("onglets").hidden = true; $("verrouiller").hidden = true;
    $("verrou").hidden = false;
    for (const f of ["creer", "ouvrir", "restaurer"]) { $("f-" + f).hidden = f !== ecran; $("f-" + f).reset(); }
    $("verrou-secondaire").hidden = ecran === "restaurer";
    $("effacer-verrou").hidden = !enveloppe && !erreur;
    const titres = {
      creer: ["Créer votre portefeuille", "Vos données restent dans ce navigateur, chiffrées par un mot de passe que vous êtes seul à connaître. Rien n'est envoyé sur Internet."],
      ouvrir: ["Portefeuille verrouillé", "Saisissez votre mot de passe pour déchiffrer vos données."],
      restaurer: ["Restaurer une sauvegarde", "La sauvegarde remplacera le portefeuille enregistré dans ce navigateur."],
    };
    $("verrou-titre").textContent = titres[ecran][0];
    $("verrou-texte").textContent = titres[ecran][1];
    let avis = texteMessage || erreur || "";
    if (!Coffre.disponible) {
      avis = "Ce navigateur ne permet pas le chiffrement sur cette page (elle doit être ouverte en https ou depuis votre ordinateur). Seule la démonstration est disponible.";
      $("f-creer").hidden = true; $("f-ouvrir").hidden = true;
    } else if (!stockageOK && ecran === "creer" && !avis) {
      avis = "Ce navigateur n'autorise pas l'enregistrement sur cette page : le portefeuille ne sera pas conservé après fermeture. Pensez à exporter une sauvegarde.";
    }
    message("verrou-message", avis);
    const champ = { creer: "mdp-nouveau", ouvrir: "mdp", restaurer: "mdp-sauvegarde" }[ecran];
    if (!$("f-" + ecran).hidden) $(champ).focus();
  }

  function occuper(formulaire, occupe) {
    formulaire.querySelectorAll("button, input").forEach((c) => (c.disabled = occupe));
  }

  function ouvrirSession(pf, session, mode) {
    etat.pf = pf; etat.session = session; etat.mode = mode; etat.aRestaurer = null;
    $("verrou").hidden = true; $("appli").hidden = false; $("onglets").hidden = false; $("verrouiller").hidden = false;
    $("verrouiller").textContent = mode === "demo" ? "Quitter" : "Verrouiller";
    afficherVue("tableau");
    toutAfficher();
    // Un point par jour d'ouverture alimente la courbe d'évolution.
    if (mode === "ouvert" && !pf.historique.some((h) => h.date === Journal.aujourdhui()) && (pf.lignes.length || pf.parametres.cash)) enregistrer();
    armerVerrouillageAuto();
  }

  function verrouiller(texteMessage) {
    if ($("dlg-ligne").open) $("dlg-ligne").close();
    if ($("dlg-operation").open) $("dlg-operation").close();
    if (etat.actualisation) etat.actualisation.abort();
    etat.apercuOperation = null;
    etat.pf = null; etat.session = null; etat.mode = "verrou"; etat.importCSV = null; etat.ligneEnCours = null;
    clearTimeout(minuterie);
    // On vide l'affichage : plus aucune donnée déchiffrée ne reste dans la page.
    $("lignes").tBodies[0].replaceChildren(); $("indicateurs").replaceChildren();
    $("operations").tBodies[0].replaceChildren(); $("journal-totaux").replaceChildren();
    $("rapport-liste").replaceChildren(); $("rapport-cours").hidden = true;
    etat.filtreClasse = "toutes";
    patrimoine.reinitialiser(); analyses.reinitialiser();
    afficherVerrou(null, texteMessage);
  }

  let minuterie = null;
  function armerVerrouillageAuto() {
    clearTimeout(minuterie);
    if (etat.mode !== "ouvert") return;
    minuterie = setTimeout(() => verrouiller("Verrouillé après 15 minutes d'inactivité."), VERROUILLAGE_AUTO_MS);
  }
  for (const evenement of ["pointerdown", "keydown", "input"]) document.addEventListener(evenement, armerVerrouillageAuto, { passive: true });

  // Enregistrements chiffrés, l'un après l'autre.
  let file = Promise.resolve();
  function enregistrer() {
    if (etat.pf) {
      const s = D.synthese(etat.pf.lignes, etat.pf.parametres.cash, P, new Date());
      Donnees.noterHistorique(etat.pf, Journal.aujourdhui(), s.valeurTitres, s.cash);
    }
    if (etat.mode !== "ouvert") return file;
    etat.pf.modifieLe = new Date().toISOString();
    const session = etat.session, copie = JSON.parse(JSON.stringify(etat.pf));
    file = file.then(async () => {
      const enveloppe = await Coffre.sceller(session, copie);
      if (stockageOK) Coffre.ecrire(stockage, enveloppe);
      etat.derniereEnveloppe = enveloppe;
    }).catch((e) => {
      console.error(e);
      afficherBandeaux("L'enregistrement a échoué (" + e.message + "). Exportez une sauvegarde sans attendre.");
    });
    return file;
  }

  $("f-creer").addEventListener("submit", async (e) => {
    e.preventDefault();
    const mdp = $("mdp-nouveau").value;
    if (mdp.length < Coffre.LONGUEUR_MIN) return message("verrou-message", `Le mot de passe doit compter au moins ${Coffre.LONGUEUR_MIN} caractères.`);
    if (mdp !== $("mdp-confirmation").value) return message("verrou-message", "Les deux mots de passe ne sont pas identiques.");
    occuper(e.target, true); message("verrou-message", "Création du coffre…", true);
    try {
      const pf = Donnees.nouveauPortefeuille();
      const { session, enveloppe } = await Coffre.creer(mdp, pf);
      if (stockageOK) Coffre.ecrire(stockage, enveloppe);
      etat.derniereEnveloppe = enveloppe;
      occuper(e.target, false);
      ouvrirSession(pf, session, "ouvert");
    } catch (err) { occuper(e.target, false); message("verrou-message", "Création impossible : " + err.message); }
  });

  $("f-ouvrir").addEventListener("submit", async (e) => {
    e.preventDefault();
    const mdp = $("mdp").value;
    occuper(e.target, true); message("verrou-message", "Déchiffrement…", true);
    try {
      const enveloppe = Coffre.lire(stockage);
      const { session, donnees } = await Coffre.ouvrir(mdp, enveloppe);
      etat.derniereEnveloppe = enveloppe;
      occuper(e.target, false);
      ouvrirSession(Donnees.normaliser(donnees), session, "ouvert");
    } catch (err) {
      occuper(e.target, false);
      message("verrou-message", err.message);
      $("mdp").value = ""; $("mdp").focus();
    }
  });

  // ----- Restauration d'une sauvegarde -----
  async function choisirSauvegarde(e) {
    const fichier = e.target.files[0]; e.target.value = "";
    if (!fichier) return;
    try {
      let contenu;
      try { contenu = JSON.parse(await lireFichier(fichier, true)); }
      catch (err) { if (err instanceof SyntaxError) throw new Error("Ce fichier n'est pas une sauvegarde de cet outil."); throw err; }
      etat.aRestaurer = Coffre.validerEnveloppe(contenu);
      afficherVerrou("restaurer");
      const date = etat.aRestaurer.enregistreLe ? " enregistrée le " + fDate.format(new Date(etat.aRestaurer.enregistreLe)) : "";
      $("restaurer-fichier").textContent = `Fichier : ${fichier.name}${date}.`;
    } catch (err) {
      if (etat.mode === "verrou") message("verrou-message", err.message);
      else afficherBandeaux(err.message);
    }
  }
  $("fichier-sauvegarde").addEventListener("change", choisirSauvegarde);
  $("fichier-sauvegarde-2").addEventListener("change", choisirSauvegarde);

  $("f-restaurer").addEventListener("submit", async (e) => {
    e.preventDefault();
    const mdp = $("mdp-sauvegarde").value;
    occuper(e.target, true); message("verrou-message", "Déchiffrement de la sauvegarde…", true);
    try {
      const enveloppe = etat.aRestaurer;
      const { session, donnees } = await Coffre.ouvrir(mdp, enveloppe);
      const pf = Donnees.normaliser(donnees);
      occuper(e.target, false);
      if (coffreEnregistre().enveloppe && !window.confirm("Remplacer le portefeuille enregistré dans ce navigateur par cette sauvegarde ? Cette action est définitive.")) {
        return message("verrou-message", "Restauration annulée.", true);
      }
      await file;
      if (stockageOK) Coffre.ecrire(stockage, enveloppe);
      etat.derniereEnveloppe = enveloppe;
      ouvrirSession(pf, session, "ouvert");
      afficherBandeaux(`Sauvegarde restaurée : ${pluriel(pf.lignes.length, "ligne")}.`, true);
    } catch (err) {
      occuper(e.target, false);
      message("verrou-message", err.message);
      $("mdp-sauvegarde").value = ""; $("mdp-sauvegarde").focus();
    }
  });
  $("restaurer-annuler").addEventListener("click", () => {
    etat.aRestaurer = null;
    if (etat.mode === "verrou") afficherVerrou();
    else { $("verrou").hidden = true; $("appli").hidden = false; $("onglets").hidden = false; $("verrouiller").hidden = false; }
  });

  $("verrouiller").addEventListener("click", () => verrouiller());
  $("demo").addEventListener("click", () => ouvrirSession(portefeuilleDemo(), null, "demo"));

  function effacerTout() {
    if (!window.confirm("Effacer définitivement le portefeuille enregistré dans ce navigateur ? Sans sauvegarde exportée, il sera perdu.")) return;
    if (stockageOK) Coffre.effacer(stockage);
    etat.derniereEnveloppe = null;
    verrouiller("Les données de ce navigateur ont été effacées.");
  }
  $("effacer-verrou").addEventListener("click", effacerTout);
  $("effacer").addEventListener("click", effacerTout);

  // ---------- Données de démonstration (sociétés fictives) ----------
  function dansJours(nb) {
    const d = new Date(); d.setDate(d.getDate() + nb);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function portefeuilleDemo() {
    const pf = Donnees.normaliser({
      version: 1, parametres: { capitalDepart: 8000, cash: 1150, relais: "" },
      lignes: [
        { nom: "Alpha Industrie", code: "ALPH", place: "XPAR", enveloppe: "PEA", quantite: 100, prixRevient: 3.5, cours: 3.8, dateCours: dansJours(-1), objectif: 7.5, solvabilite: 0.881, dateResultats: dansJours(9) },
        { nom: "Bêta Textile", code: "BETA", place: "XPAR", enveloppe: "PEA", quantite: 40, prixRevient: 9.2, cours: 15.4, dateCours: dansJours(-1), objectif: 16, solvabilite: 0.62, dateResultats: dansJours(70) },
        { nom: "Gamma Outillage", code: "GAMM", place: "XBRU", enveloppe: "PEA", quantite: 140, prixRevient: 4.1, cours: 3.15, dateCours: dansJours(-1), objectif: 8.2, solvabilite: 0.55, dateResultats: dansJours(40) },
        { nom: "Delta Négoce", code: "DELT", place: "XOSL", enveloppe: "CTO", quantite: 60, prixRevient: 6, cours: 5.1, dateCours: dansJours(-1), objectif: 10.5, solvabilite: 0.31, dateResultats: dansJours(25) },
        { nom: "Epsilon Papiers", code: "EPSI", place: "XPAR", enveloppe: "PEA", quantite: 70, prixRevient: 5.4, cours: 5.9 },
        { nom: "ETF Small Cap Value Monde", classe: "etf", code: "SCVM", place: "XPAR", enveloppe: "PEA", quantite: 45, prixRevient: 48, cours: 52.3, dateCours: dansJours(-1) },
        { nom: "ETF Asie émergente", classe: "etf", code: "ASIE", place: "XPAR", enveloppe: "PEA", quantite: 60, prixRevient: 21, cours: 19.6, dateCours: dansJours(-1) },
        { nom: "ETF baissier semi-conducteurs ×3", classe: "etf", code: "SOXS", place: "XNYS", enveloppe: "CTO", quantite: 25, prixRevient: 18, cours: 15.2, dateCours: dansJours(-1) },
        { nom: "Or physique (pièces)", classe: "or", code: "GC=F", place: "AUTRE", enveloppe: "CTO", quantite: 0.5, prixRevient: 2300, cours: 2480, dateCours: dansJours(-1) },
        { nom: "ETF mines d'or", classe: "or", code: "GDX", place: "XNYS", enveloppe: "CTO", quantite: 12, prixRevient: 38, cours: 44.5, dateCours: dansJours(-1) },
      ],
      journal: [
        { date: dansJours(-60), type: "achat", nom: "Alpha Industrie", code: "ALPH", quantite: 100, prix: 3.48, frais: 2, total: 350 },
        { date: dansJours(-45), type: "achat", nom: "Bêta Textile", code: "BETA", quantite: 40, prix: 9.15, frais: 2, total: 368 },
        { date: dansJours(-20), type: "vente", nom: "Omega Verrerie", code: "OMEG", quantite: 50, prix: 12.4, frais: 2, total: 618, plusValue: 203 },
        { date: dansJours(-10), type: "dividende", nom: "Bêta Textile", code: "BETA", quantite: 40, prix: 0.35, frais: 4.2, total: 9.8 },
      ],
      analyses: [
        { outil: "rapp", nom: Methodes.EXEMPLE_RAPP.nom, valeurs: Object.assign({ nom: Methodes.EXEMPLE_RAPP.nom, tsr: Methodes.EXEMPLE_RAPP.tauxSansRisque },
          ...Methodes.EXEMPLE_RAPP.annees.map((a, i) => Object.fromEntries(Object.entries(a).map(([k, v]) => [`a${i}_${k}`, v])))) },
      ],
    });
    // Historique fictif sur neuf mois : une marche régulière qui aboutit à la valeur actuelle.
    const s = D.synthese(pf.lignes, pf.parametres.cash, P, new Date());
    let graine = 7;
    const hasard = () => { graine = (graine * 16807) % 2147483647; return graine / 2147483647 - 0.5; };
    const jours = 270, depart = Math.round(s.valeurTitres * 0.88);
    let v = depart;
    for (let k = jours; k >= 1; k -= 3) {
      const cible = depart + (s.valeurTitres - depart) * (1 - k / jours);
      v = v + (cible - v) * 0.25 + hasard() * 140;
      pf.historique.push({ date: dansJours(-k), titres: Math.max(0, Math.round(v)), cash: pf.parametres.cash });
    }
    return pf;
  }

  // ================= Navigation =================
  function afficherVue(nom) {
    document.querySelectorAll(".vue").forEach((v) => (v.hidden = v.id !== "vue-" + nom));
    document.querySelectorAll(".onglet").forEach((o) =>
      o.dataset.vue === nom ? o.setAttribute("aria-current", "page") : o.removeAttribute("aria-current"));
    window.scrollTo(0, 0);
  }
  document.querySelectorAll(".onglet").forEach((o) => o.addEventListener("click", () => afficherVue(o.dataset.vue)));

  function afficherBandeaux(texte, info) {
    const demo = etat.mode === "demo" ? "Démonstration : sociétés fictives. Vos modifications ne sont pas enregistrées." : "";
    for (const id of ["bandeau", "bandeau-donnees", "bandeau-journal"]) {
      const b = $(id); const t = texte || demo;
      b.hidden = !t; b.textContent = t;
      b.classList.toggle("alerte", !!texte && !info);
      b.classList.toggle("info", !!texte && !!info);
    }
  }

  function toutAfficher() { afficherBandeaux(); afficherTableau(); afficherJournal(); afficherDonnees(); analyses.afficherFiches(); }

  // ================= Tableau de bord =================
  const CLASSE_STATUT = {
    [D.STATUTS.VENDRE]: "s-vendre", [D.STATUTS.REEXAMINER]: "s-reexaminer", [D.STATUTS.RENFORCER]: "s-renforcer",
    [D.STATUTS.A_COMPLETER]: "s-completer", [D.STATUTS.GARDER]: "s-garder", [D.STATUTS.SUIVI]: "s-suivi",
  };
  const COULEUR_CLASSE = { decote: "v1", etf: "v2", or: "v4" };
  const CLASSE_COURTE = { decote: "Action décotée", etf: "ETF", or: "Or, matières" };

  function indicateur(titre, valeur, detail, extra) {
    return el("div", { class: "indic" }, [
      el("p", { class: "indic-titre", texte: titre }), el("p", { class: "indic-valeur", texte: valeur }),
      extra, el("p", { class: "indic-detail", texte: detail }),
    ]);
  }

  function afficherTableau() {
    const pf = etat.pf; if (!pf) return;
    const capital = pf.parametres.capitalDepart;
    const s = D.synthese(pf.lignes, pf.parametres.cash, P, new Date());
    const S = D.STATUTS;
    const decisions = s.compte(S.VENDRE) + s.compte(S.REEXAMINER) + s.compte(S.RENFORCER);
    const pvTexte = s.investi > 0 ? `Plus-value latente : ${s.pvLatente >= 0 ? "+" : "−"}${fEur0.format(Math.abs(s.pvLatente))} (${signe(s.pvLatente / s.investi)})` : "";

    $("indicateurs").replaceChildren(
      indicateur("Valeur totale", fmt(fEur0, s.total), [capital > 0 ? `Capital de départ : ${fEur0.format(capital)} (${signe(s.total / capital - 1)})` : "", pvTexte].filter(Boolean).join(" · ")),
      indicateur("Cash disponible", fmt(fEur0, s.cash), `${fmt(fPct0, s.partCash)} du total`, patrimoine.jaugeCash(s)),
      indicateur("Décisions à prendre", String(decisions), `${s.compte(S.VENDRE)} à vendre · ${s.compte(S.REEXAMINER)} à réexaminer · ${s.compte(S.RENFORCER)} à renforcer ?`),
      indicateur("Points d'attention", String(s.lignesTropLourdes + s.resultatsProches + s.compte(S.A_COMPLETER)), `${s.lignesTropLourdes} ligne trop lourde · ${s.resultatsProches} publication proche · ${s.compte(S.A_COMPLETER)} à compléter`),
    );
    patrimoine.afficher(pf, s, Journal.aujourdhui());

    $("resume-lignes").textContent = `${pluriel(s.detail.length, "ligne")} · ${fmt(fEur0, s.valeurTitres)} en titres`;
    const demo = etat.mode === "demo";
    $("actualiser").disabled = demo || s.detail.length === 0 || !!etat.actualisation;
    $("etat-cours").textContent = demo ? "Démonstration : actualisation des cours indisponible (sociétés fictives)."
      : pf.coursActualisesLe ? "Cours actualisés le " + fDate.format(new Date(pf.coursActualisesLe)) + "." : "Cours saisis à la main pour l'instant.";

    // Filtre par classe d'actif (ne concerne que le tableau ; les compteurs restent visibles).
    const compteClasse = (c) => s.detail.filter((d) => d.classe === c).length;
    const filtres = [["toutes", "Toutes", s.detail.length]].concat(Object.entries(Donnees.CLASSES).map(([c, nom]) => [c, nom, compteClasse(c)]).filter(([, , n]) => n > 0));
    if (!filtres.some(([c]) => c === etat.filtreClasse)) etat.filtreClasse = "toutes";
    $("filtres-classe").hidden = filtres.length <= 2;
    $("filtres-classe").replaceChildren(...filtres.map(([c, nom, n]) => {
      const b = el("button", { type: "button", "aria-pressed": String(etat.filtreClasse === c), texte: `${nom} (${n})` });
      b.addEventListener("click", () => { etat.filtreClasse = c; afficherTableau(); });
      return b;
    }));
    const visibles = s.detail.filter((d) => etat.filtreClasse === "toutes" || d.classe === etat.filtreClasse);

    $("aucune-ligne").hidden = s.detail.length > 0;
    $("lignes").hidden = s.detail.length === 0;
    const cellule = (titre, texte, classe) => el("td", { "data-titre": titre, class: classe || "num", texte });
    $("lignes").tBodies[0].replaceChildren(...visibles.map((d) => {
      const l = d.ligne;
      const puces = [];
      if (d.tropLourde) puces.push(el("span", { class: "puce", texte: `⚠ Concentration : ${fPct.format(d.poids)} (> ${fPct0.format(P.tailleMaxLigne)})` }));
      if (d.resultatsProches) puces.push(el("span", { class: "puce", texte: d.joursAvantResultats === 0 ? "Résultats aujourd'hui" : `Résultats dans ${d.joursAvantResultats} j` }));
      const modifier = el("button", { type: "button", class: "lien", texte: "Modifier", "aria-label": "Modifier " + l.nom });
      modifier.addEventListener("click", () => ouvrirLigne(l));
      const sousTitre = [l.code, placeCourte(l.place), l.enveloppe, estNombre(l.quantite) ? pluriel(l.quantite, "titre") : null,
        l.dateCours && estNombre(l.cours) ? "cours du " + jourCourt(l.dateCours) : null].filter(Boolean).join(" · ");
      const pv = d.pvLatente;
      const decote = d.classe === "decote";
      return el("tr", {}, [
        el("td", { class: "c-soc" }, [
          el("div", { class: "soc-nom", texte: l.nom }),
          el("div", { class: "soc-code" }, [el("span", { class: "classe-tag " + COULEUR_CLASSE[d.classe], texte: CLASSE_COURTE[d.classe] }), document.createTextNode(sousTitre ? " · " + sousTitre : "")]),
        ]),
        cellule("Cours", fmt(fEur, l.cours)),
        cellule("PRU", fmt(fEur, l.prixRevient)),
        cellule("Plus-value latente", pv === null ? vide : `${pv >= 0 ? "+" : "−"}${fEur0.format(Math.abs(pv))} (${signe(d.performance)})`, "num " + (pv > 0 ? "hausse" : pv < 0 ? "baisse" : "")),
        cellule("Objectif", decote ? fmt(fEur, l.objectif) : vide),
        cellule("Potentiel", decote ? signe(d.potentiel) : vide),
        cellule("Poids", fmt(fPct, d.poids), "num" + (d.tropLourde ? " trop-lourd" : "")),
        el("td", { class: "c-statut" }, [el("span", { class: "statut " + CLASSE_STATUT[d.statut], texte: d.statut }), el("div", {}, puces)]),
        el("td", { class: "c-actions" }, modifier),
      ]);
    }));

    const regles = [
      ["Prix d'achat maximal", `${fPct0.format(P.achatMaxPctValeur)} de la VANN ou de la VANE`],
      ["Vente", `à l'objectif (VANT), ou potentiel restant < ${fPct0.format(P.seuilVentePotentiel)}`],
      ["Renforcement envisagé", `baisse de ${fPct0.format(-P.seuilRenforcement)} et bilan solide`],
      ["Solvabilité maison minimale", fPct0.format(P.solvabiliteMin)],
      ["Taille maximale d'une action", `${fPct0.format(P.tailleMaxLigne)} (hors ETF et or)`],
      ["Cash à garder", `entre ${fPct0.format(P.cashMin)} et ${fPct0.format(P.cashCible)}`],
      ["Immeubles retenus dans la VANE", `${fPct0.format(P.immeublesRetenus)} du prix d'achat`],
      ["Alerte avant publication", `${P.joursAlerteResultats} jours`],
      ["ETF, or et matières premières", "suivis sans règle d'achat ni de vente (statut SUIVI)"],
    ];
    $("regles").replaceChildren(...regles.flatMap(([t, v]) => [el("dt", { texte: t }), el("dd", { texte: v })]));
  }

  // ================= Fiche d'une ligne =================
  const CHAMPS_LIGNE = ["quantite", "prixRevient", "cours", "objectif", "solvabilite"];

  function ouvrirLigne(ligne, estNouvelle) {
    const l = ligne || {};
    etat.ligneEnCours = ligne && !estNouvelle ? ligne.id : null;
    $("ligne-titre").textContent = etat.ligneEnCours ? "Modifier la ligne" : "Nouvelle ligne";
    $("l-nom").value = l.nom || ""; $("l-code").value = l.code || "";
    $("l-enveloppe").value = l.enveloppe === "CTO" ? "CTO" : "PEA";
    $("l-place").value = l.place && Donnees.PLACES[l.place] ? l.place : Donnees.PLACE_DEFAUT;
    $("l-classe").value = l.classe && Donnees.CLASSES[l.classe] ? l.classe : "decote";
    $("l-dateCours").value = l.dateCours || "";
    etat.coursInitial = estNombre(l.cours) ? l.cours : null;
    etat.dateCoursInitiale = l.dateCours || "";
    for (const c of CHAMPS_LIGNE) {
      $("l-" + c).value = versChamp(c === "solvabilite" && estNombre(l[c]) ? l[c] * 100 : l[c]);
      $("l-" + c).classList.remove("invalide");
    }
    $("l-bilanSolide").value = l.bilanSolide === true ? "oui" : l.bilanSolide === false ? "non" : "";
    $("l-dateResultats").value = l.dateResultats || ""; $("l-notes").value = l.notes || "";
    $("l-nom").classList.remove("invalide");
    $("ligne-supprimer").hidden = !etat.ligneEnCours;
    message("ligne-message", "");
    $("dlg-ligne").showModal();
  }

  $("f-ligne").addEventListener("submit", (e) => {
    e.preventDefault();
    const valeurs = {}; let invalide = false;
    for (const c of CHAMPS_LIGNE) { const v = lireChamp($("l-" + c)); if (Number.isNaN(v)) invalide = true; valeurs[c] = v; }
    const nom = $("l-nom").value.trim();
    $("l-nom").classList.toggle("invalide", !nom);
    if (!nom) return message("ligne-message", "Indiquez le nom de la société.");
    if (invalide) return message("ligne-message", "Corrigez les nombres signalés en rouge.");
    const solide = $("l-bilanSolide").value;
    const ligne = Donnees.normaliserLigne(Object.assign(valeurs, {
      id: etat.ligneEnCours, nom, code: $("l-code").value, enveloppe: $("l-enveloppe").value, place: $("l-place").value, classe: $("l-classe").value,
      // Un cours modifié à la main sans changer sa date est daté d'aujourd'hui.
      dateCours: valeurs.cours !== null && valeurs.cours !== etat.coursInitial && $("l-dateCours").value === etat.dateCoursInitiale
        ? Journal.aujourdhui() : $("l-dateCours").value || null,
      solvabilite: valeurs.solvabilite === null ? null : valeurs.solvabilite / 100,
      bilanSolide: solide === "oui" ? true : solide === "non" ? false : null,
      dateResultats: $("l-dateResultats").value || null, notes: $("l-notes").value,
    }));
    const i = etat.pf.lignes.findIndex((x) => x.id === etat.ligneEnCours);
    if (i >= 0) etat.pf.lignes[i] = ligne; else etat.pf.lignes.push(ligne);
    $("dlg-ligne").close(); enregistrer(); toutAfficher();
  });
  $("ligne-annuler").addEventListener("click", () => $("dlg-ligne").close());
  $("ligne-supprimer").addEventListener("click", () => {
    const l = etat.pf.lignes.find((x) => x.id === etat.ligneEnCours);
    if (!l || !window.confirm(`Supprimer la ligne ${l.nom} ?`)) return;
    etat.pf.lignes = etat.pf.lignes.filter((x) => x.id !== l.id);
    $("dlg-ligne").close(); enregistrer(); toutAfficher();
  });
  $("ajouter-ligne").addEventListener("click", () => ouvrirLigne(null));

  // ================= Données =================
  function afficherDonnees() {
    const pf = etat.pf; if (!pf) return;
    const demo = etat.mode === "demo";
    $("p-capital").value = versChamp(pf.parametres.capitalDepart);
    $("p-cash").value = versChamp(pf.parametres.cash);
    $("parametres-etat").textContent = "";
    $("sauvegarde-etat").textContent = demo
      ? "En démonstration, rien n'est enregistré. Créez votre portefeuille pour utiliser la sauvegarde."
      : `${pluriel(pf.lignes.length, "ligne")}, dernière modification le ${fDate.format(new Date(pf.modifieLe))}. ` +
        (stockageOK ? "Enregistré dans ce navigateur, chiffré (AES-GCM 256 bits)." : "Ce navigateur n'enregistre rien ici : exportez une sauvegarde avant de fermer.");
    for (const id of ["exporter", "fichier-sauvegarde-2", "effacer"]) $(id).disabled = demo;
    $("p-relais").value = pf.parametres.relais || "";
    $("relais-avertissement").hidden = !pf.parametres.relais;
    annulerCSV();
  }

  $("f-parametres").addEventListener("submit", (e) => e.preventDefault());
  $("f-parametres").addEventListener("change", () => {
    const capital = lireChamp($("p-capital")), cash = lireChamp($("p-cash"));
    if (Number.isNaN(capital) || Number.isNaN(cash)) { $("parametres-etat").textContent = "Nombre illisible : rien n'a été modifié."; return; }
    etat.pf.parametres.capitalDepart = capital ?? 0; etat.pf.parametres.cash = cash ?? 0;
    enregistrer(); afficherTableau();
    $("parametres-etat").textContent = etat.mode === "demo" ? "Pris en compte (non enregistré en démonstration)." : "Enregistré.";
  });

  $("exporter").addEventListener("click", async () => {
    await file;
    const enveloppe = etat.derniereEnveloppe; if (!enveloppe) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(enveloppe, null, 2)], { type: "application/json" }));
    const lien = el("a", { href: url, download: `chasseur-decotes-sauvegarde-${dansJours(0)}.json` });
    document.body.append(lien); lien.click(); lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    afficherBandeaux("Sauvegarde chiffrée exportée. Rangez-la hors de ce navigateur.", true);
  });

  // ----- Import CSV -----
  function annulerCSV() { etat.importCSV = null; $("csv-resultat").hidden = true; }
  $("csv-annuler").addEventListener("click", annulerCSV);

  $("fichier-csv").addEventListener("change", async (e) => {
    const fichier = e.target.files[0]; e.target.value = "";
    if (!fichier) return;
    annulerCSV();
    let lu;
    try { lu = CSV.lirePortefeuille(CSV.decoder(await lireFichier(fichier, false))); }
    catch (err) { lu = { lignes: [], ignorees: [], colonnes: [], erreur: err.message }; }
    $("csv-resultat").hidden = false;
    $("csv-ignorees").replaceChildren(...lu.ignorees.slice(0, 20).map((i) => el("li", { texte: `Ligne ${i.numero} ignorée. ${i.raison}` })));
    if (lu.erreur || lu.lignes.length === 0) {
      $("csv-resume").textContent = lu.erreur || "Aucune ligne exploitable dans ce fichier.";
      $("csv-valider").hidden = true;
      return;
    }
    etat.importCSV = lu.lignes;
    $("csv-resume").textContent = `${fichier.name} : ${pluriel(lu.lignes.length, "ligne")} à importer. Colonnes reconnues : ${lu.colonnes.join(", ")}.`;
    $("csv-valider").hidden = false;
    $("csv-valider").textContent = `Ajouter ${pluriel(lu.lignes.length, "ligne")}`;
  });

  $("csv-valider").addEventListener("click", () => {
    if (!etat.importCSV) return;
    const { ajoutees, doublons } = Donnees.ajouterLignes(etat.pf, etat.importCSV);
    enregistrer(); toutAfficher();
    const suite = doublons.length ? ` ${pluriel(doublons.length, "ligne")} déjà présente${doublons.length > 1 ? "s" : ""} (même code) : ${doublons.join(", ")}.` : "";
    afficherBandeaux(`${pluriel(ajoutees, "ligne")} ajoutée${ajoutees > 1 ? "s" : ""} au portefeuille.${suite}`, true);
    afficherVue("tableau");
  });

  // ----- Source des cours -----
  $("f-relais").addEventListener("submit", (e) => e.preventDefault());
  $("p-relais").addEventListener("change", () => {
    const valeur = $("p-relais").value;
    if (valeur && !window.confirm("Le relais corsproxy.io recevra la liste de vos codes bourse (jamais vos quantités ni vos montants) et peut l'enregistrer. Activer le relais ?")) {
      $("p-relais").value = etat.pf.parametres.relais || ""; return;
    }
    etat.pf.parametres.relais = Donnees.RELAIS.includes(valeur) ? valeur : "";
    $("relais-avertissement").hidden = !etat.pf.parametres.relais;
    enregistrer();
  });

  // ================= Actualisation des cours =================
  $("actualiser").addEventListener("click", async () => {
    if (etat.mode !== "ouvert" || etat.actualisation || etat.pf.lignes.length === 0) return;
    const pf = etat.pf;
    const controleur = new AbortController();
    etat.actualisation = controleur;
    const bouton = $("actualiser");
    bouton.disabled = true; bouton.textContent = "Actualisation…";
    $("rapport-cours").hidden = false; $("rapport-liste").replaceChildren();
    $("rapport-resume").textContent = "Connexion à Yahoo Finance…";
    let rapport = null;
    try {
      rapport = await Reseau.actualiser(pf.lignes, {
        relais: pf.parametres.relais, signal: controleur.signal,
        progression: (fait, total) => { $("rapport-resume").textContent = `Actualisation : ${fait} / ${total} codes…`; },
      });
    } catch (e) {
      $("rapport-resume").textContent = "Actualisation impossible : " + e.message;
    } finally {
      etat.actualisation = null;
      bouton.textContent = "Actualiser les cours";
      bouton.disabled = etat.mode !== "ouvert";
    }
    // Session verrouillée ou portefeuille remplacé pendant l'attente : on n'applique rien.
    if (!rapport || etat.mode !== "ouvert" || etat.pf !== pf) return;
    for (const r of rapport.resultats) {
      if (!r.ok) continue;
      const l = pf.lignes.find((x) => x.id === r.id); // une ligne supprimée entre-temps est ignorée
      if (l) { l.cours = r.prix; l.dateCours = r.date; }
    }
    if (rapport.misAJour) { pf.coursActualisesLe = new Date().toISOString(); enregistrer(); }
    afficherTableau();
    afficherRapport(rapport);
  });
  $("rapport-fermer").addEventListener("click", () => { $("rapport-cours").hidden = true; });

  function afficherRapport(r) {
    let resume = `${r.misAJour} cours mis à jour sur ${pluriel(r.resultats.length, "ligne")}`;
    if (r.echecs) resume += `, ${pluriel(r.echecs, "échec")}`;
    if (r.ignorees) resume += `, ${r.ignorees} sans code`;
    resume += r.echecs || r.ignorees ? ". Les lignes en échec gardent leur ancien cours." : ".";
    if (r.diagnostic === "reseau") {
      resume = "Yahoo Finance n'a pas pu être joint depuis cette page : soit la connexion Internet est coupée, soit Yahoo refuse les requêtes " +
        "venant d'un site web (règle de sécurité « CORS » des navigateurs). Aucun cours n'a été modifié. Vous pouvez saisir les cours à la main " +
        "dans chaque ligne, ou essayer le relais (onglet Données) en connaissant ses limites.";
    } else if (r.diagnostic === "limite") {
      resume = "Yahoo Finance limite le nombre de requêtes : l'actualisation s'est arrêtée. Réessayez dans quelques minutes. " + resume;
    }
    $("rapport-resume").textContent = resume + (r.relais !== "Aucun (requête directe)" ? ` Relais utilisé : ${r.relais}.` : "");
    if (r.diagnostic === "reseau") { $("rapport-liste").replaceChildren(); return; }
    // Les lignes à vérifier d'abord : échecs, puis variations inhabituelles.
    const ordre = (x) => (!x.ok ? 0 : x.alerte ? 1 : 2);
    const fOrigine = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 4 });
    $("rapport-liste").replaceChildren(...r.resultats.slice().sort((a, b) => ordre(a) - ordre(b)).map((x) => {
      const enfants = [el("span", { class: "r-nom", texte: x.nom })];
      if (x.ok) {
        enfants.push(el("span", { class: "r-valeur", texte: `${fmt(fEur, x.ancien)} → ${fEur.format(x.prix)}${estNombre(x.variation) ? " (" + signe(x.variation) + ")" : ""}` }));
        const detail = [x.symbole, x.date ? "cours du " + jourCourt(x.date) : null, x.nomFournisseur ? "Yahoo : " + x.nomFournisseur : null,
          x.taux ? `converti depuis ${fOrigine.format(x.prixOrigine)} ${x.devise}` : null].filter(Boolean).join(" · ");
        enfants.push(el("span", { class: "r-detail", texte: detail }));
        if (x.alerte) enfants.push(el("span", { class: "r-alerte", texte: `Variation de ${signe(x.variation)} depuis le dernier cours : vérifiez que le code ${x.symbole} correspond bien à cette société.` }));
      } else {
        enfants.push(el("span", { class: "r-valeur", texte: x.symbole || "" }));
        enfants.push(el("span", { class: "r-erreur", texte: x.erreur }));
      }
      return el("li", {}, enfants);
    }));
  }

  // ================= Journal =================
  const LIBELLES_TYPE = { achat: "Achat", vente: "Vente", dividende: "Dividende" };

  function afficherJournal() {
    const pf = etat.pf; if (!pf) return;
    const s = Journal.synthese(pf.journal);
    const t = s.totaux;
    $("journal-totaux").replaceChildren(
      indicateur("Achats", fEur.format(t.achat), "Frais compris"),
      indicateur("Ventes", fEur.format(t.vente), "Nettes de frais"),
      indicateur("Dividendes", fEur.format(t.dividende), "Nets de prélèvements"),
      indicateur("Plus-values réalisées", (t.plusValues > 0 ? "+" : "") + fEur.format(t.plusValues), `Frais payés : ${fEur.format(t.frais)}`),
    );
    $("journal-resume").textContent = pluriel(s.operations.length, "opération");
    $("journal-vide").hidden = s.operations.length > 0;
    $("operations").hidden = s.operations.length === 0;
    const cellule = (titre, texte, classe) => el("td", { "data-titre": titre, class: classe || "num", texte });
    $("operations").tBodies[0].replaceChildren(...s.operations.map((o) => {
      const supprimer = el("button", { type: "button", class: "lien", texte: "Supprimer", "aria-label": `Supprimer l'opération du ${o.date}` });
      supprimer.addEventListener("click", () => {
        if (!window.confirm("Supprimer cette opération du journal ? Cela n'annule pas ses effets sur la ligne et sur le cash.")) return;
        pf.journal = pf.journal.filter((x) => x.id !== o.id);
        enregistrer(); afficherJournal();
      });
      const encaisse = o.type !== "achat";
      return el("tr", {}, [
        el("td", { class: "c-soc" }, [el("div", { class: "soc-nom", texte: o.nom || o.code }), el("div", { class: "soc-code", texte: [o.code, o.note].filter(Boolean).join(" · ") })]),
        el("td", { class: "c-statut" }, [el("span", { class: "type t-" + o.type, texte: LIBELLES_TYPE[o.type] }), el("span", { class: "soc-code", texte: " · " + (o.date ? fJourAn.format(versDate(o.date)) : "date inconnue") })]),
        cellule("Quantité", fmt(fQte, o.quantite)),
        cellule(o.type === "dividende" ? "Par action" : "Prix unitaire", fmt(fEur, o.prix)),
        cellule(o.type === "dividende" ? "Prélèvements" : "Frais", fmt(fEur, o.frais)),
        cellule("Total", estNombre(o.total) ? (encaisse ? "+" : "−") + fEur.format(Math.abs(o.total)) : vide, "num " + (encaisse ? "hausse" : "")),
        cellule("Plus-value", estNombre(o.plusValue) ? (o.plusValue > 0 ? "+" : "") + fEur.format(o.plusValue) : vide, "num " + (o.plusValue > 0 ? "hausse" : o.plusValue < 0 ? "baisse" : "")),
        el("td", { class: "c-actions" }, supprimer),
      ]);
    }));
  }

  // ----- Saisie d'une opération : étape 1 (saisie), puis étape 2 (confirmation des mises à jour) -----
  const typeOperation = () => document.querySelector('input[name="op-type"]:checked').value;

  function etapeOperation(confirmation) {
    $("op-saisie").hidden = confirmation;
    $("op-confirmation").hidden = !confirmation;
    $("op-retour").hidden = !confirmation;
    $("op-valider").textContent = confirmation ? "Enregistrer l'opération" : "Continuer";
    message("op-message", "");
  }

  /** Adapte les libellés au type d'opération ; montre la place et l'enveloppe pour un achat d'une nouvelle société. */
  function ajusterOperation() {
    const type = typeOperation();
    $("op-prix-libelle").textContent = type === "dividende" ? "Dividende par action (€)" : "Prix unitaire (€)";
    $("op-frais-libelle").textContent = type === "dividende" ? "Prélèvements (€)" : "Frais (€)";
    const existante = Journal.trouverLigne(etat.pf, $("op-code").value.trim().toUpperCase(), $("op-nom").value);
    $("op-nouvelle-ligne").hidden = type !== "achat" || !!existante;
  }

  function ouvrirOperation() {
    $("f-operation").reset();
    $("op-date").value = Journal.aujourdhui();
    $("op-place").value = Donnees.PLACE_DEFAUT;
    $("op-classe").value = "decote";
    $("op-societes").replaceChildren(...etat.pf.lignes.map((l) => el("option", { value: l.nom })));
    $("f-operation").querySelectorAll(".invalide").forEach((c) => c.classList.remove("invalide"));
    etat.apercuOperation = null;
    etapeOperation(false); ajusterOperation();
    $("dlg-operation").showModal();
  }
  $("nouvelle-operation").addEventListener("click", ouvrirOperation);

  // Choisir une société du portefeuille remplit son code, et inversement.
  $("op-nom").addEventListener("input", () => {
    const l = Journal.trouverLigne(etat.pf, "", $("op-nom").value);
    if (l && !$("op-code").value) $("op-code").value = l.code;
    ajusterOperation();
  });
  $("op-code").addEventListener("change", () => {
    const l = Journal.trouverLigne(etat.pf, $("op-code").value.trim().toUpperCase(), "");
    if (l && !$("op-nom").value) $("op-nom").value = l.nom;
    ajusterOperation();
  });
  document.querySelectorAll('input[name="op-type"]').forEach((r) => r.addEventListener("change", ajusterOperation));

  function texteLigne(a) {
    const L = a.ligne, nom = a.op.nom || a.op.code;
    const pru = (v) => (estNombre(v) ? fEur.format(v) : "inconnu");
    if (L.action === "creer") return `Ajouter la ligne « ${nom} » au portefeuille : ${pluriel(L.apres.quantite, "titre")}, prix de revient ${pru(L.apres.prixRevient)}.`;
    if (L.action === "solder") return `Retirer la ligne ${nom} du portefeuille : tous les titres sont vendus.`;
    if (a.op.type === "achat") return `Mettre à jour la ligne ${nom} : ${fQte.format(L.avant.quantite)} → ${pluriel(L.apres.quantite, "titre")}, prix de revient ${pru(L.avant.prixRevient)} → ${pru(L.apres.prixRevient)}.`;
    return `Mettre à jour la ligne ${nom} : ${fQte.format(L.avant.quantite)} → ${pluriel(L.apres.quantite, "titre")} (prix de revient inchangé : ${pru(L.apres.prixRevient)}).`;
  }

  function texteRecap(a) {
    const o = a.op, nom = o.nom || o.code, frais = o.frais ? `, ${o.type === "dividende" ? "prélèvements" : "frais"} ${fEur.format(o.frais)}` : "";
    if (o.type === "achat") return `Achat de ${pluriel(o.quantite, "titre")} ${nom} à ${fEur.format(o.prix)}${frais} : ${fEur.format(o.total)} décaissés.`;
    if (o.type === "vente") return `Vente de ${pluriel(o.quantite, "titre")} ${nom} à ${fEur.format(o.prix)}${frais} : ${fEur.format(o.total)} encaissés.` +
      (estNombre(a.plusValue) ? ` Plus-value réalisée : ${a.plusValue > 0 ? "+" : ""}${fEur.format(a.plusValue)}.` : "");
    return `Dividende de ${fEur.format(o.prix)} par action sur ${pluriel(o.quantite, "titre")} ${nom}${frais} : ${fEur.format(o.total)} encaissés.`;
  }

  $("f-operation").addEventListener("submit", (e) => {
    e.preventDefault();
    // Étape 2 : l'utilisateur a choisi ce qui doit être mis à jour.
    if (etat.apercuOperation) {
      const a = etat.apercuOperation;
      try {
        Journal.appliquer(etat.pf, a, {
          majLigne: !$("op-case-ligne").hidden && $("op-maj-ligne").checked,
          majCash: $("op-maj-cash").checked,
        });
      } catch (err) { return message("op-message", err.message); }
      etat.apercuOperation = null;
      $("dlg-operation").close();
      enregistrer(); toutAfficher();
      afficherBandeaux(`Opération enregistrée : ${LIBELLES_TYPE[a.op.type].toLowerCase()} ${a.op.nom || a.op.code}.`, true);
      return;
    }
    // Étape 1 : lecture et vérification de la saisie, puis aperçu des mises à jour proposées.
    const nombres = {}; let invalide = false;
    for (const c of ["quantite", "prix", "frais"]) { const v = lireChamp($("op-" + c)); if (Number.isNaN(v)) invalide = true; nombres[c] = v; }
    if (invalide) return message("op-message", "Corrigez les nombres signalés en rouge.");
    const a = Journal.preparer(etat.pf, Object.assign(nombres, {
      type: typeOperation(), date: $("op-date").value, nom: $("op-nom").value, code: $("op-code").value,
      place: $("op-place").value, enveloppe: $("op-enveloppe").value, classe: $("op-classe").value, note: $("op-note").value,
    }));
    if (a.erreurs.length) return message("op-message", a.erreurs.join(" "));
    etat.apercuOperation = a;
    $("op-recap").textContent = texteRecap(a);
    $("op-avertissements").replaceChildren(...a.avertissements.map((t) => el("li", { texte: t })));
    $("op-case-ligne").hidden = !a.ligne.action;
    $("op-maj-ligne").checked = true;
    if (a.ligne.action) $("op-texte-ligne").textContent = texteLigne(a);
    $("op-maj-cash").checked = true;
    $("op-texte-cash").textContent = `Ajuster le cash disponible : ${fEur.format(a.cash.avant)} → ${fEur.format(a.cash.apres)}.`;
    etapeOperation(true);
  });
  $("op-retour").addEventListener("click", () => { etat.apercuOperation = null; etapeOperation(false); });
  $("op-annuler").addEventListener("click", () => { $("dlg-operation").close(); });
  $("dlg-operation").addEventListener("close", () => { etat.apercuOperation = null; });

  // ================= Calculatrice d'analyse =================
  const CHAMPS = [
    ["La société", [
      ["nom", "Nom", "texte"],
      ["cours", "Cours actuel (€)"],
      ["nbActions", "Nombre d'actions (millions)"],
      ["chiffreAffaires", "Chiffre d'affaires"],
    ]],
    ["Le bilan", [
      ["tresorerie", "Trésorerie et placements"],
      ["creances", "Créances clients"],
      ["stocks", "Stocks"],
      ["autresActifsCourants", "Autres actifs courants"],
      ["immeublesPrixAchat", "Immeubles : prix d'achat historique", "nombre", "Dans l'annexe des comptes, pas la valeur nette du bilan."],
      ["incorporels", "Immobilisations incorporelles"],
      ["goodwill", "Goodwill"],
      ["impotsDifferesActifs", "Impôts différés actifs"],
      ["totalBilan", "Total du bilan"],
      ["capitauxPropres", "Capitaux propres part du groupe"],
      ["minoritaires", "Intérêts minoritaires"],
      ["provisions", "Provisions (si hors dettes)"],
      ["dettesTotales", "Dettes totales", "nombre", "Emprunts, fournisseurs et autres dettes."],
    ]],
    ["Retraitements", [
      ["decoteStocks", "Décote sur les stocks (%)", "pourcent", "0 % si la rotation est stable ; 20 à 50 % si elle ralentit."],
      ["decoteCreances", "Décote sur les créances (%)", "pourcent", "0 % si le délai clients est stable ; 30 % s'il s'allonge."],
    ]],
  ];
  const TYPES = Object.fromEntries(CHAMPS.flatMap(([, cs]) => cs.map(([cle, , type]) => [cle, type || "nombre"])));
  let analyse = { societe: {}, resultat: null, complet: false };

  function construireFormulaire() {
    $("formulaire").replaceChildren(...CHAMPS.map(([titre, champs]) =>
      el("fieldset", {}, [el("legend", { texte: titre })].concat(champs.map(([cle, libelle, type, aide]) =>
        el("div", { class: "champ" + (type === "texte" ? " large" : "") }, [
          el("label", { for: "c-" + cle, texte: libelle }),
          el("input", { id: "c-" + cle, name: cle, type: "text", inputmode: type === "texte" ? null : "decimal" }),
          aide ? el("small", { texte: aide }) : null,
        ]))))));
  }

  function remplir(societe) {
    for (const [cle, type] of Object.entries(TYPES)) {
      const v = societe ? societe[cle] : null;
      $("c-" + cle).value = v === null || v === undefined ? "" : type === "texte" ? v : versChamp(type === "pourcent" ? v * 100 : v);
    }
    calculer();
  }

  function calculer() {
    const s = {};
    for (const [cle, type] of Object.entries(TYPES)) {
      const champ = $("c-" + cle);
      if (type === "texte") { s[cle] = champ.value.trim(); continue; }
      const v = lireChamp(champ);
      s[cle] = Number.isNaN(v) || v === null ? null : type === "pourcent" ? v / 100 : v;
    }
    const r = D.analyser(s, P);
    const incomplet = !(s.cours > 0 && s.nbActions > 0 && s.totalBilan > 0);
    analyse = { societe: s, resultat: r, complet: !incomplet };
    $("vers-portefeuille").disabled = incomplet;

    const v = $("verdict");
    v.className = "bloc verdict " + (incomplet ? "" : r.verdict.code === "exclue" ? "v-exclue" : r.verdict.code === "attendre" ? "v-attendre" : "v-achat");
    v.replaceChildren(
      el("p", { class: "verdict-titre", texte: s.nom || "Société" }),
      el("p", { class: "verdict-texte", texte: incomplet ? "Saisissez au moins le cours, le nombre d'actions et le total du bilan" : r.verdict.texte }));

    const ligne = (t, val, fort) => [el("dt", { class: fort ? "fort" : null, texte: t }), el("dd", { class: fort ? "fort" : null, texte: val })];
    const sep = () => el("div", { class: "sep" });
    const M = (x) => (estNombre(x) ? fNb.format(x) + " M€" : vide);
    $("valeurs").replaceChildren(
      ...ligne("Capitalisation boursière", M(r.capitalisation)),
      ...ligne("Fonds de roulement net", M(r.fondsDeRoulementNet)),
      ...ligne("Actif courant retraité", M(r.actifCourantRetraite)), sep(),
      ...ligne("VANN par action", fmt(fEur, r.vannParAction), true),
      ...ligne("VANN totale", M(r.vann)),
      ...ligne("Prix d'achat maximal Net-Net", fmt(fEur, r.prixMaxNetNet)),
      ...ligne("Cours en % de la VANN", fmt(fPct, r.coursSurVann)), sep(),
      ...ligne("VANE par action", fmt(fEur, r.vaneParAction), true),
      ...ligne("Prix d'achat maximal Net-Estate", fmt(fEur, r.prixMaxNetEstate)),
      ...ligne("Cours en % de la VANE", fmt(fPct, r.coursSurVane)), sep(),
      ...ligne("VANT par action (objectif de vente)", fmt(fEur, r.vantParAction), true),
      ...ligne("Potentiel jusqu'à la VANT", signe(r.potentiel)), sep(),
      ...ligne("Solvabilité maison", fmt(fPct, r.solvabilite), true),
      ...ligne("Solvabilité classique", fmt(fPct, r.solvabiliteClassique)));

    const f = r.filtres;
    const filtres = [
      ["Fonds de roulement net positif", f.fondsDeRoulementPositif],
      [`Solvabilité maison d'au moins ${fPct0.format(P.solvabiliteMin)}`, f.solvabiliteSuffisante],
      ["Chiffre d'affaires suffisant", f.chiffreAffairesSuffisant],
      [`Cours à ${fPct0.format(P.achatMaxPctValeur)} ou moins de la VANN`, f.decoteNetNet],
      [`Cours à ${fPct0.format(P.achatMaxPctValeur)} ou moins de la VANE`, f.decoteNetEstate],
    ];
    $("filtres").replaceChildren(...filtres.map(([t, ok]) =>
      el("li", {}, [el("span", { texte: t }), el("span", { class: ok ? "oui" : "non", texte: ok ? "Oui" : "Non" })])));
  }

  // Reprend l'analyse dans une nouvelle ligne : cours, objectif (VANT par action) et solvabilité sont préremplis.
  $("vers-portefeuille").addEventListener("click", () => {
    if (!analyse.complet) return;
    const r = analyse.resultat, arrondi = (v) => (estNombre(v) ? Math.round(v * 100) / 100 : null);
    ouvrirLigne({
      nom: (analyse.societe.nom || "").replace(/\s*\(exemple fictif\)\s*$/i, ""), cours: analyse.societe.cours, prixRevient: analyse.societe.cours,
      objectif: r.vantParAction > 0 ? arrondi(r.vantParAction) : null,
      solvabilite: estNombre(r.solvabilite) ? Math.round(r.solvabilite * 1000) / 1000 : null,
    }, true);
  });

  // ================= Démarrage =================
  const ctx = {
    $, el, G: Graphiques, M: Methodes, Donnees, P, etat, enregistrer, lireChamp, versChamp, estNombre, fEur, fEur0, fPct, fPct0,
    vann: { lire: () => Object.assign({}, analyse.societe), remplir: (v) => remplir(v), exemple: D.ALPHA_INDUSTRIE },
  };
  patrimoine = window.DecotesVuePatrimoine.creer(ctx);
  analyses = window.DecotesVueAnalyses.creer(ctx);
  construireFormulaire();
  for (const [id, valeurs] of [["l-classe", Donnees.CLASSES], ["op-classe", Donnees.CLASSES]]) {
    $(id).replaceChildren(...Object.entries(valeurs).map(([cle, nom]) => el("option", { value: cle, texte: nom })));
  }
  for (const id of ["l-place", "op-place"]) {
    $(id).replaceChildren(...Object.entries(Donnees.PLACES).map(([cle, nom]) => el("option", { value: cle, texte: nom })));
  }
  $("formulaire").addEventListener("input", calculer);
  $("formulaire").addEventListener("submit", (e) => e.preventDefault());
  patrimoine.installerSimulateur();
  analyses.installer();
  afficherVerrou();

  window.DecotesTests.pret.then((t) => {
    const e = $("etat-tests");
    e.className = "tests " + (t.ok ? "ok" : "ko");
    e.textContent = t.ok
      ? `Logique vérifiée au chargement : ${t.reussis}/${t.total} tests réussis.`
      : `Attention : ${t.total - t.reussis} test(s) en échec sur ${t.total}. Ne vous fiez pas aux calculs et consultez la console.`;
  });
})();
