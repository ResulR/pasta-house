# Procédure de restauration PostgreSQL — Pasta House

Ce document explique comment vérifier, tester et restaurer les backups PostgreSQL du projet Pasta House.

## 1. Base concernée

La base sauvegardée est uniquement :

    pasta_house

La base LocalFood ne doit pas être incluse dans ces backups.

## 2. Emplacement des backups

Les backups locaux sont stockés sur le VPS dans :

    /var/backups/pasta-house/postgres

Les fichiers ont un nom de ce type :

    pasta_house-YYYYMMDD-HHMMSS.dump

Exemple réel testé :

    pasta_house-20260511-141125.dump

## 3. Backup quotidien automatique

Service systemd :

    backup-pastahouse.service

Timer systemd :

    backup-pastahouse.timer

Rôle :

- créer un dump PostgreSQL de la base pasta_house
- stocker le dump dans /var/backups/pasta-house/postgres
- garder les backups locaux pendant 14 jours

Horaire :

    01:00 UTC

Cela correspond environ à 03:00 heure de Bruxelles pendant l’heure d’été.

## 4. Vérification hebdomadaire automatique

Service systemd :

    verify-pastahouse-backup.service

Timer systemd :

    verify-pastahouse-backup.timer

Rôle :

- prendre le dernier dump disponible
- créer une base temporaire appelée pasta_house_restore_test
- restaurer le dump dans cette base temporaire
- vérifier que les tables sont restaurées
- vérifier le nombre de commandes dans orders
- comparer le nombre de commandes entre la base actuelle et le backup restauré
- supprimer la base temporaire
- envoyer un rapport email à l’adresse admin configurée dans ADMIN_NOTIFICATION_EMAIL

Horaire :

    Lundi à 06:00 UTC

Cela correspond environ à 08:00 heure de Bruxelles pendant l’heure d’été.

## 5. Vérifier les backups disponibles

Commande :

    sudo ls -lh /var/backups/pasta-house/postgres

Cette commande affiche les dumps disponibles, leur taille et leur date.

Un backup valide doit avoir une taille supérieure à 0.

## 6. Voir le backup le plus récent

Commande :

    sudo ls -lt /var/backups/pasta-house/postgres | head

Le fichier le plus récent doit apparaître en haut de la liste.

## 7. Vérifier que le backup quotidien est actif

Commande :

    systemctl status backup-pastahouse.timer --no-pager

Résultat attendu :

    Active: active (waiting)

## 8. Voir la prochaine exécution du backup quotidien

Commande :

    systemctl list-timers --all | grep backup-pastahouse

## 9. Lancer un backup manuel

Commande :

    sudo systemctl start backup-pastahouse.service

Puis vérifier que le dump a été créé :

    sudo ls -lh /var/backups/pasta-house/postgres

## 10. Voir les logs du backup

Commande :

    journalctl -u backup-pastahouse.service --no-pager -n 50

Un résultat positif doit indiquer qu’un backup a été créé.

Exemple :

    Backup created: /var/backups/pasta-house/postgres/pasta_house-YYYYMMDD-HHMMSS.dump
    Backup size bytes: XXXXX

## 11. Vérifier que le rapport hebdomadaire est actif

Commande :

    systemctl status verify-pastahouse-backup.timer --no-pager

Résultat attendu :

    Active: active (waiting)

## 12. Voir la prochaine vérification hebdomadaire

Commande :

    systemctl list-timers --all | grep verify-pastahouse-backup

## 13. Lancer une vérification restore manuelle

Commande :

    sudo systemctl start verify-pastahouse-backup.service

Puis lire le résultat :

    sudo systemctl status verify-pastahouse-backup.service --no-pager -l
    journalctl -u verify-pastahouse-backup.service --no-pager -n 80

Cette vérification doit :

- restaurer le dernier backup dans une base temporaire
- vérifier les tables
- compter les commandes
- supprimer la base temporaire
- envoyer un rapport email

## 14. Vérifier que la base temporaire a été supprimée

Commande :

    sudo -u postgres psql -tAc "SELECT datname FROM pg_database WHERE datname = 'pasta_house_restore_test';"

Résultat attendu :

    aucun résultat

Si pasta_house_restore_test apparaît, la base temporaire n’a pas été supprimée et il faut investiguer.

## 15. Tester une restauration manuelle sans toucher à la production

Cette procédure restaure un dump dans une base temporaire.

Elle ne touche pas à la vraie base pasta_house.

