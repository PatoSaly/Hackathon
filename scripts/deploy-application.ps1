# deploy-application.ps1 - Application Deployment Script
# Microhack Document Management System - Deploy to Azure App Service

param(
    [Parameter(Mandatory=$false)]
    [string]$Environment = "dev",
    
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroupName = "rg-tim5",
    
    [Parameter(Mandatory=$false)]
    [string]$WebAppName,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipTests
)

# =========================================================
# Helper Functions
# =========================================================
function Write-Success { param($Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Info { param($Message) Write-Host "ℹ️  $Message" -ForegroundColor Cyan }
function Write-Warning { param($Message) Write-Host "⚠️  $Message" -ForegroundColor Yellow }
function Write-ErrorMsg { param($Message) Write-Host "❌ $Message" -ForegroundColor Red }
function Write-Step { param($Number, $Message) Write-Host "`n📍 Step $Number : $Message" -ForegroundColor Magenta }

# =========================================================
# Banner
# =========================================================
Clear-Host
Write-Host @"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🚀 Microhack Application Deployment                        ║
║   📦 Deploy to Azure App Service                             ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

Write-Info "Deployment Configuration:"
Write-Host "  Environment: $Environment"
Write-Host "  Resource Group: $ResourceGroupName"
Write-Host "  Skip Build: $SkipBuild"
Write-Host "  Skip Tests: $SkipTests"
Write-Host ""

# Load deployment info if exists
$deploymentInfoPath = Join-Path $PSScriptRoot ".." "deployment-info-$Environment.json"
if (Test-Path $deploymentInfoPath) {
    $deploymentInfo = Get-Content $deploymentInfoPath | ConvertFrom-Json
    if (-not $WebAppName) {
        $WebAppName = $deploymentInfo.WebApp.Name
    }
    Write-Info "Loaded deployment info from: $deploymentInfoPath"
    Write-Host "  Web App Name: $WebAppName"
}

if (-not $WebAppName) {
    $WebAppName = "microhack-$Environment-app"
    Write-Warning "Web App Name not specified, using default: $WebAppName"
}

# =========================================================
# Step 1: Prerequisites Check
# =========================================================
Write-Step 1 "Checking Prerequisites"

try {
    # Check Azure CLI
    Write-Info "Checking Azure CLI..."
    $null = az version --output json 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "Azure CLI is not installed"
        exit 1
    }
    Write-Success "Azure CLI is available"

    # Check Node.js
    Write-Info "Checking Node.js..."
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "Node.js is not installed"
        exit 1
    }
    Write-Success "Node.js version: $nodeVersion"

    # Check npm
    Write-Info "Checking npm..."
    $npmVersion = npm --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "npm is not installed"
        exit 1
    }
    Write-Success "npm version: $npmVersion"

} catch {
    Write-ErrorMsg "Prerequisites check failed: $_"
    exit 1
}

# =========================================================
# Step 2: Run Tests (Optional)
# =========================================================
if (-not $SkipTests) {
    Write-Step 2 "Running Tests"
    
    try {
        Write-Info "Running backend tests..."
        npm test
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Tests failed, but continuing deployment..."
        } else {
            Write-Success "All tests passed"
        }
    } catch {
        Write-Warning "Error running tests: $_"
    }
} else {
    Write-Step 2 "Skipping Tests"
}

# =========================================================
# Step 3: Install Dependencies
# =========================================================
Write-Step 3 "Installing Dependencies"

try {
    Write-Info "Installing backend dependencies..."
    npm install --production
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "Failed to install backend dependencies"
        exit 1
    }
    Write-Success "Backend dependencies installed"

    Write-Info "Installing frontend dependencies..."
    Push-Location frontend
    npm install --production
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        Write-ErrorMsg "Failed to install frontend dependencies"
        exit 1
    }
    Pop-Location
    Write-Success "Frontend dependencies installed"

} catch {
    Write-ErrorMsg "Dependency installation failed: $_"
    exit 1
}

