# GUIDE DE DÉPLOIEMENT ANDROID & GOOGLE PLAY STORE - ITAMYA

> **Application** : ITAMYA (Commande & Livraison Gastronomique au Bénin)  
> **Identifiant Android (Package ID)** : `bj.itamya.app`  
> **Développé et Propulsé par** : ITA INNOVATE (www.itainnovate.com)  
> **Version initiale** : `1.0.0` (Version Code : `1`)

---

## 1. ARCHITECTURE HYBRIDE WEB + MOBILE

L'application mobile ITAMYA repose sur une architecture moderne utilisant **Capacitor** pour encapsuler la plateforme web existante dans un conteneur natif Android haute performance.

```text
                                ITAMYA
                                   │
               ┌───────────────────┴───────────────────┐
               │                                       │
        VERSION WEB / PWA                       VERSION MOBILE ANDROID
               │                                       │
      HTML5 / CSS3 / Vanilla JS                  Capacitor 8.x
               │                                       │
       Navigateurs Mobiles & Desktop             Android Studio / Gradle (SDK 36)
               │                                       │
        Hébergement Web (Vercel)                 Google Play Store (.AAB)
               │                                       │
               └───────────────────┬───────────────────┘
                                   │
                         BACKEND & DONNÉES COMMUNS
                                   │
                         PostgreSQL Supabase
                      (Même base, Mêmes RLS,
                     Même système d'auth unifié)
                                   │
                        Paiements Mobile Money
                        (MTN MoMo, Moov, Celtiis)
```

### Principes respectés :
1. **Base de données unique** : Aucune deuxième base créée. L'application mobile consomme exactement les mêmes tables Supabase (`restaurants`, `categories`, `menu_items`, `restau_orders`, `restau_clients`, `restaurant_staff`).
2. **Authentification unifiée** : Les clients et gérants de restaurant se connectent avec leur email ou leur numéro de téléphone sur le Web comme sur l'application Android.
3. **Sécurité RLS intacte** : La clé publique Supabase (`anon`) est utilisée côté client. Les politiques de sécurité au niveau des lignes (Row Level Security) restent actives. La clé secrète Service Role n'est jamais exposée dans le binaire Android.
4. **Zéro régression Web** : Le site web existant continue de fonctionner de manière autonome sur PC, Mac et navigateurs mobiles.

---

## 2. PRÉREQUIS & ENVIRONNEMENT TECHNIQUE

Pour compiler l'application Android en local, vous avez besoin de :
- **Node.js** (v18, v20 ou v22+) et **npm**
- **Android Studio** (version Jellyfish, Koala ou supérieure)
  - SDK Android 34, 35 ou 36 installé via le SDK Manager
  - Android Build-Tools 34.x / 35.x
- **OpenJDK 17** (inclus nativement dans Android Studio sous le répertoire `jbr/`)
- **Git**

---

## 3. ARBORESCENCE DU PROJET ANDROID

Le projet est structuré comme suit :

```text
commande restau/
├── android/                         -> Projet natif Android Gradle complet
│   ├── app/
│   │   ├── build.gradle             -> Configuration compileSdk 36, versionName 1.0.0, signingConfigs
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml  -> Permissions (Internet, Réseau, Caméra, Notifications) & Deep Links
│   │   │   ├── assets/public/       -> Fichiers Web synchronisés pour l'application native
│   │   │   └── res/
│   │   │       ├── mipmap-*/        -> Icônes Android générées depuis le logo officiel ITAMYA
│   │   │       ├── drawable-*/      -> Splash screens portrait & paysage générés
│   │   │       └── values/strings.xml -> Nom public "ITAMYA"
│   ├── build.gradle                 -> Configuration Gradle au niveau racine
│   ├── gradlew & gradlew.bat        -> Wrapper Gradle multiplateforme
│   └── variables.gradle             -> Définition des versions de SDK (compileSdkVersion = 36)
├── assets/
│   ├── css/style.css                -> Design responsive & support des zones sûres (safe areas)
│   ├── js/mobile.js                 -> Pont Capacitor, gestion du bouton retour Android & réseau
│   └── images/                      -> Logo et icônes PWA (icon-192, icon-512, icon-maskable)
├── scripts/
│   ├── prepare-web.js               -> Script de synchronisation vers le dossier www/
│   ├── generate-icons.py            -> Script de génération de toutes les tailles d'icônes Android
│   └── build-android.ps1            -> Script de compilation automatisée sous Windows
├── .github/workflows/
│   └── build-android.yml            -> Pipeline GitHub Actions de compilation cloud automatique
├── capacitor.config.json            -> Configuration Capacitor (appId: bj.itamya.app, plugins)
├── manifest.json                    -> Manifeste Progressive Web App (PWA)
├── sw.js                            -> Service Worker de mise en cache hors-ligne
├── package.json                     -> Scripts npm et dépendances Capacitor
└── build-android.bat                -> Lanceur de compilation 1-clic pour Windows
```

