import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Cpu, FileText,
  LogOut, Play, Sparkles, Users, Target,
  Loader2, Bot, Zap, ExternalLink, Upload,
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

interface InfluencerAnalysisDraft {
  profileFile: File | null;
  manualPosts: string;
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
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  /* pipeline state */
  const [loadingPipeline, setLoadingPipeline] = useState(false);
  const [runningGap, setRunningGap] = useState(false);
  const [liveStatus, setLiveStatus] = useState('');
  const [progress, setProgress] = useState(0);

  /* results */
  const [results, setResults] = useState<any[]>([]);
  const [influencers, setInfluencers] = useState<any[]>([]);
  const [selectedInfluencers, setSelectedInfluencers] = useState<any[]>([]);
  const [selectedInfluencerDrafts, setSelectedInfluencerDrafts] = useState<Record<string, InfluencerAnalysisDraft>>({});
  const [gapAnalysisData, setGapAnalysisData] = useState<any | null>(null);
  const [customInfluencerUrl, setCustomInfluencerUrl] = useState('');
  const [customInfluencerError, setCustomInfluencerError] = useState('');
  const [pastPostsInput, setPastPostsInput] = useState('');
  const detectedPastPostsCount = useMemo(() => {
    if (!pastPostsInput || !pastPostsInput.trim()) return 0;
    return pastPostsInput.split(/\n\s*\n/).filter(p => p.trim() !== '').length;
  }, [pastPostsInput]);

  /* UI */
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [runningStepIdx, setRunningStepIdx] = useState(-1);

