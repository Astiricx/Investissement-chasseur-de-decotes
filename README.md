# Chasseur de décotes

Suivi de portefeuille boursier selon la méthode Net-Net / Daubasses. Outil personnel : il ne constitue pas un conseil en investissement.

## Principes

- HTML, CSS et JavaScript simples, sans bibliothèque extérieure ni étape de compilation.
- La page ne contacte aucun autre site (politique de sécurité dans `index.html`).
- Ce dépôt est public : il ne contient que du code et des sociétés fictives. Le fichier `.gitignore` refuse les fichiers de données (.json, .xlsx, .csv).

## Fichiers

- `index.html` : la page (tableau de bord et analyse d'une société).
- `css/style.css` : la présentation, adaptée au téléphone.
- `js/calc.js` : la logique de la méthode (VANN, VANE, VANT, solvabilité, statuts, synthèse). Aucune dépendance à la page.
- `js/tests.js` : les tests, exécutés à chaque chargement de la page.
- `js/app.js` : l'interface.

## Lancer

Ouvrir `index.html` dans un navigateur. Pour lancer les tests seuls : `node js/tests.js`.

## État

Itération 1 : tableau de bord avec données de démonstration et calculatrice d'analyse. À venir : saisie et enregistrement des lignes dans le navigateur, sauvegarde chiffrée, import du fichier Excel, journal.
