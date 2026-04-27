# Pasta House — Procédure backend VPS

## Structure cible

Backend attendu sur le VPS dans :

/var/www/pasta-house/server

## Fichiers attendus côté serveur

Le dossier backend doit contenir au minimum :
- package.json
- package-lock.json
- src/
- ecosystem.config.cjs
- .env

## 1. Créer le dossier cible

mkdir -p /var/www/pasta-house/server

## 2. Envoyer le backend

Depuis la machine locale, envoyer le dossier server/ vers :

/var/www/pasta-house/server

Important :
- ne pas envoyer node_modules
- le vrai fichier .env prod doit être géré séparément

## 3. Placer le vrai .env prod

Chemin attendu :

/var/www/pasta-house/server/.env

Ce fichier doit contenir les vraies valeurs prod pour :
- PORT
- NODE_ENV
- DB_HOST
- DB_PORT
- DB_NAME
- DB_USER
- DB_PASSWORD
- JWT_SECRET
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- APP_BASE_URL
- API_BASE_URL

## 4. Installer les dépendances backend

cd /var/www/pasta-house/server
npm ci

## 5. Démarrer avec PM2

cd /var/www/pasta-house/server
pm2 start ecosystem.config.cjs

## 6. Vérifier l’état PM2

pm2 list

## 7. Vérifier la santé backend

curl http://127.0.0.1:4000/api/health

## 8. Voir les logs backend

pm2 logs pasta-house-server

## 9. Recharger après mise à jour

cd /var/www/pasta-house/server
pm2 reload ecosystem.config.cjs

## 10. Redémarrer si nécessaire

cd /var/www/pasta-house/server
pm2 restart pasta-house-server