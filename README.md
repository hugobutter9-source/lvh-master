# LVH Master

Le poste de pilotage de l'agence : tâches, objectifs, agenda, organigramme, équipe, présences et congés,
créatrices, accompagnements, calls, scripts, finances, et un accès direct au Creator Portal.

C'est la suite de l'outil « second brain » (Agency OS). Le code de départ est le même, donc une sauvegarde
exportée depuis l'ancien outil s'importe ici (Paramètres › Import / export).

## Ce qui a été ajouté par rapport à l'ancien outil

- **Creator Portal** (menu Agence) : raccourcis vers chaque page du portal, et un bloc sur le dashboard.
  Les chiffres du portal ne sont pas encore lus : c'est l'étape 2.
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

## Organisation du code

- `src/js/core/` : configuration (menu, champs des fiches), règles métier, stockage, sauvegardes.
- `src/js/ui/` : formulaires, tiroirs, apparence, horloge.
- `src/js/modules/` : une page par fichier (`dashboard.js`, `students.js` pour l'accompagnement,
  `agency.js` pour les calls et les scripts, `portal.js` pour le Creator Portal…).
