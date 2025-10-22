# ============================================================================
# Azure Web App Configuration Script
# Nastavenie environment variables pre Microhack aplikáciu
# ============================================================================

# FARBY pre output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

# ============================================================================
# KONFIGURÁCIA - UPRAVTE TIETO HODNOTY
# ============================================================================

$APP_NAME = "microhack-dev-app"
$RESOURCE_GROUP = "microhack-rg"  # <-- UPRAVTE NA VÁŠ RESOURCE GROUP

# MySQL Configuration
$MYSQL_HOST = "your-mysql-server.mysql.database.azure.com"  # <-- UPRAVTE
$MYSQL_DATABASE = "microhack"
$MYSQL_USER = "microhackadmin"  # <-- UPRAVTE
$MYSQL_PASSWORD = "YourSecurePassword123!"  # <-- UPRAVTE
$MYSQL_PORT = "3306"

# Azure Storage Configuration
$AZURE_STORAGE_ACCOUNT = "microhackstorage"  # <-- UPRAVTE
$AZURE_STORAGE_KEY = "your-storage-account-key-here"  # <-- UPRAVTE
$AZURE_STORAGE_CONTAINER = "microhack-documents"

# Alebo použite Connection String namiesto Account + Key
$AZURE_STORAGE_CONNECTION_STRING = ""  # <-- Voliteľné: môžete použiť connection string

# ============================================================================
# AUTOMATICKÁ DETEKCIA RESOURCE GROUP (ak nie je nastavená)
# ============================================================================

Write-Info "`n🔍 Zisťujem Resource Group pre aplikáciu '$APP_NAME'..."

if ($RESOURCE_GROUP -eq "microhack-rg") {
    try {
        $detected_rg = az webapp show --name $APP_NAME --query resourceGroup -o tsv 2>$null
        if ($detected_rg) {
            $RESOURCE_GROUP = $detected_rg
            Write-Success "✅ Resource Group detekovaná: $RESOURCE_GROUP"
        }
    } catch {
        Write-Warning "⚠️  Nepodarilo sa automaticky detekovať Resource Group"
        Write-Warning "   Upravte premennú RESOURCE_GROUP v skripte"
    }
}

# ============================================================================
# OVERENIE PRIHLÁSENIA DO AZURE
# ============================================================================

Write-Info "`n🔐 Overujem prihlásenie do Azure..."

try {
    $account = az account show 2>$null | ConvertFrom-Json
    if ($account) {
        Write-Success "✅ Prihlásený ako: $($account.user.name)"
        Write-Success "   Subscription: $($account.name)"
    }
} catch {
    Write-Error "❌ Nie ste prihlásený do Azure CLI"
    Write-Info "   Spustite: az login"
    exit 1
}

# ============================================================================
# OVERENIE EXISTENCIE WEB APP
# ============================================================================

Write-Info "`n🔍 Overujem existenciu Web App '$APP_NAME'..."

try {
    $webapp = az webapp show --name $APP_NAME --resource-group $RESOURCE_GROUP 2>$null | ConvertFrom-Json
    if ($webapp) {
        Write-Success "✅ Web App nájdená: $($webapp.defaultHostName)"
    }
} catch {
    Write-Error "❌ Web App '$APP_NAME' nenájdená v resource group '$RESOURCE_GROUP'"
    Write-Info "   Skontrolujte názvy v skripte"
    exit 1
}

# ============================================================================
# NASTAVENIE ENVIRONMENT VARIABLES
# ============================================================================

Write-Info "`n⚙️  Nastavujem Environment Variables..."

# Základné nastavenia
$settings = @{
    "NODE_ENV" = "production"
    "DATABASE_TYPE" = "mysql"
    "STORAGE_TYPE" = "azure"
    "CORS_ORIGIN" = "*"
}

# MySQL nastavenia
$settings["MYSQL_HOST"] = $MYSQL_HOST
$settings["MYSQL_DATABASE"] = $MYSQL_DATABASE
$settings["MYSQL_USER"] = $MYSQL_USER
$settings["MYSQL_PASSWORD"] = $MYSQL_PASSWORD
$settings["MYSQL_PORT"] = $MYSQL_PORT
$settings["MYSQL_SSL"] = "true"

# Azure Storage nastavenia
if ($AZURE_STORAGE_CONNECTION_STRING) {
    # Ak máte connection string, použite ten
    $settings["AZURE_STORAGE_CONNECTION_STRING"] = $AZURE_STORAGE_CONNECTION_STRING
} else {
    # Inak použite Account + Key
    $settings["AZURE_STORAGE_ACCOUNT"] = $AZURE_STORAGE_ACCOUNT
    $settings["AZURE_STORAGE_KEY"] = $AZURE_STORAGE_KEY
}
$settings["AZURE_STORAGE_CONTAINER"] = $AZURE_STORAGE_CONTAINER

# Vytvorenie JSON pre settings
$settingsJson = @()
foreach ($key in $settings.Keys) {
    $settingsJson += "$key=$($settings[$key])"
}

Write-Info "Nastavujem tieto premenné:"
foreach ($key in $settings.Keys) {
    if ($key -match "PASSWORD|KEY|CONNECTION_STRING") {
        Write-Info "  - $key = ********"
    } else {
        Write-Info "  - $key = $($settings[$key])"
    }
}

