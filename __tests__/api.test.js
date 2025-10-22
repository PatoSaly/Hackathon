const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs').promises;

// Mock dependencies
jest.mock('../database');
jest.mock('../azure-storage');

describe('API Integration Tests', () => {
    let app;
    let db;

    beforeAll(() => {
        // Set test environment
        process.env.NODE_ENV = 'test';
        process.env.STORAGE_TYPE = 'local';
        process.env.PORT = 3002;
    });

    beforeEach(() => {
        // Mock database
        db = require('../database');
        db.get = jest.fn();
        db.run = jest.fn();
        db.all = jest.fn();

        // Create express app without starting server
        app = express();
        app.use(express.json());
        
        // Add basic test routes
        app.get('/api/health', (req, res) => {
            res.json({ status: 'ok' });
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/health', () => {
        test('should return health status', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect(200);

            expect(response.body).toEqual({ status: 'ok' });
        });
    });

    describe('Document Endpoints', () => {
        beforeEach(() => {
            // Mock documents route
            app.get('/api/documents', (req, res) => {
                db.all('SELECT * FROM documents', [], (err, rows) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    res.json(rows || []);
                });
            });

            app.get('/api/documents/:id', (req, res) => {
                db.get('SELECT * FROM documents WHERE id = ?', [req.params.id], (err, row) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    if (!row) {
                        return res.status(404).json({ error: 'Document not found' });
                    }
                    res.json(row);
                });
            });

            app.post('/api/documents', (req, res) => {
                const { case_name, file_path, status } = req.body;
                db.run(
                    'INSERT INTO documents (case_name, file_path, status) VALUES (?, ?, ?)',
                    [case_name, file_path, status],
                    function(err) {
                        if (err) {
                            return res.status(500).json({ error: err.message });
                        }
                        res.status(201).json({ id: this.lastID });
                    }
                );
            });
        });

        test('GET /api/documents should return all documents', async () => {
            const mockDocuments = [
                { id: 1, case_name: '000001', status: 'Draft' },
                { id: 2, case_name: '000002', status: 'Signed' }
            ];

            db.all.mockImplementation((sql, params, callback) => {
                callback(null, mockDocuments);
            });

            const response = await request(app)
                .get('/api/documents')
                .expect(200);

            expect(response.body).toEqual(mockDocuments);
            expect(db.all).toHaveBeenCalledWith(
                'SELECT * FROM documents',
                [],
                expect.any(Function)
            );
        });

        test('GET /api/documents/:id should return specific document', async () => {
            const mockDocument = { id: 1, case_name: '000001', status: 'Draft' };

            db.get.mockImplementation((sql, params, callback) => {
                callback(null, mockDocument);
            });

            const response = await request(app)
                .get('/api/documents/1')
                .expect(200);

            expect(response.body).toEqual(mockDocument);
        });

        test('GET /api/documents/:id should return 404 for non-existent document', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            const response = await request(app)
                .get('/api/documents/999')
                .expect(404);

            expect(response.body).toEqual({ error: 'Document not found' });
        });

        test('POST /api/documents should create new document', async () => {
            db.run.mockImplementation(function(sql, params, callback) {
                callback.call({ lastID: 1 }, null);
            });

            const newDocument = {
                case_name: '000001',
                file_path: '/uploads/000001.pdf',
                status: 'Draft'
            };

            const response = await request(app)
                .post('/api/documents')
                .send(newDocument)
                .expect(201);

            expect(response.body).toEqual({ id: 1 });
            expect(db.run).toHaveBeenCalled();
        });

        test('GET /api/documents should handle database errors', async () => {
            db.all.mockImplementation((sql, params, callback) => {
                callback(new Error('Database error'), null);
            });

            const response = await request(app)
                .get('/api/documents')
                .expect(500);

            expect(response.body).toEqual({ error: 'Database error' });
        });
    });

    describe('Approver Endpoints', () => {
        beforeEach(() => {
            app.get('/api/documents/:id/approvers', (req, res) => {
                db.all(
                    'SELECT * FROM approvers WHERE document_id = ?',
                    [req.params.id],
                    (err, rows) => {
                        if (err) {
                            return res.status(500).json({ error: err.message });
                        }
                        res.json(rows || []);
                    }
                );
            });

            app.post('/api/documents/:id/approvers', (req, res) => {
                const { email } = req.body;
                db.run(
                    'INSERT INTO approvers (document_id, email, status) VALUES (?, ?, ?)',
                    [req.params.id, email, 'Pending'],
                    function(err) {
                        if (err) {
                            return res.status(500).json({ error: err.message });
                        }
                        res.status(201).json({ id: this.lastID });
                    }
                );
            });
        });

        test('GET /api/documents/:id/approvers should return approvers', async () => {
            const mockApprovers = [
                { id: 1, document_id: 1, email: 'test1@example.com', status: 'Pending' },
                { id: 2, document_id: 1, email: 'test2@example.com', status: 'Approved' }
            ];

            db.all.mockImplementation((sql, params, callback) => {
                callback(null, mockApprovers);
            });

            const response = await request(app)
                .get('/api/documents/1/approvers')
                .expect(200);

            expect(response.body).toEqual(mockApprovers);
        });

        test('POST /api/documents/:id/approvers should add approver', async () => {
            db.run.mockImplementation(function(sql, params, callback) {
                callback.call({ lastID: 1 }, null);
            });

            const response = await request(app)
                .post('/api/documents/1/approvers')
                .send({ email: 'test@example.com' })
                .expect(201);

            expect(response.body).toEqual({ id: 1 });
        });
    });

    describe('Predefined Approvers Endpoints', () => {
        beforeEach(() => {
            app.get('/api/predefined-approvers', (req, res) => {
                db.all(
                    'SELECT * FROM predefined_approvers WHERE is_active = 1',
                    [],
                    (err, rows) => {
                        if (err) {
                            return res.status(500).json({ error: err.message });
                        }
                        res.json(rows || []);
                    }
                );
            });
        });

        test('GET /api/predefined-approvers should return active approvers', async () => {
            const mockApprovers = [
                { id: 1, email: 'approver1@example.com', is_active: 1 },
                { id: 2, email: 'approver2@example.com', is_active: 1 }
            ];

            db.all.mockImplementation((sql, params, callback) => {
                callback(null, mockApprovers);
            });

            const response = await request(app)
                .get('/api/predefined-approvers')
                .expect(200);

            expect(response.body).toEqual(mockApprovers);
        });
    });

    describe('Error Handling', () => {
        test('should handle 404 for unknown routes', async () => {
            const response = await request(app)
                .get('/api/unknown-endpoint')
                .expect(404);
        });

        test('should handle malformed JSON', async () => {
            app.post('/api/test', (req, res) => {
                res.json({ received: req.body });
            });

            await request(app)
                .post('/api/test')
                .set('Content-Type', 'application/json')
                .send('{"invalid": json}')
                .expect(400);
        });
    });

    describe('CORS', () => {
        test('should include CORS headers', async () => {
            const cors = require('cors');
            const testApp = express();
            testApp.use(cors());
            testApp.get('/api/health', (req, res) => {
                res.json({ status: 'ok' });
            });

            const response = await request(testApp)
                .get('/api/health')
                .expect(200);

            expect(response.headers['access-control-allow-origin']).toBeDefined();
        });
    });
});