Étape 1 — choisir le dernier dump :

    LATEST_DUMP="$(sudo find /var/backups/pasta-house/postgres -type f -name 'pasta_house-*.dump' -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)"
    echo "$LATEST_DUMP"
    sudo ls -lh "$LATEST_DUMP"

Étape 2 — supprimer l’ancienne base temporaire si elle existe :

    sudo -u postgres dropdb --if-exists pasta_house_restore_test

Étape 3 — créer la base temporaire :

    sudo -u postgres createdb pasta_house_restore_test

Étape 4 — restaurer le dump dans la base temporaire :

    sudo bash -c 'runuser -u postgres -- pg_restore --dbname=pasta_house_restore_test --no-owner --no-acl < "$1"' _ "${LATEST_DUMP:?Tu dois d'abord exécuter l'étape 1 pour définir LATEST_DUMP}"

Étape 5 — vérifier les tables restaurées :

    sudo -u postgres psql -d pasta_house_restore_test -c "\dt"

Étape 6 — vérifier le nombre de commandes restaurées :

    sudo -u postgres psql -d pasta_house_restore_test -c "SELECT COUNT(*) AS restored_orders_count FROM orders;"

Étape 7 — comparer avec la vraie base :

    cd /home/debian/apps/pasta-house

    set -a
    source server/.env
    set +a

    PGPASSWORD="$DB_PASSWORD" psql \
      -h "$DB_HOST" \
      -p "$DB_PORT" \
      -U "$DB_USER" \
      -d "$DB_NAME" \
      -c "SELECT COUNT(*) AS live_orders_count FROM orders;"

Étape 8 — supprimer la base temporaire :

    sudo -u postgres dropdb --if-exists pasta_house_restore_test

Étape 9 — confirmer que la base temporaire est supprimée :

    sudo -u postgres psql -tAc "SELECT datname FROM pg_database WHERE datname = 'pasta_house_restore_test';"

Résultat attendu :

    aucun résultat

## 16. Résultat du test réel effectué

Le test réel effectué le 11/05/2026 a validé :

    Statut : OK
    Dernier dump testé : pasta_house-20260511-141125.dump
    Taille : 61601 bytes
    Tables restaurées : 15
    Commandes dans la base actuelle : 7
    Commandes dans le backup restauré : 7
    Temps de restauration / vérification estimé : moins d'une minute
    Base temporaire supprimée après test : oui
    Email de rapport reçu : oui

RTO observé :

    moins d'une minute

Objectif de restauration :

    moins de 30 minutes

Le test respecte donc l’objectif.

## 17. Que faire si le rapport email indique OK

Si le rapport indique :

    Statut global : OK
    Action requise : aucune

Alors le dernier backup a été restauré avec succès dans une base temporaire.

Aucune action n’est nécessaire.

## 18. Que faire si le rapport email n’arrive pas

Vérifier d’abord le timer :

    systemctl status verify-pastahouse-backup.timer --no-pager
    systemctl list-timers --all | grep verify-pastahouse-backup

Puis vérifier les logs :

    journalctl -u verify-pastahouse-backup.service --no-pager -n 100

Vérifier aussi les spams de la boîte email admin.

## 19. Que faire si la vérification échoue

Lire les logs :

    journalctl -u verify-pastahouse-backup.service --no-pager -n 100

Ne pas restaurer la vraie base directement.

Causes possibles :

- aucun dump disponible
- dump vide
- permission de lecture du dump incorrecte
- erreur PostgreSQL pendant pg_restore
- table orders absente dans le backup
- problème d’envoi email Resend
- base temporaire déjà présente ou bloquée

## 20. Restaurer la vraie base en urgence

Attention : cette partie est dangereuse.

Restaurer la vraie base pasta_house peut écraser les données actuelles du site.

Il ne faut pas le faire sans validation claire.

Avant toute restauration en production, il faut au minimum :

1. prévenir que le site doit être mis en maintenance ou commandes fermées
2. arrêter temporairement le backend Pasta House
3. faire un backup de sécurité de l’état actuel
4. restaurer le dump choisi
5. redémarrer le backend
6. tester l’API, le menu, l’admin et les commandes

Ne jamais lancer une restauration de production sans backup de sécurité juste avant.

## 21. Limite actuelle importante

Les backups sont actuellement stockés localement sur le VPS.

Cela protège contre :

- erreur SQL
- suppression accidentelle
- mauvaise migration
- bug applicatif

Cela ne protège pas complètement contre :

- panne disque du VPS
- suppression complète du serveur
- piratage du VPS
- suspension du compte hébergeur

Une copie off-site reste à mettre en place plus tard.
