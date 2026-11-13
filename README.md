# Chasseur de décotes

Suivi de portefeuille boursier selon la méthode Net-Net / Daubasses. Outil personnel : il ne constitue pas un conseil en investissement.

## Principes

- HTML, CSS et JavaScript simples, sans bibliothèque extérieure ni étape de compilation.
- La page ne contacte aucun autre site (politique de sécurité dans `index.html`).
- Ce dépôt est public : il ne contient que du code et des sociétés fictives. Le fichier `.gitignore` refuse les fichiers de données (.json, .xlsx, .csv).

## Fichiers

- `index.html` : la page (verrouillage, tableau de bord, analyse, données).
- `css/style.css` : la présentation, adaptée au téléphone.
- `js/calc.js` : la logique de la méthode (VANN, VANE, VANT, solvabilité, statuts, synthèse).
- `js/donnees.js` : le format du portefeuille et le nettoyage de tout ce qui vient de l'extérieur.
- `js/coffre.js` : le chiffrement par mot de passe (Web Crypto : PBKDF2-SHA-256 à 600 000 itérations, AES-GCM 256 bits) et le stockage local.
- `js/csv.js` : la lecture des fichiers CSV, sans bibliothèque.
- `js/tests.js` : les tests, exécutés à chaque chargement de la page.
- `js/app.js` : l'interface.

## Lancer

Ouvrir `index.html` dans un navigateur. Pour lancer les tests seuls : `node js/tests.js`.

## Sécurité des données

- Le portefeuille est chiffré avant d'être écrit dans le stockage local du navigateur. Le mot de passe n'est jamais enregistré et ne peut pas être retrouvé.
- Le fichier de sauvegarde exporté contient les données chiffrées, le sel et le vecteur d'initialisation (non secrets).
- La session se verrouille après 15 minutes d'inactivité.
- Limite connue : pendant qu'une session est ouverte, les données déchiffrées sont en mémoire dans la page. Un logiciel malveillant ou une extension de navigateur indiscrète sur l'appareil pourrait les lire.

## État

- Itération 1 : tableau de bord et calculatrice d'analyse.
- Itération 2 : portefeuille chiffré enregistré dans le navigateur, export et restauration d'une sauvegarde, import CSV, fiche de saisie d'une ligne.
- À venir : journal des opérations, mise à jour des cours, installation sur téléphone.
