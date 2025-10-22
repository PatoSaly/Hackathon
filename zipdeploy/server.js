// server.js
require('dotenv').config(); // Load environment variables
const express = require('express');
const cors = require('cors');
const multer = require('multer'); // Pre upload súborov
const fs = require('fs').promises;
const path = require('path');

// Dynamic database selection based on DATABASE_TYPE environment variable
const databaseType = process.env.DATABASE_TYPE || 'sqlite';
let db;

if (databaseType === 'mysql') {
    console.log('🗄️  Using MySQL database');
    db = require('./database-mysql');
} else {
    console.log('🗄️  Using SQLite database');
    db = require('./database');
}

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const azureStorage = require('./azure-storage'); // Azure Storage service

const app = express();
const PORT = process.env.PORT || 3001;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local'; // 'local' or 'azure'

// Middleware
const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
};
app.use(cors(corsOptions));
app.use(express.json()); // Pre parsovanie JSON tela requestov
app.use('/uploads', express.static(UPLOAD_DIR)); // Sprístupnenie nahraných súborov

// Uložisko pre Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // Uloží súbor s jedinečným časovým prefixom, aby sa predišlo konfliktom
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// =========================================================
// HELPER: Storage abstraction layer
// =========================================================
async function saveFile(fileName, fileBuffer) {
    if (STORAGE_TYPE === 'azure') {
        return await azureStorage.uploadFile(fileName, fileBuffer);
    } else {
        const filePath = path.join(UPLOAD_DIR, fileName);
        await fs.writeFile(filePath, fileBuffer);
        return `/uploads/${fileName}`;
    }
}

async function getFile(fileName) {
    if (STORAGE_TYPE === 'azure') {
        return await azureStorage.downloadFile(fileName);
    } else {
        const filePath = path.join(UPLOAD_DIR, fileName);
        return await fs.readFile(filePath);
    }
}

async function deleteFile(fileName) {
    if (STORAGE_TYPE === 'azure') {
        await azureStorage.deleteFile(fileName);
    } else {
        const filePath = path.join(UPLOAD_DIR, fileName);
        await fs.unlink(filePath);
    }
}

