/* ═══════════════════════════════════════════════════════════════
   BrandForge AI — Core API Service
   Centralized Fetch Wrapper with Interceptor-like behavior
   ═══════════════════════════════════════════════════════════════ */

export const API_BASE = window.location.origin + '/api';

export const Api = {
    async request(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        const token = sessionStorage.getItem('authToken');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers,
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.detail || `Request failed (${response.status})`);
            }

            return data;
        } catch (error) {
            console.error(`[API ERROR] ${endpoint}:`, error);
            throw error;
        }
    },

    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },

    post(endpoint, body) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    },

    /**
     * Specialized POST for Multipart/Form-Data (Resume Upload)
     */
    async postFormData(endpoint, formData) {
        const url = `${API_BASE}${endpoint}`;
        const headers = {}; // Fetch handles boundaries for FormData automatically
        
        const token = sessionStorage.getItem('authToken');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: formData,
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.detail || `Upload failed (${response.status})`);
            }

            return data;
        } catch (error) {
            console.error(`[UPLOAD ERROR] ${endpoint}:`, error);
            throw error;
        }
    }
};
