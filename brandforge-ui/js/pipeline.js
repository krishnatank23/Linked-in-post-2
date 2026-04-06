/* ═══════════════════════════════════════════════════════════════
   BrandForge AI — Pipeline & Agent Orchestrator
   Handles Execution, Status Polling, and Result Persistence
   ═══════════════════════════════════════════════════════════════ */

import { Api } from './api.js';
import { Auth } from './auth.js';
import { Ui } from './ui.js';
import { Renderers } from './ui/renderers.js';
import { State } from './state.js';

export const Pipeline = {
    statusPoller: null,
    results: [],

    async run() {
        const btn = document.getElementById('run-pipeline-btn');
        const orchestrator = document.getElementById('pipeline-orchestrator');
        const statusText = document.getElementById('pipeline-status-text');
        
        Ui.setLoading(btn, true);
        orchestrator.classList.remove('hidden');
        orchestrator.classList.add('fade-in');
        
        this.resetUI();
        this.startPolling();

        try {
            const data = await Api.post('/pipeline/run', { user_id: Auth.user.id });
            this.results = data.results;
            State.update({ pipelineResults: data.results });
            this.renderResults();
            Ui.toast('Analysis complete! Review your agent reports.', 'success');
        } catch (err) {
            Ui.toast(err.message, 'error');
            statusText.textContent = 'Pipeline failed. Check server logs.';
            statusText.style.color = 'var(--clr-error)';
        } finally {
            this.stopPolling();
            Ui.setLoading(btn, false);
        }
    },

    async loadExisting() {
        if (!Auth.user) return;
        try {
            const data = await Api.get(`/pipeline/results/${Auth.user.id}`);
            if (data.results && data.results.length > 0) {
                this.results = data.results;
                State.update({ pipelineResults: data.results });
                this.renderResults();
            }
        } catch (err) {
            // Silently fail if no results found
        }
    },

    startPolling() {
        this.stopPolling();
        const pollerEl = document.getElementById('pipeline-live-poller');
        const statusText = document.getElementById('pipeline-status-text');
        const progressBar = document.getElementById('pipeline-progress-bar');

        this.statusPoller = setInterval(async () => {
            try {
                const data = await Api.get(`/pipeline/live-status/${Auth.user.id}`);
                if (data.active && data.message) {
                    statusText.textContent = data.message;
                    pollerEl.textContent = `⏳ Live from Agentic Graph...`;
                    
                    const progressMap = {
                        'Resume Parser': 25,
                        'Brand Voice': 50,
                        'Influence Scout': 75,
                        'Gap Analysis': 90
                    };
                    for (const [key, val] of Object.entries(progressMap)) {
                        if (data.message.includes(key)) {
                            progressBar.style.width = `${val}%`;
                        }
                    }
                }
            } catch (ignore) {}
        }, 1500);
    },

    stopPolling() {
        if (this.statusPoller) {
            clearInterval(this.statusPoller);
            this.statusPoller = null;
        }
        const poller = document.getElementById('pipeline-live-poller');
        if (poller) poller.textContent = '';
        const progress = document.getElementById('pipeline-progress-bar');
        if (progress) progress.style.width = '100%';
    },

    resetUI() {
        document.getElementById('results-grid').innerHTML = '';
        document.getElementById('action-center').innerHTML = '';
        document.getElementById('pipeline-progress-bar').style.width = '5%';
    },

    renderResults() {
        const grid = document.getElementById('results-grid');
        grid.innerHTML = '';

        this.results.forEach((res, index) => {
            const card = this.createAgentCard(res, index);
            grid.appendChild(card);
        });

        this.updateActionCenter();
    },

    createAgentCard(res, index) {
        const card = document.createElement('div');
        card.className = `glass-card agent-card slide-up stagger-${(index % 5) + 1}`;
        
        const statusIcon = res.status === 'success' ? '✅' : '⚠️';
        const badgeClass = res.status === 'success' ? 'text-success' : 'text-error';

        // Use specialized renderer if available, otherwise fallback
        const renderer = Renderers[res.agent_name];
        const contentHtml = renderer ? renderer(res.output) : `<pre class="text-xs whitespace-pre-wrap">${JSON.stringify(res.output, null, 2)}</pre>`;

        card.innerHTML = `
            <div class="agent-card-header flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <div class="agent-icon glass p-3 text-2xl">🤖</div>
                    <div>
                        <h4 class="text-xl">${res.agent_name}</h4>
                        <p class="text-xs text-muted">${res.type || 'AI Agent'}</p>
                    </div>
                </div>
                <span class="${badgeClass} font-bold">${statusIcon}</span>
            </div>
            <div class="agent-card-body mt-4">
                <div class="text-sm text-dim overflow-auto max-h-80 custom-scrollbar p-3 glass">
                    ${contentHtml}
                </div>
            </div>
        `;
        return card;
    },

    updateActionCenter() {
        const center = document.getElementById('action-center');
        center.innerHTML = '';
        
        const hasInfluencers = this.results.some(r => r.agent_name === 'Influencer Scout');
        const hasGap = this.results.some(r => r.agent_name === 'Gap Analysis');

        if (hasInfluencers && !hasGap) {
            this.showInfluencerAction(center);
        } else if (hasGap) {
            this.showPostGenAction(center);
        }
    },

    showInfluencerAction(container) {
        container.classList.remove('hidden');
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary btn-lg shadow-xl animate-pulse';
        btn.innerHTML = `<span>Analyze Performance Gaps</span>`;
        btn.onclick = () => this.performGapAnalysis(btn);
        container.appendChild(btn);
    },

    async performGapAnalysis(btn) {
        Ui.setLoading(btn, true);
        try {
            // In the backend, gap analysis needs specific influencer IDs usually,
            // but for simplicity here we trigger the next stage.
            const data = await Api.post('/pipeline/gap-analysis', { 
                user_id: Auth.user.id,
                influencer_ids: [] // Strategy: analyze all scouts
            });
            Ui.toast('Gap Analysis Complete!', 'success');
            await this.loadExisting();
        } catch (err) {
            Ui.toast(err.message, 'error');
        } finally {
            Ui.setLoading(btn, false);
        }
    },

    showPostGenAction(container) {
        container.classList.remove('hidden');
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary btn-lg shadow-xl';
        btn.innerHTML = `<span>Generate LinkedIn Content</span>`;
        btn.onclick = () => this.generatePosts(btn);
        container.appendChild(btn);
    },

    async generatePosts(btn) {
        Ui.setLoading(btn, true);
        try {
            await Api.post('/pipeline/generate-posts', { user_id: Auth.user.id });
            Ui.toast('Content Generated!', 'success');
            await this.loadExisting();
        } catch (err) {
            Ui.toast(err.message, 'error');
        } finally {
            Ui.setLoading(btn, false);
        }
    }
};
