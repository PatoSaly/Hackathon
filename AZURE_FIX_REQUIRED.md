# 🔧 AZURE CONFIGURATION REQUIRED

## ✅ What's Fixed
- Node.js version updated to 20.19.3
- Application code updated with health check
- Better error handling and logging

## ❌ What Needs to Be Done

### CRITICAL: Set Environment Variables in Azure

Your app is failing because Azure doesn't have the required environment variables set.

### Quick Fix (5 minutes)

1. **Open Azure Portal**
   - Go to https://portal.azure.com
   - Find your app: `microhack-dev-app`

2. **Add Environment Variables**
   - Click **Configuration** (left menu)
   - Click **Application settings** tab
   - Click **+ New application setting**
   
   Add these:
   
   | Name | Value |
   |------|-------|
   | `NODE_ENV` | `production` |
   | `DATABASE_TYPE` | `sqlite` |
   | `STORAGE_TYPE` | `local` |
   
3. **Save**
   - Click **Save** at the top
   - Click **Continue** when prompted
   - Wait 30 seconds for restart

4. **Test**
   - Open: https://microhack-dev-app.azurewebsites.net/api/health
   - Should see JSON response with status "OK"

### Alternative: Use Azure CLI

```powershell
az webapp config appsettings set `
  --name microhack-dev-app `
  --resource-group <your-resource-group> `
  --settings `
    NODE_ENV=production `
    DATABASE_TYPE=sqlite `
    STORAGE_TYPE=local

az webapp restart --name microhack-dev-app --resource-group <your-resource-group>
```

Replace `<your-resource-group>` with your actual resource group name.

### How to Find Your Resource Group

```powershell
az webapp show --name microhack-dev-app --query resourceGroup -o tsv
```

## After Configuration

Your app should:
- ✅ Show health check at `/api/health`
- ✅ Display the React frontend at `/`
- ✅ Accept API requests at `/api/*`

## Troubleshooting

**Still seeing "Application Error"?**

Check logs:
```powershell
az webapp log tail --name microhack-dev-app --resource-group <your-resource-group>
```

Look for:
```
🚀 Starting Microhack Application...
✅ Server is running on port 8080
```

**Need to access Azure SSH?**
```powershell
az webapp ssh --name microhack-dev-app --resource-group <your-resource-group>
```

Then check:
```bash
cd /home/site/wwwroot
ls -la
cat .node-version  # Should show: 20
node --version     # Should show: v20.x.x
```

## Next Deployment

After you set environment variables and the app works:

1. Commit code changes:
```powershell
git add .
git commit -m "fix: Add health check and improve Azure deployment"
git push origin main
```

2. GitHub Actions will automatically deploy

3. App will restart with new code

## Need Help?

Check the detailed guide: `NODE_VERSION_FIX.md`
