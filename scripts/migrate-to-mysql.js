// migrate-to-mysql.js - SQLite to MySQL Migration Script
// Microhack Document Management System - Data Migration Tool

const fs = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

class DatabaseMigrator {
    constructor() {
        this.sqliteDb = null;
        this.mysqlDb = null;
        this.migrationLog = [];
        this.stats = {
            documentsExported: 0,
            documentsImported: 0,
            approversExported: 0,
            approversImported: 0,
            predefinedApproversExported: 0,
            predefinedApproversImported: 0,
            errors: []
        };
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
        this.migrationLog.push(logEntry);
        
        switch(type) {
            case 'success':
                console.log(`✅ ${message}`);
                break;
            case 'error':
                console.error(`❌ ${message}`);
                break;
            case 'warning':
                console.warn(`⚠️  ${message}`);
                break;
            default:
                console.log(`ℹ️  ${message}`);
        }
    }

    async migrate() {
        try {
            console.log('╔═══════════════════════════════════════════════════════════════╗');
            console.log('║                                                               ║');
            console.log('║   🔄 Database Migration: SQLite → MySQL                      ║');
            console.log('║   Microhack Document Management System                        ║');
            console.log('║                                                               ║');
            console.log('╚═══════════════════════════════════════════════════════════════╝');
            console.log('');
            
            this.log('Starting database migration process');
            
            // 1. Pripojenie k databázam
            await this.connectDatabases();
            
            // 2. Kontrola cieľovej databázy
            await this.validateTargetDatabase();
            
            // 3. Export dát zo SQLite
            const data = await this.exportSQLiteData();
            
            // 4. Import dát do MySQL
            await this.importMySQLData(data);
            
            // 5. Verifikácia migrácie
            await this.verifyMigration();
            
            // 6. Generovanie reportu
            await this.generateMigrationReport();
            
            this.log('Migration completed successfully!', 'success');
            console.log('');
            this.displaySummary();
            
            return true;
            
        } catch (error) {
            this.log(`Migration failed: ${error.message}`, 'error');
            this.stats.errors.push(error.message);
            await this.generateMigrationReport();
            throw error;
        } finally {
            await this.cleanup();
        }
    }

    async connectDatabases() {
        this.log('Connecting to databases...');
        
        // SQLite Connection
        const dbPath = path.join(__dirname, '..', 'db.sqlite');
        
        try {
            await fs.access(dbPath);
        } catch (error) {
            throw new Error(`SQLite database not found at: ${dbPath}`);
        }

        await new Promise((resolve, reject) => {
            this.sqliteDb = new sqlite3.Database(dbPath, (err) => {
                if (err) reject(err);
                else {
                    this.log('Connected to SQLite database', 'success');
                    resolve();
                }
            });
        });

        // MySQL Connection
        const MySQLDB = require('../database-mysql');
        this.mysqlDb = MySQLDB;
        
        // Počkaj na pripojenie
        let retries = 10;
        while (!this.mysqlDb.isConnected && retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            retries--;
        }
        
        if (!this.mysqlDb.isConnected) {
            throw new Error('Failed to connect to MySQL database');
        }
        
        this.log('Connected to MySQL database', 'success');
    }

    async validateTargetDatabase() {
        this.log('Validating target MySQL database...');
        
        // Skontroluj či existujú tabuľky
        const tables = await this.mysqlDb.allAsync('SHOW TABLES');
        
        if (tables.length === 0) {
            this.log('Target database is empty - tables will be created automatically', 'warning');
        } else {
            this.log(`Found ${tables.length} tables in target database`);
            
            // Kontrola či už existujú dáta
            const docCount = await this.mysqlDb.getAsync('SELECT COUNT(*) as count FROM documents');
            if (docCount && docCount.count > 0) {
                this.log(`Target database already contains ${docCount.count} documents`, 'warning');
                
                if (process.env.MIGRATION_CLEAR_TARGET !== 'true') {
                    const readline = require('readline').createInterface({
                        input: process.stdin,
                        output: process.stdout
                    });
                    
                    const answer = await new Promise((resolve) => {
                        readline.question('Do you want to clear existing data and continue? (yes/no): ', resolve);
                    });
                    readline.close();
                    
                    if (answer.toLowerCase() !== 'yes') {
                        throw new Error('Migration cancelled by user');
                    }
                    
                    await this.clearTargetDatabase();
                }
            }
        }
        
        this.log('Target database validated', 'success');
    }

