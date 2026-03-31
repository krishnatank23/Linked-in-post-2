/* ═══════════════════════════════════════════════════════════════
   BrandForge AI — Frontend Application Logic
   Handles auth, pipeline execution, and agent output rendering
   ═══════════════════════════════════════════════════════════════ */

const API_BASE = window.location.origin + '/api';

// ─── State ───
let currentUser = null;
let authToken = null;
let pipelineStatusPoller = null;
let selectedInfluencers = [];

// ─── DOM References ───
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const authSection = $('#auth-section');
const dashboardSection = $('#dashboard-section');
const registerForm = $('#register-form');
const loginForm = $('#login-form');
const registerFormEl = $('#registerForm');
const loginFormEl = $('#loginForm');
const fileUploadZone = $('#file-upload-zone');
const resumeInput = $('#reg-resume');
const selectedFileName = $('#selected-file-name');
const pipelineProgress = $('#pipeline-progress');
const agentOutputs = $('#agent-outputs');

// ═══════════════════════════════════════════════════════════════
// NAVIGATION & AUTH TOGGLE
// ═══════════════════════════════════════════════════════════════

$('#show-login').addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.hidden = true;
    loginForm.hidden = false;
});

$('#show-register').addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.hidden = true;
    registerForm.hidden = false;
});

function showSection(section) {
    authSection.hidden = true;
    authSection.classList.remove('active');
    dashboardSection.hidden = true;

    section.hidden = false;
    section.classList.add('active');
}

function showDashboard() {
    showSection(dashboardSection);
    $('#user-greeting').textContent = `Hello, ${currentUser.username}`;
}

// ═══════════════════════════════════════════════════════════════
// FILE UPLOAD HANDLING
// ═══════════════════════════════════════════════════════════════

fileUploadZone.addEventListener('click', () => resumeInput.click());

fileUploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileUploadZone.classList.add('dragover');
});

fileUploadZone.addEventListener('dragleave', () => {
    fileUploadZone.classList.remove('dragover');
});

fileUploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    fileUploadZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
        resumeInput.files = e.dataTransfer.files;
        showSelectedFile(file.name);
    }
});

resumeInput.addEventListener('change', () => {
    if (resumeInput.files.length > 0) {
        showSelectedFile(resumeInput.files[0].name);
    }
});

function showSelectedFile(name) {
    selectedFileName.textContent = `📄 ${name}`;
    fileUploadZone.classList.add('has-file');
}

// ═══════════════════════════════════════════════════════════════
// REGISTRATION
// ═══════════════════════════════════════════════════════════════

registerFormEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#btn-register');
    setButtonLoading(btn, true);

    try {
        const formData = new FormData();
        formData.append('email', $('#reg-email').value);
        formData.append('username', $('#reg-username').value);
        formData.append('password', $('#reg-password').value);
        formData.append('resume', resumeInput.files[0]);

        const res = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            body: formData,
        });

        let data;
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await res.json();
        } else {
            const text = await res.text();
            throw new Error(`Server error (${res.status}): ${text.substring(0, 100)}...`);
        }

        if (!res.ok) {
            throw new Error(data.detail || 'Registration failed');
        }

        showToast('Account created successfully! Please login.', 'success');

        // Switch to login form
        registerForm.hidden = true;
        loginForm.hidden = false;
        $('#login-email').value = $('#reg-email').value;

    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        setButtonLoading(btn, false);
    }
});

// ═══════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════

loginFormEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#btn-login');
    setButtonLoading(btn, true);

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: $('#login-email').value,
                password: $('#login-password').value,
            }),
        });

        let data;
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await res.json();
        } else {
            const text = await res.text();
            throw new Error(`Server error (${res.status}): ${text.substring(0, 100)}...`);
        }

        if (!res.ok) {
            throw new Error(data.detail || 'Login failed');
        }

        authToken = data.access_token;
        currentUser = {
            id: data.user_id,
            unique_id: data.unique_id,
            username: data.username,
        };

        // Save to sessionStorage
        sessionStorage.setItem('authToken', authToken);
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));

        showToast(`Welcome back, ${currentUser.username}!`, 'success');
        showDashboard();

        // Reset all previous UI state before loading this user's data.
        clearAnalysisUI();

        // Load existing results if any
        loadExistingResults();

    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        setButtonLoading(btn, false);
    }
});

// ═══════════════════════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════════════════════

$('#btn-logout').addEventListener('click', () => {
    currentUser = null;
    authToken = null;
    selectedInfluencers = [];
    sessionStorage.clear();
    clearAnalysisUI();
    showSection(authSection);
    showToast('Logged out successfully', 'info');
});

// ═══════════════════════════════════════════════════════════════
// PIPELINE EXECUTION
// ═══════════════════════════════════════════════════════════════

$('#btn-run-pipeline').addEventListener('click', runPipeline);

async function runPipeline() {
    const btn = $('#btn-run-pipeline');
    setButtonLoading(btn, true);
    btn.disabled = true;

    // Show progress bar
    pipelineProgress.hidden = false;
    resetProgress();
    selectedInfluencers = [];
    agentOutputs.innerHTML = '';
    const gapSection = $('#gap-analysis-section');
    const gapResults = $('#gap-analysis-results');
    if (gapSection) gapSection.hidden = true;
    if (gapResults) gapResults.innerHTML = '';
    ensureLiveStatusBanner();
    startPipelineStatusPolling();

    // Show step 1 running
    setStepState('step-1', 'running');

    try {
        const res = await fetch(`${API_BASE}/pipeline/run`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({ user_id: currentUser.id }),
        });

        let data;
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await res.json();
        } else {
            const text = await res.text();
            throw new Error(`Server error (${res.status}): ${text.substring(0, 100)}...`);
        }

        if (!res.ok) {
            throw new Error(data.detail || 'Pipeline execution failed');
        }

        // Render results with staggered animation
        renderResults(data.results);
        showToast('AI analysis completed!', 'success');
        showPipelineNotices(data.results);

    } catch (err) {
        showToast(err.message, 'error');
        setStepState('step-1', 'error');
    } finally {
        stopPipelineStatusPolling();
        setButtonLoading(btn, false);
        btn.disabled = false;
    }
}

