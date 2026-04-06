/* ═══════════════════════════════════════════════════════════════
   BrandForge AI — UI Utilities
   Focus: Toasts, Loading States, and DOM Helpers
   ═══════════════════════════════════════════════════════════════ */

export const Ui = {
    /**
     * Show a premium toast notification
     */
    toast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        
        toast.className = `glass p-4 rounded-lg slide-in-right flex items-center gap-3 border shadow-lg`;
        toast.style.minWidth = '280px';
        
        const colors = {
            success: 'var(--clr-success)',
            error: 'var(--clr-error)',
            warning: 'var(--clr-warning)',
            info: 'var(--clr-primary)'
        };

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: '💡'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type]}</span>
            <span class="toast-msg font-medium text-sm">${message}</span>
        `;
        toast.style.borderColor = colors[type];
        
        container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    },

    /**
     * Set button loading state
     */
    setLoading(btn, isLoading) {
        if (!btn) return;
        const text = btn.querySelector('span');
        
        if (isLoading) {
            btn.dataset.originalText = text ? text.innerHTML : btn.innerHTML;
            btn.disabled = true;
            if (text) text.innerHTML = `<span class="spinner inline-block anime-spin">⌛</span> Loading...`;
            else btn.innerHTML = `Loading...`;
            btn.style.opacity = '0.7';
        } else {
            btn.disabled = false;
            if (text) text.innerHTML = btn.dataset.originalText;
            else btn.innerHTML = btn.dataset.originalText;
            btn.style.opacity = '1';
        }
    },

    /**
     * Helper to clear an element and add a fade-in class
     */
    clearAndPrep(el) {
        if (!el) return;
        el.innerHTML = '';
        el.classList.add('fade-in');
    }
};
