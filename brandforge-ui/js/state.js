/* ═══════════════════════════════════════════════════════════════
   BrandForge AI — App State Management
   Single Source of Truth for reactive UI updates
   ═══════════════════════════════════════════════════════════════ */

export const State = {
    // ─── App Context ───
    user: null,
    authToken: null,

    // ─── Pipeline State ───
    pipelineResults: [],
    isPipelineRunning: false,
    
    // ─── Selection State ───
    selectedInfluencers: [],
    gapAnalysisResult: null,
    generatedPosts: null,

    // ─── Listeners (Simplified Event System) ───
    listeners: [],

    subscribe(callback) {
        this.listeners.push(callback);
    },

    notify() {
        this.listeners.forEach(cb => cb(this));
    },

    update(newData) {
        Object.assign(this, newData);
        this.notify();
    },

    clear() {
        this.pipelineResults = [];
        this.selectedInfluencers = [];
        this.gapAnalysisResult = null;
        this.generatedPosts = null;
        this.notify();
    }
};
