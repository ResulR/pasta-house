# Pasta House — Plan de déploiement prod

## Structure cible VPS

/var/www/pasta-house/
- dist/   -> frontend buildé Vite
- server/ -> backend Node/Express

## Frontend

Build local :
- npm run build

Dossier à déployer :
- dist/

## Backend

Dossier à déployer :
- server/

Le backend sera démarré avec PM2 via :
- ecosystem.config.cjs
- script : src/server.js

## Nginx

Le frontend sera servi depuis :
- /var/www/pasta-house/dist

Le backend sera reverse-proxy via :
- /api -> http://127.0.0.1:4000

## Variables d’environnement backend prod

Fichier de référence :
- server/.env.production.example

Le vrai fichier prod attendu plus tard sur le VPS sera :
- /var/www/pasta-house/server/.env

## Santé du service

Endpoint de vérification backend :
- GET /api/health