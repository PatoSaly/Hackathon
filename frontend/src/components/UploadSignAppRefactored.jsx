// src/components/UploadSignAppRefactored.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import UploadForm from './UploadForm';
import SignDocument from './SignDocument';
import StatusBadge from './StatusBadge';
import AdminApproversTab from './AdminApproversTab';
import ApproversTab from './ApproversTab';
import useApi from '../hooks/useApi';
import { getStatusColor, getApproverCardColor, formatDate } from '../utils/documentUtils';
import './UploadSignApp.css';

const UploadSignAppRefactored = () => {
    const { t } = useTranslation();
    const api = useApi();
    
    // State variables
    const [caseName, setCaseName] = useState('');
    const [documentId, setDocumentId] = useState(null);
    const [uploadStatus, setUploadStatus] = useState('');
    const [approverEmails, setApproverEmails] = useState('');
    const [approvalLinks, setApprovalLinks] = useState([]);
    const [history, setHistory] = useState(null);
    const [allDocuments, setAllDocuments] = useState([]);
    const [activeTab, setActiveTab] = useState(1);
    
    // State pre dynamických schvaľovateľov
    const [selectedApprovers, setSelectedApprovers] = useState([]);
    const [predefinedApprovers, setPredefinedApprovers] = useState([]);
    const [showApproverDropdown, setShowApproverDropdown] = useState(null);
    
    const loadNextCaseId = useCallback(async () => {
        try {
            const response = await api.get('/next-case-id');
            setCaseName(response.nextCaseId);
        } catch (error) {
            console.error('Chyba pri načítavaní Case ID:', error);
            setCaseName('000001');
        }
    }, [api]);

    const loadPredefinedApprovers = useCallback(async () => {
        try {
            const response = await api.get('/predefined-approvers');
            setPredefinedApprovers(response);
        } catch (error) {
            console.error('Chyba pri načítavaní schvaľovateľov:', error);
        }
    }, [api]);
    
    // Načítanie pri štarte
    useEffect(() => {
        loadNextCaseId();
        loadPredefinedApprovers();
    }, [loadNextCaseId, loadPredefinedApprovers]);
    
    const handleLoadAllDocuments = useCallback(async () => {
        try {
            setAllDocuments([]);
            const response = await api.get('/documents');
            setAllDocuments(response.documents);
            setUploadStatus(t('all_documents.load_success', { count: response.totalCount }));
        } catch (error) {
            setUploadStatus(t('all_documents.load_error', { error: api.error }));
        }
    }, [t]); // eslint-disable-line react-hooks/exhaustive-deps
    
    // Sledovanie zmien tabov
    useEffect(() => {
        if (activeTab === 5 && allDocuments.length === 0) {
            handleLoadAllDocuments();
        }
        if (activeTab === 3) {
            loadPredefinedApprovers();
        }
        if (activeTab !== 5 && uploadStatus.includes('dokumentov')) {
            setUploadStatus('');
        }
    }, [activeTab, allDocuments.length, handleLoadAllDocuments, loadPredefinedApprovers, uploadStatus]);

    // Definícia tabov
    const tabs = [
        { id: 1, label: t('tabs.upload'), enabled: true },
        { id: 2, label: t('tabs.sign'), enabled: !!documentId },
        { id: 3, label: t('tabs.approvers'), enabled: !!documentId },
        { id: 4, label: t('tabs.approval_status'), enabled: !!documentId },
        { id: 5, label: t('tabs.all_documents'), enabled: true },
        { id: 6, label: t('tabs.admin_approvers'), enabled: true }
    ];

    // Handlery
    const handleNewDocument = () => {
        setDocumentId(null);
        setUploadStatus('');
        setApproverEmails('');
        setApprovalLinks([]);
        setHistory(null);
        setActiveTab(1);
        setAllDocuments([]);
        setSelectedApprovers([]);
        setShowApproverDropdown(null);
        loadNextCaseId();
    };

    const handleUploadSuccess = async (response) => {
        setDocumentId(response.documentId);
        setCaseName(response.caseId);
        await handleViewHistory(response.documentId);
        // Presmeruj na podpisový tab po úspešnom nahratí
        setActiveTab(2);
    };

    const handleSignSuccess = (message) => {
        setUploadStatus(message);
        handleViewHistory(documentId);
        setActiveTab(3);
    };

    const handleViewHistory = async (id = documentId) => {
        if (!id) return;
        try {
            const response = await api.get(`/document/${id}`);
            setHistory(response);
            setUploadStatus(t('history.refresh_success', { id: response.case_name }));
            return response; // Vrátime história pre ďalšie použitie
        } catch (error) {
            setUploadStatus(t('history.refresh_error', { error: api.error }));
            setHistory(null);
            return null;
        }
    };

    const handleResetDatabase = async () => {
        if (window.confirm(t('all_documents.reset_confirm'))) {
            try {
                await api.post('/reset-database');
                setUploadStatus(t('all_documents.reset_success'));
                handleNewDocument();
            } catch (error) {
                setUploadStatus(t('all_documents.reset_error', { error: api.error }));
            }
        }
    };

    // Simulácia schválenia/zamietnutia
    const handleApprovalAction = async (link, action) => {
        const parts = link.split('/');
        const approverId = parts[parts.length - 2]; 

        try {
            const response = await api.post(`/approve/${approverId}`, { action });
            window.alert(`Akcia ${action} pre schvaľovateľa ${approverId} bola spracovaná.`);
            setUploadStatus(response.message);
            
            // Odstráň len spracovaný link namiesto všetkých
            const updatedLinks = approvalLinks.filter(item => item.link !== link);
            setApprovalLinks(updatedLinks);
            
            // Ak už nie sú žiadne linky, zobraz informáciu o dokončení
            if (updatedLinks.length === 0) {
                setUploadStatus(t('approvers.all_completed'));
            }
            
            handleViewHistory();
        } catch (error) {
            window.alert(`Chyba pri akcii ${action}.`);
        }
    };

    const handleApproversAdded = (response) => {
        setUploadStatus(response.message);
        setApprovalLinks(response.approvalLinks);
        handleViewHistory(documentId);
        setActiveTab(4); // Presun na história tab
    };

    // Handler pre nahradenie dokumentu
    const handleReplaceDocument = (response) => {
        setUploadStatus(`Súbor bol zmenený pre prípad: ${response.caseId}`);
        // Znovu načítaj históriu aby sa aktualizovali informácie o súbore
        if (documentId) {
            handleViewHistory(documentId);
        }
        // Ak bol dokument už podpísaný, presun na záložku podpis
        // Ak bol v Draft, zostane na prvom tabe
        if (history && history.status === 'Waiting for Approval') {
            setActiveTab(2); // Presun na podpis
        } else {
            setActiveTab(1); // Zostane na upload/zmena
        }
    };

    // Render funkcií pre jednotlivé taby
    const renderUploadTab = () => (
        <UploadForm
            caseName={caseName}
            onUploadSuccess={handleUploadSuccess}
            documentId={documentId}
            onNewDocument={handleNewDocument}
            history={history}
            onReplaceDocument={handleReplaceDocument}
        />
    );

    const renderSignTab = () => (
        <SignDocument
            documentId={documentId}
            caseName={caseName}
            history={history}
            onSignSuccess={handleSignSuccess}
        />
    );

    const renderApproversTab = () => (
        <ApproversTab
            documentId={documentId}
            history={history}
            approverEmails={approverEmails}
            setApproverEmails={setApproverEmails}
            selectedApprovers={selectedApprovers}
            setSelectedApprovers={setSelectedApprovers}
            predefinedApprovers={predefinedApprovers}
            showApproverDropdown={showApproverDropdown}
            setShowApproverDropdown={setShowApproverDropdown}
            approvalLinks={approvalLinks}
            onApproversAdded={handleApproversAdded}
            onApprovalAction={handleApprovalAction}
        />
    );

    const renderHistoryTab = () => (
        <div>
            <h3 className="section-title">{t('history.title')}</h3>
            {!documentId ? (
                <div className="alert alert-warning">
                    {t('history.upload_first')}
                </div>
            ) : (
                <div>
                    <button 
                        onClick={() => handleViewHistory()} 
                        className="btn btn-primary"
                        style={{ marginBottom: '20px' }}
                        disabled={api.loading}
                    >
                        {api.loading ? t('general.loading') : t('history.refresh_button')}
                    </button>

                    {history && (
                        <div className="card" style={{ border: '1px solid #28a745', backgroundColor: '#f8fff8' }}>
                            <h3>
                                📄 {t('history.case_id')} {history.case_name} | {t('history.status')} 
                                <StatusBadge status={history.status} />
                            </h3>
                            
                            {/* Základné informácie */}
                            <div className="card" style={{ backgroundColor: '#f8f9fa', marginBottom: '20px' }}>
                                <h4>{t('history.basic_info')}</h4>
                                <p><strong>{t('history.original_filename')}</strong> {history.original_filename}</p>
                                <p><strong>{t('history.comment')}</strong> {history.comment || t('history.no_comment')}</p>
                                <p><strong>{t('history.uploaded')}</strong> {formatDate(history.upload_date)}</p>
                                {history.signed_date && <p><strong>{t('history.signed')}</strong> {formatDate(history.signed_date)}</p>}
                            </div>

                            {/* Časová os procesu */}
                            <div style={{ marginBottom: '20px' }}>
                                <h4>{t('history.timeline')}</h4>
                                <div style={{ borderLeft: '3px solid #007bff', paddingLeft: '20px' }}>
                                    <div style={{ marginBottom: '15px', position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '-27px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#28a745' }}></div>
                                        <strong>{t('history.timeline_upload')}</strong><br />
                                        <small>{formatDate(history.upload_date)}</small>
                                    </div>
                                    
                                    {history.signed_date && (
                                        <div style={{ marginBottom: '15px', position: 'relative' }}>
                                            <div style={{ position: 'absolute', left: '-27px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#007bff' }}></div>
                                            <strong>{t('history.timeline_sign')}</strong><br />
                                            <small>{formatDate(history.signed_date)}</small>
                                        </div>
                                    )}
                                    
                                    {history.approvers && history.approvers.length > 0 && (
                                        <div style={{ marginBottom: '15px', position: 'relative' }}>
                                            <div style={{ position: 'absolute', left: '-27px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: history.status === 'Final Approved' ? '#28a745' : history.status === 'Rejected' ? '#dc3545' : '#ffc107' }}></div>
                                            <strong>{t('history.timeline_approval')}</strong><br />
                                            <small>{t('history.approvers_added', { count: history.approvers.length })}</small>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {/* Odkaz na stiahnutie */}
                            {history.file_path && (
                                <div className="alert alert-info" style={{ marginBottom: '20px' }}>
                                    <h4>{t('history.file_section')}</h4>
                                    <a href={`http://localhost:3001/uploads/${history.file_path.split(/[/\\]/).pop()}`} target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', textDecoration: 'none', fontSize: '16px' }}>
                                        {t('history.view_download', { filename: history.original_filename })}
                                    </a>
                                </div>
                            )}

                            {/* História schvaľovateľov */}
                            {history.approvers && history.approvers.length > 0 && (
                                <div className="card" style={{ backgroundColor: '#f8f9fa', padding: '20px' }}>
                                    <h4>{t('history.approvers_history', { count: history.approvers.length })}</h4>
                                    <div style={{ display: 'grid', gap: '10px' }}>
                                        {history.approvers.map((approver, i) => (
                                            <div key={i} className="card" style={{ 
                                                backgroundColor: getApproverCardColor(approver.approval_status)
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <strong>📧 {approver.approver_email}</strong><br />
                                                        <span style={{ fontSize: '12px', color: '#666' }}>
                                                            {t('history.approver_number', { number: i + 1 })}
                                                        </span>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <StatusBadge status={approver.approval_status} />
                                                        {approver.approval_date && (
                                                            <div style={{ fontSize: '11px', color: '#666', marginTop: '5px' }}>
                                                                {formatDate(approver.approval_date)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {/* Súhrn schvaľovania */}
                                    <div className="alert alert-info" style={{ marginTop: '20px' }}>
                                        <h5>{t('history.summary')}</h5>
                                        <div style={{ display: 'flex', gap: '20px', fontSize: '14px' }}>
                                            <span>{t('history.approved')} <strong>{history.approvers.filter(a => a.approval_status === 'Approved').length}</strong></span>
                                            <span>{t('history.rejected')} <strong>{history.approvers.filter(a => a.approval_status === 'Rejected').length}</strong></span>
                                            <span>{t('history.pending')} <strong>{history.approvers.filter(a => a.approval_status === 'Pending').length}</strong></span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Simulácia schválenia cez tlačidlá (ak existujú approval links) */}
                            {approvalLinks.length > 0 && (
                                <div className="alert alert-info" style={{ marginTop: '20px', backgroundColor: '#e7f3ff' }}>
                                    <h4>{t('history.simulation_title')}</h4>
                                    <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
                                        {t('history.simulation_description')}
                                    </p>
                                    {approvalLinks.map((item, index) => (
                                        <div key={index} className="card" style={{ marginBottom: '10px', backgroundColor: 'white' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <strong style={{ minWidth: '200px' }}>📧 {item.email}</strong> 
                                                <button 
                                                    onClick={() => handleApprovalAction(item.link, 'Approve')} 
                                                    className="btn btn-success"
                                                    disabled={api.loading}
                                                >
                                                    {t('history.approve_button')}
                                                </button>
                                                <button 
                                                    onClick={() => handleApprovalAction(item.link, 'Disapprove')} 
                                                    className="btn btn-danger"
                                                    disabled={api.loading}
                                                >
                                                    {t('history.reject_button')}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    const renderAllDocumentsTab = () => (
        <div>
            <h3 className="section-title">{t('all_documents.title')}</h3>
            <div style={{ marginBottom: '20px' }}>
                <button 
                    onClick={handleLoadAllDocuments} 
                    className="btn btn-primary btn-margin-right"
                >
                    {t('all_documents.load_button')}
                </button>
                
                <button 
                    onClick={handleResetDatabase} 
                    className="btn btn-danger"
                >
                    {t('all_documents.reset_button')}
                </button>
            </div>

            {allDocuments.length > 0 && (
                <div>
                    {/* Štatistiky */}
                    <div className="stats-container">
                        <span className="stat-badge" style={{ backgroundColor: '#28a745' }}>
                            {t('all_documents.approved')} {allDocuments.filter(d => d.status === 'Final Approved').length}
                        </span>
                        <span className="stat-badge" style={{ backgroundColor: '#dc3545' }}>
                            {t('all_documents.rejected')} {allDocuments.filter(d => d.status === 'Rejected').length}
                        </span>
                        <span className="stat-badge" style={{ backgroundColor: '#ffc107', color: 'black' }}>
                            {t('all_documents.waiting')} {allDocuments.filter(d => d.status === 'Waiting for Approval').length}
                        </span>
                        <span className="stat-badge" style={{ backgroundColor: '#6c757d' }}>
                            {t('all_documents.draft')} {allDocuments.filter(d => d.status === 'Draft').length}
                        </span>
                    </div>

                    {/* Zoznam dokumentov */}
                    <div style={{ display: 'grid', gap: '15px' }}>
                        {allDocuments.map((doc) => (
                            <div key={doc.id} className="card" style={{ borderLeft: `5px solid ${getStatusColor(doc.status)}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                    <div style={{ flex: 1 }}>
                                        <h4>📄 {doc.case_name}</h4>
                                        <p><strong>{t('all_documents.file')}</strong> {doc.original_filename}</p>
                                        <p><strong>{t('all_documents.uploaded')}</strong> {formatDate(doc.upload_date)}</p>
                                    </div>
                                    
                                    <div style={{ textAlign: 'right' }}>
                                        <StatusBadge status={doc.status} />
                                        <div style={{ marginTop: '15px' }}>
                                            <button 
                                                onClick={() => {
                                                    handleViewHistory(doc.id);
                                                    setActiveTab(4);
                                                }}
                                                className="btn btn-primary btn-small"
                                            >
                                                {t('all_documents.view_detail')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    const renderTabContent = () => {
        switch (activeTab) {
            case 1: return renderUploadTab();
            case 2: return renderSignTab();
            case 3: return renderApproversTab();
            case 4: return renderHistoryTab();
            case 5: return renderAllDocumentsTab();
            case 6: return <AdminApproversTab onApproverChange={loadPredefinedApprovers} />;
            default: return <div>Neznámy tab</div>;
        }
    };

    return (
        <div className="app-container">
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                marginBottom: '20px' 
            }}>
                <img 
                    src="/seas-logo-fullcolor.svg" 
                    alt="SEAS Logo" 
                    style={{ 
                        height: '60px',
                        marginRight: '20px'
                    }}
                />
                <LanguageSwitcher />
            </div>
            <h1 className="app-title">{t('title')}</h1>
            
            {uploadStatus && (
                <div className="status-message">
                    📢 <strong>{t('status')}:</strong> {uploadStatus}
                </div>
            )}

            {/* Tab Navigation */}
            <div className="tab-navigation">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => tab.enabled && setActiveTab(tab.id)}
                        disabled={!tab.enabled}
                        className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="tab-content">
                {renderTabContent()}
            </div>
        </div>
    );
};

export default UploadSignAppRefactored;