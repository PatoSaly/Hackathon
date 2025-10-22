# 🚀 Azure Configuration Guide - MySQL + Azure Storage

## 📋 Prehľad

Tento návod vám ukáže, ako nakonfigurovať Azure Web App s:
- ✅ **MySQL Database** (Azure Database for MySQL)
- ✅ **Azure Blob Storage** (pre dokumenty)
- ✅ **Všetky potrebné environment variables**

## 🎯 Krok 1: Získanie Potrebných Údajov

### A) Resource Group Name

```powershell
# Zistiť resource group pre vašu web app
az webapp show --name microhack-dev-app --query resourceGroup -o tsv
```

### B) MySQL Database Credentials

#### Ak už máte MySQL server:

```powershell
# Získať hostname
az mysql flexible-server show --name <your-mysql-server> --resource-group <your-rg> --query fullyQualifiedDomainName -o tsv

# Výstup: your-mysql-server.mysql.database.azure.com
```

#### Ak potrebujete vytvoriť nový MySQL server:

```powershell
# 1. Vytvorenie MySQL servera
az mysql flexible-server create \
  --name microhack-mysql \
  --resource-group <your-rg> \
  --location westeurope \
  --admin-user microhackadmin \
  --admin-password 'YourSecurePassword123!' \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 8.0.21

# 2. Povoliť Azure services prístup
az mysql flexible-server firewall-rule create \
  --name microhack-mysql \
  --resource-group <your-rg> \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# 3. Vytvoriť databázu
az mysql flexible-server db create \
  --resource-group <your-rg> \
  --server-name microhack-mysql \
  --database-name microhack
```

**Zapíšte si:**
- Host: `microhack-mysql.mysql.database.azure.com`
- User: `microhackadmin`
- Password: `YourSecurePassword123!`
- Database: `microhack`

### C) Azure Storage Account

#### Ak už máte Storage Account:

```powershell
# Získať meno storage accountu
az storage account list --resource-group <your-rg> --query "[].name" -o tsv

# Získať access key
az storage account keys list \
  --account-name <your-storage-account> \
  --resource-group <your-rg> \
  --query "[0].value" -o tsv

# Alebo získať connection string
az storage account show-connection-string \
  --name <your-storage-account> \
  --resource-group <your-rg> \
  --query connectionString -o tsv
```

#### Ak potrebujete vytvoriť nový Storage Account:

```powershell
# 1. Vytvorenie storage accountu
az storage account create \
  --name microhackstorage \
  --resource-group <your-rg> \
  --location westeurope \
  --sku Standard_LRS \
  --kind StorageV2

# 2. Získať access key
az storage account keys list \
  --account-name microhackstorage \
  --resource-group <your-rg> \
  --query "[0].value" -o tsv

# 3. Vytvoriť container
az storage container create \
  --name microhack-documents \
  --account-name microhackstorage \
  --auth-mode key
```

**Zapíšte si:**
- Account Name: `microhackstorage`
- Access Key: `<dlhý-string>`
- Container: `microhack-documents`

## 🎯 Krok 2: Úprava Konfiguračného Skriptu

### Windows (PowerShell)

Otvorte `configure-azure-webapp.ps1` a upravte tieto riadky:

```powershell
# Resource Group
$RESOURCE_GROUP = "microhack-rg"  # <-- VÁŠ RESOURCE GROUP

# MySQL
$MYSQL_HOST = "microhack-mysql.mysql.database.azure.com"  # <-- VÁŠ MYSQL HOST
$MYSQL_DATABASE = "microhack"
$MYSQL_USER = "microhackadmin"  # <-- VÁŠ MYSQL USER
$MYSQL_PASSWORD = "YourSecurePassword123!"  # <-- VAŠE HESLO

# Azure Storage
$AZURE_STORAGE_ACCOUNT = "microhackstorage"  # <-- VÁŠ STORAGE ACCOUNT
$AZURE_STORAGE_KEY = "your-key-here"  # <-- VÁŠ ACCESS KEY
$AZURE_STORAGE_CONTAINER = "microhack-documents"
```

### Linux/Mac (Bash)

Otvorte `configure-azure-webapp.sh` a upravte rovnaké riadky.

## 🎯 Krok 3: Spustenie Konfigurácie

### Windows (PowerShell)

```powershell
# 1. Prihláste sa do Azure (ak ešte nie ste)
az login

# 2. Nastavte správnu subscription (ak máte viacero)
az account set --subscription "<subscription-id-or-name>"

# 3. Spustite konfiguračný skript
.\configure-azure-webapp.ps1
```

### Linux/Mac (Bash)

```bash
# 1. Urobte skript spustiteľným
chmod +x configure-azure-webapp.sh

# 2. Prihláste sa do Azure
az login

# 3. Nastavte subscription
az account set --subscription "<subscription-id-or-name>"

# 4. Spustite skript
./configure-azure-webapp.sh
```