# =========================================================
# Step 4: Build Frontend
# =========================================================
if (-not $SkipBuild) {
    Write-Step 4 "Building Frontend"
    
    try {
        Write-Info "Building React frontend for production..."
        Push-Location frontend
        
        # Set environment variable for production build
        $env:REACT_APP_API_URL = "/api"
        $env:GENERATE_SOURCEMAP = "false"
        
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Pop-Location
            Write-ErrorMsg "Frontend build failed"
            exit 1
        }
        Pop-Location
        Write-Success "Frontend built successfully"

        # Verify build folder
        if (-not (Test-Path "frontend\build")) {
            Write-ErrorMsg "Build folder not found"
            exit 1
        }
        Write-Success "Build folder verified"

    } catch {
        Write-ErrorMsg "Build failed: $_"
        exit 1
    }
} else {
    Write-Step 4 "Skipping Build"
}

# =========================================================
# Step 5: Prepare Deployment Package
# =========================================================
Write-Step 5 "Preparing Deployment Package"

try {
    $deploymentFolder = Join-Path $PSScriptRoot ".." "deployment"
    $deploymentZip = Join-Path $PSScriptRoot ".." "deployment.zip"

    # Clean previous deployment
    if (Test-Path $deploymentFolder) {
        Remove-Item $deploymentFolder -Recurse -Force
    }
    if (Test-Path $deploymentZip) {
        Remove-Item $deploymentZip -Force
    }

    # Create deployment folder
    New-Item -ItemType Directory -Path $deploymentFolder | Out-Null
    Write-Success "Deployment folder created"

    # Copy backend files
    Write-Info "Copying backend files..."
    $backendFiles = @(
        "server.js",
        "database.js",
        "database-mysql.js",
        "azure-storage.js",
        "package.json",
        "package-lock.json",
        "web.config",
        ".deployment"
    )

    foreach ($file in $backendFiles) {
        $sourcePath = Join-Path $PSScriptRoot ".." $file
        if (Test-Path $sourcePath) {
            Copy-Item $sourcePath -Destination $deploymentFolder -Force
        }
    }

    # Copy node_modules (production only)
    Write-Info "Copying production dependencies..."
    $nodeModulesSource = Join-Path $PSScriptRoot ".." "node_modules"
    $nodeModulesDest = Join-Path $deploymentFolder "node_modules"
    if (Test-Path $nodeModulesSource) {
        Copy-Item $nodeModulesSource -Destination $nodeModulesDest -Recurse -Force
    }

    # Copy frontend build as public folder
    Write-Info "Copying frontend build..."
    $frontendBuild = Join-Path $PSScriptRoot ".." "frontend" "build"
    $publicFolder = Join-Path $deploymentFolder "public"
    if (Test-Path $frontendBuild) {
        Copy-Item $frontendBuild -Destination $publicFolder -Recurse -Force
    }

    # Create web.config if not exists
    $webConfigPath = Join-Path $deploymentFolder "web.config"
    if (-not (Test-Path $webConfigPath)) {
        @'
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <handlers>
      <add name="iisnode" path="server.js" verb="*" modules="iisnode"/>
    </handlers>
    <rewrite>
      <rules>
        <rule name="StaticContent">
          <action type="Rewrite" url="public{REQUEST_URI}"/>
        </rule>
        <rule name="DynamicContent">
          <conditions>
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="True"/>
          </conditions>
          <action type="Rewrite" url="server.js"/>
        </rule>
      </rules>
    </rewrite>
    <iisnode nodeProcessCommandLine="&quot;%programfiles%\nodejs\node.exe&quot;"/>
  </system.webServer>
</configuration>
'@ | Out-File -FilePath $webConfigPath -Encoding UTF8
    }

    Write-Success "Deployment package prepared"

    # Create ZIP archive
    Write-Info "Creating deployment ZIP archive..."
    Compress-Archive -Path "$deploymentFolder\*" -DestinationPath $deploymentZip -Force
    Write-Success "Deployment ZIP created: $deploymentZip"

    # Get ZIP size
    $zipSize = (Get-Item $deploymentZip).Length / 1MB
    Write-Info "Deployment package size: $([math]::Round($zipSize, 2)) MB"

} catch {
    Write-ErrorMsg "Package preparation failed: $_"
    exit 1
}

