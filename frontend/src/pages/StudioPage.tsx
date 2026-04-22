import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Cpu, FileText,
  LogOut, Mail, Play, Sparkles, Users, Target,
  PenTool, Loader2, Bot, Zap, ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import AgentCard from '../components/AgentCard';

/* ─── Pipeline step definitions ─── */
type StepStatus = 'idle' | 'running' | 'complete' | 'error';

interface PipelineStep {
  id: string;
  label: string;
  shortLabel: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  color: string;
  glowColor: string;
  description: string;
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: 'resume',
    label: 'Resume Parser',
    shortLabel: 'Resume',
    icon: FileText,
    color: '#c9714f',
    glowColor: 'rgba(201,113,79,0.18)',
    description: 'Extracts experience, skills & profile data',
  },
  {
    id: 'brand',
    label: 'Brand Voice',
    shortLabel: 'Brand',
    icon: Bot,
    color: '#7a9e87',
    glowColor: 'rgba(122,158,135,0.18)',
    description: 'Defines your professional identity & tone',
  },
  {
    id: 'influencer',
    label: 'Influencer Scout',
    shortLabel: 'Scout',
    icon: Users,
    color: '#4a5b8c',
    glowColor: 'rgba(74,91,140,0.18)',
    description: 'Discovers your LinkedIn benchmarks',
  },
  {
    id: 'gap',
    label: 'Gap Analysis',
    shortLabel: 'Gap',
    icon: Target,
    color: '#d4a24b',
    glowColor: 'rgba(212,162,75,0.2)',
    description: 'Identifies content authority gaps',
  },
  {
    id: 'posts',
    label: 'Post Generator',
    shortLabel: 'Posts',
    icon: PenTool,
    color: '#c9714f',
    glowColor: 'rgba(201,113,79,0.18)',
    description: 'Crafts your LinkedIn content',
  },
  {
    id: 'delivery',
    label: 'Post Delivery',
    shortLabel: 'Deliver',
    icon: Mail,
    color: '#7a9e87',
    glowColor: 'rgba(122,158,135,0.18)',
    description: 'Sends posts to your inbox',
  },
];

