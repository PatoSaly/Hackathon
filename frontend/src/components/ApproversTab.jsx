import React from 'react';
import { useTranslation } from 'react-i18next';
import useApi from '../hooks/useApi';

const ApproversTab = ({ 
    documentId, 
    history, 
    approverEmails, 
    setApproverEmails,
    selectedApprovers,
    setSelectedApprovers,
    predefinedApprovers,
    showApproverDropdown,
    setShowApproverDropdown,
    approvalLinks,
    onApproversAdded,
    onApprovalAction
}) => {
    const { t } = useTranslation();
    const api = useApi();

    // Kontrola či je dokument v procese schvaľovania alebo už dokončený
    const isApprovalInProgress = history && ['Waiting for Approval', 'WaitingForApproval'].includes(history.status);
    const isApprovalCompleted = history && ['Final Approved', 'Rejected'].includes(history.status);
    const isSigned = history && history.status === 'Signed';
    const hasApprovers = history && history.approvers && history.approvers.length > 0;
    
    // Rozlíšenie medzi prvým pridaním schvaľovateľov vs úpravou existujúcich
    // Môžeme pridať schvaľovateľov len ak je dokument podpísaný a ešte nemá schvaľovateľov
    const canAddApprovers = isSigned && !hasApprovers && approvalLinks.length === 0;
    const canModifyApprovers = isSigned && !isApprovalInProgress && !isApprovalCompleted && approvalLinks.length === 0;

    // Funkcie pre správu schvaľovateľov
    const addApproverRow = () => {
        setSelectedApprovers([...selectedApprovers, null]);
        setShowApproverDropdown(selectedApprovers.length);
    };

    const selectApprover = (index, approver) => {
        const newApprovers = [...selectedApprovers];
        newApprovers[index] = approver;
        setSelectedApprovers(newApprovers);
        setShowApproverDropdown(null);
    };

    const removeApprover = (index) => {
        const newApprovers = selectedApprovers.filter((_, i) => i !== index);
        setSelectedApprovers(newApprovers);
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

        try {
            const response = await api.post(`/approvers/${documentId}`, { approverEmails: emails });
            onApproversAdded(response);
        } catch (error) {
            console.error('Chyba pri pridávaní schvaľovateľov:', error);
        }
    };

    if (!documentId) {
        return (
            <div>
                <h3 className="section-title">{t('approvers.title')}</h3>
                <div className="alert alert-warning">
                    {t('approvers.upload_first')}
                </div>
            </div>
        );
    }

    return (
        <div>
            <h3 className="section-title">{t('approvers.title')}</h3>
            <div className="form-container">
                
                {/* Varovanie počas schvaľovania - len ak už má schvaľovateľov */}
                {(isApprovalInProgress || isApprovalCompleted) && hasApprovers && (
                    <div className="alert alert-warning" style={{
                        backgroundColor: isApprovalCompleted ? '#f8d7da' : '#fff3cd',
                        border: isApprovalCompleted ? '1px solid #f5c6cb' : '1px solid #ffeaa7',
                        padding: '15px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                        color: isApprovalCompleted ? '#721c24' : '#856404'
                    }}>
                        <strong>
                            {isApprovalCompleted ? '� Dokument uzamknutý' : '�🚫 Schvaľovanie v procese'}
                        </strong>
                        <br />
                        {history && history.status && (
                            <>Dokument <strong>{history.case_name}</strong> je v stave: <strong>{history.status}</strong><br /></>
                        )}
                        <small>
                            {isApprovalCompleted 
                                ? 'Dokument je finálne spracovaný a zoznam schvaľovateľov je natrvalo uzamknutý.'
                                : 'Zoznam schvaľovateľov už nemožno meniť po začatí procesu schvaľovania.'
                            }
                        </small>
                    </div>
                )}
                
                {/* Informačné správy */}
                {isApprovalInProgress && hasApprovers && (
                    <div className="alert alert-info" style={{
                        backgroundColor: '#d1ecf1',
                        border: '1px solid #bee5eb',
                        padding: '15px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                        color: '#0c5460'
                    }}>
                        <strong>ℹ️ Informácia:</strong> Dokument už má priradených {history.approvers.length} schvaľovateľov a proces schvaľovania bol spustený.
                        <br />
                        <small>Ak chcete zmeniť zoznam schvaľovateľov, musíte najprv zrušiť dokument a začať znova.</small>
                    </div>
                )}
                
                {!canAddApprovers && !isApprovalInProgress && !isApprovalCompleted && (
                    <div className="alert alert-info" style={{
                        backgroundColor: '#d1ecf1',
                        border: '1px solid #bee5eb',
                        padding: '15px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                        color: '#0c5460'
                    }}>
                        <strong>ℹ️ Informácia:</strong> Dokument nie je pripravený na pridanie schvaľovateľov.
                        <br />
                        <small>
                            Aktuálny stav dokumentu: <strong>{history?.status || 'Neznámy'}</strong>
                            <br />
                            {history?.status === 'Draft' && 'Najprv musíte dokument podpísať.'}
                            {history?.status === 'Signed' && hasApprovers && 'Dokument už má priradených schvaľovateľov.'}
                        </small>
                    </div>
                )}
                
                {/* Nový dynamický systém schvaľovateľov */}
                <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ marginBottom: '15px' }}>{t('approvers.dynamic_title')}</h4>
                    
                    {selectedApprovers.map((approver, index) => (
                        <div key={index} className="card" style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '10px', 
                            marginBottom: '10px',
                            backgroundColor: approver ? '#d4edda' : '#f8f9fa'
                        }}>
                            {approver ? (
                                <>
                                    <span style={{ flex: 1 }}>
                                        <strong>{approver.name}</strong> - {approver.email}
                                        <br />
                                        <small style={{ color: '#666' }}>{approver.department}</small>
                                    </span>
                                    <button 
                                        onClick={() => removeApprover(index)}
                                        disabled={!canModifyApprovers}
                                        className="btn btn-danger btn-small"
                                        style={{
                                            opacity: !canModifyApprovers ? 0.5 : 1,
                                            cursor: !canModifyApprovers ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        ❌
                                    </button>
                                </>
                            ) : (
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <button 
                                        onClick={() => setShowApproverDropdown(showApproverDropdown === index ? null : index)}
                                        disabled={!canAddApprovers}
                                        className="btn btn-primary"
                                        style={{
                                            opacity: !canAddApprovers ? 0.5 : 1,
                                            cursor: !canAddApprovers ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        ➕ {t('approvers.add_approver')}
                                    </button>
                                    
                                    {showApproverDropdown === index && canAddApprovers && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            backgroundColor: 'white',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                            zIndex: 1000,
                                            maxHeight: '200px',
                                            overflowY: 'auto'
                                        }}>
                                            {predefinedApprovers.map((predefApprover) => (
                                                <div 
                                                    key={predefApprover.id}
                                                    onClick={() => selectApprover(index, predefApprover)}
                                                    style={{
                                                        padding: '10px',
                                                        borderBottom: '1px solid #eee',
                                                        cursor: 'pointer'
                                                    }}
                                                    onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                                                    onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                                                >
                                                    <div><strong>{predefApprover.name}</strong></div>
                                                    <div style={{ fontSize: '12px', color: '#666' }}>
                                                        {predefApprover.email} • {predefApprover.department}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                    
                    <button 
                        onClick={addApproverRow}
                        disabled={!canAddApprovers}
                        className="btn btn-success"
                        style={{
                            opacity: !canAddApprovers ? 0.5 : 1,
                            cursor: !canAddApprovers ? 'not-allowed' : 'pointer'
                        }}
                    >
                        ➕ {t('approvers.add_row')}
                    </button>
                </div>
                
                {/* Alternatívny systém - textarea */}
                <div style={{ marginBottom: '15px' }}>
                    <h4 style={{ marginBottom: '10px' }}>{t('approvers.manual_title')}</h4>
                    <label className="form-label">{t('approvers.email_label')}</label>
                    <textarea 
                        placeholder={t('approvers.email_placeholder')}
                        value={approverEmails} 
                        onChange={e => setApproverEmails(e.target.value)} 
                        disabled={!canAddApprovers}
                        rows="3"
                        className="form-textarea"
                        style={{
                            opacity: !canAddApprovers ? 0.5 : 1,
                            cursor: !canAddApprovers ? 'not-allowed' : 'text'
                        }}
                    />
                </div>
                <button 
                    onClick={handleAddApprovers} 
                    disabled={!canAddApprovers || api.loading}
                    className="btn btn-warning"
                    style={{
                        opacity: !canAddApprovers ? 0.5 : 1,
                        cursor: !canAddApprovers ? 'not-allowed' : 'pointer'
                    }}
                >
                    {api.loading ? t('approvers.adding') : t('approvers.add_button')}
                </button>

                {/* Simulácia schválenia cez linky */}
                {approvalLinks.length > 0 && (
                    <div className="alert alert-info" style={{ marginTop: '20px' }}>
                        <h4>{t('approvers.simulation_title')}</h4>
                        {approvalLinks.map((item, index) => (
                            <div key={index} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <strong>{item.email}:</strong> 
                                <button 
                                    onClick={() => onApprovalAction(item.link, 'Approve')} 
                                    className="btn btn-success btn-small"
                                >
                                    {t('approvers.approve_button')}
                                </button>
                                <button 
                                    onClick={() => onApprovalAction(item.link, 'Disapprove')} 
                                    className="btn btn-danger btn-small"
                                >
                                    {t('approvers.disapprove_button')}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                
                {/* Informácia po dokončení simulácie */}
                {history && history.approvers && history.approvers.length > 0 && approvalLinks.length === 0 && (
                    <div className="alert alert-success" style={{ marginTop: '20px' }}>
                        <p style={{ margin: 0 }}>{t('approvers.simulation_completed')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ApproversTab;