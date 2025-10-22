# Node.js Version Fix for Azure Web App

## Problem
Azure Web App was using Node.js v18.20.8, but the application requires Node.js 20 because:
- `@azure/storage-blob` and related packages require Node.js >=20.0.0
- This was causing `EBADENGINE` warnings during npm install

## Changes Made

### 1. Updated `package.json`
```json
"engines": {
  "node": "20.x",
  "npm": ">=10.0.0"
}
```

### 2. Created `.node-version` file
This file tells Azure which Node.js version to use:
```
20
```

### 3. Updated GitHub Actions workflow
Added `.node-version` to deployment package in `.github/workflows/main_microhack-dev-app.yml`

## Additional Steps Required in Azure Portal

You may also need to configure the Node.js version directly in Azure:

### Option 1: Using Azure Portal
1. Go to Azure Portal → Your Web App (`microhack-dev-app`)
2. Navigate to **Configuration** → **General settings**
3. Set **Stack**: `Node`
4. Set **Major version**: `20 LTS`
5. Set **Minor version**: `20` (latest)
6. Click **Save**

### Option 2: Using Azure CLI
```bash
az webapp config set --resource-group <your-resource-group> \
  --name microhack-dev-app \
  --linux-fx-version "NODE|20-lts"
```

### Option 3: Using Application Settings
Add an application setting:
- **Name**: `WEBSITE_NODE_DEFAULT_VERSION`
- **Value**: `~20`

## Verification

After deployment, check the logs to verify Node.js 20 is being used:
```
NodeJS Version : v20.x.x  # Should show v20 instead of v18
```

## Next Steps

1. **Commit these changes**:
   ```bash
   git add package.json .node-version .github/workflows/main_microhack-dev-app.yml
   git commit -m "fix: Update Node.js version to 20 for Azure compatibility"
   git push origin main
   ```

2. **Configure Azure** (choose one option above)

3. **Restart the Web App** after configuration:
   ```bash
   az webapp restart --name microhack-dev-app --resource-group <your-resource-group>
   ```
   Or use Azure Portal: Your Web App → Overview → Restart

4. **Monitor deployment** in GitHub Actions

5. **Verify** the application logs show Node.js v20

## Expected Result

After these changes, you should see:
- ✅ `NodeJS Version : v20.x.x` in logs
- ✅ No `EBADENGINE` warnings
- ✅ Successful npm install
- ✅ Application starts correctly

## Troubleshooting

If the issue persists:
1. Check `deployment logs` in Azure Portal
2. Verify `.node-version` file is in the deployed package
3. Check Application Settings in Azure Portal
4. Try explicit `WEBSITE_NODE_DEFAULT_VERSION` setting
5. Clear deployment cache and redeploy
