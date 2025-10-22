// database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Názov súboru DB
const DBSOURCE = path.join(__dirname, 'db.sqlite');

let db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
        // Chyba pri otváraní databázy
        console.error(err.message);
        throw err;
    } else {
        console.log('Pripojené k databáze SQLite.');
        
        // Vytvorenie hlavnej tabuľky pre dokumenty
        db.run(`CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_name TEXT NOT NULL UNIQUE,
            original_filename TEXT NOT NULL,
            file_path TEXT NOT NULL,
            comment TEXT,
            status TEXT DEFAULT 'Draft',
            upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            signed_date DATETIME
        )`, (err) => {
            if (err) {
                // Tabuľka už existuje
            }
        });

        // Tabuľka pre schvaľovateľov (Approvers)
        db.run(`CREATE TABLE IF NOT EXISTS approvers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id INTEGER NOT NULL,
            approver_email TEXT NOT NULL,
            approval_status TEXT DEFAULT 'Pending', -- Pending, Approved, Rejected
            approval_date DATETIME,
            FOREIGN KEY (document_id) REFERENCES documents(id)
        )`, (err) => {
            if (err) {
                // Tabuľka už existuje
            }
        });

        // Tabuľka pre predefined schvaľovateľov (Admin)
        db.run(`CREATE TABLE IF NOT EXISTS predefined_approvers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            department TEXT NOT NULL,
            active INTEGER DEFAULT 1,
            created_date DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                // Tabuľka už existuje
            } else {
                // Naplnenie základnými dátami ak tabuľka je prázdna
                db.get("SELECT COUNT(*) as count FROM predefined_approvers", (err, row) => {
                    if (!err && row.count === 0) {
                        const defaultApprovers = [
                            { name: 'Ján Novák', email: 'jan.novak@firma.sk', department: 'Riaditeľstvo' },
                            { name: 'Mária Svobodová', email: 'maria.svobodova@firma.sk', department: 'Právne oddelenie' },
                            { name: 'Peter Horváth', email: 'peter.horvath@firma.sk', department: 'Financie' },
                            { name: 'Anna Kováčová', email: 'anna.kovacova@firma.sk', department: 'HR' },
                            { name: 'Milan Dvořák', email: 'milan.dvorak@firma.sk', department: 'IT' },
                            { name: 'Eva Procházková', email: 'eva.prochazkova@firma.sk', department: 'Marketing' },
                            { name: 'Tomáš Černý', email: 'tomas.cerny@firma.sk', department: 'Predaj' },
                            { name: 'Zuzana Varga', email: 'zuzana.varga@firma.sk', department: 'Kvalita' }
                        ];

                        const stmt = db.prepare("INSERT INTO predefined_approvers (name, email, department) VALUES (?, ?, ?)");
                        defaultApprovers.forEach(approver => {
                            stmt.run(approver.name, approver.email, approver.department);
                        });
                        stmt.finalize();
                        console.log('Predefined approvers initialized.');
                    }
                });
            }
        });
    }
});

module.exports = db;