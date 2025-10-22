# deploy-infrastructure.ps1 - Infrastructure as Code Deployment Script
# Microhack Document Management System - Azure Deployment

param(
    [Parameter(Mandatory=$false)]
    [string]$SubscriptionId = "d9f78e2d-60c6-4a0a-a6df-85c33540dd5e",
    
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroupName = "rg-tim5",
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "West Europe",
    
    [Parameter(Mandatory=$false)]
    [ValidateSet('dev', 'test', 'prod')]
    [string]$Environment = "dev",
    
    [Parameter(Mandatory=$false)]
    [string]$AdminLogin = "microhackadmin",
    
    [Parameter(Mandatory=$false)]
    [SecureString]$AdminPassword,
    
    [Parameter(Mandatory=$false)]
    [switch]$WhatIf
)

# =========================================================
# Helper Functions
# =========================================================
function Write-Success { 
    param($Message) 
    Write-Host "✅ $Message" -ForegroundColor Green 
}

function Write-Info { 
    param($Message) 
    Write-Host "ℹ️  $Message" -ForegroundColor Cyan 
}

function Write-Warning { 
    param($Message) 
    Write-Host "⚠️  $Message" -ForegroundColor Yellow 
}

function Write-ErrorMsg { 
    param($Message) 
    Write-Host "❌ $Message" -ForegroundColor Red 
}

function Write-Step { 
    param($Number, $Message) 
    Write-Host "`n📍 Step $Number : $Message" -ForegroundColor Magenta 
}

# =========================================================
# Banner
# =========================================================
Clear-Host
Write-Host @"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🚀 Microhack Infrastructure Deployment                     ║
║   📦 Infrastructure as Code - Azure Bicep                    ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

Write-Info "Deployment Configuration:"
Write-Host "  Subscription: $SubscriptionId"
Write-Host "  Resource Group: $ResourceGroupName"
Write-Host "  Location: $Location"
Write-Host "  Environment: $Environment"
Write-Host "  Admin Login: $AdminLogin"
Write-Host "  What-If Mode: $WhatIf"
Write-Host ""

# =========================================================
# Step 1: Prerequisites Check
# =========================================================
Write-Step 1 "Checking Prerequisites"

try {
    # Check Azure CLI
    Write-Info "Checking Azure CLI installation..."
    $azVersion = az version --output json 2>$null | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "Azure CLI is not installed or not in PATH"
        Write-Info "Install from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
        exit 1
    }
    Write-Success "Azure CLI version: $($azVersion.'azure-cli')"

    # Check Bicep
    Write-Info "Checking Bicep installation..."
    $bicepVersion = az bicep version 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Bicep not found, installing..."
        az bicep install
        if ($LASTEXITCODE -ne 0) {
            Write-ErrorMsg "Failed to install Bicep"
            exit 1
        }
    }
    Write-Success "Bicep is installed"

} catch {
    Write-ErrorMsg "Prerequisites check failed: $_"
    exit 1
}

# =========================================================
# Step 2: Azure Login & Subscription
# =========================================================
Write-Step 2 "Azure Authentication"

try {
    Write-Info "Checking Azure login status..."
    $accountInfo = az account show --output json 2>$null | ConvertFrom-Json
    
    if ($LASTEXITCODE -ne 0) {
        Write-Info "Logging in to Azure..."
        az login
        if ($LASTEXITCODE -ne 0) {
            Write-ErrorMsg "Failed to login to Azure"
            exit 1
        }
        $accountInfo = az account show --output json | ConvertFrom-Json
    }
    
    Write-Success "Logged in as: $($accountInfo.user.name)"
    
    # Set subscription
    Write-Info "Setting subscription to: $SubscriptionId..."
    az account set --subscription $SubscriptionId
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "Failed to set subscription"
        exit 1
    }
    
    $currentSub = az account show --output json | ConvertFrom-Json
    Write-Success "Active subscription: $($currentSub.name) ($($currentSub.id))"
    
} catch {
    Write-ErrorMsg "Authentication failed: $_"
    exit 1
}

# =========================================================
# Step 3: Resource Group
# =========================================================
Write-Step 3 "Verifying Resource Group"