# Nastavenie cez Azure CLI
try {
    $cmd = "az webapp config appsettings set --name $APP_NAME --resource-group $RESOURCE_GROUP --settings $($settingsJson -join ' ')"
    Write-Info "`nSpúšťam príkaz..."
    
    Invoke-Expression $cmd | Out-Null
    
    Write-Success "`n✅ Environment variables úspešne nastavené!"
} catch {
    Write-Error "❌ Chyba pri nastavovaní environment variables: $_"
    exit 1
}

# ============================================================================
# NASTAVENIE STARTUP COMMAND
# ============================================================================

Write-Info "`n⚙️  Nastavujem Startup Command..."

try {
    az webapp config set `
        --name $APP_NAME `
        --resource-group $RESOURCE_GROUP `
        --startup-file "node server.js" `
        --output none
    
    Write-Success "✅ Startup command nastavený: node server.js"
} catch {
    Write-Warning "⚠️  Nepodarilo sa nastaviť startup command (môže byť už nastavený)"
}

# ============================================================================
# NASTAVENIE APPLICATION LOGGING
# ============================================================================

Write-Info "`n📝 Zapínam Application Logging..."

try {
    az webapp log config `
        --name $APP_NAME `
        --resource-group $RESOURCE_GROUP `
        --application-logging filesystem `
        --detailed-error-messages true `
        --failed-request-tracing true `
        --web-server-logging filesystem `
        --level verbose `
        --output none
    
    Write-Success "✅ Application logging zapnuté"
} catch {
    Write-Warning "⚠️  Nepodarilo sa zapnúť logging"
}

# ============================================================================
# REŠTART APLIKÁCIE
# ============================================================================

Write-Info "`n🔄 Reštartujem aplikáciu..."

try {
    az webapp restart --name $APP_NAME --resource-group $RESOURCE_GROUP --output none
    Write-Success "✅ Aplikácia reštartovaná"
} catch {
    Write-Error "❌ Nepodarilo sa reštartovať aplikáciu"
}

# ============================================================================
# OVERENIE KONFIGURÁCIE
# ============================================================================

Write-Info "`n🔍 Overujem nastavenia..."

Start-Sleep -Seconds 5

try {
    $currentSettings = az webapp config appsettings list `
        --name $APP_NAME `
        --resource-group $RESOURCE_GROUP | ConvertFrom-Json
    
    Write-Success "`n✅ Aktuálne nastavené environment variables:"
    foreach ($setting in $currentSettings) {
        if ($setting.name -match "PASSWORD|KEY|CONNECTION_STRING") {
            Write-Info "  ✓ $($setting.name) = ********"
        } else {
            Write-Info "  ✓ $($setting.name) = $($setting.value)"
        }
    }
} catch {
    Write-Warning "⚠️  Nepodarilo sa overiť nastavenia"
}

# ============================================================================
# HEALTH CHECK
# ============================================================================

Write-Info "`n🏥 Čakám na spustenie aplikácie (30s)..."
Start-Sleep -Seconds 30

Write-Info "Testujem Health Check endpoint..."

$healthUrl = "https://$APP_NAME.azurewebsites.net/api/health"

try {
    $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 10
    $healthData = $response.Content | ConvertFrom-Json
    
    Write-Success "`n✅ Health Check úspešný!"
    Write-Info "Status: $($healthData.status)"
    Write-Info "Database: $($healthData.environment.database)"
    Write-Info "Storage: $($healthData.environment.storage)"
    Write-Info "Node Version: $($healthData.environment.nodeVersion)"
} catch {
    Write-Warning "`n⚠️  Health check zlyhal (aplikácia sa možno ešte spúšťa)"
    Write-Info "Skúste manuálne o chvíľu: $healthUrl"
}

# ============================================================================
# ZOBRAZENIE LOGOV
# ============================================================================

Write-Info "`n📋 Chcete zobraziť live logy? (y/n)"
$showLogs = Read-Host

if ($showLogs -eq "y" -or $showLogs -eq "Y") {
    Write-Info "`n📜 Zobrazujem live logy (Ctrl+C pre ukončenie)...`n"
    az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP
} else {
    Write-Info "`nMôžete zobraziť logy príkazom:"
    Write-Info "az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP"
}

# ============================================================================
# SÚHRN
# ============================================================================

Write-Success "`n╔════════════════════════════════════════════════════════════════╗"
Write-Success   "║                    ✅ KONFIGURÁCIA DOKONČENÁ                    ║"
Write-Success   "╚════════════════════════════════════════════════════════════════╝"

Write-Info "`n📋 ĎALŠIE KROKY:"
Write-Info "1. Overte aplikáciu: https://$APP_NAME.azurewebsites.net"
Write-Info "2. Health check:     https://$APP_NAME.azurewebsites.net/api/health"
Write-Info "3. Skontrolujte logy v Azure Portal"
Write-Info ""
Write-Info "🔧 UŽITOČNÉ PRÍKAZY:"
Write-Info "  Logy:      az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP"
Write-Info "  SSH:       az webapp ssh --name $APP_NAME --resource-group $RESOURCE_GROUP"
Write-Info "  Reštart:   az webapp restart --name $APP_NAME --resource-group $RESOURCE_GROUP"
Write-Info ""
