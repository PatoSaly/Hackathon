const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

describe('Database Tests', () => {
    const TEST_DB_PATH = path.join(__dirname, '../test.db');
    let db;

    beforeEach((done) => {
        // Remove test database if exists
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }

                // Create new test database
        db = new sqlite3.Database(TEST_DB_PATH, (err) => {
            if (err) {
                done(err);
                return;
            }

            // Enable foreign keys
            db.run('PRAGMA foreign_keys = ON', (err) => {
                if (err) {
                    done(err);
                    return;
                }

                // Initialize tables
                db.serialize(() => {
                // Documents table
                db.run(`
                    CREATE TABLE IF NOT EXISTS documents (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        case_name TEXT NOT NULL,
                        file_path TEXT NOT NULL,
                        status TEXT DEFAULT 'Draft',
                        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                        final_status TEXT
                    )
                `, (err) => {
                    if (err) {
                        done(err);
                        return;
                    }

                    // Approvers table
                    db.run(`
                        CREATE TABLE IF NOT EXISTS approvers (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            document_id INTEGER NOT NULL,
                            email TEXT NOT NULL,
                            status TEXT DEFAULT 'Pending',
                            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
                        )
                    `, (err) => {
                        if (err) {
                            done(err);
                            return;
                        }

                        // Predefined approvers table
                        db.run(`
                            CREATE TABLE IF NOT EXISTS predefined_approvers (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                email TEXT NOT NULL UNIQUE,
                                is_active INTEGER DEFAULT 1
                            )
                        `, done);
                    });
                });
            });
        });
        });
    });

    afterEach((done) => {
        if (db) {
            db.close((err) => {
                setTimeout(() => {
                    try {
                        if (fs.existsSync(TEST_DB_PATH)) {
                            fs.unlinkSync(TEST_DB_PATH);
                        }
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                    done();
                }, 100);
            });
        } else {
            done();
        }
    });

    test('should create documents table', (done) => {
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='documents'", (err, row) => {
            expect(err).toBeNull();
            expect(row).toBeDefined();
            expect(row.name).toBe('documents');
            done();
        });
    });

    test('should create approvers table', (done) => {
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='approvers'", (err, row) => {
            expect(err).toBeNull();
            expect(row).toBeDefined();
            expect(row.name).toBe('approvers');
            done();
        });
    });

    test('should create predefined_approvers table', (done) => {
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='predefined_approvers'", (err, row) => {
            expect(err).toBeNull();
            expect(row).toBeDefined();
            expect(row.name).toBe('predefined_approvers');
            done();
        });
    });

    test('should insert document', (done) => {
        const caseName = '000001';
        const filePath = '/uploads/000001.pdf';

        db.run(
            'INSERT INTO documents (case_name, file_path, status) VALUES (?, ?, ?)',
            [caseName, filePath, 'Draft'],
            function(err) {
                expect(err).toBeNull();
                expect(this.lastID).toBeGreaterThan(0);

                db.get('SELECT * FROM documents WHERE id = ?', [this.lastID], (err, row) => {
                    expect(err).toBeNull();
                    expect(row.case_name).toBe(caseName);
                    expect(row.file_path).toBe(filePath);
                    expect(row.status).toBe('Draft');
                    done();
                });
            }
        );
    });

    test('should insert approver', (done) => {
        // First insert a document
        db.run(
            'INSERT INTO documents (case_name, file_path, status) VALUES (?, ?, ?)',
            ['000001', '/uploads/000001.pdf', 'Signed'],
            function(err) {
                expect(err).toBeNull();
                const documentId = this.lastID;

                // Then insert approver
                db.run(
                    'INSERT INTO approvers (document_id, email, status) VALUES (?, ?, ?)',
                    [documentId, 'test@example.com', 'Pending'],
                    function(err) {
                        expect(err).toBeNull();
                        expect(this.lastID).toBeGreaterThan(0);

                        db.get('SELECT * FROM approvers WHERE id = ?', [this.lastID], (err, row) => {
                            expect(err).toBeNull();
                            expect(row.document_id).toBe(documentId);
                            expect(row.email).toBe('test@example.com');
                            expect(row.status).toBe('Pending');
                            done();
                        });
                    }
                );
            }
        );
    });

    test('should insert predefined approver', (done) => {
        const email = 'approver@example.com';

        db.run(
            'INSERT INTO predefined_approvers (email, is_active) VALUES (?, ?)',
            [email, 1],
            function(err) {
                expect(err).toBeNull();
                expect(this.lastID).toBeGreaterThan(0);

                db.get('SELECT * FROM predefined_approvers WHERE id = ?', [this.lastID], (err, row) => {
                    expect(err).toBeNull();
                    expect(row.email).toBe(email);
                    expect(row.is_active).toBe(1);
                    done();
                });
            }
        );
    });

    test('should enforce unique email in predefined_approvers', (done) => {
        const email = 'unique@example.com';

        db.run(
            'INSERT INTO predefined_approvers (email) VALUES (?)',
            [email],
            (err) => {
                expect(err).toBeNull();

                // Try to insert same email again
                db.run(
                    'INSERT INTO predefined_approvers (email) VALUES (?)',
                    [email],
                    (err) => {
                        expect(err).toBeDefined();
                        expect(err.message).toContain('UNIQUE');
                        done();
                    }
                );
            }
        );
    });

    test('should cascade delete approvers when document is deleted', (done) => {
        // Insert document
        db.run(
            'INSERT INTO documents (case_name, file_path) VALUES (?, ?)',
            ['000001', '/uploads/000001.pdf'],
            function(err) {
                expect(err).toBeNull();
                const documentId = this.lastID;

                // Insert approver
                db.run(
                    'INSERT INTO approvers (document_id, email) VALUES (?, ?)',
                    [documentId, 'test@example.com'],
                    (err) => {
                        expect(err).toBeNull();

                        // Delete document
                        db.run('DELETE FROM documents WHERE id = ?', [documentId], (err) => {
                            expect(err).toBeNull();

                            // Check if approver was deleted
                            db.get('SELECT * FROM approvers WHERE document_id = ?', [documentId], (err, row) => {
                                expect(err).toBeNull();
                                expect(row).toBeUndefined();
                                done();
                            });
                        });
                    }
                );
            }
        );
    });

    test('should update document status', (done) => {
        db.run(
            'INSERT INTO documents (case_name, file_path, status) VALUES (?, ?, ?)',
            ['000001', '/uploads/000001.pdf', 'Draft'],
            function(err) {
                expect(err).toBeNull();
                const documentId = this.lastID;

                db.run(
                    'UPDATE documents SET status = ? WHERE id = ?',
                    ['Signed', documentId],
                    (err) => {
                        expect(err).toBeNull();

                        db.get('SELECT status FROM documents WHERE id = ?', [documentId], (err, row) => {
                            expect(err).toBeNull();
                            expect(row.status).toBe('Signed');
                            done();
                        });
                    }
                );
            }
        );
    });

    test('should get max case_name number', (done) => {
        db.serialize(() => {
            db.run('INSERT INTO documents (case_name, file_path) VALUES (?, ?)', ['000001', '/uploads/000001.pdf']);
            db.run('INSERT INTO documents (case_name, file_path) VALUES (?, ?)', ['000005', '/uploads/000005.pdf']);
            db.run('INSERT INTO documents (case_name, file_path) VALUES (?, ?)', ['000003', '/uploads/000003.pdf'], () => {
                db.get(
                    'SELECT MAX(CAST(case_name AS INTEGER)) as max_id FROM documents WHERE case_name GLOB "[0-9][0-9][0-9][0-9][0-9][0-9]"',
                    (err, row) => {
                        expect(err).toBeNull();
                        expect(row.max_id).toBe(5);
                        done();
                    }
                );
            });
        });
    });
});
