/* Coffre : chiffrement des données par mot de passe avec la Web Crypto API du navigateur.
   - Clé dérivée du mot de passe par PBKDF2 (SHA-256, 600 000 itérations, sel aléatoire de 16 octets).
   - Données chiffrées en AES-GCM 256 bits, avec un vecteur d'initialisation neuf à chaque enregistrement.
   Le sel et le vecteur ne sont pas secrets : ils sont enregistrés à côté des données chiffrées.
   Le mot de passe n'est jamais enregistré : s'il est perdu, les données sont irrécupérables. */
(function (racine) {
  "use strict";
  const FORMAT = "chasseur-decotes-coffre";
  const VERSION = 1;
  const CLE_STOCKAGE = "chasseur-decotes.coffre.v1";
  const ITERATIONS = 600000;
  const LONGUEUR_MIN = 10;
  const subtle = racine.crypto && racine.crypto.subtle;
  // Lie le texte chiffré à ce format : un fichier chiffré pour autre chose ne s'ouvrira pas ici.
  const CONTEXTE = new TextEncoder().encode(FORMAT + ":" + VERSION);

  class ErreurMotDePasse extends Error {}
  class ErreurFormat extends Error {}

  function versBase64(octets) {
    let s = "";
    for (let i = 0; i < octets.length; i += 0x8000) s += String.fromCharCode.apply(null, octets.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function depuisBase64(t) {
    const s = atob(t); const o = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i);
    return o;
  }
  const aleatoire = (n) => racine.crypto.getRandomValues(new Uint8Array(n));

  async function deriverCle(motDePasse, sel, iterations) {
    // NFKC : un même mot de passe accentué donne la même clé sur téléphone et sur ordinateur.
    const brut = new TextEncoder().encode(String(motDePasse).normalize("NFKC"));
    const base = await subtle.importKey("raw", brut, "PBKDF2", false, ["deriveKey"]);
    return subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: sel, iterations }, base,
      { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  /** Chiffre `objet` avec la clé de la session et renvoie l'enveloppe à enregistrer. */
  async function sceller(session, objet) {
    const iv = aleatoire(12);
    const clair = new TextEncoder().encode(JSON.stringify(objet));
    const chiffre = await subtle.encrypt({ name: "AES-GCM", iv, additionalData: CONTEXTE }, session.cle, clair);
    return {
      format: FORMAT, version: VERSION,
      kdf: { algorithme: "PBKDF2", hash: "SHA-256", iterations: session.iterations, sel: versBase64(session.sel) },
      chiffrement: { algorithme: "AES-GCM", iv: versBase64(iv) },
      donnees: versBase64(new Uint8Array(chiffre)),
      enregistreLe: new Date().toISOString(),
    };
  }

  /** Crée un coffre : nouveau sel, nouvelle clé. Renvoie la session (clé en mémoire) et l'enveloppe. */
  async function creer(motDePasse, objet, options) {
    const sel = aleatoire(16);
    const iterations = (options && options.iterations) || ITERATIONS;
    const session = { cle: await deriverCle(motDePasse, sel, iterations), sel, iterations };
    return { session, enveloppe: await sceller(session, objet) };
  }

  /** Vérifie la forme d'une enveloppe (lue dans le stockage ou dans un fichier de sauvegarde). */
  function validerEnveloppe(e) {
    const chaine = (v) => typeof v === "string" && v.length > 0 && /^[A-Za-z0-9+/]+=*$/.test(v);
    if (!e || typeof e !== "object" || e.format !== FORMAT) throw new ErreurFormat("Ce fichier n'est pas une sauvegarde de cet outil.");
    if (e.version !== VERSION) throw new ErreurFormat("Cette sauvegarde vient d'une autre version de l'outil.");
    const k = e.kdf, c = e.chiffrement;
    if (!k || k.algorithme !== "PBKDF2" || k.hash !== "SHA-256" || !Number.isInteger(k.iterations) ||
        k.iterations < 1 || k.iterations > 5000000 || !chaine(k.sel) ||
        !c || c.algorithme !== "AES-GCM" || !chaine(c.iv) || !chaine(e.donnees)) {
      throw new ErreurFormat("La sauvegarde est incomplète ou abîmée.");
    }
    return e;
  }

  /** Déchiffre une enveloppe. Lève ErreurMotDePasse si le mot de passe est faux (ou le fichier altéré). */
  async function ouvrir(motDePasse, enveloppe) {
    validerEnveloppe(enveloppe);
    const sel = depuisBase64(enveloppe.kdf.sel);
    const iterations = enveloppe.kdf.iterations;
    const cle = await deriverCle(motDePasse, sel, iterations);
    let clair;
    try {
      clair = await subtle.decrypt({ name: "AES-GCM", iv: depuisBase64(enveloppe.chiffrement.iv), additionalData: CONTEXTE },
        cle, depuisBase64(enveloppe.donnees));
    } catch (e) {
      throw new ErreurMotDePasse("Mot de passe incorrect.");
    }
    return { session: { cle, sel, iterations }, donnees: JSON.parse(new TextDecoder().decode(clair)) };
  }

  // ---------- Stockage local du navigateur ----------
  function stockageDisponible(stockage) {
    try { stockage.setItem("chasseur-decotes.essai", "1"); stockage.removeItem("chasseur-decotes.essai"); return true; }
    catch (e) { return false; }
  }
  function lire(stockage) {
    try { const t = stockage.getItem(CLE_STOCKAGE); return t ? validerEnveloppe(JSON.parse(t)) : null; }
    catch (e) { if (e instanceof ErreurFormat || e instanceof SyntaxError) throw new ErreurFormat("Les données enregistrées dans ce navigateur sont illisibles."); return null; }
  }
  const ecrire = (stockage, enveloppe) => stockage.setItem(CLE_STOCKAGE, JSON.stringify(enveloppe));
  const effacer = (stockage) => stockage.removeItem(CLE_STOCKAGE);

  const api = { FORMAT, VERSION, ITERATIONS, LONGUEUR_MIN, CLE_STOCKAGE, ErreurMotDePasse, ErreurFormat,
    disponible: !!subtle, creer, sceller, ouvrir, validerEnveloppe, stockageDisponible, lire, ecrire, effacer };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else racine.DecotesCoffre = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
