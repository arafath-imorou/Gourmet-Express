# Script de compilation Android ITAMYA pour Windows
# Conçu par ITA INNOVATE

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   ITAMYA - Compilation Android Native (APK & AAB)        " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

# 1. Vérification de Node.js et synchronisation Capacitor
Write-Host "`n[1/4] Synchronisation des fichiers web vers Capacitor..." -ForegroundColor Yellow
$env:Path = "C:\Program Files\nodejs;C:\Users\LENOVO X13\AppData\Local\Programs\Git\cmd;" + $env:Path
Set-Location $projectRoot
npm run cap:sync

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERREUR] Échec de la synchronisation Capacitor." -ForegroundColor Red
    exit 1
}

# 2. Détection automatique de Java / JDK
Write-Host "`n[2/4] Recherche de Java / JDK..." -ForegroundColor Yellow
$javaFound = $false

$potentialJavaPaths = @(
    $env:JAVA_HOME,
    "C:\Program Files\Android\Android Studio\jbr",
    "C:\Program Files\Android\Android Studio\jre",
    "C:\Program Files\Java\jdk-17*",
    "C:\Program Files\Eclipse Adoptium\jdk-17*",
    "C:\Program Files\Microsoft\jdk-17*"
)

foreach ($p in $potentialJavaPaths) {
    if ($p -and (Test-Path $p)) {
        $resolved = (Resolve-Path $p)[0].Path
        if (Test-Path "$resolved\bin\java.exe") {
            $env:JAVA_HOME = $resolved
            $env:Path = "$resolved\bin;" + $env:Path
            $javaFound = $true
            Write-Host "  ✓ JAVA_HOME détecté : $resolved" -ForegroundColor Green
            break
        }
    }
}

if (-not $javaFound) {
    # Tester si java est dans le PATH
    $cmd = Get-Command java -ErrorAction SilentlyContinue
    if ($cmd) {
        $javaFound = $true
        Write-Host "  ✓ Commande java trouvée dans le PATH" -ForegroundColor Green
    }
}

if (-not $javaFound) {
    Write-Host "`n[INFO] Aucun JDK 17 local configuré dans JAVA_HOME." -ForegroundColor Yellow
    Write-Host "Pour compiler directement en local sur votre machine :" -ForegroundColor White
    Write-Host "  1. Ouvrez Android Studio (gratuit) : npx cap open android" -ForegroundColor White
    Write-Host "  2. Cliquez sur 'Build > Generate Signed Bundle / APK' dans le menu." -ForegroundColor White
    Write-Host "OU utilisez le pipeline automatique GitHub Actions inclus (.github/workflows/build-android.yml) qui génère l'APK et l'AAB en un clic dans le cloud." -ForegroundColor Green
    exit 0
}

# 3. Compilation Gradle
Write-Host "`n[3/4] Lancement de la compilation Gradle..." -ForegroundColor Yellow
Set-Location "$projectRoot\android"

Write-Host "  -> Compilation Debug APK..." -ForegroundColor Cyan
.\gradlew.bat assembleDebug

Write-Host "  -> Compilation Release Bundle (AAB)..." -ForegroundColor Cyan
.\gradlew.bat bundleRelease

# 4. Copie des livrables finaux
Set-Location $projectRoot
$apkSrc = "android\app\build\outputs\apk\debug\app-debug.apk"
$aabSrc = "android\app\build\outputs\bundle\release\app-release.aab"

if (Test-Path $apkSrc) {
    Copy-Item $apkSrc -Destination "ITAMYA-debug.apk" -Force
    Write-Host "`n  ✓ Livrable généré : ITAMYA-debug.apk" -ForegroundColor Green
}

if (Test-Path $aabSrc) {
    Copy-Item $aabSrc -Destination "ITAMYA-release.aab" -Force
    Write-Host "  ✓ Livrable généré : ITAMYA-release.aab (Format Google Play Store)" -ForegroundColor Green
}

Write-Host "`n[TERMINÉ] Opération achevée avec succès !" -ForegroundColor Cyan