/* ─── Dot indicator ─── */
function StepDots({ current, statuses }: { current: number; statuses: StepStatus[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {PIPELINE_STEPS.map((step, idx) => (
        <div
          key={step.id}
          className="rounded-full transition-all duration-300"
          style={{
            width: idx === current ? '20px' : '6px',
            height: '6px',
            backgroundColor:
              idx === current
                ? step.color
                : statuses[idx] === 'complete'
                ? '#7a9e87'
                : 'rgba(180,160,140,0.35)',
          }}
        />
      ))}
    </div>
  );
}

/* ─── Main Page ─── */
export default function StudioPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  /* pipeline state */
  const [loadingPipeline, setLoadingPipeline] = useState(false);
  const [runningGap, setRunningGap] = useState(false);
  const [generatingPosts, setGeneratingPosts] = useState(false);
  const [sendingPostEmail, setSendingPostEmail] = useState(false);
  const [liveStatus, setLiveStatus] = useState('');
  const [progress, setProgress] = useState(0);

  /* results */
  const [results, setResults] = useState<any[]>([]);
  const [influencers, setInfluencers] = useState<any[]>([]);
  const [selectedInfluencers, setSelectedInfluencers] = useState<any[]>([]);
  const [gapAnalysisData, setGapAnalysisData] = useState<any | null>(null);
  const [postResults, setPostResults] = useState<any[]>([]);
  const [scrapedInfluencerData, setScrapedInfluencerData] = useState<any | null>(null);
  const [scrapeTargetUrl, setScrapeTargetUrl] = useState('');
  const [phantombusterUrl, setPhantombusterUrl] = useState('');
  const [scrapingPosts, setScrapingPosts] = useState(false);

  /* UI */
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [runningStepIdx, setRunningStepIdx] = useState(-1);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [navigate, user]);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      try {
        const res = await api.get(`/pipeline/results/${user.id}`);
        const all = res.data.results || [];
        setResults(all);
        const infRes = all.find((r: any) => r.agent_name?.includes('Influence'));
        setInfluencers(infRes?.output?.influencers || []);
        setPostResults(all.filter((r: any) => String(r.agent_name || '').includes('Post Generator')));
      } catch {
        setResults([]);
      }
    };
    void load();
  }, [user]);

  useEffect(() => {
    if (selectedInfluencers.length > 0) {
      setScrapeTargetUrl(selectedInfluencers[0].link || '');
    }
  }, [selectedInfluencers]);

  /* live polling */
  useEffect(() => {
    let interval: number | undefined;
    if (loadingPipeline && user) {
      interval = window.setInterval(async () => {
        try {
          const res = await api.get(`/pipeline/live-status/${user.id}`);
          if (res.data?.active) {
            const msg = String(res.data.message || '');
            setLiveStatus(msg);
            if (msg.includes('Resume')) { setProgress(20); setRunningStepIdx(0); setActiveStepIdx(0); }
            else if (msg.includes('Brand')) { setProgress(45); setRunningStepIdx(1); setActiveStepIdx(1); }
            else if (msg.includes('Scout') || msg.includes('Influence')) { setProgress(75); setRunningStepIdx(2); setActiveStepIdx(2); }
          }
        } catch { /* ignore */ }
      }, 1500);
    }
    return () => { if (interval) window.clearInterval(interval); };
  }, [loadingPipeline, user]);

  /* step statuses */
  const stepStatuses = useMemo((): StepStatus[] => {
    return PIPELINE_STEPS.map((_, idx) => {
      if (loadingPipeline) {
        if (idx < runningStepIdx) return 'complete';
        if (idx === runningStepIdx) return 'running';
        return 'idle';
      }
      if (idx === 0) return results.some(r => String(r.agent_name || '').includes('Resume')) ? 'complete' : 'idle';
      if (idx === 1) return results.some(r => String(r.agent_name || '').includes('Brand Voice')) ? 'complete' : 'idle';
      if (idx === 2) return results.some(r => String(r.agent_name || '').includes('Influence')) ? 'complete' : 'idle';
      if (idx === 3) return gapAnalysisData ? 'complete' : 'idle';
      if (idx === 4) return postResults.length > 0 ? 'complete' : 'idle';
      if (idx === 5) return results.some(r => String(r.agent_name || '').includes('Post Delivery')) ? 'complete' : 'idle';
      return 'idle';
    });
  }, [results, loadingPipeline, runningStepIdx, gapAnalysisData, postResults]);

  /* active result for display */
  const activeResult = useMemo(() => {
    if (activeStepIdx === 0) return results.find(r => String(r.agent_name || '').includes('Resume')) || null;
    if (activeStepIdx === 1) return results.find(r => String(r.agent_name || '').includes('Brand Voice')) || null;
    if (activeStepIdx === 2) return results.find(r => String(r.agent_name || '').includes('Influence')) || null;
    if (activeStepIdx === 3) return results.find(r => String(r.agent_name || '').includes('Gap Analysis')) || null;
    if (activeStepIdx === 4) return postResults[postResults.length - 1] || results.find(r => String(r.agent_name || '').includes('Post Generator')) || null;
    if (activeStepIdx === 5) return results.find(r => String(r.agent_name || '').includes('Post Delivery')) || null;
    return null;
  }, [activeStepIdx, results, postResults]);

  const latestGeneratedPostOutput = useMemo(() => {
    const r = [...postResults].reverse().find(r => String(r.agent_name || '').includes('Post Generator'));
    return r?.output || null;
  }, [postResults]);

  /* actions */
  const runPipeline = async () => {
    if (!user) return;
    setLoadingPipeline(true);
    setLiveStatus('Starting pipeline…');
    setProgress(5);
    setResults([]); setInfluencers([]); setSelectedInfluencers([]);
    setGapAnalysisData(null); setPostResults([]); setScrapedInfluencerData(null);
    setScrapeTargetUrl(''); setPhantombusterUrl('');
    setRunningStepIdx(0); setActiveStepIdx(0);
    try {
      const res = await api.post('/pipeline/run', { user_id: user.id });
      const all = res.data.results || [];
      setResults(all);
      const inf = all.find((r: any) => r.agent_name?.includes('Influence'));
      setInfluencers(inf?.output?.influencers || []);
      setProgress(100);
      setActiveStepIdx(2);
      toast.success('Pipeline complete — select influencers to continue.');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Pipeline failed.');
    } finally {
      setLoadingPipeline(false);
      setLiveStatus('');
      setProgress(0);
      setRunningStepIdx(-1);
    }
  };

  const toggleInfluencer = (inf: any) => {
    setSelectedInfluencers(prev => {
      const key = inf.link || inf.title;
      return prev.some(i => (i.link || i.title) === key)
        ? prev.filter(i => (i.link || i.title) !== key)
        : [...prev, inf];
    });
  };

  const runGapAnalysis = async (): Promise<boolean> => {
    if (!user || (selectedInfluencers.length === 0 && !scrapedInfluencerData)) {
      toast.error('Select or scrape at least one LinkedIn URL first.');
      return false;
    }
    setRunningGap(true);
    try {
      const influencerData = scrapedInfluencerData ? [scrapedInfluencerData] : selectedInfluencers;
      const res = await api.post('/pipeline/gap-analysis', { user_id: user.id, influencer_data: influencerData });
      const next = res.data.results || [];
      const gap = next.find((r: any) => r.agent_name?.includes('Gap Analysis'));
      setGapAnalysisData(gap?.output || null);
      setResults(prev => [...prev, ...next]);
      toast.success('Gap analysis completed.');
      return true;
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Gap analysis failed.');
      return false;
    } finally { setRunningGap(false); }
  };

  const scrapeSelectedUrl = async (): Promise<boolean> => {
    if (!user || !scrapeTargetUrl.trim()) {
      toast.error('Select or enter a LinkedIn URL first.');
      return false;
    }

    setScrapingPosts(true);
    try {
      const payload: any = {
        user_id: user.id,
        selected_url: scrapeTargetUrl.trim(),
      };

      if (phantombusterUrl.trim()) {
        payload.phantombuster_url = phantombusterUrl.trim();
      }

      const res = await api.post('/pipeline/scrape-linkedin-posts', payload);
      const next = res.data.results || [];
      const scrape = next.find((r: any) => r.agent_name?.includes('Scraper')) || next[0];
      const scrapedOutput = scrape?.output || null;

      if (scrapedOutput) {
        setScrapedInfluencerData({
          ...(selectedInfluencers[0] || {}),
          link: scrapedOutput.selected_url || scrapeTargetUrl.trim(),
          scraped_posts: scrapedOutput.scrape_response,
          scraped_source: scrapedOutput.phantombuster_url,
        });
      }

      setResults(prev => [...prev, ...next]);
      toast.success('LinkedIn URL scraped successfully.');
      return true;
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'LinkedIn scraping failed.');
      return false;
    } finally {
      setScrapingPosts(false);
    }
  };

  const generatePosts = async (): Promise<boolean> => {
    if (!user || !gapAnalysisData) { toast.error('Complete gap analysis first.'); return false; }
    setGeneratingPosts(true);
    try {
      const res = await api.post('/pipeline/generate-posts', { user_id: user.id, gap_analysis_data: gapAnalysisData });
      const next = res.data.results || [];
      setPostResults(next);
      setResults(prev => [...prev, ...next]);
      toast.success('Posts generated successfully.');
      return true;
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Post generation failed.');
      return false;
    } finally { setGeneratingPosts(false); }
  };

  const sendToEmail = async (): Promise<boolean> => {
    if (!user || !latestGeneratedPostOutput) { toast.error('Generate posts first.'); return false; }
    setSendingPostEmail(true);
    try {
      const payload = { user_id: user.id, posts_data: latestGeneratedPostOutput };
      let res: any;
      try { res = await api.post('/pipeline/send-post-email', payload); }
      catch (e: any) {
        if (e?.response?.status === 404) res = await api.post('/pipeline/send-reminder', payload);
        else throw e;
      }
      toast.success(res.data?.message || 'Posts sent to email.');
      const refreshed = await api.get(`/pipeline/results/${user.id}`);
      setResults(refreshed.data.results || []);
      return true;
    } catch (err: any) {
      toast.error(String(err?.response?.data?.detail || err?.message || 'Failed to send email.'));
      return false;
    } finally { setSendingPostEmail(false); }
  };

  const handleNextStep = async () => {
    if (activeStepIdx === 2) {
      const completed = await runGapAnalysis();
      if (completed) setActiveStepIdx(3);
      return;
    }

    if (activeStepIdx === 3) {
      const completed = await generatePosts();
      if (completed) setActiveStepIdx(4);
      return;
    }

    if (activeStepIdx === 4) {
      const completed = await sendToEmail();
      if (completed) setActiveStepIdx(5);
      return;
    }

    setActiveStepIdx(Math.min(PIPELINE_STEPS.length - 1, activeStepIdx + 1));
  };

  const currentStep = PIPELINE_STEPS[activeStepIdx];
  const currentStatus = stepStatuses[activeStepIdx];
  const StepIcon = currentStep.icon;
  const nextStepLabel =
    activeStepIdx === 2
      ? (runningGap ? 'Analyzing…' : 'Gap Analysis')
      : activeStepIdx === 3
        ? (generatingPosts ? 'Generating…' : 'Generate Posts')
        : activeStepIdx === 4
          ? (sendingPostEmail ? 'Sending…' : 'Send Email')
          : activeStepIdx < PIPELINE_STEPS.length - 1
            ? PIPELINE_STEPS[activeStepIdx + 1].shortLabel
            : 'Done';
  const nextButtonDisabled =
    activeStepIdx === 2
      ? runningGap || (selectedInfluencers.length === 0 && !scrapedInfluencerData)
      : activeStepIdx === 3
        ? generatingPosts || !gapAnalysisData
        : activeStepIdx === 4
          ? sendingPostEmail || !latestGeneratedPostOutput
          : activeStepIdx === PIPELINE_STEPS.length - 1;

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: 'var(--cream)' }}>
      <div className="relative z-10 flex h-screen overflow-hidden">

        {/* ═══════════════════════════════════════════
            LEFT SIDEBAR — Agent Pipeline Stepper
        ═══════════════════════════════════════════ */}
        <aside
          className="flex flex-col w-72 shrink-0 overflow-y-auto"
          style={{
            background: 'rgba(255,255,255,0.82)',
            borderRight: '1px solid rgba(180,160,140,0.2)',
            backdropFilter: 'blur(28px)',
            boxShadow: '4px 0 30px rgba(50,40,30,0.08)',
          }}
        >
          {/* Logo */}
          <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: '1px solid rgba(180,160,140,0.2)' }}>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: '#c9714f',
                boxShadow: '0 4px 12px rgba(50,40,30,0.12)',
              }}
            >
              <Sparkles size={18} color="#fff" />
            </div>
            <div>
              <div className="font-bold text-[15px] text-[#1c1a17]" style={{ fontFamily: "'DM Sans',sans-serif" }}>PostPilot AI</div>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(90,85,80,0.5)', letterSpacing: '0.12em' }}>Pipeline Studio</div>
            </div>
          </div>

          {/* User chip */}
          <div className="px-5 py-3.5 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(180,160,140,0.15)' }}>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(212,162,75,0.2), rgba(201,113,79,0.18))',
                border: '1.5px solid rgba(180,160,140,0.4)',
                color: '#5a5550',
                boxShadow: 'none',
              }}
            >
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#1c1a17]/90 truncate">{user?.username || 'Creator'}</div>
              <div className="text-[10px] truncate" style={{ color: 'rgba(90,85,80,0.5)' }}>{user?.email}</div>
            </div>
          </div>

          {/* Run Pipeline CTA */}
          <div className="px-4 py-4" style={{ borderBottom: '1px solid rgba(180,160,140,0.15)' }}>
            <button
              id="run-pipeline-btn"
              onClick={runPipeline}
              disabled={loadingPipeline}
              className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-bold py-3.5 transition-all duration-300 disabled:cursor-not-allowed"
              style={{
                background: loadingPipeline
                  ? 'rgba(201,113,79,0.14)'
                  : '#1c1a17',
                border: `1px solid ${loadingPipeline ? 'rgba(201,113,79,0.35)' : 'rgba(180,160,140,0.25)'}`,
                color: loadingPipeline ? '#5a5550' : '#faf7f2',
                boxShadow: loadingPipeline
                  ? 'none'
                  : '0 4px 14px rgba(50,40,30,0.14)',
                opacity: loadingPipeline ? 0.85 : 1,
                letterSpacing: '0.03em',
              }}
            >
              {loadingPipeline
                ? <Loader2 size={16} className="animate-spin" />
                : <Play size={15} />}
              {loadingPipeline ? 'Running pipeline…' : 'Run Pipeline'}
            </button>

            <AnimatePresence>
              {liveStatus && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 10 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="rounded-xl px-3.5 py-2.5 text-[11px] leading-relaxed"
                  style={{
                    background: 'rgba(201,113,79,0.08)',
                    border: '1px solid rgba(201,113,79,0.24)',
                    color: 'rgba(90,85,80,0.85)',
                    boxShadow: 'none',
                  }}
                >
                  <Zap size={10} className="inline mr-1.5 mb-0.5" style={{ color: '#c9714f' }} />
                  {liveStatus}
                </motion.div>
              )}
            </AnimatePresence>

            {loadingPipeline && (
              <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(180,160,140,0.15)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg,#c9714f,#d4a24b,#7a9e87,#c9714f)', backgroundSize: '200% 100%' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            )}
          </div>

          {/* ── Vertical Stepper ── */}
          <div className="flex-1 px-3 py-5 overflow-y-auto">
            <div className="text-[9px] uppercase tracking-widest px-2 mb-3" style={{ color: 'rgba(90,85,80,0.5)' }}>
              Pipeline Steps
            </div>

            {/* Connector line container */}
            <div className="relative">
              {/* Thin vertical rail */}
              <div
                className="absolute top-5 bottom-5"
                style={{ left: '22px', width: '1px', background: 'rgba(180,160,140,0.15)' }}
              />

              <div className="space-y-1">
                {PIPELINE_STEPS.map((step, idx) => {
                  const status = stepStatuses[idx];
                  const isActive = activeStepIdx === idx;
                  const isDone = status === 'complete';
                  const isRunning = status === 'running';
                  const StepIconComp = step.icon;

                  return (
                    <button
                      key={step.id}
                      id={`pipeline-step-${step.id}`}
                      onClick={() => setActiveStepIdx(idx)}
                      className="relative w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-200"
                      style={{
                        background: isActive ? `${step.color}12` : 'transparent',
                        border: `1px solid ${isActive ? `${step.color}30` : 'transparent'}`,
                        boxShadow: 'none',
                      }}
                    >
                      {/* Icon circle */}
                      <div
                        className="relative z-10 w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300"
                        style={{
                          background: isDone
                            ? 'rgba(16,185,129,0.15)'
                            : isRunning || isActive
                            ? `${step.color}18`
                            : 'rgba(180,160,140,0.12)',
                          border: `1.5px solid ${
                            isDone
                              ? 'rgba(16,185,129,0.45)'
                              : isRunning || isActive
                              ? `${step.color}55`
                              : 'rgba(180,160,140,0.2)'
                          }`,
                          boxShadow: 'none',
                        }}
                      >
                        {isDone ? (
                          <CheckCircle2 size={16} style={{ color: '#7a9e87' }} />
                        ) : isRunning ? (
                          <Loader2 size={16} className="animate-spin" style={{ color: step.color }} />
                        ) : (
                          <StepIconComp size={15} style={{ color: isActive ? step.color : 'rgba(90,85,80,0.55)' }} />
                        )}

                        {/* Pulse ring while running */}
                        {isRunning && (
                          <span
                            className="absolute inset-0 rounded-xl animate-ping opacity-25"
                            style={{ backgroundColor: step.color, borderRadius: '10px' }}
                          />
                        )}
                      </div>

                      {/* Label */}
                      <div className="min-w-0 flex-1">
                        <div
                          className="text-[13px] font-semibold leading-none mb-1.5 transition-colors"
                          style={{
                            color: isActive ? 'rgba(28,26,23,0.9)' : isDone ? 'rgba(28,26,23,0.75)' : 'rgba(90,85,80,0.65)',
                          }}
                        >
                          {step.label}
                        </div>
                        <div className="text-[10px] leading-none truncate" style={{ color: 'rgba(90,85,80,0.4)' }}>
                          {step.description}
                        </div>
                      </div>

                      {/* Status pill */}
                      <div
                        className="shrink-0 text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full"
                        style={{
                          background: isDone
                            ? 'rgba(16,185,129,0.15)'
                            : isRunning
                            ? `${step.color}20`
                            : isActive
                            ? 'rgba(180,160,140,0.2)'
                            : 'transparent',
                          color: isDone
                            ? '#34d399'
                            : isRunning
                            ? step.color
                            : isActive
                            ? 'rgba(90,85,80,0.8)'
                            : 'rgba(180,160,140,0.4)',
                          border: isDone
                            ? '1px solid rgba(16,185,129,0.25)'
                            : isRunning
                            ? `1px solid ${step.color}40`
                            : 'none',
                        }}
                      >
                        {isDone ? '✓' : isRunning ? 'Live' : isActive ? 'Open' : `${idx + 1}`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sign out */}
          <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(180,160,140,0.15)' }}>
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all"
              style={{ color: 'rgba(90,85,80,0.65)', transition: 'all 0.2s' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = '#c9714f';
                (e.currentTarget as HTMLElement).style.background = 'rgba(201,113,79,0.08)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,113,79,0.2)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = 'rgba(90,85,80,0.65)';
                (e.currentTarget as HTMLElement).style.background = 'transparent';
                (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
              }}
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </aside>

        {/* ═══════════════════════════════════════════
            MAIN CONTENT AREA
        ═══════════════════════════════════════════ */}
        <main className="flex-1 flex flex-col overflow-hidden">

          {/* Top header bar */}
          <header
            className="shrink-0 flex items-center justify-between px-7 py-4"
            style={{
              background: 'rgba(255,255,255,0.95)',
              borderBottom: '1px solid rgba(180,160,140,0.2)',
              backdropFilter: 'blur(24px)',
              boxShadow: '0 2px 20px rgba(50,40,30,0.05)',
            }}
          >
            <div className="flex items-center gap-4">
              {/* Step icon */}
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-500"
                style={{
                  background: `${currentStep.color}1A`,
                  border: `1.5px solid ${currentStep.color}50`,
                  boxShadow: 'none',
                }}
              >
                <StepIcon size={20} style={{ color: currentStep.color }} />
              </div>

              <div>
                <div className="font-bold text-[17px] text-[#1c1a17] leading-none mb-1">{currentStep.label}</div>
                <div className="text-[11px]" style={{ color: 'rgba(90,85,80,0.65)' }}>{currentStep.description}</div>
              </div>

              {/* Status chip */}
              <div
                className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                style={{
                  background: currentStatus === 'complete'
                    ? 'rgba(16,185,129,0.15)'
                    : currentStatus === 'running'
                    ? `${currentStep.color}18`
                    : 'rgba(180,160,140,0.15)',
                  border: `1px solid ${
                    currentStatus === 'complete'
                      ? 'rgba(16,185,129,0.35)'
                      : currentStatus === 'running'
                      ? `${currentStep.color}45`
                      : 'rgba(180,160,140,0.25)'
                  }`,
                  color:
                    currentStatus === 'complete'
                      ? '#7a9e87'
                      : currentStatus === 'running'
                      ? currentStep.color
                      : 'rgba(90,85,80,0.55)',
                }}
              >
                {currentStatus === 'complete' ? '✓ Complete' : currentStatus === 'running' ? '⚡ Running' : 'Idle'}
              </div>
            </div>

            {/* Dot progress */}
            <div className="flex items-center gap-3">
              <span className="text-xs" style={{ color: 'rgba(90,85,80,0.55)' }}>
                {activeStepIdx + 1} / {PIPELINE_STEPS.length}
              </span>
              <StepDots current={activeStepIdx} statuses={stepStatuses} />
            </div>
          </header>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-7 space-y-5 max-w-5xl mx-auto">

              {/* ── Agent Output Card (hidden on Influencer Scout to avoid duplicate panels) ── */}
              {activeStepIdx !== 2 && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStepIdx}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                  >
                    {activeResult ? (
                      /* Has result — render AgentCard */
                      <div>
                        <div
                          className="flex items-center gap-2 px-4 py-3 rounded-t-2xl"
                          style={{
                            background: `${currentStep.color}10`,
                            border: `1px solid ${currentStep.color}25`,
                            borderBottom: 'none',
                          }}
                        >
                          <Cpu size={14} style={{ color: currentStep.color }} />
                          <span className="text-xs font-semibold" style={{ color: 'rgba(28,26,23,0.7)' }}>
                            Agent Output
                          </span>
                          <span className="ml-auto text-[10px]" style={{ color: 'rgba(90,85,80,0.5)' }}>
                            {activeResult.agent_name}
                          </span>
                        </div>
                        <div
                          className="rounded-b-2xl overflow-hidden"
                          style={{
                            border: `1px solid ${currentStep.color}25`,
                            borderTop: 'none',
                          }}
                        >
                          <AgentCard data={activeResult} index={activeStepIdx} />
                        </div>
                      </div>
                    ) : currentStatus === 'running' ? (
                      /* Running state */
                      <div
                        className="rounded-2xl flex flex-col items-center justify-center py-24 gap-5"
                        style={{
                          background: 'rgba(255,255,255,0.8)',
                          border: `1px solid ${currentStep.color}30`,
                          boxShadow: '0 8px 24px rgba(50,40,30,0.08)',
                        }}
                      >
                        <div className="relative">
                          <div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center"
                            style={{ background: `${currentStep.color}18`, border: `1.5px solid ${currentStep.color}45` }}
                          >
                            <Loader2 size={30} className="animate-spin" style={{ color: currentStep.color }} />
                          </div>
                          <span
                            className="absolute inset-0 rounded-2xl animate-ping opacity-15"
                            style={{ background: currentStep.color }}
                          />
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-[#1c1a17]/80 mb-1">{currentStep.label} is running</div>
                          <div className="text-sm" style={{ color: 'rgba(90,85,80,0.65)' }}>{liveStatus || 'Processing your data…'}</div>
                        </div>
                      </div>
                    ) : (
                      /* Empty / idle state */
                      <div
                        className="rounded-2xl flex flex-col items-center justify-center py-24 gap-5 text-center"
                        style={{
                          background: 'rgba(255,255,255,0.6)',
                          border: `1px dashed ${currentStep.color}20`,
                        }}
                      >
                        <div
                          className="w-16 h-16 rounded-2xl flex items-center justify-center"
                          style={{ background: `${currentStep.color}0D`, border: `1px solid ${currentStep.color}20` }}
                        >
                          <StepIcon size={28} style={{ color: `${currentStep.color}55` }} />
                        </div>
                        <div>
                          <div className="font-semibold text-[#1c1a17]/35 mb-1">No output yet</div>
                          <div className="text-sm max-w-xs" style={{ color: 'rgba(90,85,80,0.45)' }}>
                            {activeStepIdx === 0 ? 'Click "Run Pipeline" in the sidebar to start.' :
                             activeStepIdx === 3 ? 'Select influencers (Step 3), then run Gap Analysis below.' :
                             activeStepIdx === 4 ? 'Complete Gap Analysis (Step 4) first, then generate posts below.' :
                             activeStepIdx === 5 ? 'Generate posts (Step 5) first, then send to email below.' :
                             'Run the pipeline first.'}
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}

              {/* ── Step 2 (idx=2): Influencer selection panel ── */}
              {activeStepIdx === 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl p-6"
                  style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(59,130,246,0.2)' }}
                >
                  <div className="flex items-center gap-3 mb-5">
                    <Users size={17} style={{ color: '#60a5fa' }} />
                    <div className="font-semibold text-[#1c1a17]/85">Select Influencer Benchmarks</div>
                    {selectedInfluencers.length > 0 && (
                      <span
                        className="text-[11px] px-2.5 py-1 rounded-full font-bold"
                        style={{ background: 'rgba(59,130,246,0.2)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)' }}
                      >
                        {selectedInfluencers.length} selected
                      </span>
                    )}
                  </div>

                  {influencers.length > 0 ? (
                    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {influencers.map((inf, idx) => {
                        const key = inf.link || inf.title;
                        const checked = selectedInfluencers.some(i => (i.link || i.title) === key);
                        return (
                          <button
                            key={idx}
                            onClick={() => toggleInfluencer(inf)}
                            className="text-left p-4 rounded-xl transition-all duration-200"
                            style={{
                              background: checked ? 'rgba(59,130,246,0.15)' : 'rgba(180,160,140,0.1)',
                              border: `1px solid ${checked ? 'rgba(59,130,246,0.5)' : 'rgba(180,160,140,0.2)'}`,
                              boxShadow: checked ? '0 0 14px rgba(59,130,246,0.15)' : 'none',
                            }}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="font-semibold text-sm text-[#1c1a17]/85 leading-snug line-clamp-2">
                                {inf.title || `Influencer ${idx + 1}`}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {inf.link ? (
                                  <a
                                    href={inf.link}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-5 h-5 rounded-full flex items-center justify-center"
                                    style={{ border: '1px solid rgba(90,85,80,0.45)', color: 'rgba(28,26,23,0.85)' }}
                                    title="Open LinkedIn profile"
                                  >
                                    <ExternalLink size={11} />
                                  </a>
                                ) : null}
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center transition-all"
                                  style={{
                                    background: checked ? '#3b82f6' : 'transparent',
                                    border: `2px solid ${checked ? '#3b82f6' : 'rgba(90,85,80,0.4)'}`,
                                  }}
                                >
                                  {checked && <CheckCircle2 size={10} className="text-[#1c1a17]" />}
                                </div>
                              </div>
                            </div>
                            <p className="text-[11px] leading-relaxed line-clamp-2" style={{ color: 'rgba(90,85,80,0.7)' }}>
                              {inf.snippet || 'LinkedIn benchmark candidate.'}
                            </p>
                            {inf.link ? (
                              <a
                                href={inf.link}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="mt-2 inline-block text-[11px] underline underline-offset-2"
                                style={{ color: 'rgba(74,91,140,0.9)' }}
                              >
                                {inf.link}
                              </a>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-10 text-center text-sm rounded-xl" style={{ color: 'rgba(90,85,80,0.5)', border: '1px dashed rgba(180,160,140,0.2)' }}>
                      Run the pipeline first to load influencers
                    </div>
                  )}

                  <div className="mt-5 rounded-2xl p-4 md:p-5" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(180,160,140,0.2)' }}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
                      <div>
                        <div className="font-semibold text-[#1c1a17]/85">Scrape selected LinkedIn URL</div>
                        <div className="text-xs mt-1" style={{ color: 'rgba(90,85,80,0.7)' }}>
                          Uses the selected profile URL and sends it to your PhantomBuster endpoint.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { void scrapeSelectedUrl(); }}
                        disabled={scrapingPosts || !scrapeTargetUrl.trim()}
                        className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed"
                        style={{
                          background: scrapingPosts ? 'rgba(201,113,79,0.14)' : '#1c1a17',
                          color: '#faf7f2',
                          border: '1px solid rgba(180,160,140,0.25)',
                          opacity: scrapingPosts ? 0.8 : 1,
                        }}
                      >
                        {scrapingPosts ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                        {scrapingPosts ? 'Scraping…' : 'Scrape URL'}
                      </button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        value={scrapeTargetUrl}
                        onChange={(e) => setScrapeTargetUrl(e.target.value)}
                        placeholder="Selected LinkedIn URL"
                        className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                        style={{ background: 'rgba(180,160,140,0.1)', border: '1px solid rgba(180,160,140,0.2)', color: 'rgba(28,26,23,0.98)' }}
                      />
                      <input
                        value={phantombusterUrl}
                        onChange={(e) => setPhantombusterUrl(e.target.value)}
                        placeholder="PhantomBuster URL or webhook (optional)"
                        className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                        style={{ background: 'rgba(180,160,140,0.1)', border: '1px solid rgba(180,160,140,0.2)', color: 'rgba(28,26,23,0.98)' }}
                      />
                    </div>

                    <div className="text-[11px] mt-3" style={{ color: 'rgba(90,85,80,0.6)' }}>
                      If the PhantomBuster field is empty, the backend uses PHANTOMBUSTER_SCRAPER_URL or PHANTOMBUSTER_WEBHOOK_URL from backend/.env.
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Step 3 (idx=3): Gap Analysis action ── */}
              {activeStepIdx === 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl p-6"
                  style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(245,158,11,0.2)' }}
                >
                  <div className="font-semibold text-[#1c1a17]/85 mb-1">Run Gap Analysis</div>
                  <div className="text-sm" style={{ color: 'rgba(90,85,80,0.7)' }}>
                    {selectedInfluencers.length > 0 || scrapedInfluencerData
                      ? `Ready to analyze ${selectedInfluencers.length} influencer(s) vs your brand. Use the bottom-right button to run it.`
                      : 'Select an influencer or scrape a LinkedIn URL before running gap analysis.'}
                  </div>
                </motion.div>
              )}

              {/* ── Step 4 (idx=4): Generate Posts action ── */}
              {activeStepIdx === 4 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl p-6"
                  style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(16,185,129,0.2)' }}
                >
                  <div className="font-semibold text-[#1c1a17]/85 mb-1">Generate LinkedIn Posts</div>
                  <div className="text-sm" style={{ color: 'rgba(90,85,80,0.7)' }}>
                    {gapAnalysisData
                      ? 'Gap data is ready. Use the bottom-right button to generate personalised posts.'
                      : 'Complete gap analysis first to unlock post generation.'}
                  </div>
                </motion.div>
              )}

              {/* ── Step 5 (idx=5): Send to email action ── */}
              {activeStepIdx === 5 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl p-6"
                  style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(244,63,94,0.2)' }}
                >
                  <div className="font-semibold text-[#1c1a17]/85 mb-1">Send Posts to Your Email</div>
                  <div className="text-sm" style={{ color: 'rgba(90,85,80,0.7)' }}>
                    {latestGeneratedPostOutput
                      ? `Deliver generated posts to ${user?.email}. Use the bottom-right button to send them.`
                      : 'Generate posts first to unlock email delivery.'}
                  </div>
                </motion.div>
              )}

            </div>
          </div>

          {/* ── Bottom Prev / Next navigation ── */}
          <footer
            className="shrink-0 flex items-center justify-between px-7 py-4"
            style={{
              background: 'rgba(255,255,255,0.95)',
              borderTop: '1px solid rgba(180,160,140,0.2)',
              backdropFilter: 'blur(24px)',
              boxShadow: 'none',
            }}
          >
            <button
              id="prev-step-btn"
              onClick={() => setActiveStepIdx(Math.max(0, activeStepIdx - 1))}
              disabled={activeStepIdx === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed"
              style={{
                background: activeStepIdx > 0 ? 'rgba(180,160,140,0.15)' : 'rgba(180,160,140,0.1)',
                border: `1px solid ${activeStepIdx > 0 ? 'rgba(180,160,140,0.3)' : 'rgba(180,160,140,0.15)'}`,
                color: activeStepIdx > 0 ? 'rgba(28,26,23,0.8)' : 'rgba(90,85,80,0.55)',
              }}
            >
              <ArrowLeft size={15} />
              {activeStepIdx > 0 ? PIPELINE_STEPS[activeStepIdx - 1].shortLabel : 'Start'}
            </button>

            {/* Mini step name with glow */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="text-[11px] font-bold tracking-wide"
                style={{
                  color: currentStep.color,
                  textShadow: 'none',
                }}
              >
                {currentStep.label}
              </div>
              <StepDots current={activeStepIdx} statuses={stepStatuses} />
            </div>

            <button
              id="next-step-btn"
              onClick={handleNextStep}
              disabled={nextButtonDisabled}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed"
              style={{
                background:
                  activeStepIdx < PIPELINE_STEPS.length - 1
                    ? 'rgba(28,26,23,0.95)'
                    : 'rgba(180,160,140,0.1)',
                border: `1px solid ${
                  activeStepIdx < PIPELINE_STEPS.length - 1
                    ? 'rgba(28,26,23,0.95)'
                    : 'rgba(180,160,140,0.15)'
                }`,
                color: activeStepIdx < PIPELINE_STEPS.length - 1 ? '#faf7f2' : 'rgba(90,85,80,0.55)',
                boxShadow: 'none',
              }}
            >
              {nextStepLabel}
              <ArrowRight size={15} />
            </button>
          </footer>
        </main>
      </div>
    </div>
  );
}
