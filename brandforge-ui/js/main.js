/* ═══════════════════════════════════════════════════════════════
   BrandForge AI — Main Application Orchestrator
   Handles View Switching, Event Delegation, and Logic Registry
   ═══════════════════════════════════════════════════════════════ */

import { AmbientBackground } from './canvas-bg.js';
import { Auth } from './auth.js';
import { Pipeline } from './pipeline.js';
import { Ui } from './ui.js';

class App {
    constructor() {
        this.init();
    }

    async init() {
        // 🔮 Start Ambient Background
        new AmbientBackground('ambient-canvas');

        // 🔐 Initialize Auth & Session
        const isAuthed = Auth.init();
        if (isAuthed) {
            this.showStudio();
        } else {
            this.showAuth();
        }

        // 📡 Register Event Listeners
        this.setupEventListeners();
    }

    showAuth() {
        document.getElementById('auth-view').classList.add('active');
        document.getElementById('studio-view').classList.remove('active', 'hidden');
        document.getElementById('studio-view').classList.add('hidden');
    }

    showStudio() {
        document.getElementById('auth-view').classList.remove('active');
        document.getElementById('auth-view').classList.add('hidden');
        
        const studio = document.getElementById('studio-view');
        studio.classList.remove('hidden');
        setTimeout(() => studio.classList.add('active'), 100);

        // Update UI context
        document.getElementById('user-display').textContent = `Hello, ${Auth.user.username}`;
        
        // Load existing state if any
        Pipeline.loadExisting();
    }

    setupEventListeners() {
        // Auth Toggle (Login <-> Register)
        document.getElementById('to-register').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('login-form').classList.add('hidden');
            document.getElementById('register-form').classList.remove('hidden');
        });

        document.getElementById('to-login').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('register-form').classList.add('hidden');
            document.getElementById('login-form').classList.remove('hidden');
        });

        // Login Submit
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            Ui.setLoading(btn, true);

            try {
                const email = document.getElementById('login-email').value;
                const pass = document.getElementById('login-password').value;
                await Auth.login(email, pass);
                Ui.toast('Welcome back to BrandForge!', 'success');
                this.showStudio();
            } catch (err) {
                Ui.toast(err.message, 'error');
            } finally {
                Ui.setLoading(btn, false);
            }
        });

        // Register Submit
        document.getElementById('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            Ui.setLoading(btn, true);

            try {
                const formData = new FormData();
                formData.append('username', document.getElementById('reg-username').value);
                formData.append('email', document.getElementById('reg-email').value);
                formData.append('password', document.getElementById('reg-password').value);
                
                const fileInput = document.getElementById('reg-resume');
                if (fileInput.files.length > 0) {
                    formData.append('resume', fileInput.files[0]);
                } else {
                    throw new Error('Please upload your resume to begin analysis.');
                }

                await Auth.register(formData);
                Ui.toast('Account created! Sign in to begin.', 'success');
                document.getElementById('to-login').click();
            } catch (err) {
                Ui.toast(err.message, 'error');
            } finally {
                Ui.setLoading(btn, false);
            }
        });

        // Pipeline Trigger
        document.getElementById('run-pipeline-btn').addEventListener('click', () => {
            Pipeline.run();
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => Auth.logout());

        // File Dropzone logic
        const dropzone = document.getElementById('resume-dropzone');
        const fileInput = document.getElementById('reg-resume');

        dropzone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                dropzone.querySelector('.dropzone-text').textContent = `📄 ${fileInput.files[0].name}`;
                dropzone.classList.add('active');
            }
        });
    }
}

// 🚀 Boot Application
window.addEventListener('DOMContentLoaded', () => {
    window.App = new App();
});