try {
    Write-Info "Checking if resource group '$ResourceGroupName' exists..."
    $rgExists = az group show --name $ResourceGroupName --output json 2>$null
    
    if ($LASTEXITCODE -ne 0) {
        Write-Info "Creating resource group '$ResourceGroupName' in $Location..."
        az group create --name $ResourceGroupName --location $Location --output json | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-ErrorMsg "Failed to create resource group"
            exit 1
        }
        Write-Success "Resource group created successfully"
    } else {
        Write-Success "Resource group already exists"
    }
    
} catch {
    Write-ErrorMsg "Resource group verification failed: $_"
    exit 1
}

# =========================================================
# Step 4: Generate Secure Password
# =========================================================
Write-Step 4 "Database Credentials"

if (-not $AdminPassword) {
    Write-Info "Generating secure database password..."
    
    # Generuj silné heslo: min 8 znakov, uppercase, lowercase, číslica, špeciálny znak
    $upperCase = -join ((65..90) | Get-Random -Count 3 | ForEach-Object {[char]$_})
    $lowerCase = -join ((97..122) | Get-Random -Count 3 | ForEach-Object {[char]$_})
    $numbers = -join ((48..57) | Get-Random -Count 3 | ForEach-Object {[char]$_})
    $special = -join ('!@#$%^&*'.ToCharArray() | Get-Random -Count 2)
    
    $passwordString = ($upperCase + $lowerCase + $numbers + $special).ToCharArray() | Sort-Object {Get-Random}
    $passwordString = -join $passwordString
    $AdminPassword = ConvertTo-SecureString -String $passwordString -AsPlainText -Force
    
    Write-Success "Secure password generated"
    Write-Warning "IMPORTANT: Save this password securely!"
    Write-Host "  Database Password: $passwordString" -ForegroundColor Yellow
    Write-Host ""
    
    # Ulož heslo do súboru (lokálne, pre prípad zabudnutia)
    $credentialFile = Join-Path $PSScriptRoot ".." ".credentials-$Environment.txt"
    @"
Microhack Deployment Credentials
Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Environment: $Environment
Resource Group: $ResourceGroupName
Database Server: microhack-$Environment-dbserver
Database Admin Login: $AdminLogin
Database Admin Password: $passwordString

⚠️  IMPORTANT: Store this file securely and delete after saving credentials to password manager!
"@ | Out-File -FilePath $credentialFile -Encoding UTF8
    
    Write-Warning "Credentials saved to: $credentialFile"
    Write-Warning "Please save the password to a secure location and delete this file!"
}

# =========================================================
# Step 5: Bicep Template Validation
# =========================================================
Write-Step 5 "Validating Bicep Template"

try {
    $bicepFile = Join-Path $PSScriptRoot ".." "infrastructure" "main.bicep"
    $parametersFile = Join-Path $PSScriptRoot ".." "infrastructure" "main.parameters.$Environment.json"
    
    if (-not (Test-Path $bicepFile)) {
        Write-ErrorMsg "Bicep template not found: $bicepFile"
        exit 1
    }
    Write-Success "Bicep template found: $bicepFile"
    
    # Build Bicep to ARM template
    Write-Info "Compiling Bicep template..."
    az bicep build --file $bicepFile --outfile "$bicepFile.json"
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "Bicep compilation failed"
        exit 1
    }
    Write-Success "Bicep template compiled successfully"
    
} catch {
    Write-ErrorMsg "Template validation failed: $_"
    exit 1
}

# =========================================================
# Step 6: Deploy Infrastructure
# =========================================================
Write-Step 6 "Deploying Azure Infrastructure"

try {
    $deploymentName = "microhack-infra-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    
    Write-Info "Deployment name: $deploymentName"
    Write-Info "Starting infrastructure deployment..."
    Write-Info "This may take 10-15 minutes..."
    Write-Host ""
    
    # Convert SecureString to plain text pro Azure CLI
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($AdminPassword)
    $plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    
    $deployParams = @(
        "--resource-group", $ResourceGroupName,
        "--template-file", $bicepFile,
        "--name", $deploymentName,
        "--parameters",
        "projectName=microhack",
        "environment=$Environment",
        "location=$Location",
        "administratorLogin=$AdminLogin",
        "administratorLoginPassword=$plainPassword"
    )
    
    if ($WhatIf) {
        $deployParams += "--what-if"
        Write-Warning "Running in What-If mode - no resources will be created"
    }
    
    $deploymentResult = az deployment group create @deployParams --output json
    
    # Clear password from memory
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
    
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "Infrastructure deployment failed"
        Write-ErrorMsg $deploymentResult
        exit 1
    }
    
    $deployment = $deploymentResult | ConvertFrom-Json
    Write-Success "Infrastructure deployed successfully!"
    
} catch {
    Write-ErrorMsg "Deployment failed: $_"
    exit 1
}

