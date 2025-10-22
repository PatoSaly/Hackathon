// main.bicep - Azure Infrastructure as Code using Bicep
// Microhack Document Management System - Infrastructure Definition

@description('Project name used for resource naming')
param projectName string = 'microhack'

@description('Environment name')
@allowed(['dev', 'test', 'prod'])
param environment string = 'dev'

@description('Location for all resources')
param location string = resourceGroup().location

@description('Database administrator login name')
param administratorLogin string = 'microhackadmin'

@secure()
@description('Database administrator password - min 8 chars, must contain uppercase, lowercase, number')
param administratorLoginPassword string

@description('Database SKU name for MySQL')
@allowed(['B_Gen5_1', 'B_Gen5_2', 'GP_Gen5_2', 'GP_Gen5_4'])
param databaseSkuName string = 'B_Gen5_1'

@description('Database SKU tier')
@allowed(['Basic', 'GeneralPurpose', 'MemoryOptimized'])
param databaseSkuTier string = 'Basic'

@description('App Service Plan SKU')
@allowed(['B1', 'B2', 'S1', 'S2', 'P1V2', 'P2V2'])
param appServicePlanSku string = 'B1'

@description('Enable Application Insights')
param enableApplicationInsights bool = true

@description('Enable Key Vault for secret management')
param enableKeyVault bool = true

// =========================================================
// Variables
// =========================================================
var resourcePrefix = '${projectName}-${environment}'
var appServicePlanName = '${resourcePrefix}-asp'
var webAppName = '${resourcePrefix}-app'
var storageAccountName = toLower(replace('${resourcePrefix}storage', '-', ''))
var databaseServerName = '${resourcePrefix}-dbserver'
var databaseName = '${projectName}_${environment}'
var keyVaultName = take('${resourcePrefix}-kv', 24) // Key Vault names max 24 chars
var applicationInsightsName = '${resourcePrefix}-ai'
var logAnalyticsWorkspaceName = '${resourcePrefix}-logs'

// =========================================================
// Log Analytics Workspace (pre Application Insights)
// =========================================================
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2021-12-01-preview' = if (enableApplicationInsights) {
  name: logAnalyticsWorkspaceName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}

// =========================================================
// Application Insights
// =========================================================
resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = if (enableApplicationInsights) {
  name: applicationInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: enableApplicationInsights ? logAnalyticsWorkspace.id : null
    RetentionInDays: 90
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// =========================================================
// Storage Account pre PDF dokumenty
// =========================================================
resource storageAccount 'Microsoft.Storage/storageAccounts@2021-09-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: true
    accessTier: 'Hot'
    encryption: {
      services: {
        blob: {
          enabled: true
        }
      }
      keySource: 'Microsoft.Storage'
    }
  }

  resource blobService 'blobServices@2021-09-01' = {
    name: 'default'
    
    resource documentsContainer 'containers@2021-09-01' = {
      name: 'documents'
      properties: {
        publicAccess: 'Blob'
        metadata: {
          description: 'Container for uploaded PDF documents'
        }
      }
    }
  }
}

// =========================================================
// Azure Database for MySQL Flexible Server
// =========================================================
resource mysqlServer 'Microsoft.DBforMySQL/flexibleServers@2021-12-01-preview' = {
  name: databaseServerName
  location: location
  sku: {
    name: databaseSkuName
    tier: databaseSkuTier
  }
  properties: {
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorLoginPassword
    version: '8.0.21'
    storage: {
      storageSizeGB: 20
      autoGrow: 'Enabled'
      iops: 360
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }

  // Vytvorenie databázy
  resource database 'databases@2021-12-01-preview' = {
    name: databaseName
    properties: {
      charset: 'utf8mb4'
      collation: 'utf8mb4_unicode_ci'
    }
  }

  // Firewall rule pre Azure Services
  resource firewallRuleAzure 'firewallRules@2021-12-01-preview' = {
    name: 'AllowAzureServices'
    properties: {
      startIpAddress: '0.0.0.0'
      endIpAddress: '0.0.0.0'
    }
  }

  // Firewall rule pre všetky IP (DEV only - odstráň v produkcii!)
  resource firewallRuleAll 'firewallRules@2021-12-01-preview' = if (environment == 'dev') {
    name: 'AllowAllIPs'
    properties: {
      startIpAddress: '0.0.0.0'
      endIpAddress: '255.255.255.255'
    }
  }

  // MySQL konfigurácia parametrov
  resource configCharset 'configurations@2021-12-01-preview' = {
    name: 'character_set_server'
    properties: {
      value: 'utf8mb4'
      source: 'user-override'
    }
  }

  resource configCollation 'configurations@2021-12-01-preview' = {
    name: 'collation_server'
    properties: {
      value: 'utf8mb4_unicode_ci'
      source: 'user-override'
    }
  }
}

// =========================================================
// Key Vault pre úschovu secrets
// =========================================================
resource keyVault 'Microsoft.KeyVault/vaults@2021-11-01-preview' = if (enableKeyVault) {
  name: keyVaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    accessPolicies: []
    enabledForDeployment: true
    enabledForTemplateDeployment: true
    enabledForDiskEncryption: false
    enableRbacAuthorization: true
    publicNetworkAccess: 'Enabled'
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
  }

  // Uloženie database password do Key Vault
  resource secretDbPassword 'secrets@2021-11-01-preview' = {
    name: 'DatabasePassword'
    properties: {
      value: administratorLoginPassword
      contentType: 'text/plain'
    }
  }

  // Uloženie storage account key do Key Vault
  resource secretStorageKey 'secrets@2021-11-01-preview' = {
    name: 'StorageAccountKey'
    properties: {
      value: storageAccount.listKeys().keys[0].value
      contentType: 'text/plain'
    }
  }
}