  /* upload states */
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [addingCustomInfluencer, setAddingCustomInfluencer] = useState(false);

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
      } catch {
        setResults([]);
      }
    };
    void load();
  }, [user]);

  useEffect(() => {
    setSelectedInfluencerDrafts((prev) => {
      const nextDrafts: Record<string, InfluencerAnalysisDraft> = {};

      selectedInfluencers.forEach((influencer) => {
        const key = String(influencer.link || influencer.title || influencer.name || '');
        nextDrafts[key] = prev[key] || { profileFile: null, manualPosts: '' };
      });

      return nextDrafts;
    });
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

  const cachedResumeResult = useMemo(() => {
    if (!user?.parsed_profile_cache) return null;
    return {
      agent_name: 'Resume Parser Agent',
      agent_description: 'Extracts personal info, experience, skills, education, and all details from your resume using AI',
      status: 'success',
      output: { parsed_profile: user.parsed_profile_cache },
      error: null,
      is_saved: false,
    };
  }, [user?.parsed_profile_cache]);

  const cachedBrandResult = useMemo(() => {
    if (!user?.brand_voice_cache) return null;
    return {
      agent_name: 'Brand Voice & Persona Agent',
      agent_description: 'Generates your professional identity, brand voice, and personal summary based on your profile',
      status: 'success',
      output: { brand_analysis: user.brand_voice_cache },
      error: null,
      is_saved: false,
    };
  }, [user?.brand_voice_cache]);

  const cachedInfluencerResult = useMemo(() => {
    if (!user?.influencer_scout_cache) return null;
    return {
      agent_name: 'Influence & Idol Scout Agent',
      agent_description: 'Finds your industry idols and top LinkedIn influencers matching your professional domain',
      status: 'success',
      output: user.influencer_scout_cache,
      error: null,
      is_saved: false,
    };
  }, [user?.influencer_scout_cache]);

  const getLatestResult = (agentNeedle: string) => {
    const liveResult = [...results].reverse().find((r) => String(r.agent_name || '').includes(agentNeedle)) || null;
    if (liveResult) return liveResult;
    if (agentNeedle.includes('Resume')) return cachedResumeResult;
    if (agentNeedle.includes('Brand Voice')) return cachedBrandResult;
    if (agentNeedle.includes('Influence')) return cachedInfluencerResult;
    return null;
  };

  /* step statuses */
  const stepStatuses = useMemo((): StepStatus[] => {
    return PIPELINE_STEPS.map((_, idx) => {
      if (loadingPipeline) {
        if (idx < runningStepIdx) return 'complete';
        if (idx === runningStepIdx) return 'running';
        return 'idle';
      }
      if (idx === 0) return getLatestResult('Resume Parser') ? 'complete' : 'idle';
      if (idx === 1) return getLatestResult('Brand Voice') ? 'complete' : 'idle';
      if (idx === 2) return getLatestResult('Influence') ? 'complete' : 'idle';
      if (idx === 3) return gapAnalysisData ? 'complete' : 'idle';
      return 'idle';
    });
  }, [results, loadingPipeline, runningStepIdx, gapAnalysisData, cachedResumeResult, cachedBrandResult, cachedInfluencerResult]);

  /* active result for display */
  const activeResult = useMemo(() => {
    if (activeStepIdx === 0) return getLatestResult('Resume Parser');
    if (activeStepIdx === 1) return getLatestResult('Brand Voice');
    if (activeStepIdx === 2) return getLatestResult('Influence');
    if (activeStepIdx === 3) return results.find(r => String(r.agent_name || '').includes('Gap Analysis')) || null;
    return null;
  }, [activeStepIdx, results, cachedResumeResult, cachedBrandResult, cachedInfluencerResult]);

  const pipelineStage = useMemo(() => {
    if (!getLatestResult('Resume Parser')) return 'resume_parser';
    if (!getLatestResult('Brand Voice')) return 'brand_voice';
    if (!getLatestResult('Influence')) return 'influencer';
    return 'done';
  }, [results, user?.parsed_profile_cache, user?.brand_voice_cache, user?.influencer_scout_cache]);

  const refreshPipelineResults = async () => {
    const refreshed = await api.get(`/pipeline/results/${user?.id}`);
    const all = refreshed.data.results || [];
    setResults(all);
    const latestInfluence = [...all].reverse().find((r: any) => String(r.agent_name || '').includes('Influence'));
    const cachedInfluencers = user?.influencer_scout_cache?.influencers || [];
    setInfluencers(latestInfluence?.output?.influencers || cachedInfluencers);
    return all;
  };

  const resetDownstreamState = (stage: 'resume_parser' | 'brand_voice' | 'influencer') => {
    setSelectedInfluencers([]);
    setSelectedInfluencerDrafts({});
    setGapAnalysisData(null);

    if (stage === 'resume_parser') {
      setInfluencers([]);
    }
  };

  /* actions */
  const runPipeline = async () => {
    if (!user) return;
    if (pipelineStage === 'done') {
      toast.success('Resume parser, brand voice, and influencer stages are already complete.');
      setActiveStepIdx(2);
      return;
    }

    const stageToRun = pipelineStage;

    await runPipelineStage(stageToRun);
  };

  const runPipelineStage = async (stageToRun: 'resume_parser' | 'brand_voice' | 'influencer') => {
    if (!user) return;

    setLoadingPipeline(true);
    setLiveStatus(
      stageToRun === 'resume_parser'
        ? 'Running resume parser…'
        : stageToRun === 'brand_voice'
          ? 'Running brand voice…'
          : 'Running influencer scout…'
    );
    setProgress(stageToRun === 'resume_parser' ? 15 : stageToRun === 'brand_voice' ? 55 : 80);
    setRunningStepIdx(stageToRun === 'resume_parser' ? 0 : stageToRun === 'brand_voice' ? 1 : 2);
    setActiveStepIdx(stageToRun === 'resume_parser' ? 0 : stageToRun === 'brand_voice' ? 1 : 2);
    try {
      await api.post('/pipeline/run-stage', { user_id: user.id, stage: stageToRun });
      await refreshPipelineResults();
      resetDownstreamState(stageToRun);
      setProgress(100);
      toast.success(
        stageToRun === 'resume_parser'
          ? 'Resume parser completed and saved.'
          : stageToRun === 'brand_voice'
            ? 'Brand voice completed and saved.'
            : 'Influencer scout completed and saved.'
      );
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Pipeline stage failed.');
    } finally {
      setLoadingPipeline(false);
      setLiveStatus('');
      setProgress(0);
      setRunningStepIdx(-1);
    }
  };

  const runAgainForCurrentStep = async () => {
    if (loadingPipeline || runningGap) return;
    if (!user) return;

    if (activeStepIdx === 0) {
      await runPipelineStage('resume_parser');
      return;
    }
    if (activeStepIdx === 1) {
      await runPipelineStage('brand_voice');
      return;
    }
    if (activeStepIdx === 2) {
      await runPipelineStage('influencer');
      return;
    }
    if (activeStepIdx === 3) {
      await runGapAnalysis();
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      setUploadFiles(prev => [...prev, ...droppedFiles].slice(0, 10));
    }
  };

  const handleUploadResume = async () => {
    if (!user) return;
    if (uploadFiles.length === 0) {
      toast.error('Please select at least one document to upload.');
      return;
    }

    setUploadingResume(true);
    const formData = new FormData();
    formData.append('user_id', String(user.id));
    uploadFiles.forEach(file => {
      formData.append('documents', file);
    });

    try {
      const res = await api.post('/pipeline/upload-resume', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Documents uploaded successfully!');

      // Update Auth context user so local storage and state is updated immediately
      updateUser({
        resume_path: res.data.resume_path,
        resume_filename: res.data.resume_filename,
        parsed_profile_cache: null,
        brand_voice_cache: null,
        influencer_scout_cache: null,
        selected_influencer_cache: null,
      });

      // Clear local upload state
      setUploadFiles([]);

      // Clear results in state so UI updates
      setResults([]);

      // We can also trigger the resume parser run stage automatically!
      await runPipelineStage('resume_parser');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to upload documents.');
    } finally {
      setUploadingResume(false);
    }
  };

  const toggleInfluencer = (inf: any) => {
    setSelectedInfluencers(prev => {
      const key = inf.link || inf.title;
      const isCurrentlySelected = prev.some(i => (i.link || i.title) === key);

      if (!isCurrentlySelected && prev.length >= 3) {
        toast.error('You can only select up to 3 influencers at a time to stay within limits.');
        return prev;
      }

      return isCurrentlySelected
        ? prev.filter(i => (i.link || i.title) !== key)
        : [...prev, inf];
    });
  };

  const handleAddCustomInfluencer = async () => {
    const input = customInfluencerUrl.trim();
    if (!input) return;

    setAddingCustomInfluencer(true);
    setCustomInfluencerError('');

    try {
      const res = await api.post('/pipeline/verify-custom-influencer', { url_or_name: input });
      const verifiedInfluencer = res.data;

      const alreadyExists = influencers.some(i => i.link === verifiedInfluencer.link);
      if (!alreadyExists) {
        setInfluencers(prev => [...prev, verifiedInfluencer]);
      }

      // Auto-toggle / select it
      setSelectedInfluencers(prev => {
        const isCurrentlySelected = prev.some(i => i.link === verifiedInfluencer.link);
        if (isCurrentlySelected) return prev;
        if (prev.length >= 3) {
          toast.error('Influencer verified and added! (Could not auto-select: Max limit of 3 selected influencers reached.)');
          return prev;
        }
        toast.success(`Successfully found & verified ${verifiedInfluencer.title} on LinkedIn!`);
        return [...prev, verifiedInfluencer];
      });

      setCustomInfluencerUrl('');
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Could not verify or find this profile. Please make sure the URL exists or try searching by full name.';
      setCustomInfluencerError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setAddingCustomInfluencer(false);
    }
  };

  const getInfluencerKey = (inf: any) => String(inf.link || inf.title || inf.name || '');

  const updateInfluencerDraft = (key: string, updates: Partial<InfluencerAnalysisDraft>) => {
    setSelectedInfluencerDrafts((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || { profileFile: null, manualPosts: '' }),
        ...updates,
      },
    }));
  };

  const runGapAnalysis = async (): Promise<boolean> => {
    if (!user || selectedInfluencers.length === 0) {
      toast.error('Select at least one LinkedIn URL first.');
      return false;
    }

    // Clear old data to prevent showing stale results
    setGapAnalysisData(null);
    setResults(prev => prev.filter(r => !r.agent_name?.includes('Gap Analysis')));

    setRunningGap(true);
    try {
      const analyzedInfluencers = selectedInfluencers.map((influencer, idx) => {
        const key = getInfluencerKey(influencer);
        const draft = selectedInfluencerDrafts[key];
        const manualPosts = String(draft?.manualPosts || '').trim();
        return {
          ...influencer,
          selection_index: idx,
          manual_post_samples: manualPosts,
        };
      });

      const formData = new FormData();
      formData.append('user_id', String(user.id));
      formData.append('selected_influencers_json', JSON.stringify(analyzedInfluencers));
      formData.append('user_past_posts', pastPostsInput.trim());

      analyzedInfluencers.forEach((influencer, idx) => {
        const key = getInfluencerKey(influencer);
        const draft = selectedInfluencerDrafts[key];
        const profileFile = draft?.profileFile;
        if (profileFile) {
          formData.append('profile_files', profileFile, profileFile.name);
        } else {
          formData.append('profile_files', new File([''], `${key || `influencer-${idx}`}-placeholder.txt`, { type: 'text/plain' }));
        }
      });

      const res = await api.post('/pipeline/gap-analysis-context', formData);
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

  const handleNextStep = async () => {
    if (activeStepIdx < 3 && pipelineStage !== 'done') {
      await runPipeline();
      return;
    }

    if (activeStepIdx === 2) {
      const completed = await runGapAnalysis();
      if (completed) setActiveStepIdx(3);
      return;
    }

    if (activeStepIdx === 3) {
      navigate('/dashboard');
      return;
    }

    setActiveStepIdx(Math.min(PIPELINE_STEPS.length - 1, activeStepIdx + 1));
  };

  const currentStep = PIPELINE_STEPS[activeStepIdx];
  const currentStatus = stepStatuses[activeStepIdx];
  const StepIcon = currentStep.icon;
  const nextStepLabel =
    pipelineStage === 'resume_parser'
      ? (loadingPipeline ? 'Parsing…' : (user?.resume_path ? 'Run Resume Parser' : 'Upload Resume'))
      : pipelineStage === 'brand_voice'
        ? (loadingPipeline ? 'Building…' : 'Run Brand Voice')
        : pipelineStage === 'influencer'
          ? (loadingPipeline ? 'Finding…' : 'Run Influencer Scout')
          : activeStepIdx === 2
            ? (runningGap ? 'Analyzing…' : 'Gap Analysis')
            : activeStepIdx < PIPELINE_STEPS.length - 1
              ? PIPELINE_STEPS[activeStepIdx + 1].shortLabel
              : 'Go to Dashboard';
  const nextButtonDisabled =
    pipelineStage !== 'done' && activeStepIdx < 3
      ? (pipelineStage === 'resume_parser' && !user?.resume_path ? true : loadingPipeline)
      : activeStepIdx === 2
        ? runningGap || selectedInfluencers.length === 0
        : false;

  return (
    <div className="relative min-h-screen overflow-hidden text-[#1c1a17]" style={{ background: '#ede9e3ff' }}>
      <div className="relative z-10 flex h-screen overflow-hidden">

        {/* ═══════════════════════════════════════════
            LEFT SIDEBAR — Agent Pipeline Stepper
        ═══════════════════════════════════════════ */}
        <aside
          className="flex flex-col w-72 shrink-0 overflow-y-auto"
          style={{
            background: '#eeebe6ff',
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
              disabled={loadingPipeline || (pipelineStage === 'resume_parser' && !user?.resume_path)}
              className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-bold py-3.5 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: loadingPipeline
                  ? 'rgba(201,113,79,0.14)'
                  : '#1c1a17',
                border: `1px solid ${loadingPipeline ? 'rgba(201,113,79,0.35)' : 'rgba(180,160,140,0.25)'}`,
                color: loadingPipeline ? '#5a5550' : '#faf7f2',
                boxShadow: loadingPipeline
                  ? 'none'
                  : '0 4px 14px rgba(50,40,30,0.14)',
                opacity: (loadingPipeline || (pipelineStage === 'resume_parser' && !user?.resume_path)) ? 0.5 : 1,
                letterSpacing: '0.03em',
              }}
            >
              {loadingPipeline
                ? <Loader2 size={16} className="animate-spin" />
                : <Play size={15} />}
              {loadingPipeline
                ? 'Running stage…'
                : pipelineStage === 'resume_parser'
                  ? (user?.resume_path ? 'Run Resume Parser' : 'Upload Resume')
                  : pipelineStage === 'brand_voice'
                    ? 'Run Brand Voice'
                    : pipelineStage === 'influencer'
                      ? 'Run Influencer Scout'
                      : 'Pipeline Complete'}
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
                      onClick={() => {
                        const previousStepsComplete = PIPELINE_STEPS.slice(0, idx).every((_, pIdx) => stepStatuses[pIdx] === 'complete');
                        if (idx > 0 && !previousStepsComplete) {
                          toast.error(`Please run and complete the previous steps first.`);
                          return;
                        }
                        setActiveStepIdx(idx);
                      }}
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
                          border: `1.5px solid ${isDone
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
                            ? 'rgba(180,160,140,0.2)'
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
                  border: `1px solid ${currentStatus === 'complete'
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
                          <AgentCard
                            data={activeResult}
                            index={activeStepIdx}
                            onRunAgain={runAgainForCurrentStep}
                            isRunning={loadingPipeline || runningGap}
                            projectId={user?.id}
                          />
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
                    ) : activeStepIdx === 0 && !user?.resume_path ? (
                      /* Resume / profile documents upload zone */
                      <div
                        className="rounded-2xl flex flex-col p-8 gap-6"
                        style={{
                          background: 'rgba(255,255,255,0.8)',
                          border: '1px solid rgba(201,113,79,0.25)',
                          boxShadow: '0 8px 30px rgba(50,40,30,0.06)',
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: 'rgba(201,113,79,0.1)', border: '1px solid rgba(201,113,79,0.25)' }}
                          >
                            <FileText size={18} style={{ color: '#c9714f' }} />
                          </div>
                          <div>
                            <h3 className="font-bold text-[16px] text-[#1c1a17] leading-none mb-1">Upload Profile Documents</h3>
                            <p className="text-[11px]" style={{ color: 'rgba(90,85,80,0.6)' }}>
                              Add your resume or LinkedIn profile PDFs to build context.
                            </p>
                          </div>
                        </div>

                        <div
                          onDragEnter={handleDrag}
                          onDragOver={handleDrag}
                          onDragLeave={handleDrag}
                          onDrop={handleDrop}
                          onClick={() => document.getElementById('resume-upload-input')?.click()}
                          className="relative rounded-2xl border-2 border-dashed flex flex-col items-center justify-center py-10 px-4 cursor-pointer transition-all duration-300"
                          style={{
                            borderColor: dragActive ? '#c9714f' : 'rgba(180,160,140,0.3)',
                            background: dragActive ? 'rgba(201,113,79,0.04)' : 'rgba(180,160,140,0.03)',
                          }}
                        >
                          <input
                            type="file"
                            id="resume-upload-input"
                            multiple
                            accept=".pdf,.doc,.docx"
                            onChange={(e) => {
                              if (e.target.files) {
                                const filesArray = Array.from(e.target.files);
                                setUploadFiles(prev => [...prev, ...filesArray].slice(0, 10));
                              }
                            }}
                            className="hidden"
                          />
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                            style={{ background: 'rgba(201,113,79,0.08)' }}
                          >
                            <Upload size={20} style={{ color: '#c9714f' }} />
                          </div>
                          <span className="text-sm font-semibold text-[#1c1a17]/85 mb-1">
                            {dragActive ? 'Drop files here' : 'Drag & drop your files here'}
                          </span>
                          <span className="text-[11px]" style={{ color: 'rgba(90,85,80,0.5)' }}>
                            or click to browse from your device (PDF, DOC, DOCX up to 10 files)
                          </span>
                        </div>

                        {uploadFiles.length > 0 && (
                          <div className="flex flex-col gap-2 p-3.5 rounded-xl" style={{ background: 'rgba(122,158,135,0.06)', border: '1px solid rgba(122,158,135,0.2)' }}>
                            <div className="text-[11px] font-bold uppercase tracking-wider text-[#7a9e87] mb-1">
                              Selected Documents
                            </div>
                            <div className="space-y-2">
                              {uploadFiles.map((file, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-2 rounded-lg bg-white/60 border border-black/5"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <CheckCircle2 size={13} style={{ color: '#7a9e87' }} className="shrink-0" />
                                    <span className="text-xs font-medium text-[#1c1a17]/85 truncate max-w-[280px]">
                                      {file.name}
                                    </span>
                                    <span className="text-[9px]" style={{ color: 'rgba(90,85,80,0.45)' }}>
                                      ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                    </span>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setUploadFiles(prev => prev.filter((_, i) => i !== idx));
                                    }}
                                    className="text-[10px] font-bold text-red-500 hover:text-red-700 transition-colors px-2 py-0.5 rounded hover:bg-red-50"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <button
                          onClick={handleUploadResume}
                          disabled={uploadingResume || uploadFiles.length === 0}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-300 disabled:opacity-50"
                          style={{
                            background: '#c9714f',
                            color: '#fff',
                            boxShadow: '0 4px 14px rgba(201,113,79,0.2)',
                          }}
                        >
                          {uploadingResume ? (
                            <>
                              <Loader2 size={15} className="animate-spin" />
                              Uploading & Processing...
                            </>
                          ) : (
                            <>
                              <Sparkles size={14} />
                              Initialize Setup with {uploadFiles.length} Document{uploadFiles.length !== 1 ? 's' : ''}
                            </>
                          )}
                        </button>
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
                            {activeStepIdx === 0 ? 'Click "Run Resume Parser" in the sidebar to start.' :
                              activeStepIdx === 2 ? 'Select influencers (Step 3), then run Gap Analysis below.' :
                                activeStepIdx === 3 ? 'Complete Gap Analysis (Step 4) first, then generate prompt below.' :
                                  activeStepIdx === 4 ? 'Generate prompt (Step 5) first, then send to email below.' :
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
                    <button
                      onClick={runAgainForCurrentStep}
                      disabled={loadingPipeline}
                      className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all hover:bg-black/10 disabled:opacity-50"
                      style={{ color: 'rgba(90,85,80,0.6)', border: '1px solid rgba(180,160,140,0.2)' }}
                    >
                      <Play size={10} className={loadingPipeline ? 'animate-spin' : ''} />
                      Refresh Results
                    </button>
                  </div>

                  <div className="mb-4 text-xs font-medium px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-900/80">
                    💡 <strong>Limit:</strong> You can only select up to <strong>3 influencers</strong> at a time. The AI will compare your profile against them in the next step.
                  </div>

                  {influencers.length > 0 ? (
                    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {influencers.slice(0, 6).map((inf, idx) => {
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

                  {/* ── Custom LinkedIn URL input ── */}
                  <div className="mt-4 rounded-xl p-4" style={{ background: 'rgba(201,113,79,0.06)', border: '1px solid rgba(201,113,79,0.2)' }}>
                    <div className="font-semibold text-sm text-[#1c1a17]/85 mb-1 flex items-center gap-2">
                      <ExternalLink size={14} style={{ color: '#c9714f' }} />
                      Add Your Own LinkedIn Influencer
                    </div>
                    <p className="text-[11px] mb-3" style={{ color: 'rgba(90,85,80,0.65)' }}>
                      Enter a LinkedIn profile URL or simply type their full name. The AI will search and verify that their profile exists on LinkedIn using Google.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        disabled={addingCustomInfluencer}
                        value={customInfluencerUrl}
                        onChange={e => { setCustomInfluencerUrl(e.target.value); setCustomInfluencerError(''); }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !addingCustomInfluencer) {
                            handleAddCustomInfluencer();
                          }
                        }}
                        placeholder="e.g. Kristin Kehrer OR https://www.linkedin.com/in/kristen-kehrer-datamovesme/"
                        className="flex-1 px-3 py-2 text-sm rounded-lg outline-none disabled:opacity-50"
                        style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(201,113,79,0.3)', color: '#1c1a17' }}
                      />
                      <button
                        onClick={handleAddCustomInfluencer}
                        disabled={addingCustomInfluencer || !customInfluencerUrl.trim()}
                        className="px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 disabled:cursor-not-allowed"
                        style={{
                          background: addingCustomInfluencer ? 'rgba(201,113,79,0.3)' : '#c9714f',
                          color: '#fff',
                          opacity: (addingCustomInfluencer || !customInfluencerUrl.trim()) ? 0.6 : 1,
                        }}
                      >
                        {addingCustomInfluencer ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Verifying…
                          </>
                        ) : (
                          'Add'
                        )}
                      </button>
                    </div>
                    {customInfluencerError && (
                      <p className="text-xs mt-1.5" style={{ color: '#c9714f' }}>{customInfluencerError}</p>
                    )}
                  </div>

                  {selectedInfluencers.length > 0 ? (
                    <div className="mt-5 rounded-2xl p-4 md:p-5" style={{ background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(180,160,140,0.22)' }}>
                      <div className="flex flex-col gap-2 mb-4">
                        <div className="font-semibold text-[#1c1a17]/90">Selected Influencers for Gap Analysis</div>
                        <div className="text-xs" style={{ color: 'rgba(90,85,80,0.68)' }}>
                          Upload one PDF profile for each selected influencer and paste any supporting post samples. These are used to sharpen the gap analysis.
                        </div>
                      </div>

                      <div className="grid gap-4 xl:grid-cols-2">
                        {selectedInfluencers.map((inf, idx) => {
                          const key = getInfluencerKey(inf);
                          const draft = selectedInfluencerDrafts[key] || { profileFile: null, manualPosts: '' };

                          return (
                            <div key={key || idx} className="rounded-2xl border border-[rgba(180,160,140,0.22)] bg-white/80 p-4 shadow-[0_4px_20px_rgba(50,40,30,0.05)]">
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="min-w-0">
                                  <div className="font-semibold text-[#1c1a17] truncate">{inf.title || inf.name || `Influencer ${idx + 1}`}</div>
                                  {inf.link ? (
                                    <a
                                      href={inf.link}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-1 inline-flex text-[11px] underline underline-offset-2 break-all"
                                      style={{ color: 'rgba(74,91,140,0.92)' }}
                                    >
                                      {inf.link}
                                    </a>
                                  ) : null}
                                </div>
                                <div className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full" style={{ background: 'rgba(201,113,79,0.12)', color: 'rgba(201,113,79,0.95)' }}>
                                  Ready
                                </div>
                              </div>

                              <div className="space-y-3">
                                <label className="block">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-2" style={{ color: 'rgba(90,85,80,0.7)' }}>
                                    Upload profile PDF
                                  </div>
                                  <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={(e) => updateInfluencerDraft(key, { profileFile: e.target.files?.[0] || null })}
                                    className="w-full rounded-xl border border-[rgba(180,160,140,0.2)] bg-[rgba(180,160,140,0.08)] px-3 py-2 text-sm"
                                    style={{ color: 'rgba(28,26,23,0.95)' }}
                                  />
                                </label>

                                {draft.profileFile ? (
                                  <div className="text-[11px] px-3 py-2 rounded-xl bg-black/5 border border-black/10" style={{ color: 'rgba(90,85,80,0.78)' }}>
                                    Selected file: {draft.profileFile.name}
                                  </div>
                                ) : (
                                  <div className="text-[11px] px-3 py-2 rounded-xl bg-black/5 border border-dashed border-black/10" style={{ color: 'rgba(90,85,80,0.55)' }}>
                                    No profile PDF selected yet.
                                  </div>
                                )}

                                <label className="block">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-2" style={{ color: 'rgba(90,85,80,0.7)' }}>
                                    Paste influencer posts / notes
                                  </div>
                                  <textarea
                                    value={draft.manualPosts}
                                    onChange={(e) => updateInfluencerDraft(key, { manualPosts: e.target.value })}
                                    placeholder="Paste sample posts or notes from this influencer..."
                                    className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-y"
                                    style={{ background: 'rgba(180,160,140,0.1)', border: '1px solid rgba(180,160,140,0.2)', color: 'rgba(28,26,23,0.98)', minHeight: '120px' }}
                                  />
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-4 rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(180,160,140,0.18)' }}>
                        <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] mb-2" style={{ color: 'rgba(90,85,80,0.7)' }}>
                          Your last 10 LinkedIn posts
                        </label>
                        <textarea
                          value={pastPostsInput}
                          onChange={(e) => setPastPostsInput(e.target.value)}
                          placeholder="Paste your own recent posts here so the model can capture your emotion, cadence, and voice..."
                          className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-y"
                          style={{ background: 'rgba(180,160,140,0.1)', border: '1px solid rgba(180,160,140,0.2)', color: 'rgba(28,26,23,0.98)', minHeight: '140px' }}
                        />
                        <div className="mt-2 text-[11px]" style={{ color: 'rgba(90,85,80,0.65)' }}>
                          Detected posts: {Math.min(detectedPastPostsCount, 10)} / 10 (split by blank lines).
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Scrape URL UI removed */}
                </motion.div>
              )}

              {/* ── Step 3 (idx=3): Gap Analysis action ── */}
              {activeStepIdx === 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl p-6"
                  style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(180,160,140,0.2)' }}
                >
                  <div className="font-semibold text-[#1c1a17] mb-1">Gap Analysis Ready</div>
                  <div className="text-sm" style={{ color: 'rgba(90,85,80,0.7)' }}>
                    The uploaded influencer PDFs, pasted influencer samples, and your own posts were used to generate the gap analysis.
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
                border: `1px solid ${activeStepIdx < PIPELINE_STEPS.length - 1
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
