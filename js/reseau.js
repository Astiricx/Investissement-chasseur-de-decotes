/* DecotesReseau : seul module qui accède au réseau.
   Il récupère le dernier cours de chaque ligne auprès d'un fournisseur de cours et le convertit en euros.

   Ce qui part sur le réseau : uniquement les codes bourse (et les paires de devises), jamais une quantité,
   un montant ni un nom. Le fournisseur (et le relais, s'il est activé) voit donc la liste des codes suivis.

   Pour changer de fournisseur (par exemple EODHD), il suffit d'ajouter un objet dans FOURNISSEURS avec :
     - symbole(ligne)            → code à demander, ou null si la ligne n'a pas de code exploitable
     - symboleChange(devise)     → code de la paire « devise → euro »
     - adresses(symbole)         → liste d'adresses à essayer dans l'ordre
     - lire(json)                → { prix, devise, horodatage (secondes), fuseau, nom } ou erreur ErreurReponse
   et d'autoriser son domaine dans la politique de sécurité de index.html (connect-src). */
(function (racine) {
  "use strict";

  class ErreurReseau extends Error {}       // réseau coupé, ou réponse refusée par le navigateur (CORS)
  class ErreurIntrouvable extends Error {}  // le fournisseur ne connaît pas ce code
  class ErreurReponse extends Error {}      // réponse reçue mais inexploitable
  class ErreurLimite extends Error {}       // trop de requêtes
  class ErreurDelai extends Error {}        // pas de réponse dans le délai

  const SYMBOLE_VALIDE = /^[A-Z0-9][A-Z0-9.\-]{0,23}$/;

  // ---------------------------------------------------------------- Yahoo Finance
  const SUFFIXES_YAHOO = {
    XPAR: ".PA", XBRU: ".BR", XAMS: ".AS", XMIL: ".MI", XLIS: ".LS", XOSL: ".OL",
    XETR: ".DE", XLON: ".L", XSWX: ".SW", XTKS: ".T", XNYS: "", AUTRE: "",
  };

  const yahoo = {
    nom: "Yahoo Finance",
    symbole(ligne) {
      const code = String(ligne.code || "").toUpperCase().trim();
      if (!code) return null;
      // Un code qui contient déjà un point (ALPH.PA) est pris tel quel.
      const symbole = code.includes(".") || ligne.place === "AUTRE" ? code : code + (SUFFIXES_YAHOO[ligne.place] ?? ".PA");
      return SYMBOLE_VALIDE.test(symbole) ? symbole : null;
    },
    symboleChange: (devise) => devise + "EUR=X",
    adresses(symbole) {
      const chemin = "/v8/finance/chart/" + encodeURIComponent(symbole) + "?interval=1d&range=1d";
      return ["https://query1.finance.yahoo.com" + chemin, "https://query2.finance.yahoo.com" + chemin];
    },
    lire(json) {
      const chart = json && json.chart;
      if (chart && chart.error) {
        const code = String(chart.error.code || "");
        if (/not ?found/i.test(code)) throw new ErreurIntrouvable(chart.error.description || "Code inconnu");
        throw new ErreurReponse(chart.error.description || code || "Erreur du fournisseur");
      }
      const meta = chart && Array.isArray(chart.result) && chart.result[0] && chart.result[0].meta;
      if (!meta) throw new ErreurReponse("Réponse sans données de cours");
      return {
        prix: meta.regularMarketPrice,
        devise: meta.currency,
        horodatage: meta.regularMarketTime,
        fuseau: meta.exchangeTimezoneName,
        nom: meta.longName || meta.shortName || "",
      };
    },
  };

  const FOURNISSEURS = { yahoo };

  // ---------------------------------------------------------------- Relais (proxy CORS)
  // Un relais réémet la requête depuis son serveur : il contourne le refus du navigateur,
  // mais il voit (et peut enregistrer) chaque adresse demandée, donc chaque code bourse.
  const RELAIS = {
    "": { nom: "Aucun (requête directe)", adresse: (url) => url },
    corsproxy: { nom: "corsproxy.io", adresse: (url) => "https://corsproxy.io/?" + encodeURIComponent(url) },
  };

  // ---------------------------------------------------------------- Devises
  // Certaines places cotent en centièmes (pence à Londres, cents à Johannesburg, agorot à Tel-Aviv).
  const SOUS_UNITES = { GBP: ["GBp", "GBX"], ZAR: ["ZAc", "ZAC"], ILS: ["ILA"] };
  function devisePrincipale(devise) {
    for (const [principale, sous] of Object.entries(SOUS_UNITES)) if (sous.includes(devise)) return { devise: principale, diviseur: 100 };
    return { devise: String(devise || "").toUpperCase(), diviseur: 1 };
  }

  function dateLocale(horodatage, fuseau) {
    if (typeof horodatage !== "number" || !Number.isFinite(horodatage)) return null;
    const d = new Date(horodatage * 1000);
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: fuseau || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(d); }
    catch (e) { return d.toISOString().slice(0, 10); }
  }

  // ---------------------------------------------------------------- Requêtes
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Une requête GET avec délai maximal. Ne transmet ni cookie, ni référent. */
  async function telecharger(url, opts) {
    const controleur = new AbortController();
    const minuterie = setTimeout(() => controleur.abort(), opts.delai);
    const annuler = () => controleur.abort();
    if (opts.signal) opts.signal.addEventListener("abort", annuler, { once: true });
    try {
      const reponse = await opts.fetch(url, {
        method: "GET", credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store", signal: controleur.signal,
      });
      if (reponse.status === 404) {
        // Yahoo renvoie 404 avec un corps qui décrit l'erreur.
        let json = null; try { json = await reponse.json(); } catch (e) { /* corps illisible */ }
        return { json, introuvable: true };
      }
      if (reponse.status === 429) throw new ErreurLimite("Trop de requêtes");
      if (!reponse.ok) throw new ErreurReseau("Erreur " + reponse.status + " du serveur");
      try { return { json: await reponse.json() }; }
      catch (e) { throw new ErreurReponse("Réponse illisible"); }
    } catch (e) {
      if (e instanceof ErreurLimite || e instanceof ErreurReseau || e instanceof ErreurReponse) throw e;
      if (opts.signal && opts.signal.aborted) throw new ErreurDelai("Actualisation annulée");
      if (e && e.name === "AbortError") throw new ErreurDelai("Pas de réponse en " + Math.round(opts.delai / 1000) + " s");
      // fetch lève une TypeError quand le réseau est coupé ou que le navigateur bloque la réponse (CORS).
      throw new ErreurReseau("Réseau indisponible ou accès refusé par le fournisseur");
    } finally {
      clearTimeout(minuterie);
      if (opts.signal) opts.signal.removeEventListener("abort", annuler);
    }
  }

  /** Cours d'un symbole : essaie chaque adresse du fournisseur, s'arrête au premier résultat exploitable. */
  async function coursSymbole(symbole, opts) {
    const f = opts.fournisseur, relais = RELAIS[opts.relais] || RELAIS[""];
    let derniereErreur = null;
    for (const adresse of f.adresses(symbole)) {
      try {
        const { json, introuvable } = await telecharger(relais.adresse(adresse), opts);
        if (introuvable) throw new ErreurIntrouvable("Code inconnu");
        const r = f.lire(json);
        if (typeof r.prix !== "number" || !Number.isFinite(r.prix) || r.prix <= 0 || r.prix > 1e7) throw new ErreurReponse("Cours absent ou incohérent");
        if (typeof r.devise !== "string" || !/^[A-Za-z]{3}$/.test(r.devise)) throw new ErreurReponse("Devise absente");
        return r;
      } catch (e) {
        derniereErreur = e;
        // On ne réessaie l'adresse suivante qu'en cas de souci réseau ou serveur.
        if (!(e instanceof ErreurReseau || e instanceof ErreurDelai) || (opts.signal && opts.signal.aborted)) throw e;
      }
    }
    throw derniereErreur;
  }

  function messageErreur(e) {
    if (e instanceof ErreurIntrouvable) return "Code introuvable : vérifiez le code bourse et la place de cotation.";
    if (e instanceof ErreurLimite) return "Le fournisseur limite le nombre de requêtes : réessayez dans quelques minutes.";
    if (e instanceof ErreurDelai) return e.message + ".";
    if (e instanceof ErreurReseau) return e.message + ".";
    if (e instanceof ErreurReponse) return "Réponse inexploitable (" + e.message.toLowerCase() + ").";
    return "Erreur inattendue (" + (e && e.message) + ").";
  }

  /**
   * Actualise les cours d'une liste de lignes. Ne modifie pas les lignes : renvoie un rapport,
   * que l'interface applique ensuite.
   *
   * options : { fournisseur: "yahoo", relais: "" | "corsproxy", fetch, delai (ms), pause (ms),
   *             seuilVariation (0,25), signal (AbortSignal), progression(fait, total) }
   * Renvoie : { resultats: [{ id, nom, symbole, ok, prix (€), prixOrigine, devise, taux, date,
   *                           nomFournisseur, ancien, variation, alerte, erreur }],
   *             misAJour, echecs, ignorees, diagnostic: null | "reseau" | "limite" }
   */
  async function actualiser(lignes, options) {
    const opts = Object.assign({ fournisseur: "yahoo", relais: "", delai: 10000, pause: 250, seuilVariation: 0.25 }, options);
    opts.fetch = opts.fetch || (racine.fetch && racine.fetch.bind(racine));
    opts.fournisseur = FOURNISSEURS[opts.fournisseur] || yahoo;
    const f = opts.fournisseur;

    const resultats = lignes.map((l) => ({ id: l.id, nom: l.nom, symbole: f.symbole(l), ancien: l.cours ?? null, ok: false }));
    const symboles = [...new Set(resultats.map((r) => r.symbole).filter(Boolean))];
    const parSymbole = new Map();
    const taux = new Map([["EUR", 1]]);
    let diagnostic = null, reussites = 0, echecsReseau = 0, fait = 0;

    async function tauxVersEuro(devise) {
      if (!taux.has(devise)) {
        try {
          const r = await coursSymbole(f.symboleChange(devise), opts);
          taux.set(devise, r.prix);
        } catch (e) { taux.set(devise, e); }
        if (opts.pause) await attendre(opts.pause);
      }
      const t = taux.get(devise);
      if (t instanceof Error) throw new ErreurReponse("taux de change " + devise + "/EUR indisponible");
      return t;
    }

    for (const symbole of symboles) {
      if (opts.signal && opts.signal.aborted) break;
      let issue;
      try {
        const r = await coursSymbole(symbole, opts);
        const { devise, diviseur } = devisePrincipale(r.devise);
        const t = await tauxVersEuro(devise);
        issue = { ok: true, prix: Math.round((r.prix / diviseur) * t * 10000) / 10000, prixOrigine: r.prix, devise: r.devise,
          taux: devise === "EUR" ? null : t, date: dateLocale(r.horodatage, r.fuseau), nomFournisseur: String(r.nom).slice(0, 120) };
        reussites++; echecsReseau = 0;
      } catch (e) {
        issue = { ok: false, erreur: messageErreur(e) };
        if (e instanceof ErreurReseau) echecsReseau++;
        if (e instanceof ErreurLimite) diagnostic = "limite";
      }
      parSymbole.set(symbole, issue);
      fait++;
      if (opts.progression) opts.progression(fait, symboles.length);
      // Si les premières requêtes échouent toutes pour une raison réseau, inutile d'insister :
      // le fournisseur refuse très probablement les requêtes de cette page.
      if (reussites === 0 && echecsReseau >= 2) { diagnostic = "reseau"; break; }
      if (diagnostic === "limite") break;
      if (opts.pause && fait < symboles.length) await attendre(opts.pause);
    }

    let misAJour = 0, echecs = 0, ignorees = 0;
    for (const r of resultats) {
      if (!r.symbole) { r.erreur = "Pas de code bourse exploitable : ligne ignorée."; ignorees++; continue; }
      const issue = parSymbole.get(r.symbole) || { ok: false, erreur: opts.signal && opts.signal.aborted ? "Actualisation annulée." : "Non demandé (actualisation interrompue)." };
      Object.assign(r, issue);
      if (r.ok) {
        misAJour++;
        r.variation = typeof r.ancien === "number" && r.ancien > 0 ? r.prix / r.ancien - 1 : null;
        r.alerte = r.variation !== null && Math.abs(r.variation) >= opts.seuilVariation;
      } else echecs++;
    }
    return { resultats, misAJour, echecs, ignorees, diagnostic, fournisseur: f.nom, relais: (RELAIS[opts.relais] || RELAIS[""]).nom };
  }

  const api = { FOURNISSEURS, RELAIS, actualiser, devisePrincipale, dateLocale,
    ErreurReseau, ErreurIntrouvable, ErreurReponse, ErreurLimite, ErreurDelai };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else racine.DecotesReseau = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
