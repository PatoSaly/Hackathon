# Node.js Version Fix for Azure Web App - COMPLETED ✅

## Problem
Azure Web App was using Node.js v18.20.8, but the application requires Node.js 20 because:
- `@azure/storage-blob` and related packages require Node.js >=20.0.0
- This was causing `EBADENGINE` warnings during npm install

## Status: ✅ RESOLVED
Logs now show: `NodeJS Version : v20.19.3` ✅

## Current Issue: Application Error

The app is now running Node.js 20, but getting "Application Error". This is likely due to:

### 1. Missing Environment Variables in Azure
Azure needs these Application Settings configured:

#### For MySQL + Azure Storage (RECOMMENDED for Production):

| Name | Value | Required |
|------|-------|----------|
| `NODE_ENV` | `production` | ✅ Yes |
| `DATABASE_TYPE` | `mysql` | ✅ Yes |
| `STORAGE_TYPE` | `azure` | ✅ Yes |
| `CORS_ORIGIN` | `*` or your domain | Optional |
| **MySQL Settings:** | | |
| `MYSQL_HOST` | `your-server.mysql.database.azure.com` | ✅ Yes |
| `MYSQL_DATABASE` | `microhack` | ✅ Yes |
| `MYSQL_USER` | `your-admin-user` | ✅ Yes |
| `MYSQL_PASSWORD` | `your-password` | ✅ Yes |
| `MYSQL_PORT` | `3306` | Optional (default) |
| `MYSQL_SSL` | `true` | ✅ Yes |
| **Azure Storage Settings:** | | |
| `AZURE_STORAGE_ACCOUNT` | `your-storage-account-name` | ✅ Yes |
| `AZURE_STORAGE_KEY` | `your-storage-access-key` | ✅ Yes |
| `AZURE_STORAGE_CONTAINER` | `microhack-documents` | ✅ Yes |

#### For SQLite + Local Storage (Simple, for Development):

| Name | Value | Required |
|------|-------|----------|
| `NODE_ENV` | `production` | ✅ Yes |
| `DATABASE_TYPE` | `sqlite` | Optional (default) |
| `STORAGE_TYPE` | `local` | Optional (default) |
| `CORS_ORIGIN` | `*` | Optional |

### 2. How to Set Environment Variables

**📝 IMPORTANT: See `AZURE_MYSQL_STORAGE_SETUP.md` for complete MySQL + Storage setup guide!**

**Option A: Quick Setup Script (RECOMMENDED)**

1. **Get your MySQL and Storage credentials** (see `AZURE_MYSQL_STORAGE_SETUP.md`)
2. **Edit the quick setup script**:
   - Open `quick-setup.ps1` (Windows) or `quick-setup.sh` (Linux/Mac)
   - Update: Resource Group, MySQL credentials, Azure Storage credentials
3. **Run the script**:
   ```powershell
   # Windows PowerShell
   .\quick-setup.ps1
   
   # Linux/Mac Bash
   chmod +x quick-setup.sh && ./quick-setup.sh
   ```

**Option B: Full Configuration Script (WITH VALIDATION)**

Use the comprehensive setup script that validates everything:
```powershell
# Windows
.\configure-azure-webapp.ps1

# Linux/Mac
chmod +x configure-azure-webapp.sh && ./configure-azure-webapp.sh
```

**Option C: Azure Portal (GUI)**
1. Go to Azure Portal → `microhack-dev-app`
2. Navigate to **Settings** → **Configuration**
3. Click **+ New application setting**
4. Add each variable from table above
5. Click **Save** at the top
6. Click **Continue** when prompted
7. Wait for restart to complete

**Option D: Azure CLI (Manual)**

