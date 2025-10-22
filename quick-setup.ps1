# ============================================================================
# QUICK SETUP - Jeden príkaz pre nastavenie všetkých environment variables
# ============================================================================
# 
# INŠTRUKCIE:
# 1. Upravte hodnoty nižšie podľa vašej konfigurácie
# 2. Skopírujte celý príkaz (všetky riadky až po koniec)
# 3. Vložte do PowerShell a spustite
#
# ============================================================================

# 🔧 UPRAVTE TIETO HODNOTY:
# ============================================================================

$APP_NAME = "microhack-dev-app"
$RESOURCE_GROUP = "microhack-rg"  # <-- ZMEŇTE

# MySQL Configuration (upravte všetky hodnoty)
$MYSQL_HOST = "your-server.mysql.database.azure.com"  # <-- ZMEŇTE
$MYSQL_USER = "microhackadmin"  # <-- ZMEŇTE
$MYSQL_PASSWORD = "YourPassword123!"  # <-- ZMEŇTE
$MYSQL_DATABASE = "microhack"

# Azure Storage (upravte všetky hodnoty)
$AZURE_STORAGE_ACCOUNT = "microhackstorage"  # <-- ZMEŇTE
$AZURE_STORAGE_KEY = "your-storage-key-here"  # <-- ZMEŇTE

# ============================================================================
# AUTOMATICKÁ KONFIGURÁCIA - NEKOPÍRUJTE VO SVOJOM EDITORE
# ============================================================================

Write-Host "🚀 Nastavujem Azure Web App..." -ForegroundColor Cyan

# Nastavenie všetkých environment variables jedným príkazom
az webapp config appsettings set `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --settings `
    NODE_ENV=production `
    DATABASE_TYPE=mysql `
    STORAGE_TYPE=azure `
    CORS_ORIGIN=* `
    MYSQL_HOST=$MYSQL_HOST `
    MYSQL_DATABASE=$MYSQL_DATABASE `
    MYSQL_USER=$MYSQL_USER `
    MYSQL_PASSWORD=$MYSQL_PASSWORD `
    MYSQL_PORT=3306 `
    MYSQL_SSL=true `
    AZURE_STORAGE_ACCOUNT=$AZURE_STORAGE_ACCOUNT `
    AZURE_STORAGE_KEY=$AZURE_STORAGE_KEY `
    AZURE_STORAGE_CONTAINER=microhack-documents `
  --output none

if ($?) {
    Write-Host "✅ Settings nastavené!" -ForegroundColor Green
    
    # Nastavenie startup command
    Write-Host "⚙️  Nastavujem startup command..." -ForegroundColor Cyan
    az webapp config set `
      --name $APP_NAME `
      --resource-group $RESOURCE_GROUP `
      --startup-file "node server.js" `
      --output none
    
    # Zapnutie logging
    Write-Host "📝 Zapínam logging..." -ForegroundColor Cyan
    az webapp log config `
      --name $APP_NAME `
      --resource-group $RESOURCE_GROUP `
      --application-logging filesystem `
      --level verbose `
      --output none
    
    # Reštart
    Write-Host "🔄 Reštartujem aplikáciu..." -ForegroundColor Cyan
    az webapp restart --name $APP_NAME --resource-group $RESOURCE_GROUP --output none
    
    Write-Host "`n✅ HOTOVO!" -ForegroundColor Green
    Write-Host "Čakám 30s na spustenie a testujem health check..." -ForegroundColor Cyan
    Start-Sleep -Seconds 30
    
    $healthUrl = "https://$APP_NAME.azurewebsites.net/api/health"
    try {
        $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 10
        Write-Host "`n🎉 Aplikácia beží!" -ForegroundColor Green
        Write-Host "Status: $($response.status)" -ForegroundColor Green
        Write-Host "Database: $($response.environment.database)" -ForegroundColor Green
        Write-Host "Storage: $($response.environment.storage)" -ForegroundColor Green
        Write-Host "`nURL: https://$APP_NAME.azurewebsites.net" -ForegroundColor Cyan
    } catch {
        Write-Host "`n⚠️  Health check zlyhal, ale nastavenia sú uložené." -ForegroundColor Yellow
        Write-Host "Skontrolujte logy:" -ForegroundColor Cyan
        Write-Host "az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP" -ForegroundColor White
    }
} else {
    Write-Host "❌ Chyba pri nastavovaní" -ForegroundColor Red
}
