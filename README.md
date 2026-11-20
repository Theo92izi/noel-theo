# 🎄 Le Noël de Théo — application privée de cadeaux

Application Vite/React + Supabase à déployer sur Vercel.

## Ce qui fonctionne

- 4 comptes par liens de connexion e-mail : Théo (propriétaire), Laurine, Maman et Dino (participantes).
- Théo ajoute, modifie, supprime ses cadeaux : photo via URL, lien produit, prix, priorité et description.
- Chacune peut **réserver** un cadeau ; un index unique en base garantit qu'il ne peut être réservé que par **une seule personne**.
- La personne ayant réservé peut le marquer **acheté**, ou le **libérer** (même après achat si elle s'est trompée).
- Les trois participantes voient **qui** a réservé et acheté ; Théo ne peut lire aucune réservation via les droits applicatifs de la base.
- Actualisation toutes les 5 secondes et au retour sur l'onglet (pas de temps réel absolu ; la protection contre les doubles réservations se fait en base).
- Photos de profils personnalisables ; avatar avec initiale en l'absence d'image.

## Mise en ligne — étapes complètes

### 1. Supabase (gratuit)

1. Ouvrir https://supabase.com/ et créer un projet.
2. Dans **SQL Editor**, ouvrir `supabase/setup.sql`.
3. À la fin du SQL, remplacer **les quatre adresses en `@example.com`** par les vraies adresses e-mail de Théo, Laurine, Maman, Dino. Utiliser des adresses en minuscules.
4. Exécuter le SQL. **Ces adresses sont indispensables** : seules elles pourront lire les cadeaux.
5. Dans **Authentication → Providers → Email**, activer la connexion par e-mail et laisser le lien magique / OTP disponible. Vérifier les modèles d'e-mails et les quotas : l'envoi de vrais e-mails peut nécessiter de configurer un SMTP pour un usage fiable.
6. Dans **Authentication → URL Configuration**, définir **Site URL** sur l'URL Vercel obtenue à l'étape 3 (ex. `https://noel-theo.vercel.app`) et ajouter cette même adresse dans **Redirect URLs** (sur un projet de test local : `http://localhost:5173`).
7. Dans **Project Settings → API Keys** (ou Connect), copier l'**URL du projet** et la **clé publishable/anon**. Ne jamais utiliser la clé `service_role` dans le site.

### 2. Prévisualiser en local (facultatif)

Installer Node.js LTS : https://nodejs.org/

```bash
npm install
cp .env.example .env
```

Compléter `.env` avec :

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxx
```

Puis :

```bash
npm run dev
```

Ouvrir http://localhost:5173. `npm run build` doit réussir.

### 3. Publier sur Vercel (gratuit pour ce petit usage personnel)

1. Créer un dépôt GitHub **privé** et y envoyer les fichiers du dossier (sans `.env`, déjà ignoré par `.gitignore`).
2. Sur https://vercel.com/ : **Add New → Project**, importer le dépôt.
3. Framework : Vite ; build `npm run build`, output `dist`.
4. **Environment Variables** : ajouter `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`, avec leurs vraies valeurs.
5. Cliquer sur **Deploy** ; copier l'URL `https://...vercel.app`.
6. Revenir dans Supabase pour configurer cette URL comme indiqué à l'étape 1.6.
7. Partager ce **même lien** aux trois participantes ; chacun entre sa propre adresse e-mail.

**Important :** un lien partagé ne suffit pas à accéder au contenu : il faut se connecter avec une adresse autorisée.

### 4. Mettre les avatars

Ajouter les fichiers ci-dessous dans `public/avatars/` puis envoyer les modifications sur GitHub pour déclencher un redéploiement Vercel :

- `laurine.png`
- `maman.png`
- `dino.png`
- `theo.png`

Les avatars de la conversation précédente ne sont pas intégrés dans cette archive. À défaut des fichiers, l'interface affiche l'initiale de chaque personne. Pour un autre nom ou format, modifier `avatar_url` dans `family_members`.

### 5. Ajouter des cadeaux

Se connecter avec l'adresse de Théo ; cliquer sur **Ajouter un cadeau**. Ajouter titre, description, lien produit, lien photo et prix. On peut ajouter un cadeau à n'importe quel moment et modifier la liste.

## Important sur confidentialité et sécurité

- Théo ne voit ni la personne ayant réservé, ni le statut « acheté », ni les réservations — la lecture de `gift_claims` lui est interdite par les règles RLS. Les participantes, elles, lisent les réservations de chacune.
- La réservation est exclusive grâce à `gift_claims.gift_id` en clé primaire. En cas de clics simultanés, une seule réservation réussit.
- Le propriétaire peut toujours supprimer un cadeau, ce qui supprime également la réservation associée. L'interface ne le prévient pas qu'il était réservé, afin de ne pas gâcher la surprise.
- **Les e-mails ne sont pas secrets**. L'accès dépend de l'authentification Supabase, de la sécurité des boîtes mail et de la liste blanche.
- Les URL externes des photos et des produits peuvent informer leurs hébergeurs des visites. Utiliser des images publiques uniquement.
- Pour une production plus robuste, activer protection contre les abus et SMTP adapté ; contrôler les coûts, quotas et politiques de confidentialité des services.
- Ne pas donner le rôle `owner` à une autre personne par erreur. Conserver l'accès au tableau de bord Supabase privé : un administrateur de la base peut techniquement voir les réservations, contrairement au compte propriétaire dans l'application.

## Mise à jour

Mettre à jour le code → commit/push sur GitHub → Vercel redéploie automatiquement. Les données restent en base Supabase.

## Coût

Des plans gratuits sont disponibles sur Supabase et Vercel, sous réserve de leurs conditions et quotas. Aucun achat de domaine n'est nécessaire ; utiliser l'adresse `*.vercel.app` fournie.
