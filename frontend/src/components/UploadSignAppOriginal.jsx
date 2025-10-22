// src/components/UploadSignAppOriginal.jsx - Verzia bez inline štýlov
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import LanguageSwitcher from './LanguageSwitcher';
import './UploadSignAppOriginal.css';

const API_BASE_URL = 'http://localhost:3001/api';

const UploadSignApp = () => {
    const { t } = useTranslation();
    
    // State variables
    const [caseName, setCaseName] = useState('');
    const [documentId, setDocumentId] = useState(null);
    const [uploadStatus, setUploadStatus] = useState('');
    const [file, setFile] = useState(null);
    const [comment, setComment] = useState('');
    const [approverEmails, setApproverEmails] = useState('');
    const [approvalLinks, setApprovalLinks] = useState([]);
    const [history, setHistory] = useState(null);
    const [allDocuments, setAllDocuments] = useState([]);
    const [totalDocumentsCount, setTotalDocumentsCount] = useState(0);
    const [activeTab, setActiveTab] = useState(1);
    
    // State pre dynamických schvaľovateľov
    const [selectedApprovers, setSelectedApprovers] = useState([]);
    const [predefinedApprovers, setPredefinedApprovers] = useState([]);
    const [showApproverDropdown, setShowApproverDropdown] = useState(null);
    
    // Simulácia pre história
    const [simulationData, setSimulationData] = useState([]);
    
    // Načítanie nasledujúceho Case ID pri štarte
    useEffect(() => {
        loadNextCaseId();
        loadPredefinedApprovers();
    }, []);

    const loadNextCaseId = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/next-case-id`);
            setCaseName(response.data.nextCaseId);
        } catch (error) {
            console.error('Chyba pri načítavaní Case ID:', error);
            setCaseName('000001'); // Fallback
        }
    };

    const loadPredefinedApprovers = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/predefined-approvers`);
            setPredefinedApprovers(response.data);
        } catch (error) {
            console.error('Chyba pri načítavaní schvaľovateľov:', error);
        }
    };
    
    // Automatické načítanie pri prvom zobrazení Tab 5
    useEffect(() => {
        if (activeTab === 5 && allDocuments.length === 0) {
            handleLoadAllDocuments();
        }
        // Obnovenie schvaľovateľov pri prechode na tab 3 (Schvaľovatelia)
        if (activeTab === 3) {
            loadPredefinedApprovers();
        }
        // Vyčisti status správu pri prechode medzi tabmi (okrem Tab 5)
        if (activeTab !== 5 && uploadStatus.includes('dokumentov')) {
            setUploadStatus('');
        }
    }, [activeTab]);

    // Nový dokument
    const handleNewDocument = () => {
        setDocumentId(null);
        setFile(null);
        setComment('');
        setApproverEmails('');
        setApprovalLinks([]);
        setHistory(null);
        setUploadStatus('');
        setActiveTab(1);
        setSelectedApprovers([]);
        setSimulationData([]);
        loadNextCaseId(); // Načítaj nové Case ID
    };

    // Spracovanie uploadu
    const handleFileUpload = async (e) => {
        e.preventDefault();
        setUploadStatus(t('upload.uploading'));

        if (!file) {
            setUploadStatus(t('upload.file_required'));
            return;
        }

        const formData = new FormData();
        formData.append('document', file);
        formData.append('comment', comment);

        try {
            const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            
            setDocumentId(response.data.documentId);
            setCaseName(response.data.caseId); // Aktualizuj Case ID z odpovede
            setUploadStatus(t('upload.upload_success', { caseId: response.data.caseId }));
            handleViewHistory(response.data.documentId);
            setActiveTab(2); // Presun na podpis tab
        } catch (error) {
            setUploadStatus(t('upload.upload_error', { error: error.response?.data?.error || 'Server error' }));
        }
    };

    // Podpis dokumentu
    const handleSignDocument = async () => {
        if (!documentId) return;
        setUploadStatus(t('sign.signing'));

        try {
            const response = await axios.post(`${API_BASE_URL}/sign/${documentId}`);
            setUploadStatus(response.data.message);
            handleViewHistory(documentId);
            setActiveTab(3); // Presun na schvaľovatelia tab
        } catch (error) {
            setUploadStatus(t('upload.upload_error', { error: error.response?.data?.error || 'Server error' }));
        }
    };

    // Pridanie schvaľovateľov
    const handleAddApprovers = async () => {
        if (!documentId) return;
        
        // Získaj emaily zo starého systému alebo nového
        let emails = [];
        if (selectedApprovers.length > 0 && selectedApprovers.some(a => a !== null)) {
            emails = selectedApprovers.filter(a => a !== null).map(a => a.email);
        } else if (approverEmails.trim()) {
            emails = approverEmails.split(/[\n,;]/).map(e => e.trim()).filter(e => e.length > 0);
        }
        
        if (emails.length === 0) return;
        
        setUploadStatus(t('approvers.adding'));

        try {
            const response = await axios.post(`${API_BASE_URL}/approvers/${documentId}`, { approverEmails: emails });
            setUploadStatus(response.data.message);
            setApprovalLinks(response.data.approvalLinks);
            handleViewHistory(documentId);
            setActiveTab(4); // Presun na história tab
        } catch (error) {
            setUploadStatus(t('upload.upload_error', { error: error.response?.data?.error || 'Server error' }));
        }
    };

    // Schválenie/Zamietnutie cez simuláciu
    const handleApprovalAction = async (link, action) => {
        const parts = link.split('/');
        const approverId = parts[parts.length - 2]; 

        try {
            const response = await axios.post(`${API_BASE_URL}/approve/${approverId}`, { action });
            alert(`Akcia ${action} pre schvaľovateľa ${approverId} bola spracovaná.`);
            setUploadStatus(response.data.message);
            
            // Odstráň len spracovaný link namiesto všetkých
            const updatedLinks = approvalLinks.filter(item => item.link !== link);
            setApprovalLinks(updatedLinks);
            
            // Ak už nie sú žiadne linky, zobraz informáciu o dokončení
            if (updatedLinks.length === 0) {
                setUploadStatus(t('approvers.all_completed'));
            }
            
            handleViewHistory();
        } catch (error) {
            alert(`Chyba pri akcii ${action}.`);
        }
    };

    // Načítanie histórie
    const handleViewHistory = async (id = documentId) => {
        if (!id) return;
        
        try {
            const response = await axios.get(`${API_BASE_URL}/history/${id}`);
            setHistory(response.data);
            
            // Ak je dokument v schvaľovaní a nemáme simulation data, vytvor ich
            if (response.data.status === 'WaitingForApproval' && simulationData.length === 0) {
                const pending = response.data.approvers.filter(a => a.status === 'Pending');
                if (pending.length > 0) {
                    setSimulationData(pending.map(a => ({ ...a, simulatedStatus: 'Pending' })));
                }
            }
        } catch (error) {
            console.error('Chyba pri načítavaní histórie:', error);
        }
    };

    // Načítanie všetkých dokumentov
    const handleLoadAllDocuments = async () => {
        setUploadStatus(t('all_documents.loading'));
        
        try {
            const response = await axios.get(`${API_BASE_URL}/all-documents`);
            setAllDocuments(response.data);
            setTotalDocumentsCount(response.data.length);
            setUploadStatus(t('all_documents.loaded', { count: response.data.length }));
        } catch (error) {
            setUploadStatus(t('all_documents.load_error', { error: error.response?.data?.error || 'Server error' }));
        }
    };

    // Reset databázy
    const handleResetDatabase = async () => {
        if (window.confirm(t('all_documents.reset_confirm'))) {
            try {
                await axios.post(`${API_BASE_URL}/reset-database`);
                setUploadStatus(t('all_documents.reset_success'));
                handleNewDocument();
                setAllDocuments([]);
                setTotalDocumentsCount(0);
            } catch (error) {
                setUploadStatus(t('all_documents.reset_error', { error: error.response?.data?.error || 'Server error' }));
            }
        }
    };

    // Funkcie pre prácu so schvaľovateľmi
    const addApproverSlot = () => {
        setSelectedApprovers([...selectedApprovers, null]);
    };

    const removeApproverSlot = (index) => {
        const newApprovers = selectedApprovers.filter((_, i) => i !== index);
        setSelectedApprovers(newApprovers);
    };

    const selectApprover = (index, approver) => {
        const newApprovers = [...selectedApprovers];
        newApprovers[index] = approver;
        setSelectedApprovers(newApprovers);
        setShowApproverDropdown(null);
    };

    const filteredApprovers = (searchTerm) => {
        if (!searchTerm) return predefinedApprovers;
        return predefinedApprovers.filter(approver =>
            approver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            approver.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            approver.department.toLowerCase().includes(searchTerm.toLowerCase())
        );
    };

    // Simulácia v histórii
    const handleHistorySimulation = (approverId, action) => {
        setSimulationData(prev => 
            prev.map(item => 
                item.approverId === approverId 
                    ? { ...item, simulatedStatus: action, simulatedDate: new Date().toISOString() }
                    : item
            )
        );
    };

    const resetSimulation = () => {
        if (history && history.status === 'WaitingForApproval') {
            const pending = history.approvers.filter(a => a.status === 'Pending');
            setSimulationData(pending.map(a => ({ ...a, simulatedStatus: 'Pending' })));
        }
    };

    // Render obsahu tabov
    const renderTabContent = () => {
        switch (activeTab) {
            case 1:
                return (
                    <div>
                        <h3 className="section-title">{t('upload.title')}</h3>
                        
                        {documentId && (
                            <div className="success-alert">
                                ✅ {t('upload.document_uploaded', { id: documentId })}
                                <button onClick={handleNewDocument} className="new-document-btn">
                                    {t('upload.new_document')}
                                </button>
                            </div>
                        )}
                        
                        <form onSubmit={handleFileUpload} className="form-container">
                            <div className="form-group">
                                <label className="form-label">{t('upload.file_label')}</label>
                                
                                {/* Skrytý file input */}
                                <input 
                                    type="file" 
                                    accept="application/pdf" 
                                    onChange={e => setFile(e.target.files[0])} 
                                    required 
                                    style={{ display: 'none' }}
                                    id="file-input"
                                />
                                
                                {/* Custom file selector */}
                                <div className="file-upload-container">
                                    <button 
                                        type="button"
                                        onClick={() => document.getElementById('file-input').click()}
                                        className="file-upload-button"
                                    >
                                        📁 {t('upload.choose_file')}
                                    </button>
                                    <span className={file ? 'file-status selected' : 'file-status empty'}>
                                        {file ? `✅ ${file.name}` : t('upload.no_file_selected')}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="form-group">
                                <label className="form-label">{t('upload.case_id_label')}</label>
                                <input 
                                    type="text" 
                                    value={caseName} 
                                    readOnly
                                    className="form-input readonly"
                                />
                                <small className="form-help-text">
                                    {t('upload.case_id_help')}
                                </small>
                            </div>
                            
                            <div className="form-group">
                                <label className="form-label">{t('upload.comment_label')}</label>
                                <textarea 
                                    placeholder={t('upload.comment_placeholder')}
                                    value={comment} 
                                    onChange={e => setComment(e.target.value)} 
                                    rows="3"
                                    className="form-textarea"
                                />
                            </div>
                            
                            <button type="submit" className="btn btn-success">
                                {t('upload.upload_button')}
                            </button>
                        </form>
                    </div>
                );

            case 2:
                return (
                    <div>
                        <h3 className="section-title">{t('sign.title')}</h3>
                        {documentId ? (
                            <div className="sign-container">
                                <p className="sign-document-id">
                                    <strong>{t('sign.document_id')}</strong> {caseName}
                                </p>
                                <p className="sign-description">
                                    {t('sign.description')}
                                </p>
                                <button 
                                    onClick={handleSignDocument} 
                                    disabled={history?.status && history.status !== 'Draft'}
                                    className="btn btn-primary"
                                >
                                    {t('sign.sign_button')}
                                </button>
                                {history?.status && history.status !== 'Draft' && (
                                    <p className="already-signed">
                                        {t('sign.already_signed')}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="warning-alert">
                                <p>{t('sign.no_document')}</p>
                            </div>
                        )}
                    </div>
                );

            case 3:
                return (
                    <div>
                        <h3 className="section-title">{t('approvers.title')}</h3>
                        {documentId ? (
                            <div className="form-container">
                                {/* Upozornenie o synchronizácii */}
                                <div className="approvers-warning">
                                    <strong>ℹ️ Poznámka:</strong> {t('approvers.sync_note')}
                                </div>

                                {/* Nový systém - Výber zo zoznamu */}
                                <div className="form-group">
                                    <label className="form-label">{t('approvers.select_from_list')}</label>
                                    
                                    {selectedApprovers.map((approver, index) => (
                                        <div key={index} className={approver ? 'approver-row selected' : 'approver-row empty'}>
                                            <div className="approver-info">
                                                {approver ? (
                                                    <div>
                                                        <strong>{approver.name}</strong>
                                                        <div className="approver-email">{approver.email}</div>
                                                        <div className="approver-department">{approver.department}</div>
                                                    </div>
                                                ) : (
                                                    <div style={{ position: 'relative' }}>
                                                        <input 
                                                            type="text"
                                                            placeholder={t('approvers.search_placeholder')}
                                                            className="form-input"
                                                            onFocus={() => setShowApproverDropdown(index)}
                                                            onChange={(e) => {
                                                                if (e.target.value.length > 0) {
                                                                    setShowApproverDropdown(index);
                                                                }
                                                            }}
                                                        />
                                                        {showApproverDropdown === index && (
                                                            <div className="approver-dropdown">
                                                                {filteredApprovers('').map((predefined, i) => (
                                                                    <div
                                                                        key={i}
                                                                        className="approver-dropdown-item"
                                                                        onClick={() => selectApprover(index, predefined)}
                                                                    >
                                                                        <div><strong>{predefined.name}</strong></div>
                                                                        <div className="approver-email">{predefined.email}</div>
                                                                        <div style={{ fontSize: '11px', color: '#888' }}>{predefined.department}</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <button 
                                                onClick={() => removeApproverSlot(index)}
                                                className="btn btn-danger btn-small"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                    
                                    <button 
                                        onClick={addApproverSlot}
                                        className="btn btn-primary btn-medium"
                                    >
                                        + {t('approvers.add_approver')}
                                    </button>
                                </div>

                                {/* Starý systém - Manuálny vstup */}
                                <div className="form-group">
                                    <label className="form-label">{t('approvers.manual_input')}</label>
                                    <textarea 
                                        placeholder={t('approvers.manual_placeholder')}
                                        value={approverEmails} 
                                        onChange={e => setApproverEmails(e.target.value)} 
                                        rows="3"
                                        className="form-textarea"
                                    />
                                    <small className="form-help-text">
                                        {t('approvers.manual_help')}
                                    </small>
                                </div>
                                
                                <button 
                                    onClick={handleAddApprovers} 
                                    disabled={(!selectedApprovers.some(a => a !== null) && !approverEmails.trim()) || (history?.status && history.status !== 'Signed')}
                                    className="btn btn-warning"
                                >
                                    {t('approvers.add_button')}
                                </button>
                                
                                {/* Simulácia schvaľovania */}
                                {approvalLinks.length > 0 && (
                                    <div className="simulation-section">
                                        <h4>{t('approvers.simulation_title')}</h4>
                                        <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
                                            {t('approvers.simulation_description')}
                                        </p>
                                        
                                        {approvalLinks.map((item, index) => (
                                            <div key={index} className="simulation-item">
                                                <strong style={{ minWidth: '200px' }}>{item.email}:</strong>
                                                <button 
                                                    onClick={() => handleApprovalAction(item.link, 'approve')}
                                                    className="btn btn-success btn-small"
                                                >
                                                    ✅ {t('approvers.approve')}
                                                </button>
                                                <button 
                                                    onClick={() => handleApprovalAction(item.link, 'reject')}
                                                    className="btn btn-danger btn-small"
                                                >
                                                    ❌ {t('approvers.reject')}
                                                </button>
                                            </div>
                                        ))}
                                        
                                        {approvalLinks.length === 0 && (
                                            <div className="simulation-completed">
                                                <strong>{t('approvers.all_completed')}</strong>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="warning-alert">
                                <p>{t('approvers.no_document')}</p>
                            </div>
                        )}
                    </div>
                );

            case 4:
                return (
                    <div>
                        <h3 className="section-title">{t('history.title')}</h3>
                        {history ? (
                            <div className="history-container">
                                <h4 className="history-title">{t('history.document')} {caseName}</h4>
                                
                                {/* Základné informácie */}
                                <div className="basic-info-section">
                                    <p><strong>{t('history.current_status')}:</strong> {history.status}</p>
                                    <p><strong>{t('history.created')}:</strong> {new Date(history.createdAt).toLocaleString()}</p>
                                    {history.comment && <p><strong>{t('history.comment')}:</strong> {history.comment}</p>}
                                </div>

                                {/* Timeline */}
                                <div className="timeline-section">
                                    <h5>{t('history.timeline')}</h5>
                                    <div className="timeline-container">
                                        <div className="timeline-item">
                                            <div className="timeline-dot upload"></div>
                                            <strong>{t('history.uploaded')}</strong> - {new Date(history.createdAt).toLocaleString()}
                                        </div>
                                        
                                        {history.signedAt && (
                                            <div className="timeline-item">
                                                <div className="timeline-dot sign"></div>
                                                <strong>{t('history.signed')}</strong> - {new Date(history.signedAt).toLocaleString()}
                                            </div>
                                        )}
                                        
                                        {history.approversAddedAt && (
                                            <div className="timeline-item">
                                                <div className="timeline-dot approval"></div>
                                                <strong>{t('history.approvers_added')}</strong> - {new Date(history.approversAddedAt).toLocaleString()}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Súbor */}
                                <div className="file-section">
                                    <h5>{t('history.file')}</h5>
                                    <a 
                                        href={`${API_BASE_URL}/download/${history.documentId}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="file-link"
                                    >
                                        📄 {t('history.download_original')}
                                    </a>
                                </div>

                                {/* Schvaľovatelia */}
                                {history.approvers && history.approvers.length > 0 && (
                                    <div className="approvers-history-section">
                                        <h5>{t('history.approvers')}</h5>
                                        <div className="approvers-grid">
                                            {history.approvers.map((approver, index) => {
                                                // Skontroluj či existuje simulácia pre tohto schvaľovateľa
                                                const simulation = simulationData.find(s => s.approverId === approver.approverId);
                                                const displayStatus = simulation?.simulatedStatus || approver.status;
                                                const displayDate = simulation?.simulatedDate || approver.approvalDate;
                                                
                                                return (
                                                    <div key={index} className={`approver-card ${displayStatus.toLowerCase()}`}>
                                                        <div className="approver-header">
                                                            <div>
                                                                <strong>{approver.email}</strong>
                                                                <div className="approver-number">#{index + 1}</div>
                                                            </div>
                                                            <span className={`status-badge ${displayStatus.toLowerCase()}`}>
                                                                {displayStatus === 'Approved' && '✅'}
                                                                {displayStatus === 'Rejected' && '❌'}
                                                                {displayStatus === 'Pending' && '⏳'}
                                                                {' '}{displayStatus}
                                                            </span>
                                                        </div>
                                                        {displayDate && (
                                                            <div className="approval-date">
                                                                {new Date(displayDate).toLocaleString()}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        
                                        {/* Súhrn */}
                                        <div className="summary-section">
                                            <div className="summary-stats">
                                                <span>📊 <strong>{t('history.total')}:</strong> {history.approvers.length}</span>
                                                <span>✅ <strong>{t('history.approved')}:</strong> {history.approvers.filter(a => a.status === 'Approved').length}</span>
                                                <span>❌ <strong>{t('history.rejected')}:</strong> {history.approvers.filter(a => a.status === 'Rejected').length}</span>
                                                <span>⏳ <strong>{t('history.pending')}:</strong> {history.approvers.filter(a => a.status === 'Pending').length}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Simulácia pre históriu */}
                                {history.status === 'WaitingForApproval' && simulationData.length > 0 && (
                                    <div className="history-simulation">
                                        <h5>{t('history.simulation_title')}</h5>
                                        <p className="simulation-description">
                                            {t('history.simulation_description')}
                                        </p>
                                        
                                        {simulationData.map((approver, index) => (
                                            <div key={index} className="simulation-approver">
                                                <div className="simulation-controls">
                                                    <div className="approver-email-label">{approver.email}:</div>
                                                    <button 
                                                        onClick={() => handleHistorySimulation(approver.approverId, 'Approved')}
                                                        className="btn btn-success btn-small"
                                                        disabled={approver.simulatedStatus !== 'Pending'}
                                                    >
                                                        ✅ {t('approvers.approve')}
                                                    </button>
                                                    <button 
                                                        onClick={() => handleHistorySimulation(approver.approverId, 'Rejected')}
                                                        className="btn btn-danger btn-small"
                                                        disabled={approver.simulatedStatus !== 'Pending'}
                                                    >
                                                        ❌ {t('approvers.reject')}
                                                    </button>
                                                    <span style={{ fontSize: '12px', color: '#666' }}>
                                                        {t('history.current_status')}: {approver.simulatedStatus}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                        
                                        <button 
                                            onClick={resetSimulation}
                                            className="btn btn-warning btn-small"
                                        >
                                            🔄 {t('history.reset_simulation')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="warning-alert">
                                <p>{t('history.no_document')}</p>
                            </div>
                        )}
                    </div>
                );

            case 5:
                return (
                    <div>
                        <h3 className="section-title">{t('all_documents.title')}</h3>
                        
                        <div className="documents-controls">
                            <button onClick={handleLoadAllDocuments} className="btn btn-primary">
                                {t('all_documents.refresh')}
                            </button>
                            <button onClick={handleResetDatabase} className="btn btn-danger">
                                {t('all_documents.reset_database')}
                            </button>
                        </div>
                        
                        {allDocuments.length > 0 && (
                            <div className="stats-container">
                                <div className="stat-badge approved">
                                    ✅ {t('all_documents.approved')}: {allDocuments.filter(doc => doc.status === 'Approved').length}
                                </div>
                                <div className="stat-badge rejected">
                                    ❌ {t('all_documents.rejected')}: {allDocuments.filter(doc => doc.status === 'Rejected').length}
                                </div>
                                <div className="stat-badge waiting">
                                    ⏳ {t('all_documents.waiting')}: {allDocuments.filter(doc => doc.status === 'WaitingForApproval').length}
                                </div>
                                <div className="stat-badge draft">
                                    📄 {t('all_documents.draft')}: {allDocuments.filter(doc => ['Draft', 'Signed'].includes(doc.status)).length}
                                </div>
                            </div>
                        )}
                        
                        <div className="documents-grid">
                            {allDocuments.map((doc, index) => (
                                <div key={index} className="document-card">
                                    <div className="document-header">
                                        <div className="document-info">
                                            <h4 className="document-title">{doc.caseId}</h4>
                                            <p className="document-meta">
                                                📅 {t('all_documents.created')}: {new Date(doc.createdAt).toLocaleDateString()}
                                            </p>
                                            {doc.comment && (
                                                <p className="document-meta small">💬 {doc.comment}</p>
                                            )}
                                            {doc.approversCount > 0 && (
                                                <p className="document-approvers">
                                                    👥 {doc.approversCount} {t('all_documents.approvers')} 
                                                    {doc.approvedCount > 0 && ` (✅ ${doc.approvedCount})`}
                                                    {doc.rejectedCount > 0 && ` (❌ ${doc.rejectedCount})`}
                                                </p>
                                            )}
                                        </div>
                                        <div className="document-actions">
                                            <div className={`document-status ${doc.status.toLowerCase()}`}>
                                                {doc.status === 'Approved' && '✅'}
                                                {doc.status === 'Rejected' && '❌'}
                                                {doc.status === 'WaitingForApproval' && '⏳'}
                                                {['Draft', 'Signed'].includes(doc.status) && '📄'}
                                                {' '}{doc.status}
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    setDocumentId(doc.documentId);
                                                    setCaseName(doc.caseId);
                                                    handleViewHistory(doc.documentId);
                                                    setActiveTab(4);
                                                }}
                                                className="view-detail-btn"
                                            >
                                                👁️ {t('all_documents.view_detail')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {totalDocumentsCount > 0 && (
                            <div className="total-documents">
                                📊 {t('all_documents.total_count', { count: totalDocumentsCount })}
                            </div>
                        )}
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="upload-sign-app">
            <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                <LanguageSwitcher />
            </div>
            
            <h1 className="app-title">{t('app.title')}</h1>
            
            {/* Status správa */}
            {uploadStatus && (
                <div className="status-message">
                    <strong>{uploadStatus}</strong>
                </div>
            )}
            
            {/* Tab navigácia */}
            <div className="tab-navigation">
                <button 
                    className={`tab-button ${activeTab === 1 ? 'active' : 'enabled'}`}
                    onClick={() => setActiveTab(1)}
                >
                    📄 {t('tabs.upload')}
                </button>
                <button 
                    className={`tab-button ${activeTab === 2 ? 'active' : (documentId ? 'enabled' : 'disabled')}`}
                    onClick={() => documentId && setActiveTab(2)}
                    disabled={!documentId}
                >
                    ✍️ {t('tabs.sign')}
                </button>
                <button 
                    className={`tab-button ${activeTab === 3 ? 'active' : (history?.status === 'Signed' ? 'enabled' : 'disabled')}`}
                    onClick={() => history?.status === 'Signed' && setActiveTab(3)}
                    disabled={history?.status !== 'Signed'}
                >
                    👥 {t('tabs.approvers')}
                </button>
                <button 
                    className={`tab-button ${activeTab === 4 ? 'active' : (history ? 'enabled' : 'disabled')}`}
                    onClick={() => history && setActiveTab(4)}
                    disabled={!history}
                >
                    📈 {t('tabs.history')}
                </button>
                <button 
                    className={`tab-button ${activeTab === 5 ? 'active' : 'enabled'}`}
                    onClick={() => setActiveTab(5)}
                >
                    📚 {t('tabs.all_documents')}
                </button>
            </div>
            
            {/* Tab obsah */}
            <div className="tab-content">
                {renderTabContent()}
            </div>
        </div>
    );
};

export default UploadSignApp;