function ensureLiveStatusBanner() {
    let el = document.getElementById('pipeline-live-status');
    if (!el) {
        el = document.createElement('div');
        el.id = 'pipeline-live-status';
        el.style.cssText = 'margin-top:8px;font-size:12px;color:var(--text-secondary);min-height:18px;';
        pipelineProgress.appendChild(el);
    }
    el.textContent = '';
}

function startPipelineStatusPolling() {
    stopPipelineStatusPolling();
    pipelineStatusPoller = setInterval(async () => {
        if (!currentUser?.id) return;
        try {
            const res = await fetch(`${API_BASE}/pipeline/live-status/${currentUser.id}`);
            if (!res.ok) return;
            const data = await res.json();
            const el = document.getElementById('pipeline-live-status');
            if (!el) return;

            if (data?.active && data?.message) {
                const secs = typeof data.wait_seconds === 'number' ? Math.ceil(data.wait_seconds) : null;
                el.textContent = secs ? `⏳ ${data.message.replace(/\s*\(attempt.*\)$/,'')} (${secs}s)` : `⏳ ${data.message}`;
            } else {
                el.textContent = '';
            }
        } catch (_err) {
            // Ignore polling failures silently.
        }
    }, 1200);
}

function stopPipelineStatusPolling() {
    if (pipelineStatusPoller) {
        clearInterval(pipelineStatusPoller);
        pipelineStatusPoller = null;
    }
    const el = document.getElementById('pipeline-live-status');
    if (el) {
        el.textContent = '';
    }
}

async function loadExistingResults() {
    try {
        // Always clear UI first to avoid showing stale results across users.
        clearAnalysisUI();

        const res = await fetch(`${API_BASE}/pipeline/results/${currentUser.id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` },
        });

        if (res.ok) {
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                pipelineProgress.hidden = false;
                renderResults(data.results);
            }
        }
    } catch (err) {
        // Silently ignore — no previous results
    }
}

// ═══════════════════════════════════════════════════════════════
// RENDER AGENT RESULTS
// ═══════════════════════════════════════════════════════════════

function renderResults(results) {
    agentOutputs.innerHTML = '';

    results.forEach((result, index) => {
        // Update progress steps
        const stepId = `step-${index + 1}`;
        setStepState(stepId, result.status);

        if (index === 0 && results.length > 1) {
            document.querySelector('.progress-connector').classList.add('active');
        }

        // Create agent card with delay
        setTimeout(() => {
            const card = createAgentCard(result, index);
            agentOutputs.appendChild(card);
        }, index * 300);
    });

    // Render dynamic action panel based on completed agents
    setTimeout(() => {
        renderDynamicActionPanel(results);
    }, (results.length * 300) + 200);
}

function showPipelineNotices(results) {
    if (!Array.isArray(results)) return;
    const influencerResult = results.find(r => (r.agent_name || '').includes('Influence'));
    const warning = influencerResult?.output?.warning;
    if (warning) {
        showToast(warning, 'info');
    }
}

