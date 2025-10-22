# Azure Deployment Script (PowerShell)
# This script deploys the application to Azure App Service

param(
    [string]$ResourceGroup = "microhack-rg",
    [string]$AppName = "microhack-app",
    [string]$Location = "westeurope",
    [string]$PlanName = "microhack-plan",
    [string]$StorageAccount = "microhackstorage"
)

Write-Host "🚀 Starting Azure deployment..." -ForegroundColor Green

# Step 1: Check Azure CLI
Write-Host "📝 Checking Azure CLI..." -ForegroundColor Yellow
if (!(Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Azure CLI not found. Please install: https://aka.ms/installazurecliwindows" -ForegroundColor Red
    exit 1
}

# Step 2: Login to Azure
Write-Host "📝 Checking Azure login..." -ForegroundColor Yellow
$account = az account show 2>$null
if (!$account) {
    az login
}

# Step 3: Create Resource Group
Write-Host "📦 Creating resource group..." -ForegroundColor Yellow
az group create `
    --name $ResourceGroup `
    --location $Location

# Step 4: Create App Service Plan
Write-Host "🏗️  Creating App Service Plan..." -ForegroundColor Yellow
az appservice plan create `
    --name $PlanName `
    --resource-group $ResourceGroup `
    --sku B1 `
    --is-linux

# Step 5: Create Web App
Write-Host "🌐 Creating Web App..." -ForegroundColor Yellow
az webapp create `
    --name $AppName `
    --resource-group $ResourceGroup `
    --plan $PlanName `
    --runtime "NODE:18-lts"

# Step 6: Create Storage Account
Write-Host "💾 Creating Storage Account..." -ForegroundColor Yellow
az storage account create `
    --name $StorageAccount `
    --resource-group $ResourceGroup `
    --location $Location `
    --sku Standard_LRS

# Get storage account key
Write-Host "🔑 Getting storage account key..." -ForegroundColor Yellow
$StorageKey = (az storage account keys list `
    --account-name $StorageAccount `
    --resource-group $ResourceGroup `
    --query "[0].value" -o tsv)

# Step 7: Create blob container
Write-Host "📁 Creating blob container..." -ForegroundColor Yellow
az storage container create `
    --name documents `
    --account-name $StorageAccount `
    --account-key $StorageKey

# Step 8: Configure App Settings
Write-Host "⚙️  Configuring app settings..." -ForegroundColor Yellow
az webapp config appsettings set `
    --name $AppName `
    --resource-group $ResourceGroup `
    --settings `
        NODE_ENV=production `
        AZURE_STORAGE_ACCOUNT=$StorageAccount `
        AZURE_STORAGE_KEY=$StorageKey `
        AZURE_STORAGE_CONTAINER=documents `
        WEBSITE_NODE_DEFAULT_VERSION="18-lts"

# Step 9: Enable logging
Write-Host "📊 Enabling logging..." -ForegroundColor Yellow
az webapp log config `
    --name $AppName `
    --resource-group $ResourceGroup `
    --application-logging filesystem `
    --level information

# Step 10: Build frontend
Write-Host "🔨 Building frontend..." -ForegroundColor Yellow
Set-Location frontend
npm install
npm run build
Set-Location ..

# Step 11: Create deployment package
Write-Host "📦 Creating deployment package..." -ForegroundColor Yellow
$exclude = @("node_modules", ".git", "frontend/node_modules", "*.log")
Compress-Archive -Path * -DestinationPath ../microhack.zip -Force -CompressionLevel Optimal

# Step 12: Deploy to Azure
Write-Host "🚢 Deploying application..." -ForegroundColor Yellow
az webapp deployment source config-zip `
    --name $AppName `
    --resource-group $ResourceGroup `
    --src ../microhack.zip

# Step 13: Get app URL
$AppUrl = (az webapp show `
    --name $AppName `
    --resource-group $ResourceGroup `
    --query defaultHostName -o tsv)

Write-Host ""
Write-Host "✅ Deployment completed!" -ForegroundColor Green
Write-Host "🌐 Application URL: https://$AppUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Update FRONTEND_URL in app settings"
Write-Host "2. Configure custom domain (optional)"
Write-Host "3. Enable HTTPS (recommended)"
Write-Host "4. Set up CI/CD pipeline"

# Cleanup
Remove-Item ../microhack.zip -Force
