import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useApi from '../hooks/useApi';

const AdminApproversTab = ({ onApproverChange }) => {
    const { t } = useTranslation();
    const api = useApi();
    const [approvers, setApprovers] = useState([]);
    const [editingApprover, setEditingApprover] = useState(null);
    const [formData, setFormData] = useState({ name: '', email: '', department: '', active: true });
    const [showAddForm, setShowAddForm] = useState(false);

    // Načítanie schvaľovateľov
    const loadApprovers = useCallback(async () => {
        try {
            const response = await api.get('/admin/approvers');
            setApprovers(response);
        } catch (error) {
            window.alert('Chyba pri načítaní schvaľovateľov');
        }
    }, [api]);

    // Načítaj pri prvom renderovaní
    useEffect(() => {
        loadApprovers();
    }, [loadApprovers]);

    // Pridanie nového schvaľovateľa
    const handleAdd = async (e) => {
        e.preventDefault();
        
        try {
            await api.post('/admin/approvers', formData);
            setFormData({ name: '', email: '', department: '', active: true });
            setShowAddForm(false);
            loadApprovers();
            // Obnovenie zoznamu v hlavnom komponente
            if (onApproverChange) onApproverChange();
            window.alert('Schvaľovateľ bol úspešne pridaný');
        } catch (error) {
            window.alert(api.error || 'Chyba pri pridávaní schvaľovateľa');
        }
    };

    // Úprava schvaľovateľa
    const handleEdit = async (e) => {
        e.preventDefault();
        
        try {
            await api.put(`/admin/approvers/${editingApprover.id}`, formData);
            setEditingApprover(null);
            setFormData({ name: '', email: '', department: '', active: true });
            loadApprovers();
            // Obnovenie zoznamu v hlavnom komponente
            if (onApproverChange) onApproverChange();
            window.alert('Schvaľovateľ bol úspešne upravený');
        } catch (error) {
            window.alert(api.error || 'Chyba pri úprave schvaľovateľa');
        }
    };

    // Zmazanie/deaktivácia schvaľovateľa
    const handleDelete = async (id, permanent = false) => {
        const confirmed = window.confirm(permanent ? 
            'Naozaj chcete trvale zmazať tohto schvaľovateľa?' : 
            'Naozaj chcete deaktivovať tohto schvaľovateľa?'
        );
        
        if (confirmed) {
            try {
                await api.delete(`/admin/approvers/${id}?permanent=${permanent}`);
                loadApprovers();
                // Obnovenie zoznamu v hlavnom komponente
                if (onApproverChange) onApproverChange();
                window.alert(permanent ? 'Schvaľovateľ bol trvale zmazaný' : 'Schvaľovateľ bol deaktivovaný');
            } catch (error) {
                window.alert(api.error || 'Chyba pri mazaní schvaľovateľa');
            }
        }
    };

    // Začiatok úpravy
    const startEdit = (approver) => {
        setEditingApprover(approver);
        setFormData({ 
            name: approver.name, 
            email: approver.email, 
            department: approver.department, 
            active: approver.active === 1 
        });
        setShowAddForm(false);
    };

    // Aktivácia schvaľovateľa
    const handleActivate = async (id) => {
        try {
            const approver = approvers.find(a => a.id === id);
            await api.put(`/admin/approvers/${id}`, { 
                ...approver, 
                active: 1 
            });
            loadApprovers();
            // Obnovenie zoznamu v hlavnom komponente
            if (onApproverChange) onApproverChange();
            window.alert('Schvaľovateľ bol aktivovaný');
        } catch (error) {
            window.alert('Chyba pri aktivácii schvaľovateľa');
        }
    };

    return (
        <div>
            <h3 style={{ color: '#dc3545', marginBottom: '20px' }}>{t('admin.title')}</h3>
            
            {/* Tlačidlo pre pridanie nového */}
            <div style={{ marginBottom: '20px' }}>
                <button 
                    onClick={() => {
                        setShowAddForm(true);
                        setEditingApprover(null);
                        setFormData({ name: '', email: '', department: '', active: true });
                    }}
                    className="btn btn-success"
                >
                    ➕ {t('admin.add_new')}
                </button>
            </div>

            {/* Formulár pre pridanie/úpravu */}
            {(showAddForm || editingApprover) && (
                <div className="form-container" style={{ marginBottom: '20px' }}>
                    <h4>{editingApprover ? t('admin.edit_title') : t('admin.add_title')}</h4>
                    <form onSubmit={editingApprover ? handleEdit : handleAdd}>
                        <div className="grid-2" style={{ marginBottom: '15px' }}>
                            <div className="form-group">
                                <label className="form-label">{t('admin.name')}:</label>
                                <input 
                                    type="text" 
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    required
                                    className="form-input"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('admin.email')}:</label>
                                <input 
                                    type="email" 
                                    value={formData.email}
                                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                                    required
                                    className="form-input"
                                />
                            </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: '15px' }}>
                            <label className="form-label">{t('admin.department')}:</label>
                            <input 
                                type="text" 
                                value={formData.department}
                                onChange={(e) => setFormData({...formData, department: e.target.value})}
                                required
                                className="form-input"
                            />
                        </div>
                        {editingApprover && (
                            <div className="form-group" style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'flex', alignItems: 'center' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={formData.active}
                                        onChange={(e) => setFormData({...formData, active: e.target.checked})}
                                        style={{ marginRight: '8px' }}
                                    />
                                    {t('admin.active')}
                                </label>
                            </div>
                        )}
                        <div>
                            <button 
                                type="submit"
                                className="btn btn-primary btn-margin-right"
                                disabled={api.loading}
                            >
                                {api.loading ? 'Spracovávam...' : (editingApprover ? t('admin.update') : t('admin.add'))}
                            </button>
                            <button 
                                type="button"
                                onClick={() => {
                                    setShowAddForm(false);
                                    setEditingApprover(null);
                                    setFormData({ name: '', email: '', department: '', active: true });
                                }}
                                className="btn btn-secondary"
                            >
                                {t('admin.cancel')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Zoznam schvaľovateľov */}
            {api.loading ? (
                <div>{t('admin.loading')}</div>
            ) : (
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>{t('admin.name')}</th>
                                <th>{t('admin.email')}</th>
                                <th>{t('admin.department')}</th>
                                <th style={{ textAlign: 'center' }}>{t('admin.status')}</th>
                                <th style={{ textAlign: 'center' }}>{t('admin.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {approvers.map(approver => (
                                <tr key={approver.id} style={{ 
                                    backgroundColor: approver.active ? 'white' : '#f8f9fa',
                                    opacity: approver.active ? 1 : 0.7
                                }}>
                                    <td>{approver.name}</td>
                                    <td>{approver.email}</td>
                                    <td>{approver.department}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span style={{ 
                                            padding: '4px 8px', 
                                            borderRadius: '12px', 
                                            fontSize: '12px',
                                            backgroundColor: approver.active ? '#d4edda' : '#f8d7da',
                                            color: approver.active ? '#155724' : '#721c24'
                                        }}>
                                            {approver.active ? t('admin.active_status') : t('admin.inactive_status')}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button 
                                            onClick={() => startEdit(approver)}
                                            className="btn btn-warning btn-small btn-margin-right"
                                        >
                                            ✏️ {t('admin.edit')}
                                        </button>
                                        {approver.active ? (
                                            <button 
                                                onClick={() => handleDelete(approver.id, false)}
                                                className="btn btn-danger btn-small btn-margin-right"
                                            >
                                                🚫 {t('admin.deactivate')}
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleActivate(approver.id)}
                                                className="btn btn-success btn-small btn-margin-right"
                                            >
                                                ✅ {t('admin.activate')}
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => handleDelete(approver.id, true)}
                                            className="btn btn-secondary btn-small"
                                        >
                                            🗑️ {t('admin.delete')}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AdminApproversTab;