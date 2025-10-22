import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useApi from '../hooks/useApi';

const UploadForm = ({ caseName, onUploadSuccess, documentId, onNewDocument, history, onReplaceDocument }) => {
    const { t } = useTranslation();
    const api = useApi();
    const [file, setFile] = useState(null);
    const [comment, setComment] = useState('');
    const [uploadStatus, setUploadStatus] = useState('');

    // Kontrola či sa dokument môže nahradiť - len v stave Draft
    const canReplaceDocument = documentId && history && history.status === 'Draft';
    
    // Pre debug - vždy ukážeme replacement formulár ak existuje documentId
    const shouldShowReplacement = documentId;
    
    console.log('UploadForm state:', { 
        documentId, 
        history: history ? history.status : 'null', 
        canReplaceDocument,
        shouldShowReplacement 
    });

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
            const response = await api.post('/upload', formData);
            setUploadStatus(t('upload.upload_success', { caseId: response.caseId }));
            onUploadSuccess(response);
        } catch (error) {
            setUploadStatus(t('upload.upload_error', { error: api.error }));
        }
    };

    const handleReplaceDocument = async (e) => {
        e.preventDefault();
        
        console.log('handleReplaceDocument called with:', { documentId, history });
        
        const caseName = history?.case_name || `dokument ${documentId}`;
        
        const confirmed = window.confirm(
            `Naozaj chcete zmeniť súbor pre prípad ${caseName}? Súčasný súbor bude nahradený novým súborom.`
        );
        
        if (!confirmed) return;

        setUploadStatus('Mením súbor...');

        if (!file) {
            setUploadStatus('Vyberte súbor na nahratie.');
            return;
        }

        const formData = new FormData();
        formData.append('document', file);
        formData.append('comment', comment);
        formData.append('replace', 'true');
        formData.append('documentId', documentId);
        
        console.log('Sending replacement request with params:', {
            documentId,
            replace: 'true',
            file: file ? file.name : 'no file',
            comment
        });

        try {
            const response = await api.post('/upload', formData);
            const caseId = response.caseId || history?.case_name || `prípad ${documentId}`;
            console.log('Replacement response:', response);
            setUploadStatus(`Súbor bol úspešne zmenený pre prípad: ${caseId}`);
            if (onReplaceDocument) {
                onReplaceDocument(response);
            }
        } catch (error) {
            console.error('Replacement error:', error);
            console.error('Full error details:', error.response?.data);
            const errorMsg = error.response?.data?.error || api.error || error.message;
            const errorDetails = error.response?.data?.details || '';
            setUploadStatus(`Chyba pri zmene súboru: ${errorMsg}\n${errorDetails}`);
        }
    };

    // Kontrola či je case vyriešený (schválený alebo zamietnutý)
    const isCaseResolved = history && (history.status === 'Final Approved' || history.status === 'Rejected');

    if (documentId && !shouldShowReplacement) {
        return (
            <div className="alert alert-success">
                ✅ {t('upload.document_uploaded', { id: documentId })}
                <button 
                    onClick={onNewDocument} 
                    className="btn btn-primary btn-small"
                    style={{ marginLeft: '10px' }}
                >
                    {t('upload.new_document')}
                </button>
            </div>
        );
    }

    if (documentId && shouldShowReplacement) {
        return (
            <div>
                <div className="alert alert-info">
                    📄 Dokument <strong>{history?.case_name || `ID: ${documentId}`}</strong> je v stave <strong>{history?.status || 'neznámy'}</strong>
                    <br />
                    <small>
                        {history?.status === 'Draft' 
                            ? 'Môžete zmeniť súbor. Status zostane Draft.' 
                            : 'Môžete zmeniť súbor. Po zmene bude potrebné dokument znovu podpísať.'}
                    </small>
                    {isCaseResolved && (
                        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '4px' }}>
                            <strong>✅ {t('upload.case_resolved')}</strong> {t('upload.start_new_case')}
                        </div>
                    )}
                </div>

                {/* Tlačidlo pre nový prípad ak je aktuálny vyriešený */}
                {isCaseResolved && (
                    <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                        <button 
                            onClick={onNewDocument} 
                            className="btn btn-success"
                            style={{ fontSize: '16px', padding: '12px 24px' }}
                        >
                            🆕 {t('upload.new_case')}
                        </button>
                    </div>
                )}
                
                {uploadStatus && (
                    <div className="alert alert-info">
                        {uploadStatus}
                    </div>
                )}
                
                <form onSubmit={handleReplaceDocument} className="form-container">
                    <h3 className="section-title">🔄 Zmeniť súbor</h3>
                    
                    <div className="form-group">
                        <label className="form-label">Nový súbor</label>
                        <input 
                            type="file" 
                            accept="application/pdf" 
                            onChange={e => setFile(e.target.files[0])} 
                            required 
                            style={{ display: 'none' }}
                            id="file-input-replace"
                        />
                        <div className="file-upload-container">
                            <button 
                                type="button"
                                onClick={() => document.getElementById('file-input-replace').click()}
                                className="file-upload-button"
                            >
                                📁 Zmeniť súbor
                            </button>
                            <span className={`file-upload-status ${file ? 'selected' : 'empty'}`}>
                                {file ? `✅ ${file.name}` : 'Žiadny súbor nevybraný'}
                            </span>
                        </div>
                    </div>
                    
                    <div className="form-group">
                        <label className="form-label">Komentár k zmene</label>
                        <textarea 
                            placeholder="Dôvod zmeny súboru..."
                            value={comment} 
                            onChange={e => setComment(e.target.value)} 
                            rows="3"
                            className="form-textarea"
                        />
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                            type="submit" 
                            className="btn btn-warning"
                            disabled={api.loading}
                        >
                            {api.loading ? 'Mením súbor...' : '🔄 Zmeniť súbor'}
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    if (!documentId) {
        return (
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 className="section-title">{t('upload.title')}</h3>
                </div>
                
                {/* Informácia o možnosti nahrania nového dokumentu */}
                <div className="alert alert-success" style={{ marginBottom: '20px' }}>
                    <h4>🆕 {t('upload.new_case')}</h4>
                    <p>{t('upload.new_case_info')}</p>
                </div>
                
                {uploadStatus && (
                    <div className="alert alert-info">
                        {uploadStatus}
                    </div>
                )}
                
                <form onSubmit={handleFileUpload} className="form-container">
                    <div className="form-group">
                        <label className="form-label">{t('upload.file_label')}</label>
                        <input 
                            type="file" 
                            accept="application/pdf" 
                            onChange={e => setFile(e.target.files[0])} 
                            required 
                            style={{ display: 'none' }}
                            id="file-input"
                        />
                        <div className="file-upload-container">
                            <button 
                                type="button"
                                onClick={() => document.getElementById('file-input').click()}
                                className="file-upload-button"
                            >
                                📁 {t('upload.choose_file')}
                            </button>
                            <span className={`file-upload-status ${file ? 'selected' : 'empty'}`}>
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
                            className="form-input"
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
                    
                    <button 
                        type="submit" 
                        className="btn btn-success"
                        disabled={api.loading}
                    >
                        {api.loading ? t('upload.uploading') : t('upload.upload_button')}
                    </button>
                </form>
            </div>
        );
    }

    // Ak existuje documentId, vždy vrátime null aby sa nič nezobrazilo
    // (replacement logic je vyššie)
    return null;
};

export default UploadForm;