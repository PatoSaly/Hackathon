const express = require('express');
const path = require('path');

// Import existing server
const app = require('./server');

// Serve static files from 'public' directory (where we'll put the frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html for all non-API routes (SPA support)
app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
        return;
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Export for Azure
module.exports = app;
