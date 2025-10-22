# 📚 Azure Configuration Files Overview

## 🎯 Ktorý súbor použiť?

### Pre Rýchle Nastavenie (5 minút):
✅ **`quick-setup.ps1`** (Windows) alebo **`quick-setup.sh`** (Linux/Mac)
- Jeden príkaz nastaví všetko
- Najrýchlejšia možnosť
- Vyžaduje len úpravu credentials v súbore

### Pre Kompletný Setup s Validáciou:
✅ **`configure-azure-webapp.ps1`** (Windows) alebo **`configure-azure-webapp.sh`** (Linux/Mac)
- Overí všetky nastavenia
- Zobrazí diagnostické informácie
- Automaticky testuje health check
- Interaktívne zobrazenie logov

### Pre Detailné Inštrukcie:
✅ **`AZURE_MYSQL_STORAGE_SETUP.md`**
- Kompletný sprievodca ako získať credentials
- Ako vytvoriť MySQL server
- Ako vytvoriť Storage Account
- Troubleshooting

### Pre Node.js Version Fix:
✅ **`NODE_VERSION_FIX.md`**
- Prehľad všetkých potrebných environment variables
- Rôzne možnosti konfigurácie
- Troubleshooting guide

### Pre Rýchlu Opravu:
✅ **`AZURE_FIX_REQUIRED.md`**
- 5-minútový quick fix guide
- Základné kroky
- Minimálna konfigurácia

## 📋 Súbory v Projekte

```
Microabaphack/
├── quick-setup.ps1                    # ⚡ QUICK: Windows one-liner setup
├── quick-setup.sh                     # ⚡ QUICK: Linux/Mac one-liner setup
├── configure-azure-webapp.ps1         # 🔧 FULL: Windows comprehensive setup
├── configure-azure-webapp.sh          # 🔧 FULL: Linux/Mac comprehensive setup
├── AZURE_MYSQL_STORAGE_SETUP.md       # 📖 Complete guide for MySQL + Storage
├── NODE_VERSION_FIX.md                # 📖 Environment variables reference
├── AZURE_FIX_REQUIRED.md              # 📖 Quick fix guide
└── THIS_FILE.md                       # 📚 This overview
```

## 🚀 Odporúčaný Workflow

### Scenario 1: Mám už MySQL a Storage Account
```powershell
# 1. Získaj credentials (pozri AZURE_MYSQL_STORAGE_SETUP.md, Krok 1)
# 2. Uprav quick-setup.ps1 s tvojimi údajmi
# 3. Spusti:
.\quick-setup.ps1
```

### Scenario 2: Nemám ešte MySQL ani Storage
```powershell
# 1. Prečítaj AZURE_MYSQL_STORAGE_SETUP.md
# 2. Vytvor MySQL server a Storage Account (príkazy v guide)
# 3. Uprav configure-azure-webapp.ps1
# 4. Spusti:
.\configure-azure-webapp.ps1
```

### Scenario 3: Chcem len základnú konfiguráciu (SQLite + Local)
```powershell
# 1. Spusti jednoduchý príkaz:
az webapp config appsettings set `
  --name microhack-dev-app `
  --resource-group <your-rg> `
  --settings NODE_ENV=production

# 2. Restart:
az webapp restart --name microhack-dev-app --resource-group <your-rg>
```

## 🔑 Potrebné Credentials

### Pre MySQL:
- ✅ MySQL Host (e.g., `server.mysql.database.azure.com`)
- ✅ MySQL Database name (e.g., `microhack`)
- ✅ MySQL User (e.g., `microhackadmin`)
- ✅ MySQL Password

### Pre Azure Storage:
- ✅ Storage Account name (e.g., `microhackstorage`)
- ✅ Storage Access Key (dlhý string)
- ✅ Container name (e.g., `microhack-documents`)

### Kde Nájsť:
```powershell
# Resource Group
az webapp show --name microhack-dev-app --query resourceGroup -o tsv

# MySQL Host
az mysql flexible-server show --name <your-mysql> --resource-group <rg> --query fullyQualifiedDomainName -o tsv

# Storage Key
az storage account keys list --account-name <storage> --resource-group <rg> --query "[0].value" -o tsv
```

## ✅ Po Konfigurácii

### 1. Overte Health Check:
```
https://microhack-dev-app.azurewebsites.net/api/health
```

Mala by vrátiť:
```json
{
  "status": "OK",
  "environment": {
    "database": "mysql",
    "storage": "azure",
    "nodeVersion": "v20.19.3"
  }
}
```

### 2. Skontrolujte Logy:
```powershell
az webapp log tail --name microhack-dev-app --resource-group <your-rg>
```

Očakávané logy:
```
🚀 Starting Microhack Application...
📌 Environment: production
📌 Database: mysql
📌 Storage: azure
✅ Server is running on port 8080
```

### 3. Testujte Aplikáciu:
```
https://microhack-dev-app.azurewebsites.net
```

## 🆘 Troubleshooting

### Ak Health Check Zlyhá:
1. Skontrolujte logy: `az webapp log tail --name microhack-dev-app --resource-group <rg>`
2. Overte env variables: `az webapp config appsettings list --name microhack-dev-app --resource-group <rg>`
3. Reštartujte app: `az webapp restart --name microhack-dev-app --resource-group <rg>`

### Ak MySQL Connection Zlyhá:
1. Overte firewall rules v MySQL serveri
2. Skontrolujte SSL nastavenie
3. Testujte connection z lokálneho PC

### Ak Azure Storage Zlyhá:
1. Overte access key
2. Skontrolujte či container existuje
3. Overte permissions na container

## 📞 Podpora

- 📖 **Detailný Guide**: `AZURE_MYSQL_STORAGE_SETUP.md`
- ⚡ **Quick Fix**: `AZURE_FIX_REQUIRED.md`
- 🔧 **Environment Variables**: `NODE_VERSION_FIX.md`
- 💬 **Azure Docs**: https://learn.microsoft.com/azure

## 🎯 Quick Reference Commands

```powershell
# Login
az login

# Zistiť Resource Group
az webapp show --name microhack-dev-app --query resourceGroup -o tsv

# Nastaviť env variables (quick)
.\quick-setup.ps1

# Zobraziť logy
az webapp log tail --name microhack-dev-app --resource-group <rg>

# Reštart
az webapp restart --name microhack-dev-app --resource-group <rg>

# SSH do app
az webapp ssh --name microhack-dev-app --resource-group <rg>

# Zobraziť settings
az webapp config appsettings list --name microhack-dev-app --resource-group <rg>
```
