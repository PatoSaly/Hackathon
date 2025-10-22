import { useState } from 'react';
import axios from 'axios';

// Use environment variable for API URL, default to localhost for development
const API_BASE_URL = process.env.REACT_APP_API_URL 
    ? `${process.env.REACT_APP_API_URL}/api`
    : 'http://localhost:3001/api';

export const useApi = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const request = async (method, url, data = null) => {
        setLoading(true);
        setError(null);
        try {
            const config = {
                method,
                url: `${API_BASE_URL}${url}`,
                ...(data && { data })
            };
            
            if (data instanceof FormData) {
                config.headers = { 'Content-Type': 'multipart/form-data' };
            }
            
            const response = await axios(config);
            return response.data;
        } catch (err) {
            setError(err.response?.data?.error || 'Server error');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        error,
        get: (url) => request('GET', url),
        post: (url, data) => request('POST', url, data),
        put: (url, data) => request('PUT', url, data),
        delete: (url) => request('DELETE', url)
    };
};

export default useApi;