    async clearTargetDatabase() {
        this.log('Clearing target database...');
        
        try {
            // Vymaž v správnom poradí kvôli foreign keys
            await this.mysqlDb.runAsync('DELETE FROM approvers');
            await this.mysqlDb.runAsync('DELETE FROM documents');
            await this.mysqlDb.runAsync('DELETE FROM predefined_approvers');
            
            this.log('Target database cleared', 'success');
        } catch (error) {
            this.log(`Error clearing database: ${error.message}`, 'warning');
        }
    }

    async exportSQLiteData() {
        this.log('Exporting data from SQLite database...');
        
        const data = {
            documents: await this.getSQLiteData('SELECT * FROM documents ORDER BY id'),
            approvers: await this.getSQLiteData('SELECT * FROM approvers ORDER BY id'),
            predefinedApprovers: await this.getSQLiteData('SELECT * FROM predefined_approvers ORDER BY id')
        };

        this.stats.documentsExported = data.documents.length;
        this.stats.approversExported = data.approvers.length;
        this.stats.predefinedApproversExported = data.predefinedApprovers.length;

        this.log(`Exported ${data.documents.length} documents`);
        this.log(`Exported ${data.approvers.length} approvers`);
        this.log(`Exported ${data.predefinedApprovers.length} predefined approvers`);
        
        return data;
    }

