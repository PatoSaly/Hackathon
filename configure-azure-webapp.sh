#!/bin/bash

# ============================================================================
# Azure Web App Configuration Script
# Nastavenie environment variables pre Microhack aplikáciu s MySQL a Azure Storage
# ============================================================================

# Farby pre output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ============================================================================
# KONFIGURÁCIA - UPRAVTE TIETO HODNOTY
# ============================================================================

APP_NAME="microhack-dev-app"
RESOURCE_GROUP="microhack-rg"  # <-- UPRAVTE NA VÁŠ RESOURCE GROUP

# MySQL Configuration
MYSQL_HOST="your-mysql-server.mysql.database.azure.com"  # <-- UPRAVTE
MYSQL_DATABASE="microhack"
MYSQL_USER="microhackadmin"  # <-- UPRAVTE
MYSQL_PASSWORD="YourSecurePassword123!"  # <-- UPRAVTE
MYSQL_PORT="3306"

# Azure Storage Configuration
AZURE_STORAGE_ACCOUNT="microhackstorage"  # <-- UPRAVTE
AZURE_STORAGE_KEY="your-storage-account-key-here"  # <-- UPRAVTE
AZURE_STORAGE_CONTAINER="microhack-documents"

# Alebo použite Connection String namiesto Account + Key
AZURE_STORAGE_CONNECTION_STRING=""  # <-- Voliteľné

# ============================================================================
# AUTOMATICKÁ DETEKCIA RESOURCE GROUP
# ============================================================================

echo -e "${CYAN}🔍 Zisťujem Resource Group pre aplikáciu '$APP_NAME'...${NC}"

if [ "$RESOURCE_GROUP" == "microhack-rg" ]; then
    DETECTED_RG=$(az webapp show --name $APP_NAME --query resourceGroup -o tsv 2>/dev/null)
    if [ ! -z "$DETECTED_RG" ]; then
        RESOURCE_GROUP=$DETECTED_RG
        echo -e "${GREEN}✅ Resource Group detekovaná: $RESOURCE_GROUP${NC}"
    else
        echo -e "${YELLOW}⚠️  Nepodarilo sa automaticky detekovať Resource Group${NC}"
        echo -e "${YELLOW}   Upravte premennú RESOURCE_GROUP v skripte${NC}"
    fi
fi

# ============================================================================
# OVERENIE PRIHLÁSENIA DO AZURE
# ============================================================================

echo -e "${CYAN}🔐 Overujem prihlásenie do Azure...${NC}"

ACCOUNT=$(az account show 2>/dev/null)
if [ $? -eq 0 ]; then
    ACCOUNT_NAME=$(echo $ACCOUNT | jq -r '.user.name')
    SUBSCRIPTION=$(echo $ACCOUNT | jq -r '.name')
    echo -e "${GREEN}✅ Prihlásený ako: $ACCOUNT_NAME${NC}"
    echo -e "${GREEN}   Subscription: $SUBSCRIPTION${NC}"
else
    echo -e "${RED}❌ Nie ste prihlásený do Azure CLI${NC}"
    echo -e "${CYAN}   Spustite: az login${NC}"
    exit 1
fi

# ============================================================================
# OVERENIE EXISTENCIE WEB APP
# ============================================================================

echo -e "${CYAN}🔍 Overujem existenciu Web App '$APP_NAME'...${NC}"

WEBAPP=$(az webapp show --name $APP_NAME --resource-group $RESOURCE_GROUP 2>/dev/null)
if [ $? -eq 0 ]; then
    HOSTNAME=$(echo $WEBAPP | jq -r '.defaultHostName')
    echo -e "${GREEN}✅ Web App nájdená: $HOSTNAME${NC}"
else
    echo -e "${RED}❌ Web App '$APP_NAME' nenájdená v resource group '$RESOURCE_GROUP'${NC}"
    echo -e "${CYAN}   Skontrolujte názvy v skripte${NC}"
    exit 1
fi

# ============================================================================
# NASTAVENIE ENVIRONMENT VARIABLES
# ============================================================================

echo -e "${CYAN}⚙️  Nastavujem Environment Variables...${NC}"

# Vytvorenie settings array
SETTINGS="NODE_ENV=production"
SETTINGS="$SETTINGS DATABASE_TYPE=mysql"
SETTINGS="$SETTINGS STORAGE_TYPE=azure"
SETTINGS="$SETTINGS CORS_ORIGIN=*"

# MySQL nastavenia
SETTINGS="$SETTINGS MYSQL_HOST=$MYSQL_HOST"
SETTINGS="$SETTINGS MYSQL_DATABASE=$MYSQL_DATABASE"
SETTINGS="$SETTINGS MYSQL_USER=$MYSQL_USER"
SETTINGS="$SETTINGS MYSQL_PASSWORD=$MYSQL_PASSWORD"
SETTINGS="$SETTINGS MYSQL_PORT=$MYSQL_PORT"
SETTINGS="$SETTINGS MYSQL_SSL=true"

# Azure Storage nastavenia
if [ ! -z "$AZURE_STORAGE_CONNECTION_STRING" ]; then
    SETTINGS="$SETTINGS AZURE_STORAGE_CONNECTION_STRING=$AZURE_STORAGE_CONNECTION_STRING"
else
    SETTINGS="$SETTINGS AZURE_STORAGE_ACCOUNT=$AZURE_STORAGE_ACCOUNT"
    SETTINGS="$SETTINGS AZURE_STORAGE_KEY=$AZURE_STORAGE_KEY"
fi
SETTINGS="$SETTINGS AZURE_STORAGE_CONTAINER=$AZURE_STORAGE_CONTAINER"

