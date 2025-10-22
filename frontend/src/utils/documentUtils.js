// Utils pre UploadSignApp
export const getStatusColor = (status) => {
    const colors = {
        'Draft': '#6c757d',
        'Waiting for Approval': '#ffc107',
        'Final Approved': '#28a745',
        'Rejected': '#dc3545'
    };
    return colors[status] || '#007bff';
};

export const getApproverCardColor = (status) => {
    const colors = {
        'Approved': '#d4edda',
        'Rejected': '#f8d7da',
        'Pending': '#fff3cd'
    };
    return colors[status] || '#ffffff';
};

export const getStatusIcon = (status) => {
    const icons = {
        'Approved': '✅',
        'Rejected': '❌',
        'Pending': '⏳'
    };
    return icons[status] || '❓';
};

export const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
};