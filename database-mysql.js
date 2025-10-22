// database-mysql.js - MySQL Database Adapter
// Poskytuje SQLite-kompatibilné rozhranie pre MySQL databázu
const mysql = require('mysql2/promise');
require('dotenv').config();

class MySQLDatabase {
    constructor() {
        this.pool = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            // Konfigurácia connection pool
            const config = {
                host: process.env.MYSQL_HOST,
                port: process.env.MYSQL_PORT || 3306,
                user: process.env.MYSQL_USER,
                password: process.env.MYSQL_PASSWORD,
                database: process.env.MYSQL_DATABASE,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
                enableKeepAlive: true,
                keepAliveInitialDelay: 0
            };

            // SSL konfigurácia pre Azure MySQL
            if (process.env.NODE_ENV === 'production' || process.env.MYSQL_SSL === 'true') {
                config.ssl = {
                    rejectUnauthorized: true
                };
            }

            this.pool = mysql.createPool(config);

            // Test connection
            const connection = await this.pool.getConnection();
            console.log('✅ Connected to MySQL database successfully');
            console.log(`   Host: ${process.env.MYSQL_HOST}`);
            console.log(`   Database: ${process.env.MYSQL_DATABASE}`);
            connection.release();
            
            await this.initializeTables();
            this.isConnected = true;
            
        } catch (error) {
            console.error('❌ MySQL connection error:', error.message);
            throw error;
        }
    }

    async initializeTables() {
        try {
            console.log('🔧 Initializing MySQL database tables...');

            // Vytvorenie hlavnej tabuľky pre dokumenty
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS documents (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    case_name VARCHAR(255) NOT NULL UNIQUE,
                    original_filename VARCHAR(500) NOT NULL,
                    file_path VARCHAR(1000) NOT NULL,
                    comment TEXT,
                    status VARCHAR(50) DEFAULT 'Draft',
                    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    signed_date TIMESTAMP NULL,
                    INDEX idx_case_name (case_name),
                    INDEX idx_status (status),
                    INDEX idx_upload_date (upload_date)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

            // Tabuľka pre schvaľovateľov
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS approvers (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    document_id INT NOT NULL,
                    approver_email VARCHAR(255) NOT NULL,
                    approval_status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
                    approval_date TIMESTAMP NULL,
                    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
                    INDEX idx_document_id (document_id),
                    INDEX idx_approval_status (approval_status)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

            // Tabuľka pre predefined schvaľovateľov
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS predefined_approvers (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    department VARCHAR(255) NOT NULL,
                    active BOOLEAN DEFAULT TRUE,
                    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_email (email),
                    INDEX idx_active (active)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

            // Naplnenie základnými dátami ak tabuľka je prázdna
            const [rows] = await this.pool.execute('SELECT COUNT(*) as count FROM predefined_approvers');
            if (rows[0].count === 0) {
                console.log('📝 Initializing default predefined approvers...');
                
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

                for (const approver of defaultApprovers) {
                    await this.pool.execute(
                        'INSERT INTO predefined_approvers (name, email, department) VALUES (?, ?, ?)',
                        [approver.name, approver.email, approver.department]
                    );
                }
                console.log(`✅ Initialized ${defaultApprovers.length} default approvers`);
            }

            console.log('✅ MySQL database tables initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing tables:', error.message);
            throw error;
        }
    }

    // =========================================================
    // SQLite-compatible wrapper methods
    // =========================================================

    /**
     * Get single row (SQLite compatible)
     * @param {string} sql - SQL query with ? placeholders
     * @param {array} params - Query parameters
     * @param {function} callback - Callback function (err, row)
     */
    get(sql, params = [], callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        this.pool.execute(sql, params)
            .then(([rows]) => {
                callback(null, rows[0] || null);
            })
            .catch(error => {
                console.error('MySQL GET error:', error.message);
                callback(error, null);
            });
    }

    /**
     * Get all rows (SQLite compatible)
     * @param {string} sql - SQL query with ? placeholders
     * @param {array} params - Query parameters
     * @param {function} callback - Callback function (err, rows)
     */
    all(sql, params = [], callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        this.pool.execute(sql, params)
            .then(([rows]) => {
                callback(null, rows);
            })
            .catch(error => {
                console.error('MySQL ALL error:', error.message);
                callback(error, null);
            });
    }

    /**
     * Run query (INSERT, UPDATE, DELETE) - SQLite compatible
     * @param {string} sql - SQL query with ? placeholders
     * @param {array} params - Query parameters
     * @param {function} callback - Callback function with 'this' context
     */
    run(sql, params = [], callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        this.pool.execute(sql, params)
            .then(([result]) => {
                // Simulácia SQLite callback context
                const context = {
                    lastID: result.insertId,
                    changes: result.affectedRows
                };
                
                if (callback) {
                    callback.call(context, null);
                }
            })
            .catch(error => {
                console.error('MySQL RUN error:', error.message);
                if (callback) {
                    callback.call({ lastID: 0, changes: 0 }, error);
                }
            });
    }

    /**
     * Close database connection
     * @param {function} callback - Optional callback
     */
    async close(callback) {
        try {
            if (this.pool) {
                await this.pool.end();
                this.isConnected = false;
                console.log('✅ MySQL connection closed');
            }
            if (callback) callback(null);
        } catch (error) {
            console.error('❌ Error closing MySQL connection:', error.message);
            if (callback) callback(error);
        }
    }

    // =========================================================
    // Promise-based methods (pre moderný async/await kód)
    // =========================================================

    async query(sql, params = []) {
        const [rows] = await this.pool.execute(sql, params);
        return rows;
    }

    async getAsync(sql, params = []) {
        const [rows] = await this.pool.execute(sql, params);
        return rows[0] || null;
    }

    async allAsync(sql, params = []) {
        const [rows] = await this.pool.execute(sql, params);
        return rows;
    }

    async runAsync(sql, params = []) {
        const [result] = await this.pool.execute(sql, params);
        return {
            lastID: result.insertId,
            changes: result.affectedRows
        };
    }
}

// Export singleton instance
const dbInstance = new MySQLDatabase();

// Connect on module load
dbInstance.connect().catch(error => {
    console.error('Failed to connect to MySQL database:', error);
    // V produkcii by sme chceli pokračovať s retry logikou
    if (process.env.NODE_ENV === 'production') {
        console.error('FATAL: Cannot connect to database. Exiting...');
        process.exit(1);
    }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing MySQL connection...');
    await dbInstance.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, closing MySQL connection...');
    await dbInstance.close();
    process.exit(0);
});

module.exports = dbInstance;