// =========================================================
// App Service Plan
// =========================================================
resource appServicePlan 'Microsoft.Web/serverfarms@2022-03-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: appServicePlanSku
    capacity: 1
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

// =========================================================
// Web App (App Service)
// =========================================================
resource webApp 'Microsoft.Web/sites@2022-03-01' = {
  name: webAppName
  location: location
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: {
      linuxFxVersion: 'NODE|18-lts'
      alwaysOn: true
      ftpsState: 'FtpsOnly'
      minTlsVersion: '1.2'
      http20Enabled: true
      healthCheckPath: '/health'
      appSettings: [
        {
          name: 'NODE_ENV'
          value: environment == 'prod' ? 'production' : environment
        }
        {
          name: 'DATABASE_TYPE'
          value: 'mysql'
        }
        {
          name: 'MYSQL_HOST'
          value: mysqlServer.properties.fullyQualifiedDomainName
        }
        {
          name: 'MYSQL_PORT'
          value: '3306'
        }
        {
          name: 'MYSQL_USER'
          value: administratorLogin
        }
        {
          name: 'MYSQL_PASSWORD'
          value: administratorLoginPassword
        }
        {
          name: 'MYSQL_DATABASE'
          value: databaseName
        }
        {
          name: 'MYSQL_SSL'
          value: 'true'
        }
        {
          name: 'STORAGE_TYPE'
          value: 'azure'
        }
        {
          name: 'AZURE_STORAGE_ACCOUNT'
          value: storageAccountName
        }
        {
          name: 'AZURE_STORAGE_KEY'
          value: storageAccount.listKeys().keys[0].value
        }
        {
          name: 'AZURE_STORAGE_CONTAINER'
          value: 'documents'
        }
        {
          name: 'CORS_ORIGIN'
          value: 'https://${webAppName}.azurewebsites.net'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~18'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: enableApplicationInsights ? applicationInsights.properties.InstrumentationKey : ''
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: enableApplicationInsights ? applicationInsights.properties.ConnectionString : ''
        }
      ]
    }
  }
}

// =========================================================
// RBAC Assignment - Web App môže čítať z Key Vault
// =========================================================
resource keyVaultRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (enableKeyVault) {
  name: guid(keyVault.id, webApp.id, 'Key Vault Secrets User')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
    principalId: webApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// =========================================================
// Outputs
// =========================================================
output webAppName string = webAppName
output webAppUrl string = 'https://${webAppName}.azurewebsites.net'
output webAppHostName string = webApp.properties.defaultHostName
output storageAccountName string = storageAccountName
output databaseServerName string = databaseServerName
output databaseName string = databaseName
output databaseFQDN string = mysqlServer.properties.fullyQualifiedDomainName
output keyVaultName string = enableKeyVault ? keyVaultName : ''
output applicationInsightsName string = enableApplicationInsights ? applicationInsightsName : ''
output applicationInsightsInstrumentationKey string = enableApplicationInsights ? applicationInsights.properties.InstrumentationKey : ''
output deploymentInfo object = {
  resourceGroup: resourceGroup().name
  location: location
  environment: environment
  timestamp: utcNow()
}
