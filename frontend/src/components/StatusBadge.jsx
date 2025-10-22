import React from 'react';
import { useTranslation } from 'react-i18next';

const StatusBadge = ({ status, showIcon = true }) => {
    const { t } = useTranslation();
    
    const getStatusConfig = (status) => {
        const configs = {
            'Draft': { color: '#6c757d', icon: '📝' },
            'Waiting for Approval': { color: '#ffc107', icon: '⏳' },
            'Final Approved': { color: '#28a745', icon: '✅' },
            'Rejected': { color: '#dc3545', icon: '❌' },
            'Approved': { color: '#28a745', icon: '✅' },
            'Pending': { color: '#ffc107', icon: '⏳' }
        };
        return configs[status] || { color: '#007bff', icon: '❓' };
    };

    const config = getStatusConfig(status);

    return (
        <span 
            className="badge"
            style={{ backgroundColor: config.color }}
        >
            {showIcon && `${config.icon} `}{t(`statuses.${status}`)}
        </span>
    );
};

export default StatusBadge;