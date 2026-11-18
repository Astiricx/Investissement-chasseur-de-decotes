# Chasseur de décotes

Suivi de portefeuille boursier selon la méthode Net-Net / Daubasses. Outil personnel : il ne constitue pas un conseil en investissement.

## Principes

- HTML, CSS et JavaScript simples, sans bibliothèque extérieure ni étape de compilation.
- La page ne contacte aucun autre site (politique de sécurité dans `index.html`).
- Ce dépôt est public : il ne contient que du code, des sociétés fictives et des analyses de sociétés cotées faites à partir de leurs comptes publiés. Aucune donnée personnelle (portefeuille, montants, transactions) : le fichier `.gitignore` refuse les fichiers de données (.json, .xlsx, .csv).

## Fichiers

- `index.html` : la page (verrouillage, tableau de bord, analyse, données).
- `css/style.css` : la présentation, adaptée au téléphone.
- `js/calc.js` : la logique de la méthode (VANN, VANE, VANT, solvabilité, statuts, synthèse).
- `js/donnees.js` : le format du portefeuille et le nettoyage de tout ce qui vient de l'extérieur.
- `js/coffre.js` : le chiffrement par mot de passe (Web Crypto : PBKDF2-SHA-256 à 600 000 itérations, AES-GCM 256 bits) et le stockage local.
- `js/csv.js` : la lecture des fichiers CSV, sans bibliothèque.
- `js/reseau.js` : le seul module qui accède au réseau (cours de bourse). Fournisseur interchangeable.
- `js/journal.js` : la logique du journal (achats, ventes, dividendes, prix de revient, cash).
- `js/methodes.js` : RAPP (4 ratios sur 8 exercices), holding (ANR), mine (méthode Oceana Gold), projection d'intérêts composés.
- `js/graphiques.js` : composants graphiques SVG sans bibliothèque (répartition, courbe avec infobulle, jauge, mini-courbe, barres).
- `js/vue-patrimoine.js` : tableau de bord patrimonial (répartition, jauge du cash, évolution, simulateur).
- `js/vue-analyses.js` : sous-onglets d'analyse (VANN/VANE, RAPP, holding, mine, qualité Buffett) et fiches enregistrées.
- `js/gerants.js` et `js/vue-gerants.js` : suivi « Smart Money » des mouvements des gérants (agrégation par société et par thème, import CSV).
- `js/vue-assurance.js` : simulateur d'assurance anti-krach (puts hors de la monnaie, Black-Scholes, comparaison sur 10 ans).
- `js/analyses-publiees.js` : les fiches des analyses publiées (chiffres des comptes), chargeables dans les outils.
- `analyses/` et `css/rapport.css` : une page de synthèse par analyse publiée, générée par un script de `outils/` (par exemple `node outils/analyses-coree.js`, qui s'appuie sur le modèle commun `outils/modele-analyse.js`) qui réutilise les modules de calcul.
- `js/tests.js` : les tests, exécutés à chaque chargement de la page.
- `js/app.js` : l'interface.

## Lancer

Ouvrir `index.html` dans un navigateur. Pour lancer les tests seuls : `node js/tests.js`.

## Sécurité des données

- Le portefeuille est chiffré avant d'être écrit dans le stockage local du navigateur. Le mot de passe n'est jamais enregistré et ne peut pas être retrouvé.
- Le fichier de sauvegarde exporté contient les données chiffrées, le sel et le vecteur d'initialisation (non secrets).
- La session se verrouille après 15 minutes d'inactivité.
- Connexions autorisées par la politique de sécurité : Yahoo Finance et, s'il est activé, le relais corsproxy.io. Seuls les codes bourse sont envoyés, jamais les quantités, montants ou noms.
- Limite connue : pendant qu'une session est ouverte, les données déchiffrées sont en mémoire dans la page. Un logiciel malveillant ou une extension de navigateur indiscrète sur l'appareil pourrait les lire.

## Cours de bourse

- Source : l'API « chart » de Yahoo Finance, non officielle et sans garantie. Les cours sont convertis en euros (taux Yahoo `XXXEUR=X`), y compris les cotations en pence à Londres.
- Code bourse : code court + place de cotation (ALPH + Euronext Paris → `ALPH.PA`), ou code Yahoo complet.
- Si Yahoo refuse les requêtes venant d'une page web (règle CORS des navigateurs), l'outil le signale et garde les anciens cours. Le relais corsproxy.io peut alors être activé (onglet Données) ; il voit la liste des codes demandés.
- Ajouter un fournisseur (par exemple EODHD) : un objet dans `FOURNISSEURS` de `js/reseau.js` (voir l'en-tête du fichier) et son domaine dans `connect-src` de `index.html`.

## Analyses publiées

- Onglet Analyse, liste « Analyses publiées » : la fiche remplit les outils concernés (VANN / VANE, RAPP) ; « Enregistrer la fiche » la copie dans le coffre.
- Les montants restent dans la devise des comptes de la société (liste « Devise des comptes »). Le portefeuille et le journal restent en euros : pour une société étrangère, le prix payé et l'objectif sont à convertir au cours du jour.
- Chaque page de synthèse (`analyses/…`) détaille les sources, les calculs pas à pas, la sensibilité et le plan d'action. Les tests vérifient que la fiche redonne exactement les chiffres de la page.
- [Daewon Sanup (005710, Séoul)](analyses/005710-daewon-sanup.html), 18 novembre 2026 : Net-Net (49,5 % de la VANN), trésorerie supérieure à deux fois la capitalisation.
- [SYTS (002170, Séoul)](analyses/002170-syts.html), 18 novembre 2026 : Net-Net (41,1 % de la VANN), trésorerie nette supérieure à la capitalisation.
- [Dongil Industries (004890, Séoul)](analyses/004890-dongil-industries.html), 18 novembre 2026 : Net-Net très profond (27,5 % de la VANN), deux alertes RAPP.
- [Sun A. Kaken (4234, Tokyo)](analyses/4234-sun-a-kaken.html), 17 novembre 2026 : Net-Estate (60,6 % de la VANE), pas un Net-Net ; marge dépendante des bâtiments.
- [Showa Paxxs (3954, Tokyo)](analyses/3954-showa-paxxs.html), 16 novembre 2026 : Net-Estate à la limite (69,7 % de la VANE), pas un Net-Net.

## État

- Itération 1 : tableau de bord et calculatrice d'analyse.
- Itération 2 : portefeuille chiffré enregistré dans le navigateur, export et restauration d'une sauvegarde, import CSV, fiche de saisie d'une ligne.
- Itération 3 : actualisation des cours (Yahoo Finance, conversion en euros, rapport détaillé), journal des opérations avec mise à jour proposée de la ligne et du cash, place de cotation.
- Itération 4 : classes d'actifs (actions décotées, ETF, or et matières premières), répartition, jauge du cash 5-15 %, courbe d'évolution (un point par jour), plus-value latente, simulateur d'intérêts composés ; analyses RAPP, holding et mine avec fiches enregistrées dans le coffre.
- Itération 5 : carnet de bord (thèse obligatoire avant tout achat, raison de vente, notes de suivi, rotation sur 12 mois), radar de l'« action idéale » (critères Buffett, exemple Apple 10-K 2025), suivi des gérants, assurance anti-krach, momentum 12-1 activable seulement après acceptation explicite.
- Analyses publiées : Showa Paxxs, Sun A. Kaken (Japon) ; Daewon Sanup, SYTS, Dongil Industries (Corée, montants en wons) et devise des comptes dans les outils VANN / VANE et RAPP.
- À venir : installation sur téléphone (application web hors connexion).

## Sources des chiffres cités dans l'interface

- Étude « Echo Chambers » : Cookson, Engelberg et Mullins, *Review of Financial Studies*, 2023, environ 400 000 utilisateurs de StockTwits.
- Apple : rapport annuel 10-K de l'exercice 2025 (SEC) et résultats annuels 2021-2022.
- Universa : lettre aux clients d'avril 2020 rapportée par le Wall Street Journal, Bloomberg et Yahoo Finance (+3 612 % en mars, +4 144 % depuis le début de l'année, sur le capital de couverture).
- Indépendance AM : Épargnant 3.0 (septembre 2025) ; entrées sur SEB et Électricité de Strasbourg citées dans la vidéo, non vérifiées.

## Graphiques

Les graphiques sont dessinés en SVG par `js/graphiques.js`, sans Chart.js : la politique de sécurité n'autorise que les scripts du site, et aucune dépendance n'est chargée. Palette catégorielle validée (daltonisme, contraste) en clair et en sombre ; les couleurs suivent toujours la même classe d'actifs ; chaque couleur est accompagnée d'un nom et d'un montant.
