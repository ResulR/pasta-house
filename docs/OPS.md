# Notes d'exploitation — Pasta House

Ce document regroupe les notes opérationnelles importantes pour le VPS Pasta House.

## PM2 logrotate

Le VPS utilise PM2 pour maintenir les services Node.js.

Processus PM2 concernés actuellement :

- localfood-api
- localfood-web
- pasta-house-server

Le module PM2 `pm2-logrotate` est installé pour éviter que les logs PM2 remplissent le disque.

Configuration appliquée :

- taille maximale d'un log actif : 10M
- nombre d'archives conservées : 14
- compression des archives : activée
- rotation programmée : tous les jours à minuit selon la configuration PM2

Commandes utiles :

    pm2 status

Voir la configuration de logrotate :

    pm2 conf pm2-logrotate

Voir la taille actuelle du dossier logs :

    du -sh ~/.pm2/logs

Lister les logs PM2 :

    ls -lh ~/.pm2/logs

Important :

- `pm2-logrotate` agit globalement sur les logs PM2 de l'utilisateur debian.
- Cela concerne donc Pasta House et LocalFood.
- Cela ne modifie pas le code applicatif.
- Les vieux logs compressés peuvent ne pas apparaître immédiatement si les logs sont encore petits.
