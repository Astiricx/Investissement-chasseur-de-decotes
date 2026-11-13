/* Interface : verrouillage, tableau de bord, analyse, gestion des données.
   La logique métier est dans calc.js, le chiffrement dans coffre.js, le format dans donnees.js, le CSV dans csv.js. */
(function () {
  "use strict";
  const D = window.Decotes, Donnees = window.DecotesDonnees, Coffre = window.DecotesCoffre, CSV = window.DecotesCSV;
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
  const vide = "–";
  const estNombre = (v) => typeof v === "number" && Number.isFinite(v);
  const fmt = (f, v) => (estNombre(v) ? f.format(v) : vide);
  const signe = (v) => (estNombre(v) ? (v > 0 ? "+" : "") + fPct.format(v) : vide);
  const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;
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
    armerVerrouillageAuto();
  }

  function verrouiller(texteMessage) {
    if ($("dlg-ligne").open) $("dlg-ligne").close();
    etat.pf = null; etat.session = null; etat.mode = "verrou"; etat.importCSV = null; etat.ligneEnCours = null;
    clearTimeout(minuterie);
    // On vide l'affichage : plus aucune donnée déchiffrée ne reste dans la page.
    $("lignes").tBodies[0].replaceChildren(); $("indicateurs").replaceChildren();
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
    return Donnees.normaliser({
      version: 1, parametres: { capitalDepart: 10000, cash: 7850 }, journal: [],
      lignes: [
        { nom: "Alpha Industrie", code: "ALPH", enveloppe: "PEA", quantite: 100, prixRevient: 3.5, cours: 3.8, objectif: 7.5, solvabilite: 0.881, dateResultats: dansJours(9) },
        { nom: "Bêta Textile", code: "BETA", enveloppe: "PEA", quantite: 40, prixRevient: 9.2, cours: 15.4, objectif: 16, solvabilite: 0.62, dateResultats: dansJours(70) },
        { nom: "Gamma Outillage", code: "GAMM", enveloppe: "PEA", quantite: 140, prixRevient: 4.1, cours: 3.15, objectif: 8.2, solvabilite: 0.55, dateResultats: dansJours(40) },
        { nom: "Delta Négoce", code: "DELT", enveloppe: "CTO", quantite: 60, prixRevient: 6, cours: 5.1, objectif: 10.5, solvabilite: 0.31, dateResultats: dansJours(25) },
        { nom: "Epsilon Papiers", code: "EPSI", enveloppe: "PEA", quantite: 70, prixRevient: 5.4, cours: 5.9 },
      ],
    });
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
    for (const id of ["bandeau", "bandeau-donnees"]) {
      const b = $(id); const t = texte || demo;
      b.hidden = !t; b.textContent = t;
      b.classList.toggle("alerte", !!texte && !info);
      b.classList.toggle("info", !!texte && !!info);
    }
  }

  function toutAfficher() { afficherBandeaux(); afficherTableau(); afficherDonnees(); }

  // ================= Tableau de bord =================
  const CLASSE_STATUT = {
    [D.STATUTS.VENDRE]: "s-vendre", [D.STATUTS.REEXAMINER]: "s-reexaminer", [D.STATUTS.RENFORCER]: "s-renforcer",
    [D.STATUTS.A_COMPLETER]: "s-completer", [D.STATUTS.GARDER]: "s-garder",
  };

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

    const jauge = el("div", { class: "jauge", role: "img", "aria-label": `Cash : ${fmt(fPct0, s.partCash)}, cible ${fPct0.format(P.cashCible)}` }, [el("span"), el("i")]);
    jauge.firstChild.style.width = Math.min(100, (s.partCash || 0) * 100) + "%";
    jauge.lastChild.style.left = P.cashCible * 100 + "%";

    $("indicateurs").replaceChildren(
      indicateur("Valeur totale", fmt(fEur0, s.total), capital > 0 ? `Capital de départ : ${fEur0.format(capital)} (${signe(s.total / capital - 1)})` : "Capital de départ non renseigné"),
      indicateur("Cash disponible", fmt(fEur0, s.cash), `${fmt(fPct0, s.partCash)} du total, cible ${fPct0.format(P.cashCible)}`, jauge),
      indicateur("Décisions à prendre", String(decisions), `${s.compte(S.VENDRE)} à vendre · ${s.compte(S.REEXAMINER)} à réexaminer · ${s.compte(S.RENFORCER)} à renforcer ?`),
      indicateur("Points d'attention", String(s.lignesTropLourdes + s.resultatsProches + s.compte(S.A_COMPLETER)), `${s.lignesTropLourdes} ligne trop lourde · ${s.resultatsProches} publication proche · ${s.compte(S.A_COMPLETER)} à compléter`),
    );

    $("resume-lignes").textContent = `${pluriel(s.detail.length, "ligne")} · ${fmt(fEur0, s.valeurTitres)} en actions`;
    $("aucune-ligne").hidden = s.detail.length > 0;
    $("lignes").hidden = s.detail.length === 0;
    const cellule = (titre, texte, classe) => el("td", { "data-titre": titre, class: classe || "num", texte });
    $("lignes").tBodies[0].replaceChildren(...s.detail.map((d) => {
      const l = d.ligne;
      const puces = [];
      if (d.tropLourde) puces.push(el("span", { class: "puce", texte: `Ligne trop lourde (> ${fPct0.format(P.tailleMaxLigne)})` }));
      if (d.resultatsProches) puces.push(el("span", { class: "puce", texte: d.joursAvantResultats === 0 ? "Résultats aujourd'hui" : `Résultats dans ${d.joursAvantResultats} j` }));
      const modifier = el("button", { type: "button", class: "lien", texte: "Modifier", "aria-label": "Modifier " + l.nom });
      modifier.addEventListener("click", () => ouvrirLigne(l));
      const sousTitre = [l.code, l.enveloppe, estNombre(l.quantite) ? pluriel(l.quantite, "titre") : null].filter(Boolean).join(" · ");
      return el("tr", {}, [
        el("td", { class: "c-soc" }, [el("div", { class: "soc-nom", texte: l.nom }), el("div", { class: "soc-code", texte: sousTitre })]),
        cellule("Cours", fmt(fEur, l.cours)),
        cellule("Prix de revient", fmt(fEur, l.prixRevient)),
        cellule("Performance", estNombre(l.cours) ? signe(d.performance) : vide, "num " + (estNombre(l.cours) && d.performance > 0 ? "hausse" : estNombre(l.cours) && d.performance < 0 ? "baisse" : "")),
        cellule("Objectif", fmt(fEur, l.objectif)),
        cellule("Potentiel", signe(d.potentiel)),
        cellule("Poids", fmt(fPct, d.poids)),
        el("td", { class: "c-statut" }, [el("span", { class: "statut " + CLASSE_STATUT[d.statut], texte: d.statut }), el("div", {}, puces)]),
        el("td", { class: "c-actions" }, modifier),
      ]);
    }));

    const regles = [
      ["Prix d'achat maximal", `${fPct0.format(P.achatMaxPctValeur)} de la VANN ou de la VANE`],
      ["Vente", `à l'objectif (VANT), ou potentiel restant < ${fPct0.format(P.seuilVentePotentiel)}`],
      ["Renforcement envisagé", `baisse de ${fPct0.format(-P.seuilRenforcement)} et bilan solide`],
      ["Solvabilité maison minimale", fPct0.format(P.solvabiliteMin)],
      ["Taille maximale d'une ligne", fPct0.format(P.tailleMaxLigne)],
      ["Part de cash visée", fPct0.format(P.cashCible)],
      ["Immeubles retenus dans la VANE", `${fPct0.format(P.immeublesRetenus)} du prix d'achat`],
      ["Alerte avant publication", `${P.joursAlerteResultats} jours`],
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
      id: etat.ligneEnCours, nom, code: $("l-code").value, enveloppe: $("l-enveloppe").value,
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
  construireFormulaire();
  $("formulaire").addEventListener("input", calculer);
  $("formulaire").addEventListener("submit", (e) => e.preventDefault());
  $("reinitialiser").addEventListener("click", () => remplir(D.ALPHA_INDUSTRIE));
  $("vider").addEventListener("click", () => remplir(null));
  remplir(D.ALPHA_INDUSTRIE);
  afficherVerrou();

  window.DecotesTests.pret.then((t) => {
    const e = $("etat-tests");
    e.className = "tests " + (t.ok ? "ok" : "ko");
    e.textContent = t.ok
      ? `Logique vérifiée au chargement : ${t.reussis}/${t.total} tests réussis.`
      : `Attention : ${t.total - t.reussis} test(s) en échec sur ${t.total}. Ne vous fiez pas aux calculs et consultez la console.`;
  });
})();
