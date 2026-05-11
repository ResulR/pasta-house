# Checklist Stripe go-live — Pasta House

Ce document sert à préparer la bascule Stripe en mode live.

Important : ce document ne déclenche aucune bascule technique.  
La bascule réelle devra être faite plus tard en remplaçant les clés test par les clés live dans l’environnement serveur, puis en configurant un webhook Stripe live.

## Statut actuel

Statut connu au moment de la création de ce document :

- Stripe est encore utilisé en mode test côté VPS.
- Le webhook Stripe test fonctionne.
- Une commande test a déjà été validée avec succès.
- Le passage en live n’est pas encore fait.
- Le dashboard Stripe affiche actuellement : `Virements en pause`.
- Le dashboard Stripe indique : `Une tâche obligatoire est en retard`.
- Conclusion : le compte Stripe live n’est pas encore prêt pour une bascule propre.

## Objectif

Avant de passer Stripe en live, il faut vérifier que le compte Stripe est prêt administrativement.

Basculer trop tôt peut causer des problèmes :

- paiements bloqués
- fonds gelés
- impossibilité de recevoir les virements
- informations fiscales incomplètes
- moyens de paiement non activés
- pages légales insuffisantes

## Checklist administrative Stripe

À vérifier dans le dashboard Stripe avant toute bascule live.

### 1. Compte Stripe live

Statut :

    À vérifier

Checklist :

- [ ] Le compte Stripe est activé pour le mode live.
- [ ] Le KYC est validé.
- [ ] Aucune alerte critique n’est affichée dans le dashboard Stripe.
- [ ] Stripe n’indique pas d’action obligatoire restante.

Notes :

    À compléter après vérification dans Stripe.

### 2. Informations bancaires

Statut :

    À vérifier

Checklist :

- [ ] L’IBAN de versement est renseigné.
- [ ] L’IBAN est vérifié par Stripe.
- [ ] Le calendrier de versement est compris.
- [ ] Le nom du titulaire du compte bancaire est cohérent avec l’entreprise ou l’activité déclarée.

Notes :

    À compléter après vérification dans Stripe.

### 3. Informations fiscales et entreprise

Statut :

    À vérifier

Checklist :

- [ ] L’adresse fiscale est renseignée.
- [ ] Le pays est correct.
- [ ] Le type d’activité est correct.
- [ ] Le numéro BCE est renseigné si applicable.
- [ ] Le numéro TVA est renseigné si applicable.
- [ ] Les informations légales correspondent aux pages du site.

Notes :

    À compléter après vérification dans Stripe.

### 4. Moyens de paiement

Statut :

    À décider

Checklist :

- [ ] Décision prise sur Bancontact : oui / non.
- [ ] Si Bancontact est souhaité, il est activé dans le dashboard Stripe live.
- [ ] Les moyens de paiement activés correspondent aux besoins du restaurant.
- [ ] Les moyens de paiement inutiles sont désactivés si nécessaire.

Décision Bancontact :

    Non décidé

Notes :

    À compléter.

### 5. Pages légales du site

Statut :

    À vérifier

Pages concernées :

- Mentions légales
- Conditions générales de vente
- Politique de confidentialité
- Politique ou conditions de remboursement

Checklist :

- [ ] La page de remboursement est présente et accessible.
- [ ] Les CGV expliquent clairement le fonctionnement des commandes.
- [ ] Les CGV mentionnent le paiement en ligne.
- [ ] Les CGV mentionnent Stripe comme processeur de paiement.
- [ ] Les informations du restaurant ou de l’entreprise sont correctes.
- [ ] L’adresse, le numéro BCE/TVA et les coordonnées sont complétés si applicables.
- [ ] Les pages ont été relues juridiquement ou validées par le responsable.

Notes :

    À compléter après vérification.

### 6. Webhook Stripe live

Statut :

    À faire plus tard, au moment de la bascule technique

Checklist :

- [ ] Un webhook live est créé dans le dashboard Stripe.
- [ ] URL du webhook live :

        https://pastahouses.com/api/public/stripe/webhook

- [ ] Événements live à écouter :

        checkout.session.completed
        checkout.session.async_payment_succeeded
        checkout.session.async_payment_failed

- [ ] Le secret webhook live `whsec_...` est récupéré.
- [ ] Le secret webhook live est mis dans `server/.env`.
- [ ] Le secret webhook test n’est pas réutilisé pour le live.

Notes :

    À compléter au moment de la bascule live.

### 7. Variables d’environnement à changer plus tard

Attention : ne pas changer maintenant.

Variables concernées côté serveur :

    STRIPE_SECRET_KEY
    STRIPE_WEBHOOK_SECRET

En mode test, `STRIPE_SECRET_KEY` commence par :

    sk_test_

En mode live, elle devra commencer par :

    sk_live_

Le webhook secret live commencera par :

    whsec_

Important :

- ne jamais afficher les secrets dans le terminal ou dans Git
- ne jamais commit le fichier `.env`
- après modification du `.env`, redémarrer le backend PM2
- faire un test réel avec un petit montant si possible

### 8. Tests techniques à faire après bascule live

À ne faire qu’après validation administrative complète.

Checklist technique post-bascule :

- [ ] Redémarrer `pasta-house-server`.
- [ ] Vérifier `/api/health`.
- [ ] Vérifier que les commandes sont ouvertes uniquement pendant le test.
- [ ] Faire une vraie commande live avec petit montant.
- [ ] Vérifier le retour Stripe Checkout.
- [ ] Vérifier le webhook live.
- [ ] Vérifier que la commande passe en `paid`.
- [ ] Vérifier l’email client.
- [ ] Vérifier l’email admin.
- [ ] Vérifier le suivi public de commande.
- [ ] Refermer les commandes si le site n’est pas encore officiellement ouvert.

## Critère de validation du point 14

Le point 14 est validé quand :

- toutes les cases administratives nécessaires sont vérifiées dans Stripe
- la décision Bancontact est prise
- les pages légales sont présentes et cohérentes
- ce document est complété avec les statuts réels
- aucune bascule live n’a été faite par accident

## Statut actuel du point 14

Statut :

    Documentation créée, vérifications Stripe à faire manuellement.

