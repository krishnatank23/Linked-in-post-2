import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  CheckCircle2, 
  Mail, 
  PenTool, 
  Play, 
  RefreshCw, 
  Sparkles, 
  User,
  ChevronRight, 
  Globe, 
  BarChart3, 
  Clock3, 
  UserCheck, 
  Copy, 
  Check,
  Send 
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import AgentCard, { ScheduleCalendar } from '../components/AgentCard';
export default function DashboardPage() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPosts, setGeneratingPosts] = useState(false);
  const [sendingPostEmail, setSendingPostEmail] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/pipeline/results/${user.id}`);
        setResults(response.data.results || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [navigate, user]);

  const gapResult = useMemo(() => {
    return [...results].reverse().find((result) => String(result.agent_name || '').includes('Gap Analysis')) || null;
  }, [results]);

  const gapAnalysisData = gapResult?.output || null;

  const postResults = useMemo(() => {
    return results.filter((r: any) => String(r.agent_name || '').includes('Prompt Generator'));
  }, [results]);

  const latestPostResult = useMemo(() => {
    return postResults[postResults.length - 1] || null;
  }, [postResults]);

  const deliveryResult = useMemo(() => {
    return [...results].reverse().find((result) => String(result.agent_name || '').includes('Prompt Delivery')) || null;
  }, [results]);

  // Single source of truth for suggested posting days: gap analysis recommended_days
  const suggestedDays: string[] = useMemo(() => {
    if (!gapAnalysisData) return [];
    const strategy = gapAnalysisData.overall_content_strategy || gapAnalysisData.content_strategy || {};
    return strategy.recommended_days || [];
  }, [gapAnalysisData]);

  const generatePosts = async (targetDay?: string) => {
    if (!user) return;
    if (!gapAnalysisData) {
      toast.error('You need to complete Gap Analysis in the Studio first.');
      navigate('/studio');
      return;
    }

    setGeneratingPosts(true);
    try {
      const res = await api.post('/pipeline/generate-posts', {
        user_id: user.id,
        gap_analysis_data: gapAnalysisData,
        user_past_posts: '',
        target_day: targetDay,
      });
      const next = res.data.results || [];
      setResults(prev => [...prev, ...next]);
      toast.success('Prompt generated successfully.');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Post generation failed.');
    } finally {
      setGeneratingPosts(false);
    }
  };

  const generateBulkPosts = async () => {
    if (!user) return;
    if (!gapAnalysisData) {
      toast.error('You need to complete Gap Analysis in the Studio first.');
      navigate('/studio');
      return;
    }

    setGeneratingPosts(true);
    try {
      const res = await api.post('/pipeline/generate-bulk-prompts', {
        user_id: user.id,
        gap_analysis_data: gapAnalysisData,
        user_past_posts: '',
      });
      const next = res.data.results || [];
      setResults(prev => [...prev, ...next]);
      toast.success('Weekly prompts generated successfully in bulk.');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Bulk generation failed.');
    } finally {
      setGeneratingPosts(false);
    }
  };


  const sendToEmail = async () => {
    if (!user || !latestPostResult?.output) return;

    setSendingPostEmail(true);
    try {
      const payload = {
        user_id: user.id,
        posts_data: latestPostResult.output,
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

      toast.success(response.data?.message || `Sent to ${user.email}`);
      const refreshed = await api.get(`/pipeline/results/${user.id}`);
      setResults(refreshed.data.results || []);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to send email.');
    } finally {
      setSendingPostEmail(false);
    }
  };

  const resetSetup = async () => {
    if (!user) return;
    if (!window.confirm("Are you sure you want to reset your setup? This will clear your resume and profile data, but keep your generated prompts. You'll need to run the Setup Studio again.")) return;

    try {
      await api.post('/pipeline/reset-setup', { user_id: user.id });
      updateUser({
        resume_path: null,
        resume_filename: null,
        parsed_profile_cache: null,
        brand_voice_cache: null,
        influencer_scout_cache: null,
        selected_influencer_cache: null,
      });
      toast.success('Setup reset successfully.');
      navigate('/studio');
    } catch (err: any) {
      toast.error('Failed to reset setup.');
    }
  };

  return (
    <div className="min-h-screen bg-[#ede9e3ff] text-[#1c1a17]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#eeebe6ff]/80 backdrop-blur-xl border-b border-black/5 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#c9714f] flex items-center justify-center text-white shadow-lg shadow-[#c9714f]/20">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="font-bold text-[15px]">PostPilot Dashboard</div>
            <div className="text-[10px] uppercase tracking-widest text-black/40">Daily Content Hub</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={resetSetup} className="px-4 py-2 text-sm font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200">
            Reset Setup
          </button>
          <Link to="/studio" className="px-4 py-2 text-sm font-semibold text-black/60 hover:text-black bg-black/5 hover:bg-black/10 rounded-lg transition-colors">
            Setup Studio
          </Link>
          <button onClick={() => { logout(); navigate('/'); }} className="px-4 py-2 text-sm font-semibold text-white bg-black hover:bg-black/80 rounded-lg transition-colors">
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-heading mb-2">Welcome back, {user?.username}</h1>
          <p className="text-black/60">Generate your daily LinkedIn prompts and manage your content calendar.</p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-black/50">Loading your dashboard...</div>
        ) : !gapAnalysisData ? (
          <div className="bg-white p-8 rounded-2xl border border-black/10 text-center shadow-sm">
            <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center mx-auto mb-4 text-black/40">
              <Sparkles size={24} />
            </div>
            <h2 className="text-xl font-bold mb-2">Complete Your Setup</h2>
            <p className="text-black/60 mb-6 max-w-md mx-auto">You need to run the Resume Parser, Brand Voice, and Gap Analysis in the Studio before generating prompts.</p>
            <Link to="/studio" className="inline-flex items-center gap-2 px-6 py-3 bg-[#c9714f] text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-transform">
              Go to Studio <ArrowRight size={18} />
            </Link>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Small Profile Status Bar */}
            <div className="flex flex-wrap items-center gap-4 py-3 px-5 bg-white/50 backdrop-blur-md rounded-2xl border border-black/[0.05] shadow-sm">
              <div className="flex items-center gap-2 pr-4 border-r border-black/5">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-black/40">Status:</span>
                <span className="text-xs font-bold text-green-600">Setup Complete</span>
              </div>
              <div className="flex items-center gap-2 pr-4 border-r border-black/5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-black/40">Voice:</span>
                <span className="text-xs font-bold text-black/70">{user?.brand_voice_cache?.tone_of_voice || 'Optimized'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-black/40">User:</span>
                <span className="text-xs font-bold text-black/70">{user?.username}</span>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="space-y-6">
              {/* Generated Prompt Content */}
              {!latestPostResult ? (
                <div className="bg-white p-10 rounded-2xl border border-black/10 shadow-sm text-center">
                  <div className="w-16 h-16 bg-[#c9714f]/10 rounded-full flex items-center justify-center mx-auto mb-4 text-[#c9714f]">
                    <PenTool size={24} />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Create Your Master Prompt</h2>
                  <p className="text-black/60 mb-8 max-w-sm mx-auto">Generate your daily LinkedIn prompt based on your completed Gap Analysis strategy.</p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      onClick={() => generatePosts()}
                      disabled={generatingPosts}
                      className="inline-flex py-3.5 px-8 bg-[#c9714f] text-white font-bold rounded-xl shadow-lg shadow-[#c9714f]/20 hover:scale-[1.02] transition-all disabled:opacity-70 disabled:hover:scale-100 items-center justify-center gap-2"
                    >
                      {generatingPosts ? <RefreshCw size={18} className="animate-spin" /> : <Play size={18} />}
                      {generatingPosts ? 'Crafting AI Prompt...' : 'Generate Master Prompt'}
                    </button>
                    <button
                      onClick={generateBulkPosts}
                      disabled={generatingPosts}
                      className="inline-flex py-3.5 px-8 bg-black text-white font-bold rounded-xl shadow-lg shadow-black/20 hover:scale-[1.02] transition-all disabled:opacity-70 disabled:hover:scale-100 items-center justify-center gap-2"
                    >
                      {generatingPosts ? <RefreshCw size={18} className="animate-spin" /> : <Sparkles size={18} />}
                      {generatingPosts ? 'Generating...' : 'Bulk Generate All Days'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-bold flex items-center gap-2"><Sparkles size={18} className="text-[#c9714f]" /> Your Generated Prompt</h2>
                    <button
                      onClick={generatePosts}
                      disabled={generatingPosts}
                      className="px-4 py-2 text-sm font-semibold bg-black/5 hover:bg-black/10 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {generatingPosts ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      Regenerate
                    </button>
                  </div>
                  
                  <AgentCard data={latestPostResult} index={0} />

                  <div className="pt-8 flex justify-center">
                    <button
                      onClick={() => navigate('/delivery')}
                      className="px-10 py-4 bg-black text-white font-bold rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 text-lg"
                    >
                      Next: Email Delivery <Send size={20} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
