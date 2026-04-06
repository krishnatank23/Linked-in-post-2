import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Cpu, LayoutDashboard, LogOut, Mail, Play, Send, Sparkles, Users, Target, PenTool, Clock3, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import AgentCard from '../components/AgentCard';
import { useAuth } from '../context/AuthContext';
import { btnPrimary, btnSecondary, glassBase, glassCard, pageShell } from '../styles/classes';

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${glassBase} p-4`}>
      <div className="text-xs uppercase tracking-[0.2em] text-white/35 mb-1">{label}</div>
      <div className="font-semibold text-white/85">{value}</div>
    </div>
  );
}

export default function StudioPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loadingPipeline, setLoadingPipeline] = useState(false);
  const [runningGap, setRunningGap] = useState(false);
  const [generatingPosts, setGeneratingPosts] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any[]>([]);
  const [influencers, setInfluencers] = useState<any[]>([]);
  const [selectedInfluencers, setSelectedInfluencers] = useState<any[]>([]);
  const [gapAnalysisData, setGapAnalysisData] = useState<any | null>(null);
  const [postResults, setPostResults] = useState<any[]>([]);
  const [sendingPostEmail, setSendingPostEmail] = useState(false);
  const [activeTab, setActiveTab] = useState<'workflow' | 'results'>('workflow');

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [navigate, user]);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      try {
        const response = await api.get(`/pipeline/results/${user.id}`);
        const allResults = response.data.results || [];
        setResults(allResults);
        const influencerResult = allResults.find((result: any) => result.agent_name?.includes('Influence'));
        const outputInfluencers = influencerResult?.output?.influencers || [];
        setInfluencers(outputInfluencers);
        setPostResults(allResults.filter((result: any) => String(result.agent_name || '').includes('Post Generator')));
      } catch {
        setResults([]);
      }
    };

    void load();
  }, [user]);

  useEffect(() => {
    let interval: number | undefined;
    if (loadingPipeline && user) {
      interval = window.setInterval(async () => {
        try {
          const res = await api.get(`/pipeline/live-status/${user.id}`);
          if (res.data?.active) {
            setStatus(res.data.message || 'Running pipeline...');
            if (String(res.data.message || '').includes('Resume')) setProgress(20);
            else if (String(res.data.message || '').includes('Brand')) setProgress(45);
            else if (String(res.data.message || '').includes('Scout')) setProgress(75);
          }
        } catch {
          /* ignore polling errors */
        }
      }, 1500);
    }

    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [loadingPipeline, user]);

  const selectedCount = selectedInfluencers.length;
  const hasPipelineResults = results.length > 0;
  const pipelineErrors = results.filter((result) => result.status !== 'success');
  const latestPipelineError = pipelineErrors[pipelineErrors.length - 1];

  const selectedInfluencerMeta = useMemo(
    () => selectedInfluencers.map((item) => item.title || item.name || 'Influencer'),
    [selectedInfluencers]
  );

  const latestGeneratedPostOutput = useMemo(() => {
    const fromStep = [...postResults].reverse().find((result) => String(result.agent_name || '').includes('Post Generator'));
    if (fromStep?.output) return fromStep.output;
    const fromHistory = [...results].reverse().find((result) => String(result.agent_name || '').includes('Post Generator'));
    return fromHistory?.output || null;
  }, [postResults, results]);

  const latestDeliveryStatus = useMemo(() => {
    return [...results].reverse().find((result) => String(result.agent_name || '').includes('Post Delivery')) || null;
  }, [results]);

  const runPipeline = async () => {
    if (!user) return;
    setLoadingPipeline(true);
    setStatus('Starting pipeline...');
    setProgress(5);
    setResults([]);
    setInfluencers([]);
    setSelectedInfluencers([]);
    setGapAnalysisData(null);
    setPostResults([]);

    try {
      const response = await api.post('/pipeline/run', { user_id: user.id });
      const nextResults = response.data.results || [];
      setResults(nextResults);
      const influencerResult = nextResults.find((result: any) => result.agent_name?.includes('Influence'));
      const outputInfluencers = influencerResult?.output?.influencers || [];
      setInfluencers(outputInfluencers);
      setStatus('Pipeline complete. Select influencers to continue.');
      setProgress(100);
      toast.success('Influencer list is ready.');
      navigate('/studio/review/0');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Pipeline failed.');
      setStatus('');
      setProgress(0);
    } finally {
      setLoadingPipeline(false);
      setTimeout(() => setStatus(''), 1500);
    }
  };

  const toggleInfluencer = (influencer: any) => {
    setSelectedInfluencers((current) => {
      const exists = current.some((item) => (item.link || item.title) === (influencer.link || influencer.title));
      if (exists) {
        return current.filter((item) => (item.link || item.title) !== (influencer.link || influencer.title));
      }
      return [...current, influencer];
    });
  };

  const runGapAnalysis = async () => {
    if (!user) return;
    if (selectedInfluencers.length === 0) {
      toast.error('Select at least one influencer first.');
      return;
    }

    setRunningGap(true);
    try {
      const response = await api.post('/pipeline/gap-analysis', {
        user_id: user.id,
        influencer_data: selectedInfluencers,
      });
      const nextResults = response.data.results || [];
      const gapResult = nextResults.find((result: any) => result.agent_name?.includes('Gap Analysis'));
      const recommendation = nextResults.find((result: any) => result.agent_name?.includes('Posting Frequency'));
      setGapAnalysisData(gapResult?.output || null);
      setResults((current) => [...current, ...nextResults]);
      if (recommendation?.output?.recommended_posts_per_week) {
        toast.success(`Recommended cadence: ${recommendation.output.recommended_posts_per_week} posts/week`);
      } else {
        toast.success('Gap analysis completed.');
      }
      setActiveTab('results');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Gap analysis failed.');
    } finally {
      setRunningGap(false);
    }
  };

  const generatePosts = async () => {
    if (!user || !gapAnalysisData) {
      toast.error('Complete gap analysis first.');
      return;
    }

    setGeneratingPosts(true);
    try {
      const response = await api.post('/pipeline/generate-posts', {
        user_id: user.id,
        gap_analysis_data: gapAnalysisData,
      });
      const nextResults = response.data.results || [];
      setPostResults(nextResults);
      setResults((current) => [...current, ...nextResults]);
      setActiveTab('results');
      toast.success('Posts generated successfully.');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Post generation failed.');
    } finally {
      setGeneratingPosts(false);
    }
  };

  const sendGeneratedPostsToEmail = async () => {
    if (!user || !latestGeneratedPostOutput) {
      toast.error('Generate posts first.');
      return;
    }

    setSendingPostEmail(true);
    try {
      const payload = {
        user_id: user.id,
        posts_data: latestGeneratedPostOutput,
      };

      let response: any;
      try {
        response = await api.post('/pipeline/send-post-email', payload);
      } catch (error: any) {
        if (error?.response?.status === 404) {
          response = await api.post('/pipeline/send-reminder', payload);
        } else {
          throw error;
        }
      }

      const deliveryStatus = response?.data?.results?.[0]?.status;
      const deliveryError = response?.data?.results?.[0]?.error || response?.data?.results?.[0]?.output?.message;
      if (deliveryStatus && deliveryStatus !== 'success') {
        throw new Error(deliveryError || 'Email delivery failed.');
      }

      toast.success(response.data?.message || 'Posts sent to registered email.');

      const refreshed = await api.get(`/pipeline/results/${user.id}`);
      setResults(refreshed.data.results || []);
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.detail ||
        error?.response?.data?.results?.[0]?.error ||
        error?.message ||
        'Failed to send posts by email.';
      toast.error(String(errorMessage));
    } finally {
      setSendingPostEmail(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className={pageShell}>
      <div className="fixed inset-0 pointer-events-none hero-grid opacity-20" />
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[8%] left-[10%] h-72 w-72 rounded-full bg-primary/15 blur-[120px] animate-aurora" />
        <div className="absolute top-[35%] right-[8%] h-80 w-80 rounded-full bg-accent/15 blur-[120px] animate-aurora" style={{ animationDelay: '-6s' }} />
      </div>

      <div className="relative z-10 min-h-screen flex">
        <aside className="hidden xl:flex w-72 flex-col border-r border-white/10 bg-black/10 backdrop-blur-xl p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Sparkles size={22} />
            </div>
            <div>
              <div className="font-heading text-xl font-bold">BrandForge AI</div>
              <div className="text-xs text-white/35">Studio dashboard</div>
            </div>
          </div>

          <div className="space-y-3">
            <button className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/10 border border-white/10 text-left">
              <LayoutDashboard size={18} className="text-accent" /> Workflow
            </button>
            <button onClick={() => setActiveTab('results')} className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 text-left text-white/70 hover:text-white">
              <Cpu size={18} /> Results
            </button>
            <Link to="/studio/results" className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 text-left text-white/70 hover:text-white">
              <Clock3 size={18} /> Full history
            </Link>
          </div>

          <div className="mt-auto pt-8 space-y-3">
            <button onClick={runPipeline} disabled={loadingPipeline} className={`${btnPrimary} w-full gap-2`}>
              {loadingPipeline ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />} Run pipeline
            </button>
            <button onClick={handleLogout} className={`${btnSecondary} w-full gap-2`}>
              <LogOut size={18} /> Sign out
            </button>
          </div>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 xl:p-10 overflow-x-hidden">
          <header className={`${glassCard} p-5 md:p-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between mb-6`}>
            <div>
              <div className="text-sm uppercase tracking-[0.28em] text-white/35">Studio Dashboard</div>
              <h1 className="font-heading text-3xl md:text-5xl font-bold mt-2">Welcome back, {user?.username || 'Creator'}</h1>
              <p className="text-white/50 mt-2 max-w-2xl">Run the pipeline, select influencers, review separate gap insights, and only then generate posts.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => setActiveTab('results')} className={btnSecondary}>View results</button>
            </div>
          </header>

          <section className="grid xl:grid-cols-4 gap-4 mb-6">
            <StatPill label="Pipeline" value={loadingPipeline ? 'Running' : hasPipelineResults ? 'Ready' : 'Idle'} />
            <StatPill label="Selected influencers" value={String(selectedCount)} />
            <StatPill label="Gap analysis" value={gapAnalysisData ? 'Completed' : 'Waiting for selection'} />
            <StatPill label="Posts" value={postResults.length ? 'Generated' : 'Pending'} />
          </section>

          {!loadingPipeline && latestPipelineError ? (
            <section className="mb-6 rounded-3xl border border-red-500/20 bg-red-500/10 p-5 md:p-6 text-red-50">
              <div className="text-xs uppercase tracking-[0.24em] text-red-200/75 mb-2">Pipeline failed</div>
              <div className="font-semibold mb-2">The backend could not complete the agent workflow.</div>
              <p className="text-sm leading-6 text-red-50/90 whitespace-pre-wrap break-words">{String(latestPipelineError.error || 'One or more agents failed.')}</p>
            </section>
          ) : null}

          <AnimatePresence>
            {loadingPipeline ? (
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${glassCard} p-6 md:p-8 mb-6`}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center text-primary">
                    <Cpu size={24} className="animate-pulse" />
                  </div>
                  <div>
                    <div className="font-heading text-2xl font-semibold">Agentic graph active</div>
                    <p className="text-white/45 mt-1">{status || 'Initializing pipeline...'}</p>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <motion.div className="h-full bg-gradient-to-r from-primary to-accent" animate={{ width: `${progress}%` }} />
                </div>
                <div className="mt-3 text-right text-sm text-white/45">{progress}%</div>
              </motion.section>
            ) : null}
          </AnimatePresence>

          <section className="grid lg:grid-cols-2 gap-6">
            <div className={`${glassCard} p-6 md:p-7`}>
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-white/35">Step 1</div>
                  <h2 className="font-heading text-2xl font-semibold">Run Resume Parser and Brand Voice</h2>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
                  <Play size={20} />
                </div>
              </div>
              <p className="text-white/55 leading-7 mb-5">This generates resume parsing, brand voice, and influencer analysis so you can continue to the human-in-the-loop steps.</p>
              <button onClick={runPipeline} disabled={loadingPipeline} className={`${btnPrimary} gap-2`}>
                {loadingPipeline ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />} Run Resume Parser and Brand Voice
              </button>
            </div>

            <div className={`${glassCard} p-6 md:p-7`}>
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-white/35">Step 2</div>
                  <h2 className="font-heading text-2xl font-semibold">Select influencers</h2>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-accent/15 text-accent flex items-center justify-center">
                  <Users size={20} />
                </div>
              </div>

              {influencers.length ? (
                <div className="grid md:grid-cols-2 gap-4 max-h-[540px] overflow-auto pr-1">
                  {influencers.map((influencer, index) => {
                    const checked = selectedInfluencers.some((item) => (item.link || item.title) === (influencer.link || influencer.title));
                    return (
                      <button
                        key={`${influencer.link || influencer.title || index}`}
                        type="button"
                        onClick={() => toggleInfluencer(influencer)}
                        className={`text-left rounded-3xl border p-4 transition-all ${checked ? 'border-accent bg-accent/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="font-semibold leading-6">{influencer.title || influencer.name || `Influencer ${index + 1}`}</div>
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${checked ? 'bg-accent border-accent' : 'border-white/25'}`}>
                            {checked ? <CheckCircle2 size={12} /> : null}
                          </div>
                        </div>
                        <p className="text-sm text-white/55 leading-6 mb-4 line-clamp-3">{influencer.snippet || influencer.summary || 'LinkedIn benchmark candidate.'}</p>
                        {influencer.link ? (
                          <div
                            className="text-xs text-accent break-all underline underline-offset-2"
                            onClick={(event) => {
                              event.stopPropagation();
                              window.open(influencer.link, '_blank', 'noopener,noreferrer');
                            }}
                          >
                            {influencer.link}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-white/45">
                  Run the pipeline first to populate the influencer grid.
                </div>
              )}
            </div>

            <div className={`${glassCard} p-6 md:p-7`}>
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-white/35">Step 3</div>
                  <h2 className="font-heading text-2xl font-semibold">Run gap analysis</h2>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
                  <Target size={20} />
                </div>
              </div>
              <p className="text-white/55 leading-7 mb-5">This runs only after you select influencers. The backend returns per-influencer analysis plus one combined overall improvement strategy.</p>
              <div className="flex flex-wrap gap-3 mb-5">
                {selectedInfluencerMeta.slice(0, 3).map((name) => (
                  <span key={name} className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-[11px] text-white/75">{name}</span>
                ))}
                {selectedInfluencerMeta.length > 3 ? <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-[11px] text-white/75">+{selectedInfluencerMeta.length - 3} more</span> : null}
              </div>
              <button onClick={runGapAnalysis} disabled={runningGap || selectedInfluencers.length === 0} className={`${btnPrimary} w-full gap-2`}>
                {runningGap ? <Loader2 className="animate-spin" size={18} /> : <Target size={18} />} Analyze selected influencers
              </button>
            </div>

            <div className={`${glassCard} p-6 md:p-7`}>
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-white/35">Step 4</div>
                  <h2 className="font-heading text-2xl font-semibold">Generate LinkedIn posts</h2>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-accent/15 text-accent flex items-center justify-center">
                  <PenTool size={20} />
                </div>
              </div>
              <p className="text-white/55 leading-7 mb-5">Post generation is manual and only unlocks after gap analysis. It uses the selected influencers, the gap strategy, trends, brand voice, and persona.</p>
              <button onClick={generatePosts} disabled={generatingPosts || !gapAnalysisData} className={`${btnPrimary} w-full gap-2`}>
                {generatingPosts ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />} Generate posts
              </button>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/35 mb-2">Post Delivery Agent</div>
                <p className="text-sm text-white/65 leading-6 mb-3">Send generated posts to {user?.email || 'your registered email'} via Outlook.</p>
                <button
                  onClick={sendGeneratedPostsToEmail}
                  disabled={sendingPostEmail || !latestGeneratedPostOutput}
                  className={`${btnSecondary} w-full gap-2`}
                >
                  {sendingPostEmail ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} Send this post to email
                </button>
                {latestDeliveryStatus ? (
                  <div className="mt-3 rounded-xl border border-accent/20 bg-accent/10 p-3 text-xs text-white/75 flex items-start gap-2">
                    <Mail size={14} className="mt-0.5 text-accent" />
                    <span>{String(latestDeliveryStatus.output?.message || latestDeliveryStatus.error || 'Email delivery completed.')}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="mt-6">
            <div className={`${glassCard} p-6 md:p-7 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4`}>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/35">Workspace View</div>
                <h2 className="font-heading text-2xl font-semibold mt-1">{activeTab === 'workflow' ? 'Sequential review flow' : 'Generated results'}</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => setActiveTab('workflow')} className={`${btnSecondary} ${activeTab === 'workflow' ? 'ring-2 ring-primary/25' : ''}`}>Workflow</button>
                <button onClick={() => setActiveTab('results')} className={`${btnSecondary} ${activeTab === 'results' ? 'ring-2 ring-primary/25' : ''}`}>Results</button>
              </div>
            </div>

            {activeTab === 'workflow' ? (
              <div className="grid xl:grid-cols-[0.42fr_0.58fr] gap-6">
                <div className={`${glassCard} p-6 md:p-7`}>
                  <div className="text-xs uppercase tracking-[0.2em] text-white/35 mb-3">Step-by-step review</div>
                  <h3 className="font-heading text-3xl font-semibold mb-3">Open each agent output on its own page</h3>
                  <p className="text-white/55 leading-7 mb-5">
                    The pipeline review is intentionally split into separate screens so the resume parser, brand voice, and influencer analysis are easier to inspect.
                  </p>
                  <div className="space-y-3">
                    <button onClick={() => navigate('/studio/review/0')} className={`${btnPrimary} w-full justify-between`}>
                      <span>Open Resume Parser</span>
                      <ArrowRight size={16} />
                    </button>
                    <button onClick={() => navigate('/studio/review/1')} className={`${btnSecondary} w-full justify-between`}>
                      <span>Open Brand Voice</span>
                      <ArrowRight size={16} />
                    </button>
                    <button onClick={() => navigate('/studio/review/2')} className={`${btnSecondary} w-full justify-between`}>
                      <span>Open Influencer Analysis</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                    After you finish the review flow, return here to run gap analysis and generate posts.
                  </div>
                </div>

                <div className={`${glassCard} p-6 md:p-7`}>
                  <div className="text-xs uppercase tracking-[0.2em] text-white/35 mb-3">Pipeline status</div>
                  <div className="grid sm:grid-cols-3 gap-3 mb-4">
                    <StatPill label="Parser" value={results.some((result) => String(result.agent_name || '').includes('Resume Parser')) ? 'Ready' : 'Pending'} />
                    <StatPill label="Brand Voice" value={results.some((result) => String(result.agent_name || '').includes('Brand Voice')) ? 'Ready' : 'Pending'} />
                    <StatPill label="Influencers" value={results.some((result) => String(result.agent_name || '').includes('Influence')) ? 'Ready' : 'Pending'} />
                  </div>
                  <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-white/45">
                    Your detailed agent outputs are now reviewed one at a time in the workflow pages.
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid xl:grid-cols-2 gap-6">
                {postResults.length ? postResults.map((result, index) => <AgentCard key={`post-${result.agent_name}-${index}`} data={result} index={index} />) : (
                  <div className={`${glassCard} p-10 text-white/45`}>No generated posts yet. Run gap analysis first, then generate posts.</div>
                )}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
