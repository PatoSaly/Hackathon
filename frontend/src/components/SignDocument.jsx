import React from 'react';
import { useTranslation } from 'react-i18next';
import useApi from '../hooks/useApi';

const SignDocument = ({ documentId, caseName, history, onSignSuccess }) => {
    const { t } = useTranslation();
    const api = useApi();

    const handleSignDocument = async () => {
        if (!documentId) return;

        try {
            const response = await api.post(`/sign/${documentId}`);
            onSignSuccess(response.message);
        } catch (error) {
            onSignSuccess(t('upload.upload_error', { error: api.error }));
        }
    };

    if (!documentId) {
        return (
            <div className="alert alert-warning">
                {t('sign.upload_first')}
            </div>
        );
    }

    const isAlreadySigned = history?.status && history.status !== 'Draft';

    return (
        <div>
            <h3 className="section-title">{t('sign.title')}</h3>
            <div className="form-container">
                <p style={{ fontSize: '16px', marginBottom: '15px' }}>
                    <strong>{t('sign.document_id')}</strong> {caseName}
                </p>
                <p style={{ marginBottom: '20px', color: '#666' }}>
                    {t('sign.description')}
                </p>
                <button 
                    onClick={handleSignDocument} 
                    disabled={isAlreadySigned || api.loading}
                    className="btn btn-primary"
                >
                    {api.loading ? t('sign.signing') : t('sign.sign_button')}
                </button>
                {isAlreadySigned && (
                    <div className="alert alert-warning" style={{ marginTop: '10px' }}>
                        {t('sign.already_signed')}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SignDocument;