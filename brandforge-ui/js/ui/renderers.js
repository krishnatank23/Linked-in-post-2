/* ═══════════════════════════════════════════════════════════════
   BrandForge AI — Agent Result Renderers
   Focus: Specialized UI for different agent outputs
   ═══════════════════════════════════════════════════════════════ */

export const Renderers = {
    /**
     * Resume Parser Renderer
     */
    'Resume Parser': (data) => {
        const profile = data.parsed_profile || data;
        return `
            <div class="render-resume space-y-4">
                <div class="section">
                    <h5 class="text-accent uppercase text-xs font-bold tracking-widest mb-2">Professional Summary</h5>
                    <p class="text-sm">${profile.summary || 'Profile extracted successfully.'}</p>
                </div>
                <div class="grid grid-cols-2 gap-4 mt-4">
                    <div class="glass p-3 rounded">
                        <span class="block text-xs text-dim">Top Skills</span>
                        <div class="flex flex-wrap gap-1 mt-1">
                            ${(profile.skills || []).slice(0, 6).map(s => `<span class="bg-primary/20 text-[10px] px-2 py-0.5 rounded">${s}</span>`).join('')}
                        </div>
                    </div>
                    <div class="glass p-3 rounded">
                        <span class="block text-xs text-dim">Experience</span>
                        <span class="text-sm font-bold">${profile.experience_years || '5+'} Years</span>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Brand Voice Renderer
     */
    'Brand Voice': (data) => {
        const voice = data.brand_voice || data;
        return `
            <div class="render-brand space-y-4">
                <div class="voice-traits flex flex-wrap gap-2">
                    ${(voice.tones || ['Professional', 'Visionary', 'Expert']).map(t => `
                        <span class="glass px-3 py-1 rounded-full text-xs border-accent/30 text-accent font-medium">${t}</span>
                    `).join('')}
                </div>
                <div class="mt-4">
                    <h5 class="text-xs text-dim mb-1">Core Narrative</h5>
                    <p class="text-sm italic">"${voice.narrative_arc || 'Crafting a unique market position based on your expertise.'}"</p>
                </div>
            </div>
        `;
    },

    /**
     * Influencer Scout Renderer
     */
    'Influencer Scout': (data) => {
        const influencers = data.influencers || [];
        return `
            <div class="render-influencers">
                <p class="text-xs text-dim mb-3">Identified ${influencers.length} industry leaders for benchmark analysis.</p>
                <div class="influencer-mini-grid space-y-2">
                    ${influencers.slice(0, 3).map(inf => `
                        <div class="flex items-center justify-between glass p-2 rounded">
                            <span class="text-sm font-medium">${inf.name}</span>
                            <a href="${inf.profile_url}" target="_blank" class="text-[10px] text-accent">View Profile ↗</a>
                        </div>
                    `).join('')}
                    ${influencers.length > 3 ? `<p class="text-[10px] text-center text-dim mt-2">+ ${influencers.length - 3} more scouts</p>` : ''}
                </div>
            </div>
        `;
    },

    /**
     * Gap Analysis Renderer
     */
    'Gap Analysis': (data) => {
        const strategy = data.strategy || data;
        return `
            <div class="render-gap text-sm">
                <div class="glass p-3 border-l-4 border-accent mb-3">
                    <span class="block text-xs font-bold text-accent mb-1">Primary Opportunity</span>
                    ${strategy.key_opportunity || 'Identifying unique content pillars for your niche.'}
                </div>
                <ul class="space-y-1 list-disc list-inside text-xs text-muted">
                    ${(strategy.content_pillars || ['Expert Insights', 'Project Spotlights', 'Industry Trends']).map(p => `<li>${p}</li>`).join('')}
                </ul>
            </div>
        `;
    },

    /**
     * Post Generator Renderer
     */
    'Post Generator': (data) => {
        const post = data.posts?.[0] || data;
        return `
            <div class="render-posts">
                <div class="glass p-3 rounded relative group">
                    <div class="post-preview text-xs leading-relaxed max-h-32 overflow-hidden mask-fade">
                        ${post.content || 'Strategy-led LinkedIn content ready for review.'}
                    </div>
                </div>
                <button class="btn btn-ghost btn-sm w-full mt-3 text-[10px]">Open Content Editor</button>
            </div>
        `;
    }
};