echo -e "${CYAN}Nastavujem tieto premenné:${NC}"
echo -e "${CYAN}  - NODE_ENV = production${NC}"
echo -e "${CYAN}  - DATABASE_TYPE = mysql${NC}"
echo -e "${CYAN}  - STORAGE_TYPE = azure${NC}"
echo -e "${CYAN}  - MYSQL_HOST = $MYSQL_HOST${NC}"
echo -e "${CYAN}  - MYSQL_DATABASE = $MYSQL_DATABASE${NC}"
echo -e "${CYAN}  - MYSQL_USER = $MYSQL_USER${NC}"
echo -e "${CYAN}  - MYSQL_PASSWORD = ********${NC}"
echo -e "${CYAN}  - AZURE_STORAGE_ACCOUNT = $AZURE_STORAGE_ACCOUNT${NC}"
echo -e "${CYAN}  - AZURE_STORAGE_KEY = ********${NC}"

# Nastavenie cez Azure CLI
echo -e "${CYAN}Spúšťam príkaz...${NC}"

az webapp config appsettings set \
    --name $APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings $SETTINGS \
    --output none

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Environment variables úspešne nastavené!${NC}"
else
    echo -e "${RED}❌ Chyba pri nastavovaní environment variables${NC}"
    exit 1
fi

# ============================================================================
# NASTAVENIE STARTUP COMMAND
# ============================================================================

echo -e "${CYAN}⚙️  Nastavujem Startup Command...${NC}"

az webapp config set \
    --name $APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --startup-file "node server.js" \
    --output none

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Startup command nastavený: node server.js${NC}"
else
    echo -e "${YELLOW}⚠️  Nepodarilo sa nastaviť startup command (môže byť už nastavený)${NC}"
fi

# ============================================================================
# NASTAVENIE APPLICATION LOGGING
# ============================================================================

echo -e "${CYAN}📝 Zapínam Application Logging...${NC}"

az webapp log config \
    --name $APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --application-logging filesystem \
    --detailed-error-messages true \
    --failed-request-tracing true \
    --web-server-logging filesystem \
    --level verbose \
    --output none

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Application logging zapnuté${NC}"
else
    echo -e "${YELLOW}⚠️  Nepodarilo sa zapnúť logging${NC}"
fi

# ============================================================================
# REŠTART APLIKÁCIE
# ============================================================================

echo -e "${CYAN}🔄 Reštartujem aplikáciu...${NC}"

az webapp restart --name $APP_NAME --resource-group $RESOURCE_GROUP --output none

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Aplikácia reštartovaná${NC}"
else
    echo -e "${RED}❌ Nepodarilo sa reštartovať aplikáciu${NC}"
fi

# ============================================================================
# OVERENIE KONFIGURÁCIE
# ============================================================================

echo -e "${CYAN}🔍 Overujem nastavenia...${NC}"

sleep 5

CURRENT_SETTINGS=$(az webapp config appsettings list \
    --name $APP_NAME \
    --resource-group $RESOURCE_GROUP)

echo -e "${GREEN}✅ Aktuálne nastavené environment variables:${NC}"
echo $CURRENT_SETTINGS | jq -r '.[] | "  ✓ \(.name) = \(if (.name | contains("PASSWORD") or contains("KEY") or contains("CONNECTION_STRING")) then "********" else .value end)"'

# ============================================================================
# HEALTH CHECK
# ============================================================================

echo -e "${CYAN}🏥 Čakám na spustenie aplikácie (30s)...${NC}"
sleep 30

echo -e "${CYAN}Testujem Health Check endpoint...${NC}"

HEALTH_URL="https://$APP_NAME.azurewebsites.net/api/health"

HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" $HEALTH_URL)
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n 1)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}✅ Health Check úspešný!${NC}"
    echo $HEALTH_BODY | jq .
else
    echo -e "${YELLOW}⚠️  Health check zlyhal (aplikácia sa možno ešte spúšťa)${NC}"
    echo -e "${CYAN}Skúste manuálne o chvíľu: $HEALTH_URL${NC}"
fi

# ============================================================================
# ZOBRAZENIE LOGOV
# ============================================================================

echo -e "${CYAN}📋 Chcete zobraziť live logy? (y/n)${NC}"
read -r SHOW_LOGS

if [ "$SHOW_LOGS" == "y" ] || [ "$SHOW_LOGS" == "Y" ]; then
    echo -e "${CYAN}📜 Zobrazujem live logy (Ctrl+C pre ukončenie)...${NC}"
    az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP
else
    echo -e "${CYAN}Môžete zobraziť logy príkazom:${NC}"
    echo -e "${CYAN}az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP${NC}"
fi

# ============================================================================
# SÚHRN
# ============================================================================

echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    ✅ KONFIGURÁCIA DOKONČENÁ                    ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"

echo -e "${CYAN}📋 ĎALŠIE KROKY:${NC}"
echo -e "${CYAN}1. Overte aplikáciu: https://$APP_NAME.azurewebsites.net${NC}"
echo -e "${CYAN}2. Health check:     https://$APP_NAME.azurewebsites.net/api/health${NC}"
echo -e "${CYAN}3. Skontrolujte logy v Azure Portal${NC}"
echo ""
echo -e "${CYAN}🔧 UŽITOČNÉ PRÍKAZY:${NC}"
echo -e "${CYAN}  Logy:      az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP${NC}"
echo -e "${CYAN}  SSH:       az webapp ssh --name $APP_NAME --resource-group $RESOURCE_GROUP${NC}"
echo -e "${CYAN}  Reštart:   az webapp restart --name $APP_NAME --resource-group $RESOURCE_GROUP${NC}"
echo ""
