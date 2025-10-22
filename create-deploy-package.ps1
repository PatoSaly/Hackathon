# Deploy script with Linux-compatible ZIP

# Remove old files
Remove-Item deploy-manual -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item deploy-manual.zip -Force -ErrorAction SilentlyContinue

# Create temp directory with Linux structure
New-Item -ItemType Directory -Path "deploy-manual" | Out-Null

# Copy backend files (root level)
Copy-Item -Path "server.js" -Destination "deploy-manual\"
Copy-Item -Path "database.js" -Destination "deploy-manual\"
Copy-Item -Path "database-mysql.js" -Destination "deploy-manual\"
Copy-Item -Path "azure-storage.js" -Destination "deploy-manual\"
Copy-Item -Path "package.json" -Destination "deploy-manual\"
Copy-Item -Path "package-lock.json" -Destination "deploy-manual\"
Copy-Item -Path "web.config" -Destination "deploy-manual\"

# Copy frontend build (as 'build' subdirectory)
Copy-Item -Path "frontend\build" -Destination "deploy-manual\build" -Recurse

Write-Host "Files copied to deploy-manual directory"
Write-Host "Creating ZIP archive..."

# Use 7-Zip if available, otherwise try tar
if (Get-Command "7z.exe" -ErrorAction SilentlyContinue) {
    Set-Location deploy-manual
    & 7z.exe a -tzip ..\deploy-manual.zip *
    Set-Location ..
    Write-Host "ZIP created with 7-Zip"
} elseif (Get-Command "tar.exe" -ErrorAction SilentlyContinue) {
    tar.exe -czf deploy-manual.tar.gz -C deploy-manual .
    Rename-Item deploy-manual.tar.gz deploy-manual.zip
    Write-Host "ZIP created with tar"
} else {
    # Use PowerShell method but try to handle paths
    Set-Location deploy-manual
    Get-ChildItem -Recurse | Compress-Archive -DestinationPath "..\deploy-manual.zip" -CompressionLevel Optimal
    Set-Location ..
    Write-Host "ZIP created with Compress-Archive"
}

Write-Host "Deployment package ready: deploy-manual.zip"
