#!/bin/bash

# Azure Deployment Script
# This script deploys the application to Azure App Service

set -e

echo "🚀 Starting Azure deployment..."

# Variables
RESOURCE_GROUP="microhack-rg"
APP_NAME="microhack-app"
LOCATION="westeurope"
PLAN_NAME="microhack-plan"
STORAGE_ACCOUNT="microhackstorage"

# Step 1: Login to Azure (if not already logged in)
echo "📝 Checking Azure login..."
az account show || az login

# Step 2: Create Resource Group
echo "📦 Creating resource group..."
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION

# Step 3: Create App Service Plan
echo "🏗️  Creating App Service Plan..."
az appservice plan create \
  --name $PLAN_NAME \
  --resource-group $RESOURCE_GROUP \
  --sku B1 \
  --is-linux

# Step 4: Create Web App
echo "🌐 Creating Web App..."
az webapp create \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --plan $PLAN_NAME \
  --runtime "NODE|18-lts"

# Step 5: Create Storage Account for file uploads
echo "💾 Creating Storage Account..."
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS

# Get storage account key
STORAGE_KEY=$(az storage account keys list \
  --account-name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query "[0].value" -o tsv)

# Step 6: Create blob container for documents
echo "📁 Creating blob container..."
az storage container create \
  --name documents \
  --account-name $STORAGE_ACCOUNT \
  --account-key $STORAGE_KEY

# Step 7: Configure App Settings
echo "⚙️  Configuring app settings..."
az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    NODE_ENV=production \
    AZURE_STORAGE_ACCOUNT=$STORAGE_ACCOUNT \
    AZURE_STORAGE_KEY=$STORAGE_KEY \
    AZURE_STORAGE_CONTAINER=documents \
    WEBSITE_NODE_DEFAULT_VERSION="18-lts"

# Step 8: Enable App Service logging
echo "📊 Enabling logging..."
az webapp log config \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --application-logging filesystem \
  --level information

# Step 9: Deploy application
echo "🚢 Deploying application..."
cd ..
zip -r microhack.zip . -x "*.git*" "node_modules/*" "frontend/node_modules/*"
az webapp deployment source config-zip \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --src microhack.zip

# Step 10: Get app URL
APP_URL=$(az webapp show \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query defaultHostName -o tsv)

echo ""
echo "✅ Deployment completed!"
echo "🌐 Application URL: https://$APP_URL"
echo ""
echo "Next steps:"
echo "1. Update FRONTEND_URL in app settings"
echo "2. Configure custom domain (optional)"
echo "3. Enable HTTPS (recommended)"
echo "4. Set up CI/CD pipeline"

# Cleanup
rm ../microhack.zip
