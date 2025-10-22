const request = require('supertest');

// Mock sqlite3 completely
jest.mock('sqlite3', () => ({
    verbose: () => ({
        Database: jest.fn().mockImplementation(() => ({
            get: jest.fn(),
            run: jest.fn(),
            all: jest.fn(),
            close: jest.fn()
        }))
    })
}));

// Mock Azure Storage
jest.mock('@azure/storage-blob', () => ({
    BlobServiceClient: {
        fromConnectionString: jest.fn().mockReturnValue({
            getContainerClient: jest.fn()
        })
    }
}));

// Mock pdf-lib
jest.mock('pdf-lib', () => ({
    PDFDocument: {
        load: jest.fn().mockResolvedValue({
            getPages: jest.fn().mockReturnValue([{
                getSize: jest.fn().mockReturnValue({ width: 600, height: 800 }),
                drawText: jest.fn()
            }]),
            embedFont: jest.fn().mockResolvedValue({}),
            save: jest.fn().mockResolvedValue(Buffer.from('signed pdf'))
        })
    },
    StandardFonts: {
        Helvetica: 'Helvetica'
    },
    rgb: jest.fn()
}));

// Mock fs
jest.mock('fs', () => ({
    promises: {
        writeFile: jest.fn().mockResolvedValue(),
        readFile: jest.fn().mockResolvedValue(Buffer.from('fake pdf')),
        unlink: jest.fn().mockResolvedValue(),
        access: jest.fn().mockResolvedValue(),
        mkdir: jest.fn().mockResolvedValue(),
        rename: jest.fn().mockResolvedValue(),
        copyFile: jest.fn().mockResolvedValue(),
        readdir: jest.fn().mockResolvedValue([])
    }
}));

// Mock multer
jest.mock('multer', () => {
    const mockMulter = jest.fn(() => ({
        single: jest.fn(() => (req, res, next) => {
            req.file = {
                originalname: 'test.pdf',
                path: '/tmp/test.pdf',
                size: 1024
            };
            next();
        })
    }));
    mockMulter.diskStorage = jest.fn();
    return mockMulter;
});

// Mock dotenv
jest.mock('dotenv', () => ({
    config: jest.fn()
}));