    async getSQLiteData(sql) {
        return new Promise((resolve, reject) => {
            this.sqliteDb.all(sql, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    async importMySQLData(data) {
        this.log('Importing data to MySQL database...');
        
        // 1. Import predefined approvers first (nemajú závislosti)
        this.log('Importing predefined approvers...');
        for (const approver of data.predefinedApprovers) {
            try {
                await this.mysqlDb.runAsync(
                    'INSERT INTO predefined_approvers (name, email, department, active, created_date) VALUES (?, ?, ?, ?, ?)',
                    [approver.name, approver.email, approver.department, approver.active, approver.created_date]
                );
                this.stats.predefinedApproversImported++;
            } catch (error) {
                this.log(`Error importing predefined approver ${approver.email}: ${error.message}`, 'error');
                this.stats.errors.push(`Predefined approver ${approver.email}: ${error.message}`);
            }
        }
        this.log(`Imported ${this.stats.predefinedApproversImported}/${data.predefinedApprovers.length} predefined approvers`, 'success');

        // 2. Import documents
        this.log('Importing documents...');
        const documentIdMap = new Map(); // Mapovanie SQLite ID → MySQL ID
        
        for (const doc of data.documents) {
            try {
                const result = await this.mysqlDb.runAsync(
                    'INSERT INTO documents (case_name, original_filename, file_path, comment, status, upload_date, signed_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [doc.case_name, doc.original_filename, doc.file_path, doc.comment, doc.status, doc.upload_date, doc.signed_date]
                );
                documentIdMap.set(doc.id, result.lastID);
                this.stats.documentsImported++;
            } catch (error) {
                this.log(`Error importing document ${doc.case_name}: ${error.message}`, 'error');
                this.stats.errors.push(`Document ${doc.case_name}: ${error.message}`);
            }
        }
        this.log(`Imported ${this.stats.documentsImported}/${data.documents.length} documents`, 'success');

        // 3. Import approvers (s mapovaním document_id)
        this.log('Importing approvers...');
        for (const approver of data.approvers) {
            try {
                const newDocumentId = documentIdMap.get(approver.document_id);
                if (newDocumentId) {
                    await this.mysqlDb.runAsync(
                        'INSERT INTO approvers (document_id, approver_email, approval_status, approval_date) VALUES (?, ?, ?, ?)',
                        [newDocumentId, approver.approver_email, approver.approval_status, approver.approval_date]
                    );
                    this.stats.approversImported++;
                } else {
                    this.log(`Skipping approver for missing document ID ${approver.document_id}`, 'warning');
                }
            } catch (error) {
                this.log(`Error importing approver ${approver.approver_email}: ${error.message}`, 'error');
                this.stats.errors.push(`Approver ${approver.approver_email}: ${error.message}`);
            }
        }
        this.log(`Imported ${this.stats.approversImported}/${data.approvers.length} approvers`, 'success');
    }

    async verifyMigration() {
        this.log('Verifying migration...');
        
        // Porovnaj počty záznamov
        const sqliteDocCount = (await this.getSQLiteData('SELECT COUNT(*) as count FROM documents'))[0].count;
        const sqliteAppCount = (await this.getSQLiteData('SELECT COUNT(*) as count FROM approvers'))[0].count;
        
        const mysqlDocCount = (await this.mysqlDb.getAsync('SELECT COUNT(*) as count FROM documents')).count;
        const mysqlAppCount = (await this.mysqlDb.getAsync('SELECT COUNT(*) as count FROM approvers')).count;

        this.log(`Documents: SQLite ${sqliteDocCount} → MySQL ${mysqlDocCount}`);
        this.log(`Approvers: SQLite ${sqliteAppCount} → MySQL ${mysqlAppCount}`);

        const isValid = sqliteDocCount == mysqlDocCount && sqliteAppCount == mysqlAppCount;

        if (isValid) {
            this.log('Migration verification PASSED ✓', 'success');
        } else {
            this.log('Migration verification FAILED - data counts do not match!', 'error');
            throw new Error('Migration verification failed');
        }
    }

    async cleanup() {
        this.log('Cleaning up connections...');
        
        if (this.sqliteDb) {
            this.sqliteDb.close();
        }
        
        // MySQL connection pool zostane otvorený pre aplikáciu
        
        this.log('Cleanup completed');
    }

    displaySummary() {
        console.log('');
        console.log('╔═══════════════════════════════════════════════════════════════╗');
        console.log('║                                                               ║');
        console.log('║   ✅ MIGRATION COMPLETED SUCCESSFULLY!                       ║');
        console.log('║                                                               ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝');
        console.log('');
        console.log('📊 Migration Summary:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`   Documents:            ${this.stats.documentsImported}/${this.stats.documentsExported}`);
        console.log(`   Approvers:            ${this.stats.approversImported}/${this.stats.approversExported}`);
        console.log(`   Predefined Approvers: ${this.stats.predefinedApproversImported}/${this.stats.predefinedApproversExported}`);
        console.log(`   Errors:               ${this.stats.errors.length}`);
        console.log('');
        
        if (this.stats.errors.length > 0) {
            console.log('⚠️  Errors encountered:');
            this.stats.errors.forEach((err, i) => {
                console.log(`   ${i + 1}. ${err}`);
            });
            console.log('');
        }
    }

    async generateMigrationReport() {
        const report = {
            timestamp: new Date().toISOString(),
            sourceDatabase: 'SQLite',
            targetDatabase: 'MySQL',
            statistics: this.stats,
            log: this.migrationLog,
            status: this.stats.errors.length === 0 ? 'SUCCESS' : 'COMPLETED_WITH_ERRORS'
        };

        const reportPath = path.join(__dirname, '..', `migration-report-${Date.now()}.json`);
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        this.log(`Migration report saved to: ${reportPath}`);
    }
}

// =========================================================
// Main Execution
// =========================================================
if (require.main === module) {
    const migrator = new DatabaseMigrator();
    
    migrator.migrate()
        .then(() => {
            console.log('🎉 Migration script completed successfully!');
            console.log('');
            console.log('📋 Next Steps:');
            console.log('   1. Verify data in MySQL database');
            console.log('   2. Update DATABASE_TYPE=mysql in .env');
            console.log('   3. Test application with MySQL');
            console.log('   4. Deploy to Azure');
            console.log('');
            process.exit(0);
        })
        .catch((error) => {
            console.error('');
            console.error('💥 Migration failed!');
            console.error('Error:', error.message);
            console.error('');
            console.error('Check the migration report for details.');
            process.exit(1);
        });
}

module.exports = DatabaseMigrator;