// ─── Dynamic Action Panel ───
function renderDynamicActionPanel(results) {
    // Clear any existing action panel
    let panel = document.getElementById('dynamic-action-panel');
    if (panel) panel.remove();

    const successfulAgents = results.filter(r => r.status === 'success');
    if (successfulAgents.length === 0) return;

    panel = document.createElement('div');
    panel.id = 'dynamic-action-panel';
    panel.style.cssText = `
        margin-top: 2rem;
        padding: 1.5rem;
        background: linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(99,102,241,0.08) 100%);
        border: 1px solid rgba(6,182,212,0.3);
        border-radius: 16px;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    `;

    const panelTitle = document.createElement('h3');
    panelTitle.textContent = '🎯 Next Steps';
    panelTitle.style.cssText = 'margin: 0; color: var(--text-primary); font-size: 1.1rem;';
    panel.appendChild(panelTitle);

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 1rem;
    `;
    panel.appendChild(buttonContainer);

    successfulAgents.forEach((agent, idx) => {
        const agentName = agent.agent_name || '';

        if (agentName.includes('Influence')) {
            // Action for Influencer Scout: Select & Analyze
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.style.cssText = 'background: var(--gradient-primary); padding: 12px 16px; text-align: center; cursor: pointer;';
            btn.innerHTML = `
                <span class="btn-text">👥 Select Influencers & Analyze</span>
                <span class="btn-loader" hidden><span class="spinner"></span></span>
            `;
            btn.addEventListener('click', () => {
                const influencerCard = document.querySelector('[data-influencer-idx]');
                if (influencerCard) {
                    influencerCard.closest('.agent-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
                    showToast('Scroll up to select influencers', 'info');
                } else {
                    showToast('Influencer list not found', 'error');
                }
            });
            buttonContainer.appendChild(btn);
        }

        if (agentName.includes('Gap Analysis')) {
            // Action for Gap Analysis: Generate Posts
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.style.cssText = 'background: var(--gradient-primary); padding: 12px 16px; text-align: center; cursor: pointer;';
            btn.id = 'action-generate-posts-panel';
            btn.innerHTML = `
                <span class="btn-text">✨ Generate LinkedIn Posts</span>
                <span class="btn-loader" hidden><span class="spinner"></span></span>
            `;
            btn.addEventListener('click', () => {
                const existingBtn = document.getElementById('btn-generate-posts');
                if (existingBtn && !existingBtn.hidden) {
                    existingBtn.click();
                } else {
                    showToast('Gap analysis output not found', 'error');
                }
            });
            buttonContainer.appendChild(btn);
        }

        if (agentName.includes('Post Generator')) {
            // Action for Post Generator: Send Reminder Email
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.style.cssText = 'background: var(--gradient-primary); padding: 12px 16px; text-align: center; cursor: pointer;';
            btn.id = 'action-send-reminder-panel';
            btn.innerHTML = `
                <span class="btn-text">📧 Send Reminder Email</span>
                <span class="btn-loader" hidden><span class="spinner"></span></span>
            `;
            btn.addEventListener('click', () => {
                const existingBtn = document.getElementById('btn-send-reminder');
                if (existingBtn && !existingBtn.hidden) {
                    existingBtn.click();
                } else {
                    showToast('Posts not yet generated', 'error');
                }
            });
            buttonContainer.appendChild(btn);
        }

        // Generic action for any other agent
        if (!agentName.includes('Influence') && 
            !agentName.includes('Gap Analysis') && 
            !agentName.includes('Post Generator') &&
            !agentName.includes('Resume Parser') &&
            !agentName.includes('Brand Voice')) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.style.cssText = 'background: var(--gradient-primary); padding: 12px 16px; text-align: center; cursor: pointer;';
            btn.innerHTML = `
                <span class="btn-text">▶ ${escapeHtml(agentName.split(/\s+/).slice(0, 2).join(' '))}</span>
            `;
            buttonContainer.appendChild(btn);
        }
    });

    // Only show panel if there are action buttons
    if (buttonContainer.children.length > 0) {
        agentOutputs.appendChild(panel);
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function createAgentCard(result, index) {
    const card = document.createElement('div');
    card.className = `agent-card status-${result.status}`;
    card.style.animationDelay = `${index * 0.15}s`;

    const icons = ['🔍', '✨', '🌟'];
    const icon = icons[index] || '🤖';

    const badgeClass = result.status === 'success' ? 'badge-success' : 
                       result.status === 'error' ? 'badge-error' : 'badge-running';
    const statusText = result.status === 'success' ? 'Completed' : 
                       result.status === 'error' ? 'Failed' : 'Running';

    card.innerHTML = `
        <div class="agent-card-header" onclick="this.parentElement.querySelector('.agent-card-body').classList.toggle('collapsed')">
            <div class="agent-header-left">
                <div class="agent-icon">${icon}</div>
                <div class="agent-info">
                    <h3>${result.agent_name}</h3>
                    <p>${result.agent_description || ''}</p>
                </div>
            </div>
            <span class="agent-status-badge ${badgeClass}">
                <span class="badge-dot"></span>
                ${statusText}
            </span>
        </div>
        <div class="agent-card-body">
            ${renderAgentOutput(result)}
        </div>
    `;

    return card;
}

function renderAgentOutput(result) {
    if (result.status === 'error') {
        return `<div class="error-display">⚠️ ${escapeHtml(result.error || 'Unknown error')}</div>`;
    }

    if (!result.output) {
        return '<p style="color: var(--text-muted)">No output data</p>';
    }

    // Agent 1: Resume Parser
    if (result.agent_name.includes('Resume Parser')) {
        return renderResumeParserOutput(result.output);
    }

    // Agent 2: Brand Voice
    if (result.agent_name.includes('Brand Voice')) {
        return renderBrandVoiceOutput(result.output);
    }

    // Agent 3: Influence Scout
    if (result.agent_name.includes('Influence')) {
        return renderInfluencerOutput(result.output);
    }

    // Agent 4: Gap Analysis
    if (result.agent_name.includes('Gap Analysis')) {
        return renderGapAnalysisOutput(result.output);
    }

    // Agent 4.5: Posting recommendation
    if (result.agent_name.includes('Posting Frequency Recommendation')) {
        return renderPostingRecommendationOutput(result.output);
    }

    // Agent 5: Post Generator
    if (result.agent_name.includes('Post Generator')) {
        return renderPostGeneratorOutput(result.output);
    }


    // Agent 7: Email Reminder
    if (result.agent_name.includes('Email Reminder')) {
        return renderEmailReminderOutput(result.status, result.output);
    }

    // Fallback: render raw JSON
    return `<pre class="text-block" style="font-size: var(--fs-xs); overflow-x: auto;">${escapeHtml(JSON.stringify(result.output, null, 2))}</pre>`;
}

// ─── Influencer Scout Output ───
function renderInfluencerOutput(output) {
    const influencers = output.influencers || [];
    let html = '';
    const warning = output.warning;

    if (influencers.length === 0) {
        return `
            <div class="output-section">
                <div class="output-section-title">🔍 Search Query: "${escapeHtml(output.search_query_used || 'N/A')}"</div>
                <div class="error-display" style="margin-top: 0.75rem;">
                    ⚠️ No influencer profiles were found for this query. Try running the pipeline again or adjust your resume/profile keywords.
                </div>
            </div>
        `;
    }

    html += `
        <div class="output-section">
            <div class="output-section-title">🔍 Search Query: "${escapeHtml(output.search_query_used)}"</div>
            ${warning ? `<div class="error-display" style="margin-bottom: 0.75rem; border-color: rgba(245, 158, 11, 0.4); color: #f59e0b;">ℹ️ ${escapeHtml(warning)}</div>` : ''}
            <p style="font-size: var(--fs-xs); color: var(--text-muted); margin-bottom: 1.5rem;">
                We found up to 10-15 professionals who match your profile but are more established on LinkedIn. Select one or more influencers to continue. Gap analysis and all next steps run only for your selected influencers.
            </p>
            <div class="influencer-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
                ${influencers.map((inf, idx) => `
                    <label class="influencer-item" data-influencer-idx="${idx}" style="cursor: pointer; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 1.25rem; border-radius: 16px; display: flex; flex-direction: column; justify-content: space-between; transition: all 0.3s ease;">
                        <div>
                            <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; margin-bottom:0.5rem;">
                                <span style="font-size: 11px; color: var(--text-muted);">Select</span>
                                <input type="checkbox" class="influencer-checkbox" data-idx="${idx}" style="accent-color: #06b6d4;" />
                            </div>
                            <h4 style="margin: 0 0 0.5rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem; font-size: var(--fs-sm);">
                                🌟 ${escapeHtml(inf.title)}
                            </h4>
                            <p style="font-size: var(--fs-xs); color: var(--text-secondary); margin: 0 0 1rem; line-height: 1.5; opacity: 0.8;">
                                ${escapeHtml(inf.snippet)}
                            </p>
                        </div>
                        <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: auto;">
                            <a href="${inf.link}" target="_blank" class="btn btn-ghost" style="padding: 6px 12px; font-size: 11px;">
                                View ↗
                            </a>
                        </div>
                    </label>
                `).join('')}
            </div>
            <div style="margin-top:1rem; display:flex; justify-content:center;">
                <button id="btn-run-selected-gap" class="btn btn-primary" style="background: var(--gradient-primary);" disabled>
                    <span class="btn-text">Analyze Gap for Selected Influencers</span>
                    <span class="btn-loader" hidden><span class="spinner" style="width: 12px; height: 12px;"></span></span>
                </button>
            </div>
        </div>
    `;

    // Add selection and continue event listeners
    setTimeout(() => {
        const runBtn = document.getElementById('btn-run-selected-gap');
        const syncSelectedInfluencers = () => {
            selectedInfluencers = [];
            document.querySelectorAll('.influencer-checkbox').forEach(box => {
                const idx = Number(box.getAttribute('data-idx'));
                const card = document.querySelector(`[data-influencer-idx="${idx}"]`);
                if (box.checked) {
                    if (influencers[idx]) {
                        selectedInfluencers.push(influencers[idx]);
                    }
                    if (card) {
                        card.style.border = '1px solid rgba(6, 182, 212, 0.65)';
                        card.style.boxShadow = '0 0 0 1px rgba(6, 182, 212, 0.2)';
                    }
                } else if (card) {
                    card.style.border = '1px solid rgba(255,255,255,0.05)';
                    card.style.boxShadow = 'none';
                }
            });
            if (runBtn) runBtn.disabled = selectedInfluencers.length === 0;
        };

        document.querySelectorAll('.influencer-checkbox').forEach(box => {
            box.addEventListener('change', syncSelectedInfluencers);
        });

        if (runBtn) {
            runBtn.addEventListener('click', () => {
                if (selectedInfluencers.length === 0) {
                    showToast('Please select at least one influencer first.', 'error');
                    return;
                }
                runGapAnalysis(runBtn, selectedInfluencers);
            });
        }
        // Clicking card toggles checkbox for better UX
        document.querySelectorAll('[data-influencer-idx]').forEach(card => {
            card.addEventListener('click', (event) => {
                if (event.target.closest('a')) return;
                const idx = card.getAttribute('data-influencer-idx');
                const box = document.querySelector(`.influencer-checkbox[data-idx="${idx}"]`);
                if (box) {
                    box.checked = !box.checked;
                    box.dispatchEvent(new Event('change'));
                }
            });
        });
    }, 100);

    return html;
}

async function runGapAnalysis(btn, influencers) {
    setButtonLoading(btn, true);
    const section = $('#gap-analysis-section');

    try {
        if (!section) {
            throw new Error('Gap analysis section is missing in the UI. Please refresh the page.');
        }

        const res = await fetch(`${API_BASE}/pipeline/gap-analysis`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({
                user_id: currentUser.id,
                influencer_data: influencers
            }),
        });

        let data;
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await res.json();
        } else {
            const text = await res.text();
            throw new Error(`Server error (${res.status}): ${text.substring(0, 100)}...`);
        }

        if (!res.ok) {
            throw new Error(data.detail || 'Gap analysis failed');
        }

        // Show and render post-selection chained results
        section.hidden = false;
        renderGapAnalysisResults(data.results);
        
        // Scroll to the results
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        showToast('Post-selection pipeline completed: gap, recommendation, and posts are ready.', 'success');

    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

function renderGapAnalysisResults(results) {
    const container = $('#gap-analysis-results');
    container.innerHTML = '';

    results.forEach(result => {
        if (result.status === 'error') {
            container.innerHTML += `
                <div class="error-display" style="margin-top: 1rem;">
                    ⚠️ ${escapeHtml(result.agent_name || 'Agent')} failed: ${escapeHtml(result.error || 'Unknown error')}
                </div>
            `;
            return;
        }

        if (result.agent_name.includes('Gap Analysis')) {
            const output = result.output || {};
            const gap = output.gap_analysis || {};
            const strategy = output.content_strategy || {};
            const schedule = strategy.proposed_schedule || [];
            const actions = output.action_plan || [];

            container.innerHTML += `
                <div class="strategy-card">
                    <div class="output-section">
                        <div class="output-section-title">📊 ${escapeHtml(result.agent_name)}</div>
                        <div class="gap-grid">
                            <div class="gap-card">
                                <h4>Profile Authority</h4>
                                <p class="text-block" style="border: none; padding: 0;">${escapeHtml(gap.profile_completeness_gap)}</p>
                            </div>
                            <div class="gap-card">
                                <h4>Content Impact</h4>
                                <p class="text-block" style="border: none; padding: 0;">${escapeHtml(gap.content_authority_gap)}</p>
                            </div>
                            <div class="gap-card">
                                <h4>Engagement Potential</h4>
                                <p class="text-block" style="border: none; padding: 0;">${escapeHtml(gap.engagement_gap)}</p>
                            </div>
                        </div>
                        <div class="gap-card" style="width: 100%;">
                            <h4>Missing Success Elements</h4>
                            <div class="tag-list">
                                ${(gap.key_missing_elements || []).map(item => `<span class="tag tag-rose">${escapeHtml(item)}</span>`).join('')}
                            </div>
                        </div>
                    </div>

                    <div class="output-section">
                        <div class="output-section-title">📝 Strategy & 7-Day Plan</div>
                        <div class="text-block highlight" style="margin-bottom: 1.5rem;">
                            <strong>Tone Tweak:</strong> ${escapeHtml(strategy.tone_adjustment)}
                        </div>
                        ${renderTagSection('Core Content Pillars', strategy.content_pillars, 'tag-purple')}
                        
                        <div class="schedule-list" style="margin-top: 1.5rem;">
                            ${schedule.map(item => `
                                <div class="schedule-item">
                                    <div class="schedule-day">${escapeHtml(item.day)}</div>
                                    <div class="schedule-content">
                                        <span class="badge-post-type">${escapeHtml(item.post_type)}</span>
                                        <h5>${escapeHtml(item.topic)}</h5>
                                        <p><strong>Goal:</strong> ${escapeHtml(item.topic)}</p>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="output-section">
                        <div class="output-section-title">🚀 Immediate Action Plan</div>
                        <div class="action-plan-list">
                            ${actions.map((act, i) => `
                                <div class="action-item">
                                    <div class="step-icon" style="background: var(--accent-emerald); width: 24px; height: 24px; font-size: 10px;">${i+1}</div>
                                    <span>${escapeHtml(act)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }

        if (result.agent_name.includes('Posting Frequency Recommendation')) {
            container.innerHTML += `
                <div class="strategy-card" style="margin-top: 1.25rem;">
                    ${renderPostingRecommendationOutput(result.output || {})}
                </div>
            `;
        }

        if (result.agent_name.includes('Post Generator')) {
            container.innerHTML += `
                <div class="strategy-card" style="margin-top: 1.25rem;">
                    ${renderPostGeneratorOutput(result.output || {})}
                </div>
            `;
        }
    });
}

