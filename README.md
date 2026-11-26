# LVH Master

Le poste de pilotage de l'agence : tâches, objectifs, agenda, organigramme, équipe, présences et congés,
créatrices, accompagnements, calls, scripts, finances, et un accès direct au Creator Portal.

C'est la suite de l'outil « second brain » (Agency OS). Le code de départ est le même, donc une sauvegarde
exportée depuis l'ancien outil s'importe ici (Paramètres › Import / export).

## Ce qui a été ajouté par rapport à l'ancien outil

- **Creator Portal** (menu Agence) : raccourcis vers chaque page du portal, et, une fois le compte manager du
  portal relié, les demandes envoyées aux modèles (par soi et par les autres managers), ce qu'elles ont renvoyé
  et ce qui est en retard. Le dashboard affiche ce qui attend une validation.
- **Brief avant call** : le bouton « Brief » d'un call ressort les notes du dernier call avec la même
  personne, ce qu'il fallait aborder, la suite prévue, et pour un accompagnement la durée de la
  collaboration, la progression et le reste à payer.
- **Notes à écrire** : un call passé sans notes est rappelé sur le dashboard et dans Calls.
- **Accompagnement** : nombre de personnes, « ensemble depuis », rythme des calls, paiements encaissés un
  par un, prochaine échéance et alerte quand elle est dépassée.

- **Noir et blanc par défaut**, à plat, dans l'esprit d'une app de trading : noir pur, gros chiffres, boutons
  blancs, et une courbe du CA des 6 derniers mois sur le dashboard (on la parcourt au survol). La couleur ne sert
  qu'aux pastilles, aux étiquettes de statut et aux hausses / baisses. Les autres
  thèmes restent dans Paramètres › Apparence.
- **Menu court** : Ma journée, Notifications, Drive, Dépenses et Analytics sont masqués par défaut (à réafficher
  dans Paramètres › Personnalisation). Les réglages sont derrière un seul bouton « Paramètres ».
- **Bouton +** (ou touche N) : ajouter une tâche, un call, un événement… depuis n'importe quelle page.

- **Organigramme** : les cartes se déplacent et se relient directement, sans mode à activer ; un clic ouvre la
  fiche, le bouton « Verrouiller » fige la disposition.
- **Checklists** (page Tâches ou bouton +) : un modèle crée toutes ses tâches datées en un clic. Cinq modèles
  fournis, modifiables, et on peut en ajouter.
- **Créatrices** : courbe du CA sur 6 mois dans la fiche, et alerte sur le dashboard quand le CA des 30 derniers
  jours baisse de 15 % ou plus par rapport aux 30 jours précédents.

- **Synchronisation entre ses appareils** : après connexion avec son compte manager du portal (bouton d'état en bas
  du menu), les données du tableau de bord sont aussi enregistrées en ligne, dans des lignes que seule la personne
  peut lire (`crm_records`, migration dans le dépôt du portal). L'appareil reste la copie de travail : l'app marche
  hors ligne et envoie les changements au retour de la connexion. Par fiche, la dernière écriture arrivée gagne.
- **Téléphone** : barre d'onglets en bas (Accueil, Tâches, +, Portal, Menu).

## Lancer en local

Aucune installation : c'est un site statique.

```bash
python3 -m http.server 8080 --directory src
```

Puis ouvrir http://localhost:8080.

## Tests

```bash
node tests/smoke.js
```

Le test ouvre l'app dans Chromium (Playwright), crée un accompagnement et des calls, et vérifie le dashboard,
le brief, les paiements, la page Creator Portal et toutes les pages du menu.

## Mise en ligne

Netlify : le dossier publié est `src/` (voir `netlify.toml`), sans étape de build.

## Où sont les données

- Hors de claude.ai (Netlify, local) : dans le navigateur de l'appareil (`localStorage`). Rien n'est envoyé
  sur un serveur. Pense aux sauvegardes (Paramètres › Sauvegardes).
- L'adresse du Creator Portal se règle sur la page Creator Portal.
- Chaque personne a ses propres données (tâches, objectifs, finances…) sur son appareil. Ce qui est commun, ce sont
  les données du Creator Portal : elles sont lues en direct avec le compte manager de la personne, et ce sont les
  règles d'accès de la base du portal qui décident de ce qu'elle peut voir. L'adresse et la clé publique de cette
  base sont dans `src/js/modules/portal.js` ; la clé est une clé publique, faite pour être dans le navigateur.
- `src/js/vendor/` contient la bibliothèque Supabase (licence MIT), copiée telle quelle depuis npm.

## Organisation du code

- `src/js/core/` : configuration (menu, champs des fiches), règles métier, stockage, sauvegardes.
- `src/js/ui/` : formulaires, tiroirs, apparence, horloge.
- `src/js/modules/` : une page par fichier (`dashboard.js`, `students.js` pour l'accompagnement,
  `agency.js` pour les calls et les scripts, `portal.js` pour le Creator Portal…).
