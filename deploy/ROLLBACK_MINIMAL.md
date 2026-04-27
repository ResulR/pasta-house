# Pasta House — Procédure rollback minimale

## Objectif

Pouvoir revenir rapidement à la version précédente si un déploiement frontend, backend ou Nginx provoque un dysfonctionnement.

## À conserver avant chaque déploiement

### Frontend
Conserver une copie de la version précédente de :
- /var/www/pasta-house/dist

### Backend
Conserver une copie de la version précédente de :
- /var/www/pasta-house/server

Important :
- ne pas écraser définitivement la version précédente sans possibilité de retour
- conserver le vrai fichier .env du VPS
- ne pas remplacer les secrets par une ancienne version locale par erreur

### Nginx
Conserver une copie de la configuration Nginx active avant modification.

## Stratégie minimale recommandée

Avant un déploiement :
- sauvegarder dist en dist_previous
- sauvegarder server en server_previous
- sauvegarder la config Nginx active si elle change

Exemple de logique :
- /var/www/pasta-house/dist_previous
- /var/www/pasta-house/server_previous

## Si le problème vient du frontend

Actions :
- remettre la version précédente de dist
- recharger Nginx si nécessaire

Vérifications :
- homepage OK
- routes SPA OK
- appels API OK

## Si le problème vient du backend

Actions :
- remettre la version précédente de server
- conserver le vrai .env en place
- relancer :
  - npm ci si nécessaire
  - pm2 restart pasta-house-server

Vérifications :
- pm2 list
- curl http://127.0.0.1:4000/api/health
- login admin OK
- API publique OK

## Si le problème vient de Nginx

Actions :
- restaurer la configuration Nginx précédente
- tester :
  - nginx -t
- recharger :
  - systemctl reload nginx

Vérifications :
- site accessible
- routes frontend OK
- /api OK

## Vérifications minimales après rollback

Toujours vérifier :
- homepage OK
- /commander OK
- /admin OK
- login admin OK
- /api/health OK
- logs PM2 si anomalie :
  - pm2 logs pasta-house-server

## Limites de cette procédure

Cette procédure est un rollback minimal applicatif.
Elle ne couvre pas :
- rollback base de données
- rollback Stripe live
- rollback DNS
- rollback certificat HTTPS