function renderPostingRecommendationOutput(output) {
    const days = output.recommended_days || [];
    return `
        <div class="output-section">
            <div class="output-section-title">📅 Posting Frequency Recommendation</div>
            <div class="output-grid">
                ${renderInfoItem('Posting Frequency', output.posting_frequency || 'N/A')}
                ${renderInfoItem('Posts Per Week', String(output.recommended_posts_per_week || 'N/A'))}
                ${renderInfoItem('Recommended Time (UTC)', output.recommended_time_utc || 'N/A')}
                ${renderInfoItem('Influencers Selected', String(output.benchmark_influencer_count || 'N/A'))}
            </div>
            ${renderTagSection('Recommended Days', days, 'tag-cyan')}
            <div class="text-block" style="margin-top: 0.75rem;"><strong>Why this cadence:</strong> ${escapeHtml(output.rationale || 'N/A')}</div>
        </div>
    `;
}

async function runPostGenerationFromStrategy(btn, gapAnalysisData) {
    setButtonLoading(btn, true);
    const container = $('#post-generation-results');
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">Generating your personalized posts... this may take a minute! 🚀</div>';

    try {
        const res = await fetch(`${API_BASE}/pipeline/generate-posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({
                user_id: currentUser.id,
                gap_analysis_data: gapAnalysisData
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.detail || 'Post generation failed');
        }

        // Hide the generate button after success
        btn.style.display = 'none';
        btn.previousElementSibling.style.display = 'none';

        // Render generated posts first
        container.innerHTML = '';
        data.results.forEach(result => {
            container.innerHTML += `<div style="margin-top: 2rem;">${renderAgentOutput(result)}</div>`;
        });

        // Add final explicit send button (manual email send only on click)
        const postOutput = (data.results || []).find(r => r.agent_name && r.agent_name.includes('Post Generator'))?.output;
        if (postOutput && Array.isArray(postOutput.posts) && postOutput.posts.length > 0) {
            container.innerHTML += `
                <div id="send-reminder-container" style="margin-top: 2rem; display: flex; flex-direction: column; align-items: center; gap: 1rem; border-top: 2px solid var(--border-color); padding-top: 2rem;">
                    <p style="color: var(--text-secondary); text-align: center; font-size: 1.05rem;">Posts are ready. Send reminder email now?</p>
                    <button id="btn-send-reminder" class="btn btn-primary" style="background: var(--gradient-primary); font-size: 1rem; padding: 12px 24px;">
                        <span class="btn-text">📧 Send Reminder Email</span>
                        <span class="btn-loader" hidden><span class="spinner"></span></span>
                    </button>
                    <div id="send-reminder-result" style="width: 100%; margin-top: 1rem;"></div>
                </div>
            `;

            setTimeout(() => {
                const sendBtn = document.getElementById('btn-send-reminder');
                if (sendBtn) {
                    sendBtn.addEventListener('click', () => runSendReminder(sendBtn, postOutput));
                }
            }, 50);
        }
        
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        showToast('Posts generated successfully. Review and send when ready.', 'success');

    } catch (err) {
        container.innerHTML = `<div class="error-display">⚠️ ${escapeHtml(err.message)}</div>`;
        showToast(err.message, 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}

async function runSendReminder(btn, postsOutput) {
    setButtonLoading(btn, true);
    const resultContainer = $('#send-reminder-result');
    if (resultContainer) {
        resultContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 1rem;">Sending reminder email...</div>';
    }

    try {
        const res = await fetch(`${API_BASE}/pipeline/send-reminder`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({
                user_id: currentUser.id,
                posts_data: postsOutput,
            }),
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || 'Failed to send reminder email');
        }

        const emailResult = (data.results || [])[0];
        if (resultContainer && emailResult) {
            resultContainer.innerHTML = `<div style="margin-top: 1rem;">${renderAgentOutput(emailResult)}</div>`;
        }
        showToast('Reminder email sent successfully!', 'success');
    } catch (err) {
        if (resultContainer) {
            resultContainer.innerHTML = `<div class="error-display">⚠️ ${escapeHtml(err.message)}</div>`;
        }
        showToast(err.message, 'error');
    } finally {
        setButtonLoading(btn, false);
    }
}
function renderGapAnalysisOutput(output) {
    const gap = output.gap_analysis || {};
    const strategy = output.content_strategy || {};
    const actions = output.action_plan || [];

    return `
        <div class="output-section">
            <div class="output-section-title">📊 Gap Summary</div>
            <div class="output-grid">
                ${renderInfoItem('Profile Gap', gap.profile_completeness_gap || 'N/A')}
                ${renderInfoItem('Authority Gap', gap.content_authority_gap || 'N/A')}
                ${renderInfoItem('Engagement Gap', gap.engagement_gap || 'N/A')}
            </div>
            ${renderTagSection('Missing Elements', gap.key_missing_elements || [], 'tag-rose')}
            ${renderTagSection('Content Pillars', strategy.content_pillars || [], 'tag-purple')}
            <div class="text-block" style="margin-top: 0.75rem;"><strong>Tone Adjustment:</strong> ${escapeHtml(strategy.tone_adjustment || 'N/A')}</div>
            ${actions.length ? `<div class="text-block" style="margin-top: 0.75rem;"><strong>Action Plan:</strong><br>${actions.map((a, i) => `${i + 1}. ${escapeHtml(a)}`).join('<br>')}</div>` : ''}
        </div>
    `;
}

function renderPostGeneratorOutput(output) {
    const posts = output.posts || [];

    return `
        <div class="output-section">
            <div class="output-section-title">✍️ LinkedIn Post Plan</div>
            <div class="output-grid">
                ${renderInfoItem('Posting Frequency', output.posting_frequency || 'N/A')}
                ${renderInfoItem('Strategy Summary', output.content_strategy_summary || 'N/A')}
            </div>
            ${renderTagSection('Recommended Post Types', output.recommended_post_types || [], 'tag-cyan')}
            <div class="interactive-post-list">
                ${posts.map((post, i) => `
                    <article class="interactive-post-card">
                        <div class="post-card-top">
                            <span class="badge-post-type">${escapeHtml(post.type || 'N/A')}</span>
                            <span class="post-index">Post ${i + 1}</span>
                        </div>

                        <p class="post-hook">${escapeHtml(extractPostHook(post.content || ''))}</p>

                        <details class="post-details" ${i === 0 ? 'open' : ''}>
                            <summary>Read full post</summary>
                            <div class="post-content-readable">${renderHighlightedPostContent(post.content || '')}</div>
                        </details>

                        <div class="post-action-row">
                            <button class="btn btn-ghost post-action-btn" onclick="copyPostFromEncoded('${encodeURIComponent(post.content || '')}')">Copy Post</button>
                        </div>

                        <div class="post-meta-grid">
                            ${renderInfoItem('Goal', post.goal || 'N/A')}
                        </div>
                    </article>
                `).join('')}
            </div>
        </div>
    `;
}


function renderEmailReminderOutput(status, output) {
    if (status === 'skipped') {
        return `
            <div class="output-section">
                <div class="output-section-title">📧 Email Reminder</div>
                <div style="padding: 1rem; background: rgba(100, 150, 255, 0.1); border-left: 4px solid #0077b5; border-radius: 4px;">
                    <p style="color: var(--text-secondary); margin: 0;">
                        ℹ️ Email reminder skipped. Complete all previous steps first to generate posts and send reminders.
                    </p>
                </div>
            </div>
        `;
    }

    if (!output) {
        return '<p style="color: var(--text-muted)">No email reminder data available.</p>';
    }

    const success = output.email_sent === true;
    const recipient = output.recipient || 'user';
    const message = output.message || 'Email sent successfully';
    const postsCount = output.posts_count || 0;

    return `
        <div class="output-section">
            <div class="output-section-title">📧 Email Reminder Sent</div>
            <div style="padding: 1.5rem; background: ${success ? 'rgba(76, 175, 80, 0.1)' : 'rgba(100, 150, 255, 0.1)'}; border-left: 4px solid ${success ? '#4caf50' : '#0077b5'}; border-radius: 4px;">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
                    <span style="font-size: 1.5rem;">${success ? '✅' : 'ℹ️'}</span>
                    <div>
                        <p style="margin: 0; font-weight: 600; color: var(--text-primary);">
                            ${success ? 'Reminder Email Sent!' : 'Email Reminder Status'}
                        </p>
                        <p style="margin: 0.25rem 0 0; font-size: var(--fs-xs); color: var(--text-secondary);">
                            ${escapeHtml(message)}
                        </p>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-top: 1rem;">
                    <div style="background: rgba(255,255,255,0.05); padding: 0.75rem; border-radius: 8px;">
                        <p style="margin: 0; font-size: var(--fs-xs); color: var(--text-secondary);">📧 Recipient</p>
                        <p style="margin: 0.5rem 0 0; font-weight: 600; color: var(--text-primary); font-size: var(--fs-sm);">
                            ${escapeHtml(recipient)}
                        </p>
                    </div>
                    <div style="background: rgba(255,255,255,0.05); padding: 0.75rem; border-radius: 8px;">
                        <p style="margin: 0; font-size: var(--fs-xs); color: var(--text-secondary);">📝 Posts Included</p>
                        <p style="margin: 0.5rem 0 0; font-weight: 600; color: var(--text-primary); font-size: var(--fs-sm);">
                            ${postsCount} post${postsCount !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
                ${success ? `
                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1);">
                        <p style="margin: 0; font-size: var(--fs-xs); color: var(--text-secondary); line-height: 1.6;">
                            🎉 Your LinkedIn posts with accompanying images and funny reminders have been sent to your Outlook inbox. Check your email to see your complete content ready to post!
                        </p>
                    </div>
                ` : `
                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1);">
                        <p style="margin: 0; font-size: var(--fs-xs); color: var(--text-secondary); line-height: 1.6;">
                            💡 Make sure to configure your email settings in the backend .env file with your Outlook credentials to enable email reminders.
                        </p>
                    </div>
                `}
            </div>
        </div>
    `;
}

function extractPostHook(content) {
    const lines = String(content || '').split('\n').map(l => l.trim()).filter(Boolean);
    return lines[0] || 'Here is your highlighted post idea.';
}

function renderHighlightedPostContent(content) {
    const safe = escapeHtml(String(content || '')).replace(/\n/g, '<br>');
    return safe.replace(/(^|\s)(#[A-Za-z0-9_]+)/g, '$1<span class="post-hashtag">$2</span>');
}

function copyPostFromEncoded(encodedText) {
    try {
        const value = decodeURIComponent(encodedText || '');
        navigator.clipboard.writeText(value);
        showToast('Copied to clipboard!', 'success');
    } catch (_err) {
        showToast('Unable to copy text', 'error');
    }
}

// ─── Resume Parser Output ───
function renderResumeParserOutput(output) {
    const profile = output.parsed_profile || {};
    const personal = profile.personal_info || {};
    let html = '';

    // Personal Info
    html += `
        <div class="output-section">
            <div class="output-section-title">👤 Personal Information</div>
            <div class="output-grid">
                ${renderInfoItem('Full Name', personal.full_name)}
                ${renderInfoItem('Email', personal.email)}
                ${renderInfoItem('Phone', personal.phone)}
                ${renderInfoItem('Location', personal.location)}
                ${renderInfoItem('LinkedIn', personal.linkedin_url)}
                ${renderInfoItem('Portfolio', personal.portfolio_url)}
            </div>
        </div>
    `;

    // Professional Summary
    if (profile.professional_summary) {
        html += `
            <div class="output-section">
                <div class="output-section-title">📋 Professional Summary</div>
                <div class="text-block highlight">${escapeHtml(profile.professional_summary)}</div>
            </div>
        `;
    }

    // Quick Stats
    html += `
        <div class="output-section">
            <div class="output-section-title">📊 Quick Overview</div>
            <div class="output-grid">
                ${renderInfoItem('Current Role', profile.current_role)}
                ${renderInfoItem('Industry', profile.industry)}
                ${renderInfoItem('Experience', profile.total_years_of_experience)}
                ${renderInfoItem('Text Analyzed', `${output.raw_text_length || 0} chars`)}
            </div>
        </div>
    `;

    // Skills
    const skills = profile.skills || {};
    if (Object.keys(skills).length > 0) {
        html += `
            <div class="output-section">
                <div class="output-section-title">🛠️ Skills & Technologies</div>
                ${renderTagSection('Technical Skills', skills.technical_skills, '')}
                ${renderTagSection('Soft Skills', skills.soft_skills, 'tag-cyan')}
                ${renderTagSection('Tools & Technologies', skills.tools_and_technologies, 'tag-purple')}
                ${renderTagSection('Languages', skills.languages, 'tag-amber')}
            </div>
        `;
    }

    // Experience
    const experience = profile.experience || [];
    if (experience.length > 0) {
        html += `
            <div class="output-section">
                <div class="output-section-title">💼 Experience</div>
                <div class="experience-list">
                    ${experience.map(exp => `
                        <div class="experience-item">
                            <h4>${escapeHtml(exp.role || 'N/A')}</h4>
                            <span class="exp-company">${escapeHtml(exp.company || '')}</span>
                            <span class="exp-duration"> · ${escapeHtml(exp.duration || '')}</span>
                            ${exp.description ? `<p class="exp-desc">${escapeHtml(exp.description)}</p>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Education
    const education = profile.education || [];
    if (education.length > 0) {
        html += `
            <div class="output-section">
                <div class="output-section-title">🎓 Education</div>
                <div class="experience-list">
                    ${education.map(edu => `
                        <div class="experience-item">
                            <h4>${escapeHtml(edu.degree || '')} ${edu.field_of_study ? `in ${escapeHtml(edu.field_of_study)}` : ''}</h4>
                            <span class="exp-company">${escapeHtml(edu.institution || '')}</span>
                            ${edu.year ? `<span class="exp-duration"> · ${escapeHtml(edu.year)}</span>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Expertise areas
    if (profile.expertise_areas && profile.expertise_areas.length > 0) {
        html += `
            <div class="output-section">
                <div class="output-section-title">🎯 Expertise Areas</div>
                ${renderTagSection('', profile.expertise_areas, 'tag-emerald')}
            </div>
        `;
    }

    // Certifications
    if (profile.certifications && profile.certifications.length > 0) {
        html += `
            <div class="output-section">
                <div class="output-section-title">📜 Certifications</div>
                ${renderTagSection('', profile.certifications, 'tag-amber')}
            </div>
        `;
    }

    return html;
}

// ─── Brand Voice Output ───
function renderBrandVoiceOutput(output) {
    const brand = output.brand_analysis || {};
    const persona = brand.user_persona || {};
    const voice = brand.brand_voice || {};
    const summary = brand.professional_summary || {};
    let html = '';

    // Professional Identity
    if (persona.professional_identity) {
        html += `
            <div class="output-section">
                <div class="output-section-title">🧬 Professional Identity</div>
                <div class="text-block highlight">${escapeHtml(persona.professional_identity)}</div>
            </div>
        `;
    }

    // Unique Value Proposition
    if (persona.unique_value_proposition) {
        html += `
            <div class="output-section">
                <div class="output-section-title">💎 Unique Value Proposition</div>
                <div class="text-block highlight">${escapeHtml(persona.unique_value_proposition)}</div>
            </div>
        `;
    }

    // Core Strengths
    if (persona.core_strengths && persona.core_strengths.length > 0) {
        html += `
            <div class="output-section">
                <div class="output-section-title">💪 Core Strengths</div>
                ${renderTagSection('', persona.core_strengths, 'tag-emerald')}
            </div>
        `;
    }

    // Expertise & Personality
    html += `
        <div class="output-section">
            <div class="output-section-title">🎯 Profile Attributes</div>
            <div class="output-grid">
                ${renderInfoItem('Target Audience', persona.target_audience)}
                ${renderInfoItem('Career Trajectory', persona.career_trajectory)}
            </div>
            ${persona.personality_traits ? renderTagSection('Personality Traits', persona.personality_traits, 'tag-purple') : ''}
        </div>
    `;

    // Brand Voice Details
    html += `
        <div class="output-section">
            <div class="output-section-title">🎙️ Brand Voice</div>
            <div class="output-grid">
                ${renderInfoItem('Tone', voice.tone)}
                ${renderInfoItem('Style', voice.style)}
                ${renderInfoItem('Vocabulary', voice.vocabulary_level)}
            </div>
        </div>
    `;

    // Content Themes
    if (voice.content_themes && voice.content_themes.length > 0) {
        html += `
            <div class="output-section">
                <div class="output-section-title">📝 Content Themes</div>
                ${renderTagSection('', voice.content_themes, 'tag-cyan')}
            </div>
        `;
    }

    // Do's and Don'ts
    if (voice.do_list || voice.dont_list) {
        html += `
            <div class="output-section">
                <div class="output-section-title">✅ Branding Guidelines</div>
                <div class="output-grid" style="grid-template-columns: 1fr 1fr;">
                    <div class="output-item" style="border-left: 3px solid var(--accent-emerald);">
                        <div class="output-item-label" style="color: var(--accent-emerald);">✅ Do</div>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            ${(voice.do_list || []).map(item => `<li style="font-size: var(--fs-xs); color: var(--text-secondary); padding: 0.2rem 0;">• ${escapeHtml(item)}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="output-item" style="border-left: 3px solid var(--accent-rose);">
                        <div class="output-item-label" style="color: var(--accent-rose);">❌ Don't</div>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            ${(voice.dont_list || []).map(item => `<li style="font-size: var(--fs-xs); color: var(--text-secondary); padding: 0.2rem 0;">• ${escapeHtml(item)}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    // Sample Taglines
    if (voice.sample_taglines && voice.sample_taglines.length > 0) {
        html += `
            <div class="output-section">
                <div class="output-section-title">💬 Suggested Taglines</div>
                <div class="experience-list">
                    ${voice.sample_taglines.map(tag => `
                        <div class="text-block" style="border-left: 3px solid var(--accent-indigo); padding: 0.75rem 1rem; font-style: italic;">
                            "${escapeHtml(tag)}"
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Communication Pillars
    if (voice.communication_pillars && voice.communication_pillars.length > 0) {
        html += `
            <div class="output-section">
                <div class="output-section-title">🏛️ Communication Pillars</div>
                ${renderTagSection('', voice.communication_pillars, '')}
            </div>
        `;
    }

    // Professional Summary
    if (summary.short_bio) {
        html += `
            <div class="output-section">
                <div class="output-section-title">📄 Professional Bio</div>
                <div class="text-block highlight">${escapeHtml(summary.short_bio)}</div>
            </div>
        `;
    }

    if (summary.elevator_pitch) {
        html += `
            <div class="output-section">
                <div class="output-section-title">🎤 Elevator Pitch</div>
                <div class="text-block">${escapeHtml(summary.elevator_pitch)}</div>
            </div>
        `;
    }

    if (summary.linkedin_about) {
        html += `
            <div class="output-section">
                <div class="output-section-title">📝 Recommended LinkedIn About</div>
                <div class="text-block" style="white-space: pre-line;">${escapeHtml(summary.linkedin_about)}</div>
            </div>
        `;
    }

    if (summary.key_hashtags && summary.key_hashtags.length > 0) {
        html += `
            <div class="output-section">
                <div class="output-section-title"># Recommended Hashtags</div>
                ${renderTagSection('', summary.key_hashtags, 'tag-cyan')}
            </div>
        `;
    }

    return html;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function renderInfoItem(label, value) {
    const displayValue = value || 'N/A';
    return `
        <div class="output-item">
            <div class="output-item-label">${escapeHtml(label)}</div>
            <div class="output-item-value">${escapeHtml(String(displayValue))}</div>
        </div>
    `;
}

function renderTagSection(label, items, tagClass) {
    if (!items || items.length === 0) return '';
    return `
        ${label ? `<p style="font-size: var(--fs-xs); color: var(--text-muted); margin: 0.4rem 0 0.3rem; font-weight: 500;">${escapeHtml(label)}</p>` : ''}
        <div class="tag-list">
            ${items.filter(Boolean).map(item => `<span class="tag ${tagClass}">${escapeHtml(String(item))}</span>`).join('')}
        </div>
    `;
}

function setButtonLoading(btn, loading) {
    const textEl = btn.querySelector('.btn-text');
    const loaderEl = btn.querySelector('.btn-loader');
    if (loading) {
        textEl.hidden = true;
        loaderEl.hidden = false;
        btn.disabled = true;
    } else {
        textEl.hidden = false;
        loaderEl.hidden = true;
        btn.disabled = false;
    }
}

function resetProgress() {
    $$('.progress-step').forEach(s => s.className = 'progress-step');
    document.querySelector('.progress-connector').classList.remove('active');
}

function setStepState(stepId, state) {
    const step = $(`#${stepId}`);
    if (step) {
        step.className = `progress-step ${state}`;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const container = $('#toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(60px)';
        toast.style.transition = 'all 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ─── Password Toggle Logic ───
document.querySelectorAll('.password-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        const icon = btn.querySelector('svg');
        
        if (input.type === 'password') {
            input.type = 'text';
            btn.classList.add('active');
            // Change icon to eye-off if needed, but keeping it simple for now
        } else {
            input.type = 'password';
            btn.classList.remove('active');
        }
    });
});

// ─── Session Restore ───
(function restoreSession() {
    const savedToken = sessionStorage.getItem('authToken');
    const savedUser = sessionStorage.getItem('currentUser');

    if (savedToken && savedUser) {
        authToken = savedToken;
        currentUser = JSON.parse(savedUser);
        showDashboard();
        clearAnalysisUI();
        loadExistingResults();
    }
})();

function clearAnalysisUI() {
    agentOutputs.innerHTML = '';
    pipelineProgress.hidden = true;
    resetProgress();
    selectedInfluencers = [];

    const live = document.getElementById('pipeline-live-status');
    if (live) live.textContent = '';

    const gapSection = $('#gap-analysis-section');
    const gapResults = $('#gap-analysis-results');
    if (gapSection) gapSection.hidden = true;
    if (gapResults) gapResults.innerHTML = '';
}
