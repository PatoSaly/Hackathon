# 🚀 Deployment Guide - Microhack to Azure

Complete guide for deploying Microhack Document Management System to Azure using Infrastructure as Code (Bicep).

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Deployment](#infrastructure-deployment)
3. [Database Migration](#database-migration)
4. [Application Deployment](#application-deployment)
5. [Verification & Testing](#verification--testing)
6. [Troubleshooting](#troubleshooting)
7. [Cost Optimization](#cost-optimization)

---

## 🔧 Prerequisites

### Required Software

1. **Azure CLI** (version 2.50 or later)
   ```powershell
   # Check if installed
   az version
   
   # Install if needed
   # Download from: https://aka.ms/installazurecliwindows
   ```

2. **Node.js** (version 18 or later)
   ```powershell
   # Check version
   node --version
   npm --version
   ```

3. **PowerShell** (version 7.0 or later recommended)
   ```powershell
   # Check version
   $PSVersionTable.PSVersion
   ```

### Azure Account Setup

1. **Active Azure Subscription**
   - Subscription ID: `d9f78e2d-60c6-4a0a-a6df-85c33540dd5e`
   - Resource Group: `rg-tim5`

2. **Required Permissions**
   - Contributor role on the resource group
   - Ability to create resources (App Service, MySQL, Storage)

3. **Login to Azure**
   ```powershell
   az login
   az account set --subscription d9f78e2d-60c6-4a0a-a6df-85c33540dd5e
   az account show
   ```

---

## 🏗️ Infrastructure Deployment

### Step 1: Install Dependencies

```powershell
# Backend dependencies (includes MySQL driver)
npm install

# Frontend dependencies
cd frontend
npm install
cd ..
```

### Step 2: Review Infrastructure Template

The Bicep template (`infrastructure/main.bicep`) will create:

- ✅ **Azure Database for MySQL** - Flexible Server with 20GB storage
- ✅ **Azure Storage Account** - For PDF document storage
- ✅ **Azure App Service Plan** - Linux-based, B1 tier
- ✅ **Azure App Service** - Node.js 18 runtime
- ✅ **Azure Key Vault** - For secrets management
- ✅ **Application Insights** - For monitoring and logging

### Step 3: Deploy Infrastructure

```powershell
# Run deployment script
.\scripts\deploy-infrastructure.ps1 `
  -SubscriptionId "d9f78e2d-60c6-4a0a-a6df-85c33540dd5e" `
  -ResourceGroupName "rg-tim5" `
  -Location "West Europe" `
  -Environment "dev"
```

**What happens:**
1. Validates Azure CLI and Bicep installation
2. Authenticates to Azure
3. Creates/validates resource group
4. Generates secure database password
5. Deploys all Azure resources
6. Saves deployment info to `deployment-info-dev.json`
7. Saves credentials to `.credentials-dev.txt`

**Expected Duration:** 10-15 minutes

### Step 4: Save Deployment Outputs

After deployment completes, you'll see:

```
✅ DEPLOYMENT COMPLETED SUCCESSFULLY!

📊 Deployment Summary:
Web App Name: microhack-dev-app
Web App URL: https://microhack-dev-app.azurewebsites.net
Database Server: microhack-dev-dbserver
MySQL FQDN: microhack-dev-dbserver.mysql.database.azure.com
Storage Account: microhackdevstorage
Key Vault: microhack-dev-kv
```

**IMPORTANT:** Save the database password from `.credentials-dev.txt` to a secure location (password manager) and delete the file!

---

## 🗄️ Database Migration

### Step 5: Configure Database Connection

Update `.env.production` with your deployment values:

```bash
DATABASE_TYPE=mysql
MYSQL_HOST=microhack-dev-dbserver.mysql.database.azure.com
MYSQL_PORT=3306
MYSQL_USER=microhackadmin
MYSQL_PASSWORD=<your-generated-password>
MYSQL_DATABASE=microhack_dev
MYSQL_SSL=true
```

### Step 6: Test MySQL Connection Locally

```powershell
# Test database connection
node -e "require('dotenv').config({path: '.env.production'}); require('./database-mysql');"
```

You should see:
```
✅ Connected to MySQL database successfully
   Host: microhack-dev-dbserver.mysql.database.azure.com
   Database: microhack_dev
🔧 Initializing MySQL database tables...
✅ MySQL database tables initialized successfully
```

### Step 7: Migrate Data from SQLite to MySQL

**⚠️ Backup First:**
```powershell
# Backup SQLite database
Copy-Item db.sqlite db.sqlite.backup-$(Get-Date -Format 'yyyyMMdd')
```

**Run Migration:**
```powershell
# Set environment to production
$env:NODE_ENV = 'production'

# Run migration script
npm run migrate:mysql
```

**What happens:**
1. Connects to both SQLite and MySQL
2. Exports all data from SQLite (documents, approvers, predefined_approvers)
3. Imports data to MySQL with proper ID mapping
4. Verifies data integrity
5. Generates migration report

**Expected Output:**
```
✅ MIGRATION COMPLETED SUCCESSFULLY!

📊 Migration Summary:
   Documents:            X/X
   Approvers:            Y/Y
   Predefined Approvers: 8/8
   Errors:               0
```

---

## 📦 Application Deployment

### Step 8: Build Application

```powershell
# Build frontend for production
cd frontend
npm run build
cd ..
```

This creates an optimized production build in `frontend/build/`.

### Step 9: Deploy to Azure App Service

```powershell
# Deploy application
.\scripts\deploy-application.ps1 `
  -Environment "dev" `
  -ResourceGroupName "rg-tim5" `
  -WebAppName "microhack-dev-app"
```

**What happens:**
1. Runs tests (optional)
2. Installs production dependencies
3. Builds frontend
4. Packages backend + frontend
5. Creates deployment ZIP
6. Uploads to Azure App Service
7. Restarts application

**Expected Duration:** 5-10 minutes

---

## ✅ Verification & Testing

### Step 10: Verify Deployment

1. **Check Application URL:**
   ```
   https://microhack-dev-app.azurewebsites.net
   ```

2. **Test Health Endpoint:**
   ```powershell
   Invoke-WebRequest -Uri "https://microhack-dev-app.azurewebsites.net/health"
   ```

3. **Monitor Application Logs:**
   ```powershell
   az webapp log tail `
     --name microhack-dev-app `
     --resource-group rg-tim5
   ```

### Step 11: Test Application Features

1. **Upload Document:**
   - Navigate to Upload tab
   - Select a PDF file
   - Add comment
   - Click Upload

2. **Sign Document:**
   - Go to Sign tab
   - Click "Add signature and lock"
   - Verify PDF has signature

3. **Add Approvers:**
   - Go to Approvers tab
   - Select approvers or enter emails
   - Submit

4. **Approve/Reject:**
   - Use simulation buttons
   - Check status updates

5. **View All Documents:**
   - Check Documents tab
   - Verify statistics
   - View document details

---

## 🔍 Troubleshooting

### Common Issues

#### Issue: Application not starting

**Check logs:**
```powershell
az webapp log tail --name microhack-dev-app --resource-group rg-tim5
```

**Verify environment variables:**
```powershell
az webapp config appsettings list `
  --name microhack-dev-app `
  --resource-group rg-tim5
```

#### Issue: Database connection failed

**Check firewall rules:**
```powershell
az mysql flexible-server firewall-rule list `
  --name microhack-dev-dbserver `
  --resource-group rg-tim5
```

**Add your IP if needed:**
```powershell
az mysql flexible-server firewall-rule create `
  --name microhack-dev-dbserver `
  --resource-group rg-tim5 `
  --rule-name AllowMyIP `
  --start-ip-address <your-ip> `
  --end-ip-address <your-ip>
```

#### Issue: File upload not working

**Check storage account:**
```powershell
az storage account show `
  --name microhackdevstorage `
  --resource-group rg-tim5
```

**Verify blob container:**
```powershell
az storage container show `
  --name documents `
  --account-name microhackdevstorage
```

#### Issue: MySQL SSL connection error

Add to `.env.production`:
```bash
MYSQL_SSL=true
```

Restart application:
```powershell
az webapp restart --name microhack-dev-app --resource-group rg-tim5
```

### Debug Mode

Enable detailed logging:

```powershell
az webapp config appsettings set `
  --name microhack-dev-app `
  --resource-group rg-tim5 `
  --settings LOG_LEVEL=debug
```

---

## 💰 Cost Optimization

### Current Configuration (Dev Environment)

| Resource | SKU | Estimated Cost/Month |
|----------|-----|---------------------|
| MySQL Flexible Server | B_Gen5_1 | ~€25 |
| App Service Plan | B1 | ~€13 |
| Storage Account | Standard LRS | ~€1 |
| Application Insights | Free tier | €0 |
| **Total** | | **~€40** |

### Cost Saving Tips

1. **Auto-shutdown for dev/test:**
   ```powershell
   # Stop app service when not in use
   az webapp stop --name microhack-dev-app --resource-group rg-tim5
   
   # Start when needed
   az webapp start --name microhack-dev-app --resource-group rg-tim5
   ```

2. **Use deployment slots for staging:**
   - Avoids creating separate environments
   - Swap slots for zero-downtime deployment

3. **Monitor and optimize:**
   - Review Application Insights metrics
   - Identify unused resources
   - Right-size based on usage

---

## 📊 Monitoring & Maintenance

### Application Insights

Access metrics at:
```
https://portal.azure.com → Application Insights → microhack-dev-ai
```

**Key Metrics:**
- Request rate and response times
- Failed requests
- Database query performance
- Custom events (document uploads, approvals)

### Backup Strategy

**Database Backups:**
- Automatic daily backups (7-day retention)
- Point-in-time restore available

**Manual backup:**
```powershell
az mysql flexible-server backup create `
  --name microhack-dev-dbserver `
  --resource-group rg-tim5 `
  --backup-name manual-backup-$(Get-Date -Format 'yyyyMMdd')
```

**Blob Storage:**
- Enable soft delete for blobs
- Set lifecycle policies for old documents

---

## 🔒 Security Best Practices

1. **Secrets Management:**
   - Store passwords in Azure Key Vault
   - Use Managed Identity for App Service

2. **Network Security:**
   - Enable firewall rules on MySQL
   - Restrict storage account access
   - Use private endpoints (production)

3. **Application Security:**
   - Keep dependencies updated
   - Enable HTTPS only
   - Configure CORS properly
   - Implement rate limiting

---

## 📝 Deployment Checklist

### Pre-Deployment
- [ ] Azure CLI installed and configured
- [ ] Node.js 18+ installed
- [ ] All dependencies installed (`npm install`)
- [ ] Tests passing (`npm test`)
- [ ] Backup created (SQLite database)

### Infrastructure
- [ ] Infrastructure deployed (`deploy-infrastructure.ps1`)
- [ ] Deployment outputs saved
- [ ] Database password saved securely
- [ ] Firewall rules configured
- [ ] Resource tagging completed

### Database
- [ ] `.env.production` configured
- [ ] MySQL connection tested
- [ ] Data migrated (`npm run migrate:mysql`)
- [ ] Migration verified (row counts match)

### Application
- [ ] Frontend built (`npm run build`)
- [ ] Application deployed (`deploy-application.ps1`)
- [ ] Health check passing
- [ ] Features tested end-to-end

### Post-Deployment
- [ ] Application Insights configured
- [ ] Monitoring alerts set up
- [ ] Documentation updated
- [ ] Team notified
- [ ] Credentials stored securely

---

## 🆘 Support & Resources

### Azure Resources
- [Azure CLI Documentation](https://docs.microsoft.com/en-us/cli/azure/)
- [Azure Bicep Documentation](https://docs.microsoft.com/en-us/azure/azure-resource-manager/bicep/)
- [Azure MySQL Documentation](https://docs.microsoft.com/en-us/azure/mysql/)
- [Azure App Service Documentation](https://docs.microsoft.com/en-us/azure/app-service/)

### Project Resources
- Main Documentation: `DOKUMENTACIA.md`
- Technical Design: `DESIGN_DOCUMENT.md`
- Testing Guide: `TESTING.md`
- Agent Guidelines: `agents.md`

---

## ✨ Next Steps After Deployment

1. **Configure Custom Domain** (Optional)
   - Purchase domain
   - Add DNS records
   - Configure SSL certificate

2. **Set Up CI/CD** (Optional)
   - GitHub Actions
   - Azure DevOps Pipelines

3. **Production Environment**
   - Deploy to separate resource group
   - Use higher SKU tiers
   - Enable geo-redundancy
   - Configure backup retention

4. **User Training**
   - Document workflows
   - Create user guides
   - Conduct training sessions

---

**Deployment completed! Your Microhack application is now running on Azure! 🎉**