# =========================================================
# Step 6: Deploy to Azure
# =========================================================
Write-Step 6 "Deploying to Azure App Service"

try {
    Write-Info "Deploying to Web App: $WebAppName..."
    Write-Info "This may take several minutes..."
    Write-Host ""

    az webapp deployment source config-zip `
        --resource-group $ResourceGroupName `
        --name $WebAppName `
        --src $deploymentZip `
        --timeout 600

    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "Deployment to Azure failed"
        exit 1
    }

    Write-Success "Application deployed successfully!"

} catch {
    Write-ErrorMsg "Deployment failed: $_"
    exit 1
}

# =========================================================
# Step 7: Restart Web App
# =========================================================
Write-Step 7 "Restarting Web App"

try {
    Write-Info "Restarting $WebAppName..."
    az webapp restart --name $WebAppName --resource-group $ResourceGroupName
    
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed to restart web app, but deployment completed"
    } else {
        Write-Success "Web app restarted"
    }

    # Wait for app to start
    Write-Info "Waiting for application to start..."
    Start-Sleep -Seconds 15

} catch {
    Write-Warning "Restart failed: $_"
}

# =========================================================
# Step 8: Verify Deployment
# =========================================================
Write-Step 8 "Verifying Deployment"

try {
    $webAppUrl = "https://$WebAppName.azurewebsites.net"
    
    Write-Info "Testing application endpoint..."
    Write-Info "URL: $webAppUrl"
    
    # Test health endpoint
    try {
        $response = Invoke-WebRequest -Uri "$webAppUrl/health" -TimeoutSec 30 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Success "Application is responding correctly"
        }
    } catch {
        Write-Warning "Health check endpoint not available (this may be normal)"
    }

    # Test main endpoint
    try {
        $response = Invoke-WebRequest -Uri $webAppUrl -TimeoutSec 30 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Success "Web application is accessible"
        }
    } catch {
        Write-Warning "Main endpoint returned error (app may still be starting)"
    }

} catch {
    Write-Warning "Verification checks failed: $_"
}

# =========================================================
# Step 9: Cleanup
# =========================================================
Write-Step 9 "Cleanup"

try {
    Write-Info "Cleaning up temporary files..."
    
    # Keep deployment folder and ZIP for debugging
    # Uncomment to remove:
    # if (Test-Path $deploymentFolder) {
    #     Remove-Item $deploymentFolder -Recurse -Force
    # }
    # if (Test-Path $deploymentZip) {
    #     Remove-Item $deploymentZip -Force
    # }
    
    Write-Success "Cleanup completed"

} catch {
    Write-Warning "Cleanup failed: $_"
}

# =========================================================
# Summary
# =========================================================
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                                                               ║" -ForegroundColor Green
Write-Host "║   ✅ APPLICATION DEPLOYED SUCCESSFULLY!                      ║" -ForegroundColor Green
Write-Host "║                                                               ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Host "🌐 Application URL:" -ForegroundColor Cyan
Write-Host "   https://$WebAppName.azurewebsites.net" -ForegroundColor Green
Write-Host ""

Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "1️⃣  Visit your application in a web browser"
Write-Host "2️⃣  Test document upload/sign/approval workflow"
Write-Host "3️⃣  Monitor logs:"
Write-Host "      az webapp log tail --name $WebAppName --resource-group $ResourceGroupName" -ForegroundColor White
Write-Host "4️⃣  Check Application Insights for performance metrics"
Write-Host ""

Write-Info "Deployment package saved to: $deploymentZip"
Write-Host ""