---

## 4. COMMANDES DE CYCLE DE VIE & SYNCHRONISATION

### A. Installation des dépendances (si nouvelle machine)
```bash
npm install
```

### B. Synchronisation des modifications Web vers Android
À chaque fois que vous modifiez un fichier HTML, CSS ou JS du site web, exécutez la commande suivante pour mettre à jour l'application mobile :
```bash
npm run cap:sync
```
*Cette commande prépare le dossier `www/` puis copie l'ensemble des fichiers dans `android/app/src/main/assets/public/`.*

### C. Ouverture du projet dans Android Studio
```bash
npm run cap:open
# ou directement :
npx cap open android
```

---

## 5. GÉNÉRATION DES FICHIERS DE BUILD (APK & AAB)

Google Play Store exige impérativement le format **Android App Bundle (.aab)** pour toute nouvelle publication, tandis que le format **APK (.apk)** est utilisé pour les tests directs sur téléphone.

### Méthode 1 : Via Android Studio (Recommandée & Visuelle)
1. Ouvrez le projet avec la commande :
   ```bash
   npm run cap:open
   ```
2. Attendez que la synchronisation Gradle se termine dans Android Studio.
3. Pour tester immédiatement :
   - Branchez votre smartphone Android en mode Débogage USB (ou lancez un émulateur).
   - Cliquez sur le bouton vert **Run (Play)** en haut à droite.
4. Pour générer l'APK de test :
   - Menu : **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
   - Le fichier est produit dans : `android/app/build/outputs/apk/debug/app-debug.apk`.
5. Pour générer l'AAB pour le Google Play Store :
   - Menu : **Build > Generate Signed Bundle / APK...**
   - Sélectionnez **Android App Bundle**.
   - Choisissez ou créez votre Keystore de signature.
   - Sélectionnez la variante **release**.
   - Cliquez sur **Finish**. Le fichier `app-release.aab` est généré.

### Méthode 2 : En ligne de commande
Depuis la racine du projet :
```bash
# Compiler l'APK de test :
cd android
./gradlew assembleDebug

# Compiler le bundle de release pour le Play Store :
./gradlew bundleRelease
```
*Sur Windows, utilisez `.\gradlew.bat` à la place de `./gradlew`.*

### Méthode 3 : Compilation Automatique dans le Cloud (GitHub Actions)
Un workflow GitHub Actions prêt à l'emploi est inclus dans `.github/workflows/build-android.yml`.
1. Poussez votre code sur la branche `main` du dépôt GitHub.
2. Rendez-vous sur l'onglet **Actions** de votre dépôt GitHub.
3. Le workflow compile automatiquement le projet sous Linux avec Java 17 et le SDK Android.
4. Téléchargez directement les fichiers produits dans la section **Artifacts** :
   - `ITAMYA-debug-apk`
   - `ITAMYA-release-aab`

---

## 6. SIGNATURE NUMÉRIQUE POUR LE GOOGLE PLAY STORE

Pour publier sur Google Play, votre application doit être signée avec une clé de production privée (Keystore).