async function fileExists(fileName) {
    if (STORAGE_TYPE === 'azure') {
        return await azureStorage.fileExists(fileName);
    } else {
        const filePath = path.join(UPLOAD_DIR, fileName);
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}

// =========================================================
// HELPER: Generovanie nového Case ID
// =========================================================
function getNextCaseId() {
    return new Promise((resolve, reject) => {
        db.get('SELECT MAX(CAST(case_name AS INTEGER)) as max_id FROM documents WHERE case_name GLOB "[0-9][0-9][0-9][0-9][0-9][0-9]"', [], (err, row) => {
            if (err) {
                reject(err);
            } else {
                const nextId = (row.max_id || 0) + 1;
                const caseId = nextId.toString().padStart(6, '0');
                resolve(caseId);
            }
        });
    });
}


// =========================================================
// ENDPOINT: Vyčistenie databázy (len na development)
// =========================================================
app.post('/api/reset-database', async (req, res) => {
    try {
        // Zmaž všetky záznamy
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM approvers', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM documents', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Resetuj AUTOINCREMENT počítadlá na 1
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM sqlite_sequence WHERE name="documents"', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM sqlite_sequence WHERE name="approvers"', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Zmaž súbory z uploads
        const uploadFiles = await fs.readdir(UPLOAD_DIR).catch(() => []);
        for (const file of uploadFiles) {
            await fs.unlink(path.join(UPLOAD_DIR, file)).catch(() => {});
        }

        res.json({ message: 'Databáza a súbory boli vyčistené.' });
    } catch (error) {
        res.status(500).json({ error: 'Chyba pri čistení databázy: ' + error.message });
    }
});

// =========================================================
// ENDPOINT: Získanie nasledujúceho Case ID
// =========================================================
app.get('/api/next-case-id', async (req, res) => {
    try {
        const nextCaseId = await getNextCaseId();
        res.json({ nextCaseId });
    } catch (error) {
        res.status(500).json({ error: 'Chyba pri generovaní Case ID: ' + error.message });
    }
});

// =========================================================
// 1. ENDPOINT: Upload dokumentu a uloženie do DB
// =========================================================
app.post('/api/upload', upload.single('document'), async (req, res) => {
    console.log('🚀 UPLOAD REQUEST RECEIVED!');
    console.log('Request timestamp:', new Date().toISOString());
    
    const { comment, replace, documentId } = req.body;
    const file = req.file;

    console.log('=== UPLOAD ENDPOINT DEBUG ===');
    console.log('Raw body:', req.body);
    console.log('Parsed params:', { comment, replace, documentId });
    console.log('File info:', file ? { name: file.originalname, size: file.size } : 'No file');
    console.log('Replace condition check:', replace === 'true', 'DocumentId exists:', !!documentId, 'documentId value:', documentId);

    if (!file) {
        return res.status(400).json({ error: 'Nahrávka súboru je povinná.' });
    }

    try {
        // Ak je to nahradenie existujúceho dokumentu
        if (replace === 'true' && documentId && documentId !== 'undefined') {
            console.log('Replacing document with ID:', documentId);
            // Nájdi existujúci dokument
            db.get('SELECT * FROM documents WHERE id = ?', [documentId], async (err, row) => {
                if (err || !row) {
                    console.error('Document not found:', err);
                    // Zmaž dočasný súbor nahraný multerom
                    if (file && file.path) {
                        await fs.unlink(file.path).catch(console.error);
                    }
                    return res.status(404).json({ error: 'Dokument na nahradenie nebol nájdený.' });
                }

                console.log('Found existing document:', row);

                // Kontrola či sa dokument môže nahradiť - len v stave Draft
                if (row.status !== 'Draft') {
                    // Zmaž dočasný súbor nahraný multerom
                    if (file && file.path) {
                        await fs.unlink(file.path).catch(console.error);
                    }
                    return res.status(400).json({ error: 'Dokument v tomto stave nie je možné nahradiť. Nahrádzanie je možné len pre dokumenty v stave Draft.' });
                }

                try {
                const caseId = row.case_name; // Zachovaj pôvodný Case ID
                const oldFilePath = row.file_path;
                const tempFilePath = file.path; // Dočasný súbor od multer-a
                
                // Použij jednotný formát názvu: {caseId}.pdf
                const finalFilePath = path.join(UPLOAD_DIR, `${caseId}.pdf`);
                
                console.log('=== FILE REPLACEMENT DEBUG ===');
                console.log('Old file path:', oldFilePath);
                console.log('Temp file path (from multer):', tempFilePath);
                console.log('Final file path:', finalFilePath);
                console.log('Case ID:', caseId);                    // Skontroluj či dočasný súbor existuje
                    const tempExists = await fs.access(tempFilePath).then(() => true).catch(() => false);
                    console.log('Temp file exists:', tempExists);
                    
                    if (!tempExists) {
                        throw new Error('Dočasný súbor neexistuje: ' + tempFilePath);
                    }
                    
                    // Najprv zmaž starý súbor ak existuje
                    const oldExists = await fs.access(oldFilePath).then(() => true).catch(() => false);
                    if (oldExists) {
                        await fs.unlink(oldFilePath);
                        console.log('✓ Old file deleted:', oldFilePath);
                    } else {
                        console.log('⚠ Old file does not exist:', oldFilePath);
                    }
                    
                    // Potom skopíruj nový súbor na správne miesto
                    await fs.copyFile(tempFilePath, finalFilePath);
                    console.log('✓ New file copied to:', finalFilePath);
                    
                    // Zmaž dočasný súbor
                    await fs.unlink(tempFilePath);
                    console.log('✓ Temp file deleted:', tempFilePath);
                    
                    // Overiť že finálny súbor existuje
                    const finalExists = await fs.access(finalFilePath).then(() => true).catch(() => false);
                    console.log('✓ Final file exists:', finalExists);

                    // Aktualizuj záznam v databáze - status zostane Draft
                    const newStatus = 'Draft'; // Vždy zostane Draft
                    const updateSql = `UPDATE documents SET original_filename = ?, file_path = ?, comment = ?, status = ? WHERE id = ?`;
                    db.run(updateSql, [file.originalname, finalFilePath, comment, newStatus, documentId], function(err) {
                        if (err) {
                            console.error('❌ DB update error:', err);
                            // V prípade chyby zmaž nový súbor
                            fs.unlink(finalFilePath).catch(console.error);
                            return res.status(500).json({ error: 'Chyba pri aktualizácii DB: ' + err.message });
                        }
                        
                        console.log('✓ Súbor úspešne nahradený:', finalFilePath, 'Status:', newStatus);
                        res.json({ 
                            message: 'Súbor úspešne zmenený.', 
                            documentId: documentId, 
                            caseId: caseId 
                        });
                    });
                } catch (e) {
                    console.error('❌ Chyba pri nahrádzaní súboru:', e);
                    console.error('❌ Stack trace:', e.stack);
                    // Zmaž dočasný súbor ak ešte existuje
                    if (file && file.path) {
                        await fs.unlink(file.path).catch(console.error);
                    }
                    res.status(500).json({ 
                        error: 'Chyba pri nahrádzaní súboru: ' + e.message,
                        details: e.stack 
                    });
                }
            });
        } else {
            // Štandardný upload nového dokumentu
            console.log('Standard upload - creating new document');
            const caseId = await getNextCaseId();
            
            const filePath = file.path;
            // Použij jednotný formát: {caseId}.pdf
            const finalFilePath = path.join(UPLOAD_DIR, `${caseId}.pdf`);
            
            // Premenovanie súboru na finálnu cestu
            await fs.rename(filePath, finalFilePath);

            const sql = `INSERT INTO documents (case_name, original_filename, file_path, comment, status) VALUES (?, ?, ?, ?, ?)`;
            db.run(sql, [caseId, file.originalname, finalFilePath, comment, 'Draft'], function(err) {
                if (err) {
                    // V prípade chyby zmaž súbor
                    fs.unlink(finalFilePath).catch(console.error); 
                    return res.status(500).json({ error: 'Chyba pri ukladaní do DB: ' + err.message });
                }
                console.log('New document created:', { documentId: this.lastID, caseId });
                res.json({ message: 'Dokument úspešne nahraný.', documentId: this.lastID, caseId: caseId });
            });
        }
    } catch (e) {
        res.status(500).json({ error: 'Chyba pri spracovaní súboru: ' + e.message });
    }
});


// =========================================================
// 2. ENDPOINT: Podpis dokumentu
// =========================================================
app.post('/api/sign/:documentId', async (req, res) => {
    const documentId = req.params.documentId;
    
    // Nájdi dokument
    db.get('SELECT * FROM documents WHERE id = ?', [documentId], async (err, row) => {
        if (err || !row) {
            return res.status(404).json({ error: 'Dokument nebol nájdený.' });
        }
        
        const existingPdfPath = row.file_path;
        
        try {
            // 1. Načítaj PDF
            const existingPdfBytes = await fs.readFile(existingPdfPath);
            const pdfDoc = await PDFDocument.load(existingPdfBytes);
            
            // 2. Pridaj elektronický podpis na spodok každej strany
            const pages = pdfDoc.getPages();
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            
            // Text podpisu s dátumom a časom
            const signatureText = `Podpísané elektronicky (Prototyp) | ID: ${row.case_name} | ${new Date().toLocaleString()}`;
            
            // Pridaj podpis na všetky strany
            pages.forEach((page, index) => {
                const { width, height } = page.getSize();
                
                page.drawText(signatureText, {
                    x: 50,
                    y: 30, // Spodný okraj strany
                    size: 9,
                    font: font,
                    color: rgb(0, 0.53, 0.71), // Modrá farba
                });
                
                // Pridaj aj číslo strany s podpisom
                page.drawText(`Strana ${index + 1}/${pages.length} - Elektronicky podpísané`, {
                    x: width - 200,
                    y: 15, // Ešte nižšie ako hlavný podpis
                    size: 8,
                    font: font,
                    color: rgb(0.5, 0.5, 0.5), // Sivá farba
                });
            });

            // 3. Ulož zmenený dokument (LEN textový podpis)
            const signedPdfBytes = await pdfDoc.save();
            await fs.writeFile(existingPdfPath, signedPdfBytes);

            // 4. Uzamkni dokument a ulož čas/dátum
            const signedDate = new Date().toISOString();
            db.run('UPDATE documents SET status = ?, signed_date = ? WHERE id = ?', 
                   ['Signed', signedDate, documentId], (err) => {
                if (err) {
                    return res.status(500).json({ error: 'Chyba pri aktualizácii statusu: ' + err.message });
                }
                res.json({ message: 'Dokument bol úspešne podpísaný a uzamknutý.', filePath: `/uploads/${path.basename(existingPdfPath)}` });
            });

        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Chyba pri úprave/podpisovaní PDF: ' + e.message });
        }
    });
});


// =========================================================
// 3. ENDPOINT: Pridanie schvaľovateľov (a zmena statusu)
// =========================================================
app.post('/api/approvers/:documentId', (req, res) => {
    const documentId = req.params.documentId;
    // Očakáva pole emailov, napr.: ["janko@firma.sk", "marienka@firma.sk"]
    const { approverEmails } = req.body; 

    if (!Array.isArray(approverEmails) || approverEmails.length === 0) {
        return res.status(400).json({ error: 'Je potrebné zadať aspoň jedného schvaľovateľa.' });
    }

    const inserts = approverEmails.map(email => {
        // Jednoduchá simulácia: generovanie unikátneho schvaľovacieho tokenu (ako link z emailu)
        const approvalToken = Math.random().toString(36).substring(2, 15);
        return new Promise((resolve, reject) => {
            const sql = 'INSERT INTO approvers (document_id, approver_email, approval_status) VALUES (?, ?, ?)';
            db.run(sql, [documentId, email, 'Pending'], function(err) {
                if (err) reject(err);
                resolve({ email: email, link: `/approve/${this.lastID}/${approvalToken}` }); 
            });
        });
    });

    Promise.all(inserts)
        .then(results => {
            // Po úspešnom pridaní schvaľovateľov aktualizujeme status
            db.run('UPDATE documents SET status = ? WHERE id = ?', ['Waiting for Approval', documentId]);
            res.json({ 
                message: 'Schvaľovatelia pridaní.', 
                // Vrátime linky pre manuálne testovanie (ako bonus bod)
                approvalLinks: results.map(r => ({ email: r.email, link: `http://localhost:${PORT}${r.link}` }))
            });
        })
        .catch(err => res.status(500).json({ error: 'Chyba pri pridávaní schvaľovateľov: ' + err.message }));
});


// =========================================================
// 4. ENDPOINT: Schválenie/Zamietnutie (Simulácia 'Approve' z Emailu)
// =========================================================
app.post('/api/approve/:approverId', (req, res) => {
    const approverId = req.params.approverId;
    const { action } = req.body; // očakáva 'Approve' alebo 'Disapprove'

    if (action !== 'Approve' && action !== 'Disapprove') {
        return res.status(400).json({ error: 'Neplatná akcia.' });
    }

    const status = action === 'Approve' ? 'Approved' : 'Rejected';
    const approvalDate = new Date().toISOString();

    db.run('UPDATE approvers SET approval_status = ?, approval_date = ? WHERE id = ?', 
           [status, approvalDate, approverId], function(err) {
        if (err || this.changes === 0) {
            return res.status(404).json({ error: 'Chyba pri schvaľovaní alebo schvaľovateľ nebol nájdený.' });
        }
        
        // Zistenie document_id pre kontrolu finálneho statusu
        db.get('SELECT document_id FROM approvers WHERE id = ?', [approverId], (err, row) => {
            if (row) {
                // Kontrola finálneho statusu dokumentu
                checkFinalDocumentStatus(row.document_id);
            }
        });

        res.json({ message: `Dokument bol označený ako ${status}.` });
    });
});

// Pomocná funkcia na zistenie, či je dokument finálne schválený/zamietnutý
async function checkFinalDocumentStatus(documentId) {
    try {
        const rows = await new Promise((resolve, reject) => {
            db.all('SELECT approval_status FROM approvers WHERE document_id = ?', [documentId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        if (!rows || rows.length === 0) return;

        // Kontrola, či všetci schvaľovatelia už hlasovali
        const allProcessed = rows.every(row => row.approval_status === 'Approved' || row.approval_status === 'Rejected');
        
        // Ak ešte nie všetci hlasovali, len aktualizuj status ale NEPRIDÁVAJ obrázok
        if (!allProcessed) {
            console.log(`Dokument ID ${documentId}: Čaká sa na ďalších schvaľovateľov (${rows.filter(r => r.approval_status === 'Pending').length} zostáva)`);
            return;
        }

        // Teraz už všetci hlasovali - určíme finálny status
        const allApproved = rows.every(row => row.approval_status === 'Approved');
        const anyRejected = rows.some(row => row.approval_status === 'Rejected');
        
        let newDocStatus;
        if (anyRejected) {
            newDocStatus = 'Rejected';
        } else if (allApproved) {
            newDocStatus = 'Final Approved';
        } else {
            return; // Nemal by sa stať
        }

        // Získaj aktuálny status dokumentu z databázy
        const currentDocument = await new Promise((resolve, reject) => {
            db.get('SELECT status FROM documents WHERE id = ?', [documentId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // Pridaj obrázok LEN ak status ešte NIE JE finálny
        // Toto zabezpečí, že sa obrázok pridá len raz
        const isAlreadyFinalized = currentDocument && 
                                   (currentDocument.status === 'Final Approved' || 
                                    currentDocument.status === 'Rejected');
        
        if (!isAlreadyFinalized) {
            console.log(`Všetci schvaľovatelia hlasovali pre dokument ID ${documentId}. Pridávam finálny obrázok: ${newDocStatus}`);
            await addFinalStatusImageToPDF(documentId, newDocStatus);
            
            // Aktualizuj stav v databáze
            await new Promise((resolve, reject) => {
                db.run('UPDATE documents SET status = ? WHERE id = ?', [newDocStatus, documentId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            console.log(`Dokument ID ${documentId} finalizovaný na status: ${newDocStatus}`);
        } else {
            console.log(`Dokument ID ${documentId} už bol finalizovaný (status: ${currentDocument.status}). Žiadny obrázok nepridaný.`);
        }

    } catch (error) {
        console.error('Chyba v checkFinalDocumentStatus:', error);
    }
}

// Pomocná funkcia na pridanie finálneho obrázka do PDF
async function addFinalStatusImageToPDF(documentId, finalStatus) {
    try {
        // Získaj dokument z databázy
        const document = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM documents WHERE id = ?', [documentId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!document || !document.file_path) {
            console.error('Dokument nenájdený pre ID:', documentId);
            return;
        }

        // Načítaj existujúci PDF
        const existingPdfBytes = await fs.readFile(document.file_path);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);

        // Určenie obrázka a textu podľa stavu
        let imagePath, statusText, textColor;
        if (finalStatus === 'Final Approved') {
            imagePath = path.join(__dirname, 'images', 'approved.jpg');
            statusText = 'FINÁLNE SCHVÁLENÉ / FINAL APPROVED';
            textColor = rgb(0, 0.5, 0); // Zelená
        } else if (finalStatus === 'Rejected') {
            imagePath = path.join(__dirname, 'images', 'rejected.png');
            statusText = 'ZAMIETNUTÉ / REJECTED';
            textColor = rgb(0.8, 0, 0); // Červená
        } else {
            return; // Neplatný stav
        }

        console.log(`Pridávam finálny status obrázok: ${imagePath}`);

        // Načítaj obrázok
        const imageBytes = await fs.readFile(imagePath);
        let statusImage;
        if (imagePath.toLowerCase().endsWith('.png')) {
            statusImage = await pdfDoc.embedPng(imageBytes);
        } else {
            statusImage = await pdfDoc.embedJpg(imageBytes);
        }

        // Pridaj novú stranu pre finálny status
        const newPage = pdfDoc.addPage();
        const { width: newWidth, height: newHeight } = newPage.getSize();

        // Pridaj nadpis na novú stranu
        newPage.drawText(statusText, {
            x: 50,
            y: newHeight - 100,
            size: 24,
            font: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
            color: textColor,
        });

        // Pridaj dátum a čas finálneho rozhodnutia
        const finalDateTime = `Finálne rozhodnutie: ${new Date().toLocaleString()}`;
        newPage.drawText(finalDateTime, {
            x: 50,
            y: newHeight - 140,
            size: 12,
            font: await pdfDoc.embedFont(StandardFonts.Helvetica),
            color: rgb(0.3, 0.3, 0.3),
        });

        // Pridaj obrázok na stred novej strany
        const imageDims = statusImage.scale(0.6);
        const imageX = (newWidth - imageDims.width) / 2;
        const imageY = (newHeight - imageDims.height) / 2;

        newPage.drawImage(statusImage, {
            x: imageX,
            y: imageY,
            width: imageDims.width,
            height: imageDims.height,
        });

        // Ulož upravený PDF
        const modifiedPdfBytes = await pdfDoc.save();
        await fs.writeFile(document.file_path, modifiedPdfBytes);

        console.log(`Finálny status obrázok úspešne pridaný do PDF pre dokument ID: ${documentId}`);

    } catch (error) {
        console.error('Chyba pri pridávaní finálneho status obrázka:', error);
    }
}


// =========================================================
// 5. ENDPOINT: História/Detail
// =========================================================
app.get('/api/document/:documentId', (req, res) => {
    const documentId = req.params.documentId;
    
    // 1. Získaj detail dokumentu
    db.get('SELECT * FROM documents WHERE id = ?', [documentId], (err, document) => {
        if (err || !document) {
            return res.status(404).json({ error: 'Dokument nebol nájdený.' });
        }

        // 2. Získaj detail schvaľovateľov
        db.all('SELECT approver_email, approval_status, approval_date FROM approvers WHERE document_id = ?', [documentId], (err, approvers) => {
            if (err) {
                return res.status(500).json({ error: 'Chyba pri získavaní schvaľovateľov.' });
            }
            
            res.json({
                ...document,
                approvers: approvers
            });
        });
    });
});

// =========================================================
// 6. ENDPOINT: Zoznam všetkých dokumentov s ich stavmi
// =========================================================
app.get('/api/documents', (req, res) => {
    // Získaj všetky dokumenty s počtom schvaľovateľov a ich stavmi
    const query = `
        SELECT 
            d.id,
            d.case_name,
            d.original_filename,
            d.status,
            d.upload_date,
            d.signed_date,
            d.comment,
            COUNT(a.id) as total_approvers,
            SUM(CASE WHEN a.approval_status = 'Approved' THEN 1 ELSE 0 END) as approved_count,
            SUM(CASE WHEN a.approval_status = 'Rejected' THEN 1 ELSE 0 END) as rejected_count,
            SUM(CASE WHEN a.approval_status = 'Pending' THEN 1 ELSE 0 END) as pending_count
        FROM documents d
        LEFT JOIN approvers a ON d.id = a.document_id
        GROUP BY d.id, d.case_name, d.original_filename, d.status, d.upload_date, d.signed_date, d.comment
        ORDER BY d.upload_date DESC
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Chyba pri získavaní dokumentov: ' + err.message });
        }
        
        res.json({
            documents: rows,
            totalCount: rows.length
        });
    });
});

// =========================================================
// ENDPOINT: Predefinovaní schvaľovatelia
// =========================================================
app.get('/api/predefined-approvers', (req, res) => {
    db.all("SELECT * FROM predefined_approvers WHERE active = 1 ORDER BY name", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// ENDPOINT: Administrácia schvaľovateľov - všetci (vrátane neaktívnych)
app.get('/api/admin/approvers', (req, res) => {
    db.all("SELECT * FROM predefined_approvers ORDER BY name", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// ENDPOINT: Pridať nového schvaľovateľa
app.post('/api/admin/approvers', (req, res) => {
    const { name, email, department } = req.body;
    
    if (!name || !email || !department) {
        return res.status(400).json({ error: 'Všetky polia sú povinné.' });
    }
    
    db.run(
        "INSERT INTO predefined_approvers (name, email, department) VALUES (?, ?, ?)",
        [name, email, department],
        function(err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                    return res.status(400).json({ error: 'Email už existuje.' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.json({ 
                id: this.lastID, 
                message: 'Schvaľovateľ bol úspešne pridaný.',
                approver: { id: this.lastID, name, email, department, active: 1 }
            });
        }
    );
});

// ENDPOINT: Upraviť schvaľovateľa
app.put('/api/admin/approvers/:id', (req, res) => {
    const { id } = req.params;
    const { name, email, department, active } = req.body;
    
    if (!name || !email || !department) {
        return res.status(400).json({ error: 'Všetky polia sú povinné.' });
    }
    
    db.run(
        "UPDATE predefined_approvers SET name = ?, email = ?, department = ?, active = ? WHERE id = ?",
        [name, email, department, active !== undefined ? active : 1, id],
        function(err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                    return res.status(400).json({ error: 'Email už existuje.' });
                }
                return res.status(500).json({ error: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Schvaľovateľ nebol nájdený.' });
            }
            res.json({ message: 'Schvaľovateľ bol úspešne upravený.' });
        }
    );
});

// ENDPOINT: Zmazať/deaktivovaƒ schvaľovateľa
app.delete('/api/admin/approvers/:id', (req, res) => {
    const { id } = req.params;
    const { permanent } = req.query;
    
    if (permanent === 'true') {
        // Trvalé zmazanie
        db.run("DELETE FROM predefined_approvers WHERE id = ?", [id], function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Schvaľovateľ nebol nájdený.' });
            }
            res.json({ message: 'Schvaľovateľ bol trvale zmazaný.' });
        });
    } else {
        // Deaktivácia
        db.run("UPDATE predefined_approvers SET active = 0 WHERE id = ?", [id], function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Schvaľovateľ nebol nájdený.' });
            }
            res.json({ message: 'Schvaľovateľ bol deaktivovaný.' });
        });
    }
});

// ==========================================================
// FRONTEND STATIC FILES SERVING
// ==========================================================
// Serve static frontend build files
if (process.env.NODE_ENV === 'production') {
    const buildPath = path.join(__dirname, 'build');
    app.use(express.static(buildPath));
    
    // SPA fallback - serve index.html for all non-API routes
    app.get('*', (req, res) => {
        // Don't serve index.html for API routes or uploads
        if (!req.path.startsWith('/api/') && !req.path.startsWith('/uploads/')) {
            res.sendFile(path.join(buildPath, 'index.html'));
        }
    });
}

// Spustenie servera len ak nie je v test mode
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        // Vytvorenie adresára pre upload, ak neexistuje
        fs.mkdir(UPLOAD_DIR, { recursive: true }).catch(console.error); 
        console.log(`Server beží na http://localhost:${PORT}`);
    });
}

// Export app pre testovanie
module.exports = app;