describe('Server.js Enhanced Tests', () => {
    let app;
    let mockDb;

    beforeAll(() => {
        process.env.NODE_ENV = 'test';
        process.env.STORAGE_TYPE = 'local';
        process.env.PORT = 3003;
    });

    beforeEach(() => {
        jest.resetModules();
        
        // Mock database with proper structure
        const Database = require('sqlite3').verbose().Database;
        mockDb = new Database();
        
        // Default mock implementations - môžu byť override v jednotlivých testoch
        mockDb.get = jest.fn((sql, params, callback) => {
            callback(null, null); // Default: žiadny výsledok
        });
        
        mockDb.run = jest.fn(function(sql, params, callback) {
            // Default: success s lastID alebo changes
            if (typeof callback === 'function') {
                callback.call({ lastID: 1, changes: 1 }, null);
            }
        });
        
        mockDb.all = jest.fn((sql, params, callback) => {
            callback(null, []); // Default: prázdny array
        });
        
        // Mock the database module
        jest.doMock('../database', () => mockDb);
        
        // Import server after all mocks are set
        app = require('../server');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Basic API Endpoints', () => {
        test('GET /api/next-case-id - first document', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, { max_id: null });
            });

            const response = await request(app)
                .get('/api/next-case-id')
                .expect(200);

            expect(response.body.nextCaseId).toBe('000001');
        });

        test('GET /api/next-case-id - increment existing', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, { max_id: 5 });
            });

            const response = await request(app)
                .get('/api/next-case-id')
                .expect(200);

            expect(response.body.nextCaseId).toBe('000006');
        });

        test('GET /api/next-case-id - database error', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(new Error('DB error'), null);
            });

            const response = await request(app)
                .get('/api/next-case-id')
                .expect(500);

            expect(response.body.error).toContain('DB error');
        });
    });

    describe('Document Management', () => {
        test('GET /api/documents - success', async () => {
            const mockDocs = [
                { id: 1, case_name: '000001', status: 'Draft', total_approvers: 0 }
            ];

            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, mockDocs);
            });

            const response = await request(app)
                .get('/api/documents')
                .expect(200);

            expect(response.body.documents).toEqual(mockDocs);
            expect(response.body.totalCount).toBe(1);
        });

        test('GET /api/documents - database error', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(new Error('DB error'), null);
            });

            const response = await request(app)
                .get('/api/documents')
                .expect(500);

            expect(response.body.error).toContain('DB error');
        });

        test('GET /api/document/:id - success', async () => {
            const mockDoc = { id: 1, case_name: '000001', status: 'Draft' };
            const mockApprovers = [{ approver_email: 'test@test.com' }];

            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, mockDoc);
            });

            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, mockApprovers);
            });

            const response = await request(app)
                .get('/api/document/1')
                .expect(200);

            expect(response.body.id).toBe(1);
            expect(response.body.approvers).toEqual(mockApprovers);
        });

        test('GET /api/document/:id - not found', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            const response = await request(app)
                .get('/api/document/999')
                .expect(404);

            expect(response.body.error).toContain('nebol nájdený');
        });
    });

    describe('Approvers Management', () => {
        test('GET /api/predefined-approvers - success', async () => {
            const mockApprovers = [
                { id: 1, name: 'Test User', email: 'test@test.com' }
            ];

            mockDb.all.mockImplementation((sql, callback) => {
                callback(null, mockApprovers);
            });

            const response = await request(app)
                .get('/api/predefined-approvers')
                .expect(200);

            expect(response.body).toEqual(mockApprovers);
        });

        test('POST /api/approvers/:documentId - success', async () => {
            const approverEmails = ['test1@test.com', 'test2@test.com'];

            // Mock successful insertion for each approver
            // Poradie volaní: INSERT approver 1, INSERT approver 2, UPDATE document (bez callback!)
            let callCount = 0;
            mockDb.run.mockImplementation(function(sql, params, callback) {
                callCount++;
                
                // Ošetri prípad, že callback neexistuje (napr. fire-and-forget UPDATE)
                if (!callback || typeof callback !== 'function') {
                    return; // Jednoducho skonči, žiadny callback nevyvoláme
                }
                
                // INSERTs pre approvers majú lastID, UPDATE pre status má changes
                if (sql.includes('INSERT INTO approvers')) {
                    // Volaj callback s err=null a nastav this.lastID
                    callback.call({ lastID: callCount }, null);
                } else if (sql.includes('UPDATE documents')) {
                    // Volaj callback s err=null a nastav this.changes
                    callback.call({ changes: 1 }, null);
                } else {
                    // Fallback pre iné SQL príkazy
                    callback.call({ changes: 0 }, null);
                }
            });

            const response = await request(app)
                .post('/api/approvers/1')
                .send({ approverEmails });

            expect(response.status).toBe(200);
            expect(response.body.message).toContain('pridaní');
            expect(response.body.approvalLinks).toHaveLength(2);
        });

        test('POST /api/approvers/:documentId - empty list', async () => {
            const response = await request(app)
                .post('/api/approvers/1')
                .send({ approverEmails: [] })
                .expect(400);

            expect(response.body.error).toContain('aspoň jedného');
        });

        test('POST /api/approve/:approverId - approve', async () => {
            mockDb.run.mockImplementation(function(sql, params, callback) {
                callback.call({ changes: 1 }, null);
            });

            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, { document_id: 1 });
            });

            const response = await request(app)
                .post('/api/approve/1')
                .send({ action: 'Approve' })
                .expect(200);

            expect(response.body.message).toContain('Approved');
        });

        test('POST /api/approve/:approverId - invalid action', async () => {
            const response = await request(app)
                .post('/api/approve/1')
                .send({ action: 'InvalidAction' })
                .expect(400);

            expect(response.body.error).toContain('Neplatná akcia');
        });
    });

    describe('Admin Operations', () => {
        test('GET /api/admin/approvers - success', async () => {
            const mockApprovers = [
                { id: 1, name: 'Admin User', email: 'admin@test.com' }
            ];

            mockDb.all.mockImplementation((sql, callback) => {
                callback(null, mockApprovers);
            });

            const response = await request(app)
                .get('/api/admin/approvers')
                .expect(200);

            expect(response.body).toEqual(mockApprovers);
        });

        test('POST /api/admin/approvers - success', async () => {
            mockDb.run.mockImplementation(function(sql, params, callback) {
                callback.call({ lastID: 1 }, null);
            });

            const newApprover = {
                name: 'New User',
                email: 'new@test.com',
                department: 'IT'
            };

            const response = await request(app)
                .post('/api/admin/approvers')
                .send(newApprover)
                .expect(200);

            expect(response.body.message).toContain('pridaný');
            expect(response.body.approver.id).toBe(1);
        });

        test('POST /api/admin/approvers - missing fields', async () => {
            const response = await request(app)
                .post('/api/admin/approvers')
                .send({ name: 'Test' }) // Missing email and department
                .expect(400);

            expect(response.body.error).toContain('povinné');
        });

        test('PUT /api/admin/approvers/:id - success', async () => {
            mockDb.run.mockImplementation(function(sql, params, callback) {
                callback.call({ changes: 1 }, null);
            });

            const response = await request(app)
                .put('/api/admin/approvers/1')
                .send({ name: 'Updated', email: 'updated@test.com', department: 'HR' })
                .expect(200);

            expect(response.body.message).toContain('upravený');
        });

        test('DELETE /api/admin/approvers/:id - deactivate', async () => {
            mockDb.run.mockImplementation(function(sql, params, callback) {
                callback.call({ changes: 1 }, null);
            });

            const response = await request(app)
                .delete('/api/admin/approvers/1')
                .expect(200);

            expect(response.body.message).toContain('deaktivovaný');
        });

        test('POST /api/reset-database - success', async () => {
            mockDb.run.mockImplementation((sql, callback) => {
                callback(null);
            });

            const response = await request(app)
                .post('/api/reset-database')
                .expect(200);

            expect(response.body.message).toContain('vyčistené');
        });
    });
});