## 🎯 Krok 4: Overenie

Skript automaticky:
1. ✅ Nastaví všetky environment variables
2. ✅ Nastaví startup command
3. ✅ Zapne logging
4. ✅ Reštartuje aplikáciu
5. ✅ Otestuje health check endpoint

Po dokončení skontrolujte:

```powershell
# Health check (mala by vrátiť JSON so statusom "OK")
curl https://microhack-dev-app.azurewebsites.net/api/health

# Živé logy
az webapp log tail --name microhack-dev-app --resource-group <your-rg>
```

## 📋 Kompletný Zoznam Environment Variables

Skript nastaví tieto premenné:

| Variable | Value | Purpose |
|----------|-------|---------|
| `NODE_ENV` | `production` | Production mode |
| `DATABASE_TYPE` | `mysql` | Použiť MySQL namiesto SQLite |
| `STORAGE_TYPE` | `azure` | Použiť Azure Storage namiesto local |
| `CORS_ORIGIN` | `*` | CORS pre všetky origins |
| `MYSQL_HOST` | `*.mysql.database.azure.com` | MySQL server hostname |
| `MYSQL_DATABASE` | `microhack` | Názov databázy |
| `MYSQL_USER` | `microhackadmin` | MySQL username |
| `MYSQL_PASSWORD` | `***` | MySQL heslo |
| `MYSQL_PORT` | `3306` | MySQL port |
| `MYSQL_SSL` | `true` | Vyžadovať SSL pre MySQL |
| `AZURE_STORAGE_ACCOUNT` | `microhackstorage` | Názov storage accountu |
| `AZURE_STORAGE_KEY` | `***` | Storage access key |
| `AZURE_STORAGE_CONTAINER` | `microhack-documents` | Názov containeru |

## 🔧 Manuálne Nastavenie (Alternatíva)

Ak nechcete použiť skript, môžete nastaviť manuálne cez Azure Portal:

1. Otvorte https://portal.azure.com
2. Nájdite `microhack-dev-app`
3. V ľavom menu kliknite **Configuration**
4. V záložke **Application settings** kliknite **+ New application setting**
5. Pridajte každú premennú z tabuľky vyššie
6. Kliknite **Save** a potom **Continue**
7. Počkajte na reštart (cca 30s)

## 🐛 Troubleshooting

### MySQL Connection Issues

```powershell
# Test MySQL connection z vášho počítača
mysql -h microhack-mysql.mysql.database.azure.com -u microhackadmin -p microhack

# Overiť firewall rules
az mysql flexible-server firewall-rule list \
  --name microhack-mysql \
  --resource-group <your-rg>
```

### Azure Storage Issues

```powershell
# Test storage connection
az storage container list \
  --account-name microhackstorage \
  --account-key "<your-key>"

# Overiť existenciu containeru
az storage container show \
  --name microhack-documents \
  --account-name microhackstorage \
  --account-key "<your-key>"
```

### Application Errors

```powershell
# Zobraziť logy
az webapp log tail --name microhack-dev-app --resource-group <your-rg>

# SSH do aplikácie
az webapp ssh --name microhack-dev-app --resource-group <your-rg>

# V SSH:
cd /home/site/wwwroot
node --version  # Should be v20.x
ls -la  # Check if files exist
cat .env 2>/dev/null || echo "No .env file (OK, using app settings)"
```

### Health Check Fails

```powershell
# 1. Reštart
az webapp restart --name microhack-dev-app --resource-group <your-rg>

# 2. Počkajte 60s a skúste znova
sleep 60
curl https://microhack-dev-app.azurewebsites.net/api/health

# 3. Ak stále zlyhá, pozrite logy
az webapp log tail --name microhack-dev-app --resource-group <your-rg>
```

## 📚 Ďalšie Zdroje

- [Azure Database for MySQL Documentation](https://learn.microsoft.com/en-us/azure/mysql/)
- [Azure Blob Storage Documentation](https://learn.microsoft.com/en-us/azure/storage/blobs/)
- [Azure App Service Configuration](https://learn.microsoft.com/en-us/azure/app-service/configure-common)

## 💡 Tipy

1. **Bezpečnosť**: Nikdy necommitujte heslá a keys do Git
2. **Costs**: MySQL Burstable tier je najlacnejší pre development
3. **Backups**: Zapnite automatické zálohy pre MySQL
4. **Monitoring**: Zapnite Application Insights pre lepší monitoring
5. **SSL**: MySQL SSL je povinný v production

## ✅ Next Steps

Po úspešnej konfigurácii:
1. Otestujte aplikáciu na https://microhack-dev-app.azurewebsites.net
2. Nahrajte testovací dokument
3. Overte, že sa uložil do Azure Storage
4. Skontrolujte záznamy v MySQL databáze
5. Nastavte GitHub Actions pre CI/CD (už nakonfigurované)
