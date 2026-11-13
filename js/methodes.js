/* Méthodes d'analyse complémentaires : logique pure (aucun accès à la page ni au réseau).
   - rapp()       : les 4 ratios publics de la RAPP sur 8 exercices (cours, chapitre 14 §5) ;
   - holding()    : actif net réévalué (ANR) d'une holding et décote (chapitre 14 §6) ;
   - mine()       : valeur prudente d'une mine d'or ou d'argent, méthode du cas Oceana Gold (chapitre 14 §6) ;
   - projection() : intérêts composés avec versements mensuels.
   Rappel : la formule de valorisation RAPP est tenue secrète par Les Daubasses. Les 4 ratios servent à
   juger la direction et à filtrer, pas à calculer un prix. Les seuils « vigilance / alerte » ci-dessous sont
   des choix de l'outil, indicatifs, et non des règles publiées par la chaîne. */
(function (racine) {
  "use strict";

  const estNombre = (v) => typeof v === "number" && Number.isFinite(v);
  const moyenne = (t) => (t.length ? t.reduce((a, b) => a + b, 0) / t.length : null);

  const SEUILS = Object.freeze({
    rapp: {
      actionsVigilance: 0.005,     // nombre d'actions : jusqu'à +0,5 % = stable
      actionsAlerte: 0.05,         // au-delà de +5 % sur la période = dilution marquée
      fraisVigilance: 0.005,       // frais généraux / CA : +0,5 point au-dessus de la moyenne passée = stable
      fraisAlerte: 0.02,           // au-delà de +2 points = dérive
      stocksVigilance: 0.05,       // durée de stockage : +5 % au-dessus de la moyenne passée = stable
      stocksAlerte: 0.20,          // au-delà de +20 % = ralentissement net
      stocksDecote: 0.10,          // au-delà de +10 % sur la moyenne des 3 à 5 ans précédents : décote suggérée (VANN)
      creationMarge: 0.03,         // « nettement supérieure » au taux sans risque : +3 points par an
    },
    holding: { decoteAchat: 0.30, decoteProche: 0.20 },
    mine: { coefProuvees: 1, coefPotentielles: 0.5, coefProbables: 0, decoteOr: 0.30, impots: 0.40, anneesInvestissement: 5, margeSecurite: 0.10 },
  });

  // ------------------------------------------------------------------ RAPP
  /** Garde les exercices renseignés, du plus ancien au plus récent. */
  function exercices(annees) {
    return (annees || [])
      .filter((a) => a && Object.entries(a).some(([k, v]) => k !== "annee" && estNombre(v)))
      .map((a, i) => Object.assign({ rang: i }, a))
      .sort((a, b) => (estNombre(a.annee) && estNombre(b.annee) ? a.annee - b.annee : a.rang - b.rang));
  }
  const etiquette = (a, i) => (estNombre(a.annee) ? String(a.annee) : "Année " + (i + 1));

  function serie(ex, f) {
    return ex.map((a, i) => ({ annee: etiquette(a, i), valeur: f(a) })).filter((p) => estNombre(p.valeur));
  }

  /** Classe une hausse : ≤ seuil de vigilance → ok ; ≤ seuil d'alerte → vigilance ; au-delà → alerte. */
  const verdictHausse = (hausse, vigilance, alerte) => (hausse <= vigilance ? "ok" : hausse <= alerte ? "vigilance" : "alerte");

  /**
   * annees : [{ annee, actions, chiffreAffaires, fraisGeneraux, coutVentes, stocks, fondsPropres, dividende, cours }]
   *   actions en millions, montants en millions, dividende et cours par action.
   * tauxSansRisque : ex. 0,03 pour 3 %.
   */
  function rapp(annees, tauxSansRisque) {
    const S = SEUILS.rapp;
    const ex = exercices(annees);
    const ratios = [];

    // 1. Nombre d'actions : stable ou en baisse.
    {
      const s = serie(ex, (a) => (a.actions > 0 ? a.actions : null));
      const r = { cle: "actions", titre: "Nombre d'actions", attendu: "Stable ou en baisse : pas de dilution, idéalement des rachats.", serie: s, unite: "M" };
      if (s.length < 2) Object.assign(r, { verdict: "incomplet", explication: "Saisissez le nombre d'actions sur au moins deux exercices." });
      else {
        r.debut = s[0].valeur; r.fin = s[s.length - 1].valeur; r.variation = r.fin / r.debut - 1;
        r.verdict = verdictHausse(r.variation, S.actionsVigilance, S.actionsAlerte);
        r.explication = r.variation <= -S.actionsVigilance ? "Le nombre d'actions baisse : la société rachète ses titres."
          : r.verdict === "ok" ? "Le nombre d'actions est stable : pas de dilution."
          : r.verdict === "vigilance" ? "Légère dilution sur la période : à surveiller."
          : "Dilution marquée : la part de chaque actionnaire a été réduite.";
      }
      ratios.push(r);
    }

    // 2. Frais généraux ÷ chiffre d'affaires : stable ou en baisse.
    {
      const s = serie(ex, (a) => (estNombre(a.fraisGeneraux) && a.chiffreAffaires > 0 ? a.fraisGeneraux / a.chiffreAffaires : null));
      const r = { cle: "frais", titre: "Frais généraux ÷ chiffre d'affaires", attendu: "Stable ou en baisse : une gestion disciplinée.", serie: s, unite: "%" };
      if (s.length < 2) Object.assign(r, { verdict: "incomplet", explication: "Saisissez les frais généraux et le chiffre d'affaires sur au moins deux exercices." });
      else {
        r.debut = s[0].valeur; r.fin = s[s.length - 1].valeur;
        r.reference = moyenne(s.slice(0, -1).map((p) => p.valeur));
        r.ecart = r.fin - r.reference; // en points
        r.verdict = verdictHausse(r.ecart, S.fraisVigilance, S.fraisAlerte);
        r.explication = r.verdict === "ok" ? "Les frais restent maîtrisés par rapport au chiffre d'affaires."
          : r.verdict === "vigilance" ? "Les frais pèsent un peu plus que d'habitude : à surveiller."
          : "Les frais dérivent nettement par rapport au chiffre d'affaires.";
      }
      ratios.push(r);
    }

    // 3. Durée de stockage = stocks ÷ coût des ventes × 365 : stable ou en baisse.
    {
      const sansCout = ex.some((a) => estNombre(a.stocks) && !(a.coutVentes > 0) && a.chiffreAffaires > 0);
      const s = serie(ex, (a) => (!estNombre(a.stocks) ? null : a.coutVentes > 0 ? (a.stocks / a.coutVentes) * 365 : a.chiffreAffaires > 0 ? (a.stocks / a.chiffreAffaires) * 365 : null));
      const r = { cle: "stocks", titre: "Durée de stockage (jours)", attendu: "Stable ou en baisse : une exploitation efficace.", serie: s, unite: "j" };
      if (s.length >= 2 && s.every((p) => p.valeur === 0)) Object.assign(r, { verdict: "na", explication: "Pas de stocks : ratio sans objet (société de services)." });
      else if (s.length < 2) Object.assign(r, { verdict: "incomplet", explication: "Saisissez les stocks et le coût des ventes sur au moins deux exercices." });
      else {
        r.debut = s[0].valeur; r.fin = s[s.length - 1].valeur;
        r.reference = moyenne(s.slice(0, -1).map((p) => p.valeur));
        r.variation = r.reference > 0 ? r.fin / r.reference - 1 : 0;
        r.verdict = verdictHausse(r.variation, S.stocksVigilance, S.stocksAlerte);
        r.explication = r.verdict === "ok" ? "Les stocks tournent au moins aussi vite qu'avant."
          : r.verdict === "vigilance" ? "Les stocks tournent un peu moins vite : à surveiller."
          : "Les stocks tournent nettement moins vite : risque d'invendus.";
        // Règle de retraitement du cours : dernier exercice vs moyenne des 3 à 5 précédents.
        const precedents = s.slice(Math.max(0, s.length - 6), -1).map((p) => p.valeur);
        const ref35 = moyenne(precedents);
        r.decoteSuggeree = precedents.length >= 3 && ref35 > 0 && r.fin > ref35 * (1 + S.stocksDecote);
        if (sansCout) r.explication += " (Calculé sur le chiffre d'affaires quand le coût des ventes manque.)";
      }
      ratios.push(r);
    }

    // 4. Création de valeur = hausse des fonds propres par action + dividendes cumulés, vs taux sans risque et hausse du cours.
    {
      const fp = ex.map((a, i) => ({ i, a, fpa: a.fondsPropres > 0 && a.actions > 0 ? a.fondsPropres / a.actions : null })).filter((x) => x.fpa !== null);
      const r = { cle: "creation", titre: "Création de valeur par action", attendu: "Nettement supérieure au taux sans risque et à la hausse du cours.",
        serie: fp.map((x) => ({ annee: etiquette(x.a, x.i), valeur: x.fpa })), unite: "€" };
      if (fp.length < 2) Object.assign(r, { verdict: "incomplet", explication: "Saisissez les fonds propres et le nombre d'actions sur au moins deux exercices." });
      else if (!estNombre(tauxSansRisque)) Object.assign(r, { verdict: "incomplet", explication: "Indiquez le taux sans risque (par exemple le rendement de l'OAT à 10 ans)." });
      else {
        const premier = fp[0], dernier = fp[fp.length - 1];
        const nbAnnees = estNombre(premier.a.annee) && estNombre(dernier.a.annee) ? dernier.a.annee - premier.a.annee : dernier.i - premier.i;
        const dividendes = ex.slice(premier.i + 1, dernier.i + 1).reduce((t, a) => t + (estNombre(a.dividende) ? a.dividende : 0), 0);
        r.debut = premier.fpa; r.fin = dernier.fpa; r.dividendes = dividendes; r.annees = nbAnnees;
        r.creation = dernier.fpa - premier.fpa + dividendes;
        r.rendement = nbAnnees > 0 ? Math.pow((dernier.fpa + dividendes) / premier.fpa, 1 / nbAnnees) - 1 : null;
        const c0 = premier.a.cours, c1 = dernier.a.cours;
        r.hausseCours = c0 > 0 && c1 > 0 && nbAnnees > 0 ? Math.pow(c1 / c0, 1 / nbAnnees) - 1 : null;
        r.tauxSansRisque = tauxSansRisque;
        if (r.rendement === null) Object.assign(r, { verdict: "incomplet", explication: "Il faut au moins deux exercices différents." });
        else {
          const net = r.rendement >= tauxSansRisque + S.creationMarge;
          const devantCours = r.hausseCours === null || r.rendement > r.hausseCours;
          r.verdict = net && devantCours ? "ok" : r.rendement > tauxSansRisque ? "vigilance" : "alerte";
          r.explication = r.verdict === "ok" ? "La société crée nettement plus de valeur que le taux sans risque" + (r.hausseCours !== null ? ", et plus vite que son cours ne monte : le marché ne l'a pas encore reconnue." : ".")
            : r.verdict === "vigilance" ? (net ? "Création de valeur solide, mais le cours a déjà monté au moins aussi vite." : "Création de valeur positive mais pas nettement au-dessus du taux sans risque.")
            : "La valeur créée ne dépasse pas le taux sans risque.";
        }
      }
      ratios.push(r);
    }

    const compte = (v) => ratios.filter((r) => r.verdict === v).length;
    return { ratios, exercices: ex.length, synthese: { ok: compte("ok"), vigilance: compte("vigilance"), alerte: compte("alerte"), incomplet: compte("incomplet") + compte("na") } };
  }

  // ------------------------------------------------------------------ Holding
  /**
   * h : { participations: [{ nom, valeur }], tresorerie, dettes, nbActions (M), cours (€) } ; montants en millions.
   * ANR = valeur actuelle des participations + trésorerie − dettes de la holding.
   */
  function holding(h) {
    const S = SEUILS.holding;
    const parts = (h.participations || []).filter((p) => p && estNombre(p.valeur));
    const valeurParticipations = parts.reduce((t, p) => t + p.valeur, 0);
    const anr = valeurParticipations + (estNombre(h.tresorerie) ? h.tresorerie : 0) - (estNombre(h.dettes) ? h.dettes : 0);
    const anrParAction = h.nbActions > 0 ? anr / h.nbActions : null;
    const decote = anrParAction > 0 && h.cours > 0 ? 1 - h.cours / anrParAction : null;
    const prixMax = anrParAction > 0 ? anrParAction * (1 - S.decoteAchat) : null;
    let verdict;
    if (!parts.length || !(h.nbActions > 0) || !(h.cours > 0)) verdict = { code: "incomplet", texte: "Saisissez au moins une participation, le nombre d'actions et le cours." };
    else if (!(anr > 0)) verdict = { code: "exclue", texte: "ANR négatif : les dettes dépassent la valeur des participations." };
    else if (decote >= S.decoteAchat) verdict = { code: "achat", texte: `Décote de ${Math.round(decote * 100)} % sur l'ANR : achat possible (seuil de 30 %).` };
    else if (decote >= S.decoteProche) verdict = { code: "attendre", texte: `Décote de ${Math.round(decote * 100)} % : proche du seuil de 30 %, à surveiller.` };
    else verdict = { code: "attendre", texte: decote > 0 ? `Décote de ${Math.round(decote * 100)} % seulement : attendre un meilleur prix.` : "La holding cote au-dessus de son ANR : pas de décote." };
    return {
      participations: parts.map((p) => ({ nom: p.nom, valeur: p.valeur, part: valeurParticipations > 0 ? p.valeur / valeurParticipations : null })),
      valeurParticipations, anr, anrParAction, decote, prixMax,
      capitalisation: h.cours > 0 && h.nbActions > 0 ? h.cours * h.nbActions : null, verdict,
    };
  }

  // ------------------------------------------------------------------ Mine
  /**
   * m : { reservesProuvees, reservesPotentielles, reservesProbables (millions d'onces), coursOr, coutProduction (par once),
   *       tresorerie, creances, passifTotal, investissementsAnnuels (millions), decotePays (0,10 = 10 %), nbActions (M), cours }
   * Tous les montants dans la même devise (celle des comptes de la mine).
   * Précautions reprises du cas Oceana Gold : prouvées 100 %, potentielles 50 %, probables 0 % ; or décoté de 30 % ;
   * marge par once amputée de 40 % (impôts et redevances) ; on retire tout le passif et 5 ans d'investissements ;
   * décote pays, puis marge de sécurité de 10 %.
   */
  function mine(m) {
    const S = SEUILS.mine;
    const v = (x) => (estNombre(x) ? x : 0);
    const reservesRetenues = v(m.reservesProuvees) * S.coefProuvees + v(m.reservesPotentielles) * S.coefPotentielles + v(m.reservesProbables) * S.coefProbables;
    const coursOrDecote = v(m.coursOr) * (1 - S.decoteOr);
    const margeOnce = coursOrDecote - v(m.coutProduction);
    const margeNette = Math.max(0, margeOnce) * (1 - S.impots);
    const valeurReserves = reservesRetenues * margeNette;
    const autresActifs = v(m.tresorerie) + v(m.creances) - v(m.passifTotal) - S.anneesInvestissement * v(m.investissementsAnnuels);
    const valeurBrute = valeurReserves + autresActifs;
    const pays = Math.min(Math.max(v(m.decotePays), 0), 0.9);
    const apresPays = valeurBrute * (1 - pays);
    const valeurFinale = apresPays * (1 - S.margeSecurite);
    const parAction = m.nbActions > 0 ? valeurFinale / m.nbActions : null;
    const potentiel = parAction !== null && m.cours > 0 ? parAction / m.cours - 1 : null;
    const capitalisation = m.cours > 0 && m.nbActions > 0 ? m.cours * m.nbActions : null;
    // Cours de l'or (avant la décote de 30 %) pour lequel la valeur estimée égale la capitalisation boursière.
    let coursOrImplicite = null;
    if (capitalisation !== null && reservesRetenues > 0) {
      const facteur = (1 - pays) * (1 - S.margeSecurite);
      const p = ((capitalisation / facteur - autresActifs) / (reservesRetenues * (1 - S.impots)) + v(m.coutProduction)) / (1 - S.decoteOr);
      if (p * (1 - S.decoteOr) > v(m.coutProduction)) coursOrImplicite = p;
    }
    const complet = reservesRetenues > 0 && m.coursOr > 0 && estNombre(m.coutProduction) && m.nbActions > 0 && m.cours > 0;
    let verdict;
    if (!complet) verdict = { code: "incomplet", texte: "Saisissez les réserves, le cours de l'or, le coût de production, le nombre d'actions et le cours." };
    else if (margeOnce <= 0) verdict = { code: "exclue", texte: "Avec l'or décoté de 30 %, la mine ne dégage aucune marge : ses réserves ne valent rien dans ce calcul prudent." };
    else if (!(valeurFinale > 0)) verdict = { code: "exclue", texte: "Le passif et les investissements dépassent la valeur des réserves." };
    else if (potentiel >= 0.5) verdict = { code: "achat", texte: `Potentiel de ${Math.round(potentiel * 100)} % sans parier sur une hausse de l'or.` };
    else if (potentiel > 0) verdict = { code: "attendre", texte: `Potentiel de ${Math.round(potentiel * 100)} % : marge de sécurité faible.` };
    else verdict = { code: "attendre", texte: "Le cours dépasse la valeur prudente estimée." };
    return {
      reservesRetenues, coursOrDecote, margeOnce, margeNette, valeurReserves, autresActifs, valeurBrute,
      apresPays, valeurFinale, parAction, potentiel, capitalisation, coursOrImplicite, verdict, seuils: S,
    };
  }

  // ------------------------------------------------------------------ Projection
  /**
   * Intérêts composés : capitalisation mensuelle équivalente au taux annuel, versement en fin de mois.
   * Renvoie un point par année : { annee, valeur, verse }.
   */
  function projection(capital, tauxAnnuel, annees, versementMensuel) {
    const c = estNombre(capital) && capital > 0 ? capital : 0;
    const vm = estNombre(versementMensuel) && versementMensuel > 0 ? versementMensuel : 0;
    const n = Math.max(1, Math.min(60, Math.round(annees || 0)));
    const t = estNombre(tauxAnnuel) ? tauxAnnuel : 0;
    const mensuel = Math.pow(1 + t, 1 / 12);
    const points = [{ annee: 0, valeur: c, verse: c }];
    let v = c;
    for (let a = 1; a <= n; a++) {
      for (let m = 0; m < 12; m++) v = v * mensuel + vm;
      points.push({ annee: a, valeur: v, verse: c + vm * 12 * a });
    }
    return points;
  }

  // ------------------------------------------------------------------ Exemples (fictifs)
  /** Exemple fictif construit sur les chiffres du cours : 5,0 → 4,7 M actions, frais 8,5 % → 8,2 %, 42 → 38 jours, (20 − 12) + 4 = 12 €. */
  const EXEMPLE_RAPP = Object.freeze({
    nom: "Bêta Textile (exemple fictif)", tauxSansRisque: 0.03,
    annees: [
      { annee: 2019, actions: 5.0, chiffreAffaires: 80, fraisGeneraux: 6.8, coutVentes: 52, stocks: 5.98, fondsPropres: 60, dividende: 0.4, cours: 11 },
      { annee: 2020, actions: 5.0, chiffreAffaires: 78, fraisGeneraux: 6.6, coutVentes: 51, stocks: 5.8, fondsPropres: 64, dividende: 0.4, cours: 9.5 },
      { annee: 2021, actions: 4.95, chiffreAffaires: 84, fraisGeneraux: 7.0, coutVentes: 55, stocks: 6.0, fondsPropres: 69, dividende: 0.5, cours: 12 },
      { annee: 2022, actions: 4.9, chiffreAffaires: 88, fraisGeneraux: 7.3, coutVentes: 57, stocks: 6.1, fondsPropres: 73, dividende: 0.5, cours: 12.5 },
      { annee: 2023, actions: 4.85, chiffreAffaires: 90, fraisGeneraux: 7.4, coutVentes: 58, stocks: 6.1, fondsPropres: 77, dividende: 0.6, cours: 13 },
      { annee: 2024, actions: 4.8, chiffreAffaires: 93, fraisGeneraux: 7.6, coutVentes: 60, stocks: 6.3, fondsPropres: 82, dividende: 0.6, cours: 13.5 },
      { annee: 2025, actions: 4.75, chiffreAffaires: 96, fraisGeneraux: 7.9, coutVentes: 62, stocks: 6.4, fondsPropres: 88, dividende: 0.7, cours: 14 },
      { annee: 2026, actions: 4.7, chiffreAffaires: 100, fraisGeneraux: 8.2, coutVentes: 64, stocks: 6.66, fondsPropres: 94, dividende: 0.7, cours: 14.5 },
    ],
  });
  const EXEMPLE_HOLDING = Object.freeze({
    nom: "Gamma Participations (exemple fictif)", tresorerie: 40, dettes: 25, nbActions: 10, cours: 30,
    participations: [{ nom: "Filiale cotée A (35 % du capital)", valeur: 280 }, { nom: "Filiale cotée B (12 %)", valeur: 95 }, { nom: "Société non cotée C", valeur: 60 }],
  });
  const EXEMPLE_MINE = Object.freeze({
    nom: "Delta Gold (exemple fictif)", reservesProuvees: 2, reservesPotentielles: 1, reservesProbables: 1,
    coursOr: 2000, coutProduction: 1000, tresorerie: 50, creances: 20, passifTotal: 150, investissementsAnnuels: 30,
    decotePays: 0.10, nbActions: 100, cours: 1.5,
  });

  const api = { SEUILS, rapp, holding, mine, projection, EXEMPLE_RAPP, EXEMPLE_HOLDING, EXEMPLE_MINE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else racine.DecotesMethodes = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
