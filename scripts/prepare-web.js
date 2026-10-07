const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const outDir = path.resolve(rootDir, 'www');

console.log('[ITAMYA BUILD] Préparation des fichiers web pour Capacitor/PWA...');

// 1. Nettoyer ou créer le dossier www
if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

// 2. Éléments à copier
const itemsToCopy = [
    'index.html',
    'menu.html',
    'cart.html',
    'order.html',
    'confirmation.html',
    'login.html',
    'register.html',
    'forgot-password.html',
    'blog.html',
    'manifest.json',
    'sw.js',
    '.well-known',
    'assets',
    'admin',
    'client',
    'superadmin'
];

for (const item of itemsToCopy) {
    const src = path.join(rootDir, item);
    const dest = path.join(outDir, item);

    if (fs.existsSync(src)) {
        const stat = fs.statSync(src);
        if (stat.isDirectory()) {
            fs.cpSync(src, dest, { recursive: true });
            console.log(`  ✓ Dossier copié: ${item}`);
        } else {
            fs.copyFileSync(src, dest);
            console.log(`  ✓ Fichier copié: ${item}`);
        }
    } else {
        console.log(`  - Non trouvé (ignoré): ${item}`);
    }
}

console.log('[ITAMYA BUILD] Terminé avec succès. Fichiers prêts dans /www.');
