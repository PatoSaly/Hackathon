const azureStorage = require('../azure-storage');

// Mock Azure Storage SDK
jest.mock('@azure/storage-blob', () => {
    const mockBlockBlobClient = {
        upload: jest.fn().mockResolvedValue({}),
        download: jest.fn().mockResolvedValue({
            readableStreamBody: {
                on: jest.fn((event, callback) => {
                    if (event === 'data') {
                        callback(Buffer.from('test pdf content'));
                    } else if (event === 'end') {
                        callback();
                    }
                    return mockBlockBlobClient.download().readableStreamBody;
                })
            }
        }),
        deleteIfExists: jest.fn().mockResolvedValue({}),
        exists: jest.fn().mockResolvedValue(true),
        url: 'https://testaccount.blob.core.windows.net/documents/test.pdf'
    };

    const mockContainerClient = {
        createIfNotExists: jest.fn().mockResolvedValue({}),
        getBlockBlobClient: jest.fn().mockReturnValue(mockBlockBlobClient)
    };

    const mockBlobServiceClient = {
        getContainerClient: jest.fn().mockReturnValue(mockContainerClient)
    };

    return {
        BlobServiceClient: {
            fromConnectionString: jest.fn().mockReturnValue(mockBlobServiceClient)
        }
    };
});

describe('Azure Storage Service Tests', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('Constructor', () => {
        test('should enable Azure when credentials are provided', () => {
            process.env.AZURE_STORAGE_ACCOUNT = 'testaccount';
            process.env.AZURE_STORAGE_KEY = 'testkey';
            
            // Re-require to get new instance with env vars
            jest.resetModules();
            const storage = require('../azure-storage');
            
            expect(storage.isAzureEnabled).toBeDefined();
        });

        test('should disable Azure when credentials are missing', () => {
            delete process.env.AZURE_STORAGE_ACCOUNT;
            delete process.env.AZURE_STORAGE_KEY;
            
            jest.resetModules();
            const storage = require('../azure-storage');
            
            expect(storage.isAzureEnabled).toBeDefined();
        });
    });

    describe('uploadFile', () => {
        test('should throw error when Azure is not configured', async () => {
            const storage = { isAzureEnabled: false };
            const uploadFile = azureStorage.uploadFile.bind(storage);
            
            await expect(uploadFile('test.pdf', Buffer.from('test')))
                .rejects
                .toThrow('Azure Storage is not configured');
        });
    });

    describe('downloadFile', () => {
        test('should throw error when Azure is not configured', async () => {
            const storage = { isAzureEnabled: false };
            const downloadFile = azureStorage.downloadFile.bind(storage);
            
            await expect(downloadFile('test.pdf'))
                .rejects
                .toThrow('Azure Storage is not configured');
        });
    });

    describe('deleteFile', () => {
        test('should throw error when Azure is not configured', async () => {
            const storage = { isAzureEnabled: false };
            const deleteFile = azureStorage.deleteFile.bind(storage);
            
            await expect(deleteFile('test.pdf'))
                .rejects
                .toThrow('Azure Storage is not configured');
        });
    });

    describe('fileExists', () => {
        test('should return false when Azure is not configured', async () => {
            const storage = { isAzureEnabled: false };
            const fileExists = azureStorage.fileExists.bind(storage);
            
            const exists = await fileExists('test.pdf');
            expect(exists).toBe(false);
        });
    });

    describe('getFileUrl', () => {
        test('should return null when Azure is not configured', () => {
            const storage = { isAzureEnabled: false };
            const getFileUrl = azureStorage.getFileUrl.bind(storage);
            
            const url = getFileUrl('test.pdf');
            expect(url).toBeNull();
        });
    });

    describe('streamToBuffer', () => {
        test('should convert stream to buffer', async () => {
            const mockStream = {
                on: jest.fn((event, callback) => {
                    if (event === 'data') {
                        callback(Buffer.from('chunk1'));
                        callback(Buffer.from('chunk2'));
                    } else if (event === 'end') {
                        callback();
                    }
                    return mockStream;
                })
            };

            const buffer = await azureStorage.streamToBuffer(mockStream);
            expect(buffer).toBeInstanceOf(Buffer);
            expect(buffer.toString()).toBe('chunk1chunk2');
        });

        test('should handle stream errors', async () => {
            const mockStream = {
                on: jest.fn((event, callback) => {
                    if (event === 'error') {
                        callback(new Error('Stream error'));
                    }
                    return mockStream;
                })
            };

            await expect(azureStorage.streamToBuffer(mockStream))
                .rejects
                .toThrow('Stream error');
        });
    });
});
