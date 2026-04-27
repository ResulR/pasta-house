# Pasta House — Runbook de déploiement production

## Objectif

Déployer proprement :
- le frontend buildé Vite
- le backend Node/Express
- la configuration Nginx
- le process PM2

## Pré-requis

Le VPS doit disposer de :
- Debian 13
- Nginx
- Node.js
- npm
- PM2
- PostgreSQL ou accès DB disponible
- droits suffisants sur /var/www/pasta-house

## Structure cible

/var/www/pasta-house/
- dist/
- server/

## Ordre de déploiement

### 1. Builder le frontend en local

Depuis la racine du projet :

npm run build

### 2. Préparer les dossiers sur le VPS

mkdir -p /var/www/pasta-house/dist
mkdir -p /var/www/pasta-house/server

### 3. Envoyer le frontend

Envoyer le contenu de dist/ vers :

/var/www/pasta-house/dist

### 4. Envoyer le backend

Envoyer le dossier server/ vers :

/var/www/pasta-house/server

Important :
- ne pas envoyer node_modules
- ne pas envoyer le .env local de développement
- le vrai .env prod doit être placé séparément sur le VPS

### 5. Placer le vrai .env backend prod

Chemin attendu :

/var/www/pasta-house/server/.env

### 6. Installer les dépendances backend

cd /var/www/pasta-house/server
npm ci

### 7. Installer la config Nginx

Le fichier example préparé doit être adapté/copier côté serveur pour le site réel.

Points attendus :
- root /var/www/pasta-house/dist;
- proxy /api vers http://127.0.0.1:4000
- try_files SPA React

### 8. Tester la config Nginx

nginx -t

### 9. Recharger Nginx

systemctl reload nginx

### 10. Démarrer le backend avec PM2

cd /var/www/pasta-house/server
pm2 start ecosystem.config.cjs

### 11. Vérifier PM2

pm2 list

### 12. Vérifier la santé backend

curl http://127.0.0.1:4000/api/health

### 13. Vérifier le site

Vérifications minimales :
- homepage OK
- route /commander OK
- route /admin OK
- login admin OK
- /api/health accessible via le domaine
- une page React rechargée directement fonctionne encore
- les appels API frontend passent bien via /api

### 14. Vérifier les logs si problème

pm2 logs pasta-house-server

## Mise à jour ultérieure

### Frontend uniquement
- rebuild local
- renvoyer dist/
- recharger Nginx si nécessaire

### Backend uniquement
- renvoyer server/
- conserver le vrai .env sur le VPS
- npm ci si dépendances modifiées
- pm2 reload ecosystem.config.cjs

### Changement Nginx
- mettre à jour la config
- nginx -t
- systemctl reload nginx