### Étape 1 : Créer le Keystore de production
Exécutez cette commande dans votre terminal (ou utilisez l'assistant de création dans Android Studio) :
```bash
keytool -genkey -v -keystore itamya-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias itamya
```
Vous devez renseigner :
- Un mot de passe robuste pour le Keystore
- Vos informations d'organisation (ITA INNOVATE, Bénin)
- Un mot de passe pour l'alias de clé

> **ATTENTION DE SÉCURITÉ MAJEURE** :  
> - Conservez précieusement ce fichier `.jks` et ses mots de passe dans un gestionnaire sécurisé (Keepass, 1Password, etc.).  
> - Si vous perdez cette clé, vous ne pourrez plus jamais mettre à jour l'application sur le Play Store !  
> - Le fichier `.jks` est automatiquement ignoré par `.gitignore` et ne doit **jamais** être poussé sur GitHub.

### Étape 2 : Configurer la signature automatique (Optionnel)
Créez un fichier local `android/key.properties` (non versionné dans Git) :
```properties
storePassword=VOTRE_MOT_DE_PASSE_KEYSTORE
keyPassword=VOTRE_MOT_DE_PASSE_CLE
keyAlias=itamya
storeFile=../itamya-release-key.jks
```

---

## 7. PROCÉDURE DE PUBLICATION SUR GOOGLE PLAY CONSOLE

1. **Compte Développeur Google Play** :
   - Connectez-vous sur [play.google.com/console](https://play.google.com/console).
   - Cliquez sur **Créer une application**.
   - Nom de l'application : `ITAMYA`
   - Langue par défaut : `Français (France / Bénin)`
   - Type : `Application`
   - Gratuit / Payant : `Gratuit`
2. **Fiche de l'application (Détails de la boutique)** :
   - **Titre** : ITAMYA - Commandes & Restaurants
   - **Description courte** : Commandez vos plats préférés auprès des meilleurs restaurants du Bénin.
   - **Description complète** : Détaillez le service, la livraison à Parakou et au Bénin, le paiement sécurisé par Mobile Money (MTN MoMo, Moov Money, Celtiis Cash), la sélection rigoureuse de la Charte Qualité et l'ingénierie assurée par ITA INNOVATE.
   - **Icône de l'application** : Utilisez le fichier `android/playstore-icon.png` (512x512 PNG sans transparence de fond, fond sombre `#0f172a`).
   - **Graphique de fonctionnalités** : Image 1024x500 px.
   - **Captures d'écran** : Ajoutez au moins 4 captures d'écran de smartphones Android montrant la page d'accueil, la carte d'un restaurant, le panier et la confirmation de commande.
3. **Contenu de l'application** :
   - Questionnaire sur la classification du contenu (PEGI 3).
   - Déclaration de la politique de confidentialité (URL vers la page de confidentialité ITAMYA).
   - Public cible (Tout public / 18+).
   - Déclaration des fonctionnalités financières (application de commande en ligne avec intégration FedaPay).
4. **Création d'une version de production** :
   - Dans le menu de gauche, allez dans **Production** (ou **Test fermé / ouvert** pour valider en interne d'abord).
   - Cliquez sur **Créer une version**.
   - Activez **Signature d'application par Google Play (Play App Signing)**.
   - Uploadez votre fichier `ITAMYA-release.aab`.
   - Renseignez les notes de version :
     ```text
     Version 1.0.0
     - Lancement officiel de l'application ITAMYA au Bénin.
     - Commande en ligne auprès de nos restaurants partenaires certifiés.
     - Paiement sécurisé par Mobile Money (MTN, Moov, Celtiis).
     - Suivi de commande en temps réel et assistance client.
     ```
   - Cliquez sur **Examiner la version**, puis sur **Lancer le déploiement en production**.

---

## 8. GESTION DES VERSIONS ET MISES À JOUR FUTURES

Google Play Store refuse tout envoi dont le `versionCode` est inférieur ou égal à la version précédente.

Pour publier une mise à jour :
1. Ouvrez `android/app/build.gradle`.
2. Incrémentez le `versionCode` et mettez à jour le `versionName` :
   ```groovy
   defaultConfig {
       applicationId "bj.itamya.app"
       minSdkVersion rootProject.ext.minSdkVersion
       targetSdkVersion rootProject.ext.targetSdkVersion
       versionCode 2       // Ancien: 1 -> Nouveau: 2
       versionName "1.0.1" // Ancien: 1.0.0 -> Nouveau: 1.0.1
       ...
   }
   ```
3. Mettez également à jour le numéro de version dans `package.json`.
4. Synchronisez les fichiers web : `npm run cap:sync`.
5. Générez le nouvel AAB et uploadez-le sur la console Google Play.

---

## 9. FONCTIONNALITÉS NATIVES INTÉGRÉES

L'application intègre le module `assets/js/mobile.js` :
- **Gestion du bouton retour matériel Android** :
  - Ferme automatiquement les modales ouvertes (détails restaurant, lecteur de blog, modales d'ajout).
  - Permet de naviguer vers la page précédente de l'historique sans quitter brutalement l'application.
  - Sur la page d'accueil, demande une double pression ("Appuyez à nouveau pour quitter ITAMYA") avant de fermer l'application.
- **Détection réseau & Mode Hors-ligne** :
  - Un bandeau discret s'affiche en cas de coupure de connexion Internet.
  - Les pages clés restent consultables via le cache local.
  - La reconnexion est signalée automatiquement sans blocage.
- **Barre de navigation mobile inférieure (Bottom Navigation)** :
  - Boutons ergonomiques tactiles : *Accueil*, *Restaurants*, *Panier (avec compteur d'articles en direct)*, *Blog*, *Mon Compte / Admin*.
  - S'adapte automatiquement selon que l'utilisateur est un client connecté, un gérant ou un visiteur.
  - Masquée automatiquement sur ordinateur pour préserver l'affichage de bureau.
- **Deep Links** :
  - L'application est configurée pour ouvrir automatiquement les liens `https://itamya.com` ou `itamya://`.

---

## 10. SUPPORT ET MAINTENANCE

Pour toute assistance technique, évolution ou audit d'ingénierie logicielle sur la plateforme ITAMYA :
- **Équipe d'ingénierie** : ITA INNOVATE
- **Site officiel** : [www.itainnovate.com](http://www.itainnovate.com)
- **Support client ITAMYA** : +229 01 99 15 49 10