# =========================================================
# Step 7: Extract Deployment Outputs
# =========================================================
Write-Step 7 "Extracting Deployment Information"

try {
    Write-Info "Retrieving deployment outputs..."
    
    $outputs = $deployment.properties.outputs
    
    $webAppName = $outputs.webAppName.value
    $webAppUrl = $outputs.webAppUrl.value
    $storageAccountName = $outputs.storageAccountName.value
    $databaseServerName = $outputs.databaseServerName.value
    $databaseName = $outputs.databaseName.value
    $databaseFQDN = $outputs.databaseFQDN.value
    $keyVaultName = $outputs.keyVaultName.value
    
    Write-Success "Deployment outputs extracted"
    
} catch {
    Write-ErrorMsg "Failed to extract outputs: $_"
    exit 1
}

# =========================================================
# Step 8: Save Deployment Information
# =========================================================
Write-Step 8 "Saving Deployment Information"

try {
    $deploymentInfo = @{
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        SubscriptionId = $SubscriptionId
        ResourceGroupName = $ResourceGroupName
        Environment = $Environment
        Location = $Location
        WebApp = @{
            Name = $webAppName
            URL = $webAppUrl
        }
        Database = @{
            ServerName = $databaseServerName
            FQDN = $databaseFQDN
            DatabaseName = $databaseName
            AdminLogin = $AdminLogin
        }
        Storage = @{
            AccountName = $storageAccountName
            Container = "documents"
        }
        KeyVault = @{
            Name = $keyVaultName
        }
    }
    
    $deploymentInfoPath = Join-Path $PSScriptRoot ".." "deployment-info-$Environment.json"
    $deploymentInfo | ConvertTo-Json -Depth 4 | Out-File -FilePath $deploymentInfoPath -Encoding UTF8
    Write-Success "Deployment info saved to: $deploymentInfoPath"
    
} catch {
    Write-Warning "Failed to save deployment info: $_"
}

# =========================================================
# Step 9: Display Summary
# =========================================================
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                                                               ║" -ForegroundColor Green
Write-Host "║   ✅ DEPLOYMENT COMPLETED SUCCESSFULLY!                      ║" -ForegroundColor Green
Write-Host "║                                                               ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Host "📊 Deployment Summary:" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""
Write-Host "🌐 Web Application:" -ForegroundColor Yellow
Write-Host "   Name:     $webAppName"
Write-Host "   URL:      $webAppUrl" -ForegroundColor Green
Write-Host ""
Write-Host "🗄️  MySQL Database:" -ForegroundColor Yellow
Write-Host "   Server:   $databaseServerName"
Write-Host "   FQDN:     $databaseFQDN"
Write-Host "   Database: $databaseName"
Write-Host "   Login:    $AdminLogin"
Write-Host ""
Write-Host "💾 Storage Account:" -ForegroundColor Yellow
Write-Host "   Name:     $storageAccountName"
Write-Host "   Container: documents"
Write-Host ""
Write-Host "🔐 Key Vault:" -ForegroundColor Yellow
Write-Host "   Name:     $keyVaultName"
Write-Host ""

Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "1️⃣  Update .env.production with deployment values"
Write-Host "2️⃣  Run database migration:"
Write-Host "      npm run migrate:mysql" -ForegroundColor White
Write-Host "3️⃣  Build and deploy application:"
Write-Host "      npm run build:production" -ForegroundColor White
Write-Host "      npm run deploy:app" -ForegroundColor White
Write-Host "4️⃣  Visit your application:"
Write-Host "      $webAppUrl" -ForegroundColor Green
Write-Host ""

Write-Warning "IMPORTANT: Save the database password securely!"
Write-Warning "The password is stored in: .credentials-$Environment.txt"
Write-Host ""
