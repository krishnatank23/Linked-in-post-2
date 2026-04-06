/* ═══════════════════════════════════════════════════════════════
   BrandForge AI — Authentication Service
   Handles User Registry, Login, and Session Persistent
   ═══════════════════════════════════════════════════════════════ */

import { Api } from './api.js';

export const Auth = {
    user: null,
    token: null,

    /**
     * Restore session from Storage (Local/Session per strategy)
     */
    init() {
        const token = sessionStorage.getItem('authToken');
        const user = sessionStorage.getItem('currentUser');
        
        if (token && user) {
            this.token = token;
            this.user = JSON.parse(user);
            return true;
        }
        return false;
    },

    async register(formData) {
        try {
            const data = await Api.postFormData('/register', formData);
            return data;
        } catch (error) {
            throw error;
        }
    },

    async login(email, password) {
        try {
            const data = await Api.post('/login', { email, password });
            
            this.token = data.access_token;
            this.user = {
                id: data.user_id,
                unique_id: data.unique_id,
                username: data.username
            };

            // Persistent Session
            sessionStorage.setItem('authToken', this.token);
            sessionStorage.setItem('currentUser', JSON.stringify(this.user));

            return this.user;
        } catch (error) {
            throw error;
        }
    },

    logout() {
        this.token = null;
        this.user = null;
        sessionStorage.clear();
        window.location.reload(); // Hard reset for clean state
    },

    isAuthenticated() {
        return !!this.token;
    }
};
