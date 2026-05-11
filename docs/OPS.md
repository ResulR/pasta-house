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

## Monitoring uptime avec UptimeRobot

Le site Pasta House est surveillé depuis l’extérieur avec UptimeRobot.

Compte utilisé :

- connexion via GitHub

Liens utiles :

- site UptimeRobot : https://uptimerobot.com/
- dashboard : https://dashboard.uptimerobot.com/

Deux monitors sont configurés.

### Monitor frontend

URL surveillée :

    https://pastahouses.com/

Rôle :

- vérifier que le site client est accessible
- détecter une panne Nginx, domaine, HTTPS ou frontend

### Monitor backend et base de données

URL surveillée :

    https://pastahouses.com/api/health

Rôle :

- vérifier que le backend Express répond
- vérifier que PostgreSQL répond

L’endpoint `/api/health` effectue un check DB léger avec PostgreSQL.

Réponse attendue :

    {
      "ok": true,
      "service": "pasta-house-server",
      "db": "connected",
      "now": "..."
    }

### Fréquence

Plan gratuit UptimeRobot :

    vérification toutes les 5 minutes

### Alertes

Une alerte email est configurée.

Le test réel d’alerte a été effectué le 11/05/2026 :

- le backend Pasta House a été coupé temporairement avec PM2
- `/api/health` a retourné `502 Bad Gateway`
- UptimeRobot a détecté l’incident
- l’email d’alerte a été reçu
- le backend a ensuite été relancé
- `/api/health` est revenu en `200 OK`

### Commandes utilisées pendant le test

Vérifier l’état :

    pm2 status
    curl -i https://pastahouses.com/api/health

Couper uniquement le backend Pasta House :

    pm2 stop pasta-house-server

Relancer le backend Pasta House :

    pm2 start pasta-house-server

Vérifier le retour à la normale :

    curl -i https://pastahouses.com/api/health

Important :

- ne pas couper LocalFood pendant ce test
- ne pas couper Nginx
- ne pas couper PostgreSQL
- un incident UptimeRobot visible après ce test est normal, car c’était une coupure volontaire
