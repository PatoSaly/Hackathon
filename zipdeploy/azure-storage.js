// Azure Storage Configuration
const { BlobServiceClient } = require('@azure/storage-blob');
require('dotenv').config();

class AzureStorageService {
    constructor() {
        // Check if Azure Storage is configured
        this.isAzureEnabled = !!(
            process.env.AZURE_STORAGE_ACCOUNT && 
            process.env.AZURE_STORAGE_KEY
        );

        if (this.isAzureEnabled) {
            const connectionString = `DefaultEndpointsProtocol=https;AccountName=${process.env.AZURE_STORAGE_ACCOUNT};AccountKey=${process.env.AZURE_STORAGE_KEY};EndpointSuffix=core.windows.net`;
            this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
            this.containerName = process.env.AZURE_STORAGE_CONTAINER || 'documents';
        }
    }

    /**
     * Upload file to Azure Blob Storage
     * @param {string} fileName - Name of the file
     * @param {Buffer} fileBuffer - File content as buffer
     * @returns {Promise<string>} - URL of uploaded file
     */
    async uploadFile(fileName, fileBuffer) {
        if (!this.isAzureEnabled) {
            throw new Error('Azure Storage is not configured');
        }

        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        
        // Create container if it doesn't exist
        await containerClient.createIfNotExists({
            access: 'blob' // Public read access for blobs
        });

        const blockBlobClient = containerClient.getBlockBlobClient(fileName);
        
        // Upload file
        await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
            blobHTTPHeaders: {
                blobContentType: 'application/pdf'
            }
        });

        return blockBlobClient.url;
    }

    /**
     * Download file from Azure Blob Storage
     * @param {string} fileName - Name of the file
     * @returns {Promise<Buffer>} - File content as buffer
     */
    async downloadFile(fileName) {
        if (!this.isAzureEnabled) {
            throw new Error('Azure Storage is not configured');
        }

        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);

        const downloadResponse = await blockBlobClient.download(0);
        return await this.streamToBuffer(downloadResponse.readableStreamBody);
    }

    /**
     * Delete file from Azure Blob Storage
     * @param {string} fileName - Name of the file
     * @returns {Promise<void>}
     */
    async deleteFile(fileName) {
        if (!this.isAzureEnabled) {
            throw new Error('Azure Storage is not configured');
        }

        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);

        await blockBlobClient.deleteIfExists();
    }

    /**
     * Check if file exists in Azure Blob Storage
     * @param {string} fileName - Name of the file
     * @returns {Promise<boolean>}
     */
    async fileExists(fileName) {
        if (!this.isAzureEnabled) {
            return false;
        }

        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);

        return await blockBlobClient.exists();
    }

    /**
     * Convert stream to buffer
     * @param {ReadableStream} readableStream
     * @returns {Promise<Buffer>}
     */
    async streamToBuffer(readableStream) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            readableStream.on('data', (data) => {
                chunks.push(data instanceof Buffer ? data : Buffer.from(data));
            });
            readableStream.on('end', () => {
                resolve(Buffer.concat(chunks));
            });
            readableStream.on('error', reject);
        });
    }

    /**
     * Get file URL
     * @param {string} fileName - Name of the file
     * @returns {string} - Public URL of the file
     */
    getFileUrl(fileName) {
        if (!this.isAzureEnabled) {
            return null;
        }

        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);
        return blockBlobClient.url;
    }
}

module.exports = new AzureStorageService();