For **MySQL + Azure Storage**:
```bash
# Replace <your-values> with actual values
az webapp config appsettings set \
  --name microhack-dev-app \
  --resource-group <your-resource-group> \
  --settings \
    NODE_ENV=production \
    DATABASE_TYPE=mysql \
    STORAGE_TYPE=azure \
    CORS_ORIGIN=* \
    MYSQL_HOST=<your-mysql-host>.mysql.database.azure.com \
    MYSQL_DATABASE=microhack \
    MYSQL_USER=<your-mysql-user> \
    MYSQL_PASSWORD='<your-mysql-password>' \
    MYSQL_PORT=3306 \
    MYSQL_SSL=true \
    AZURE_STORAGE_ACCOUNT=<your-storage-account> \
    AZURE_STORAGE_KEY='<your-storage-key>' \
    AZURE_STORAGE_CONTAINER=microhack-documents

# Then restart
az webapp restart --name microhack-dev-app --resource-group <your-resource-group>
```

For **SQLite + Local Storage** (simple):
```bash
az webapp config appsettings set \
  --name microhack-dev-app \
  --resource-group <your-resource-group> \
  --settings \
    NODE_ENV=production \
    DATABASE_TYPE=sqlite \
    STORAGE_TYPE=local \
    CORS_ORIGIN=*
```

### 3. Verify Deployment

After setting environment variables, check these URLs:

**Health Check:**
```
https://microhack-dev-app.azurewebsites.net/api/health
```

This should return JSON with application status.

**Application:**
```
https://microhack-dev-app.azurewebsites.net
```

### 4. Check Logs

**Enable Application Logging:**
1. Azure Portal → Your Web App
2. **Monitoring** → **App Service logs**
3. Enable **Application Logging (Filesystem)**
4. Set Level to **Verbose**
5. **Save**

**View Live Logs:**
```bash
az webapp log tail --name microhack-dev-app --resource-group <your-resource-group>
```

Or in Azure Portal:
1. **Monitoring** → **Log stream**

### 5. Troubleshooting Steps

If still seeing errors:

#### Check 1: Startup Command
Make sure startup command is correct:
1. Azure Portal → **Configuration** → **General settings**
2. **Startup Command** should be: `node server.js`
3. Save and restart

#### Check 2: Files Deployed
Verify files are in `/home/site/wwwroot`:
```bash
az webapp ssh --name microhack-dev-app --resource-group <your-resource-group>
ls -la /home/site/wwwroot
```

Should see:
- `server.js`
- `package.json`
- `node_modules/`
- `frontend/build/` or `build/`
- `database.js`

#### Check 3: Database File Permissions
If using SQLite:
```bash
# In SSH session
cd /home/site/wwwroot
touch db.sqlite
chmod 666 db.sqlite
```

#### Check 4: Application Insights
If you have Application Insights enabled, check there for detailed errors.

### 6. Quick Fixes

**Restart the app:**
```bash
az webapp restart --name microhack-dev-app --resource-group <your-resource-group>
```

**Clear deployment cache:**
```bash
az webapp deployment source delete --name microhack-dev-app --resource-group <your-resource-group>
```

Then redeploy from GitHub Actions.

## Changes Made to Code

### 1. Updated `package.json`
```json
"engines": {
  "node": "20.x",
  "npm": ">=10.0.0"
}
```

### 2. Created `.node-version` file
```
20
```

### 3. Updated GitHub Actions workflow
Added `.node-version` to deployment package

### 4. Fixed `server.js`
- Added health check endpoint `/api/health`
- Fixed frontend static file serving (checks both `frontend/build` and `build`)
- Added better startup logging
- Added error handling for server startup

## Next Steps

1. ✅ **Set environment variables** in Azure Portal (see table above)
2. ✅ **Restart the app**
3. ✅ **Check `/api/health` endpoint**
4. ✅ **View logs** to see startup messages
5. ✅ **Test the application**

## Expected Logs After Fix

You should see:
```
🚀 Starting Microhack Application...
📌 Environment: production
📌 Database: sqlite
📌 Storage: local
📌 Port: 8080
📌 CORS Origin: *
✅ Upload directory ready: /home/site/wwwroot/uploads
✅ Server is running on port 8080
🌐 Health check: http://localhost:8080/api/health
```

## Support

If issues persist:
1. Check the health endpoint response
2. Review live logs in Azure Portal
3. Verify all environment variables are set
4. Check GitHub Actions deployment logs
5. Try manual restart of the app
