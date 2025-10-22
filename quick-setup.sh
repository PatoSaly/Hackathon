#!/bin/bash

# ============================================================================
# QUICK SETUP - Jeden príkaz pre nastavenie všetkých environment variables
# ============================================================================
# 
# INŠTRUKCIE:
# 1. Upravte hodnoty nižšie podľa vašej konfigurácie
# 2. Uložte súbor
# 3. Spustite: chmod +x quick-setup.sh && ./quick-setup.sh
#
# ============================================================================

# 🔧 UPRAVTE TIETO HODNOTY:
# ============================================================================

APP_NAME="microhack-dev-app"
RESOURCE_GROUP="microhack-rg"  # <-- ZMEŇTE

# MySQL Configuration
MYSQL_HOST="your-server.mysql.database.azure.com"  # <-- ZMEŇTE
MYSQL_USER="microhackadmin"  # <-- ZMEŇTE
MYSQL_PASSWORD="YourPassword123!"  # <-- ZMEŇTE
MYSQL_DATABASE="microhack"

# Azure Storage
AZURE_STORAGE_ACCOUNT="microhackstorage"  # <-- ZMEŇTE
AZURE_STORAGE_KEY="your-storage-key-here"  # <-- ZMEŇTE

# ============================================================================
# AUTOMATICKÁ KONFIGURÁCIA
# ============================================================================

echo "🚀 Nastavujem Azure Web App..."

# Nastavenie všetkých environment variables jedným príkazom
az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    NODE_ENV=production \
    DATABASE_TYPE=mysql \
    STORAGE_TYPE=azure \
    CORS_ORIGIN=* \
    MYSQL_HOST=$MYSQL_HOST \
    MYSQL_DATABASE=$MYSQL_DATABASE \
    MYSQL_USER=$MYSQL_USER \
    MYSQL_PASSWORD=$MYSQL_PASSWORD \
    MYSQL_PORT=3306 \
    MYSQL_SSL=true \
    AZURE_STORAGE_ACCOUNT=$AZURE_STORAGE_ACCOUNT \
    AZURE_STORAGE_KEY=$AZURE_STORAGE_KEY \
    AZURE_STORAGE_CONTAINER=microhack-documents \
  --output none

if [ $? -eq 0 ]; then
    echo "✅ Settings nastavené!"
    
    # Nastavenie startup command
    echo "⚙️  Nastavujem startup command..."
    az webapp config set \
      --name $APP_NAME \
      --resource-group $RESOURCE_GROUP \
      --startup-file "node server.js" \
      --output none
    
    # Zapnutie logging
    echo "📝 Zapínam logging..."
    az webapp log config \
      --name $APP_NAME \
      --resource-group $RESOURCE_GROUP \
      --application-logging filesystem \
      --level verbose \
      --output none
    
    # Reštart
    echo "🔄 Reštartujem aplikáciu..."
    az webapp restart --name $APP_NAME --resource-group $RESOURCE_GROUP --output none
    
    echo ""
    echo "✅ HOTOVO!"
    echo "Čakám 30s na spustenie a testujem health check..."
    sleep 30
    
    HEALTH_URL="https://$APP_NAME.azurewebsites.net/api/health"
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)
    
    if [ "$RESPONSE" == "200" ]; then
        echo ""
        echo "🎉 Aplikácia beží!"
        curl -s $HEALTH_URL | jq .
        echo ""
        echo "URL: https://$APP_NAME.azurewebsites.net"
    else
        echo ""
        echo "⚠️  Health check zlyhal (HTTP $RESPONSE), ale nastavenia sú uložené."
        echo "Skontrolujte logy:"
        echo "az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP"
    fi
else
    echo "❌ Chyba pri nastavovaní"
fi
