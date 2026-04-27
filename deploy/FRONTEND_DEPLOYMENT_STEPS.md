# Pasta House — Procédure frontend VPS

## Structure cible

Frontend attendu sur le VPS dans :

/var/www/pasta-house/dist

## Contenu attendu

Le dossier dist/ doit contenir le build Vite généré localement via :

npm run build

## 1. Générer le build frontend en local

Depuis la racine du projet :

npm run build

## 2. Créer le dossier cible sur le VPS

mkdir -p /var/www/pasta-house/dist

## 3. Envoyer le build frontend

Depuis la machine locale, envoyer le contenu de dist/ vers :

/var/www/pasta-house/dist

Important :
- envoyer le build généré, pas le code source React
- ne pas utiliser src/ en production côté Nginx
- le frontend servi par Nginx doit être uniquement le build statique

## 4. Vérifier la cohérence Nginx

La config Nginx doit servir :

root /var/www/pasta-house/dist;
index index.html;

Et pour la SPA React :

location / {
    try_files $uri $uri/ /index.html;
}

## 5. Vérifier les fichiers présents

Le dossier /var/www/pasta-house/dist doit contenir au minimum :
- index.html
- assets/

## 6. Après mise à jour frontend

Réenvoyer le nouveau build dist/ puis recharger Nginx si nécessaire.

## 7. Vérification attendue

Le site doit charger :
- la page d’accueil
- les routes SPA comme /admin, /commander, /commande-confirmee
- les appels API doivent continuer à passer via /api