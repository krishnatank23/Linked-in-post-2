import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  CheckCircle2, 
  Mail, 
  RefreshCw, 
  Sparkles,
  Send,
  Clock3,
  X,
  Copy,
  Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function DeliveryPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingPostEmail, setSendingPostEmail] = useState(false);
  const [generatingDays, setGeneratingDays] = useState<Record<string, boolean>>({});
  const [selectedPrompt, setSelectedPrompt] = useState<any>(null);

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
    const rawResults = results.filter((r: any) => String(r.agent_name || '').includes('Prompt Generator') && r.status === 'success');
    
    // Deduplicate by keeping only the latest per target_day
    const latestPerDay = new Map<string, any>();
    rawResults.forEach((r: any) => {
      const day = r.output?.target_day || 'master';
      latestPerDay.set(day, r);
    });
    
    return Array.from(latestPerDay.values());
  }, [results]);

  const latestPostResult = useMemo(() => {
    return postResults[postResults.length - 1] || null;
  }, [postResults]);

  const generatedPromptByDay = useMemo(() => {
    const map = new Map<string, any>();
    postResults.forEach((r: any) => {
      const day = String(r.output?.target_day || 'master');
      map.set(day, r.output);
    });
    return map;
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

  const sendToEmail = async () => {
    // Use the already-deduplicated postResults
    const allPrompts = postResults.map((r: any) => r.output);

    if (!user || allPrompts.length === 0) {
      toast.error('No generated prompts found to deliver.');
      return;
    }

    setSendingPostEmail(true);
    try {
      const payload = {
        user_id: user.id,
        posts_data: allPrompts.length > 1 ? { generation_type: 'batch_prompts', prompts: allPrompts } : allPrompts[0],
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

      toast.success(response.data?.message || `All content delivered to ${user.email}`);
      const refreshed = await api.get(`/pipeline/results/${user.id}`);
      setResults(refreshed.data.results || []);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to send email.');
    } finally {
      setSendingPostEmail(false);
    }
  };

  const [generatingAll, setGeneratingAll] = useState(false);

  const generatePosts = async (targetDay?: string) => {
    if (!user) return;
    if (!gapAnalysisData) {
      toast.error('Strategic data not found. Please complete Setup Studio first.');
      return;
    }

    if (targetDay) {
      setGeneratingDays(prev => ({ ...prev, [targetDay]: true }));
    } else {
      setGeneratingDays(prev => ({ ...prev, 'master': true }));
    }

    try {
      const res = await api.post('/pipeline/generate-posts', {
        user_id: user.id,
        gap_analysis_data: gapAnalysisData,
        user_past_posts: '',
        target_day: targetDay,
      });
      const next = res.data.results || [];
      setResults(prev => [...prev, ...next]);
      
      // Find the newly generated prompt result
      const newPrompt = next.find((r: any) => String(r.agent_name || '').includes('Prompt Generator'));
      if (newPrompt?.output) {
        setSelectedPrompt(newPrompt.output);
      }
      
      toast.success(targetDay ? `Prompt for ${targetDay} generated!` : 'Prompt generated!');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Post generation failed.');
    } finally {
      if (targetDay) {
        setGeneratingDays(prev => ({ ...prev, [targetDay]: false }));
      } else {
        setGeneratingDays(prev => ({ ...prev, 'master': false }));
      }
    }
  };

  const generateAllDays = async () => {
    if (!user) return;
    if (!gapAnalysisData) {
      toast.error('Strategic data not found. Please complete Setup Studio first.');
      return;
    }

    const days: string[] = suggestedDays.length > 0 ? suggestedDays : ['Monday', 'Wednesday', 'Friday'];
    
    setGeneratingAll(true);
    // Mark all days as generating
    const allBusy: Record<string, boolean> = {};
    days.forEach((d: string) => { allBusy[d] = true; });
    setGeneratingDays(prev => ({ ...prev, ...allBusy }));

    let successCount = 0;

    for (const day of days) {
      try {
        const res = await api.post('/pipeline/generate-posts', {
          user_id: user.id,
          gap_analysis_data: gapAnalysisData,
          user_past_posts: '',
          target_day: day,
        });
        const next = res.data.results || [];
        setResults(prev => [...prev, ...next]);
        successCount++;

        // Mark this day as done
        setGeneratingDays(prev => ({ ...prev, [day]: false }));
        toast.success(`Prompt for ${day} generated!`);
      } catch (err: any) {
        setGeneratingDays(prev => ({ ...prev, [day]: false }));
        toast.error(`Failed to generate for ${day}.`);
      }
    }

    setGeneratingAll(false);
    if (successCount === days.length) {
      toast.success(`All ${days.length} daily prompts generated successfully!`);
    }
  };

  return (
    <div className="min-h-screen bg-[#ede9e3ff] text-[#1c1a17]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#eeebe6ff]/80 backdrop-blur-xl border-b border-black/5 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#c9714f] flex items-center justify-center text-white shadow-lg shadow-[#c9714f]/20">
            <Send size={18} />
          </div>
          <div>
            <div className="font-bold text-[15px]">Delivery Center</div>
            <div className="text-[10px] uppercase tracking-widest text-black/40">Secure Content Dispatch</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="px-4 py-2 text-sm font-semibold text-black/60 hover:text-black bg-black/5 hover:bg-black/10 rounded-lg transition-colors flex items-center gap-2">
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
          <button onClick={() => { logout(); navigate('/'); }} className="px-4 py-2 text-sm font-semibold text-white bg-black hover:bg-black/80 rounded-lg transition-colors">
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold font-heading mb-3 tracking-tight">Final Step: Content Delivery</h1>
          <p className="text-black/60 max-w-lg mx-auto">Review your generated content one last time and deliver it straight to your inbox for publishing.</p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-black/50">Accessing delivery channels...</div>
        ) : !latestPostResult ? (
          <div className="bg-white p-12 rounded-3xl border border-black/10 text-center shadow-xl">
            <div className="w-20 h-20 bg-black/5 rounded-full flex items-center justify-center mx-auto mb-6 text-black/20">
              <Mail size={32} />
            </div>
            <h2 className="text-2xl font-bold mb-3">No Prompt Ready</h2>
            <p className="text-black/60 mb-8 max-w-md mx-auto">You need to generate a prompt in the Dashboard before you can access the delivery center.</p>
            <Link to="/dashboard" className="inline-flex items-center gap-2 px-8 py-4 bg-[#c9714f] text-white font-bold rounded-2xl shadow-lg hover:scale-105 transition-transform">
              Back to Dashboard <ArrowLeft size={18} />
            </Link>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Delivery Card */}
            <div className="bg-white p-10 rounded-3xl border border-black/10 shadow-xl overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Mail size={120} />
              </div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 bg-[#7a9e87]/10 rounded-2xl flex items-center justify-center text-[#7a9e87]">
                    <Mail size={28} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Email Delivery</h2>
                    <p className="text-black/50 text-sm">Direct dispatch to your primary address</p>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-[#ede9e3ff]/30 border border-black/5 mb-8">
                  <div className="text-sm font-bold uppercase tracking-widest text-black/40 mb-2">Destination</div>
                  <div className="text-xl font-medium text-black/80">{user?.email}</div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <button
                    onClick={sendToEmail}
                    disabled={sendingPostEmail || postResults.length === 0}
                    className="w-full sm:w-auto px-10 py-5 bg-[#7a9e87] text-white font-bold rounded-2xl shadow-xl shadow-[#7a9e87]/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-3 text-lg"
                  >
                    {sendingPostEmail ? <RefreshCw size={24} className="animate-spin" /> : <Send size={24} />}
                    {sendingPostEmail ? 'Dispatching All...' : `Deliver All (${postResults.length}) to Inbox`}
                  </button>
                  
                  {deliveryResult && (
                    <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-green-500/10 text-green-700 border border-green-500/20">
                      <CheckCircle2 size={20} />
                      <span className="font-bold text-sm">Successfully delivered!</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Weekly Planner Section */}
            <div className="bg-white p-10 rounded-3xl border border-black/10 shadow-xl">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <Clock3 size={24} className="text-[#c9714f]" /> 
                    Weekly Content Planner
                  </h2>
                  <p className="text-sm text-black/50">Generate specific prompts for your suggested posting days</p>
                </div>
                <button
                  onClick={generateAllDays}
                  disabled={generatingAll}
                  className="px-6 py-3 bg-black text-white font-bold rounded-xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 flex items-center gap-2 text-sm"
                >
                  {generatingAll ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {generatingAll ? 'Generating All...' : 'Generate All Days'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(suggestedDays.length > 0 ? suggestedDays : ['Monday', 'Wednesday', 'Friday']).map((day: string) => (
                  <div key={day} className="p-6 rounded-2xl bg-black/[0.02] border border-black/[0.05] flex flex-col justify-between group hover:bg-black/[0.04] transition-all">
                    <div className="flex items-center justify-between mb-5">
                      <span className="font-bold text-xl">{day}</span>
                      <div className="px-3 py-1 bg-[#c9714f]/10 text-[#c9714f] text-[10px] font-bold uppercase rounded-lg">Suggested</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => generatePosts(day)}
                        disabled={generatingDays[day]}
                        className="flex-1 py-3 bg-white border border-black/10 text-black font-bold rounded-xl text-sm shadow-sm group-hover:border-[#c9714f]/30 group-hover:text-[#c9714f] transition-all flex items-center justify-center gap-2"
                      >
                        {generatingDays[day] ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        Generate for {day}
                      </button>

                      {generatedPromptByDay.has(day) ? (
                        <button
                          onClick={() => setSelectedPrompt(generatedPromptByDay.get(day))}
                          className="w-12 h-12 rounded-xl border border-black/10 bg-white flex items-center justify-center text-black/70 hover:bg-black/5 transition-colors"
                          title={`Show generated prompt for ${day}`}
                        >
                          <Eye size={18} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Prompt Result Modal */}
      {selectedPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="px-8 py-6 bg-black text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles size={20} className="text-[#c9714f]" />
                <h2 className="text-xl font-bold">
                  {selectedPrompt.target_day ? `Prompt for ${selectedPrompt.target_day}` : 'Generated Prompt'}
                </h2>
              </div>
              <button 
                onClick={() => setSelectedPrompt(null)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-black/40 font-bold mb-3">Master Generation Prompt</div>
                <div className="p-5 rounded-2xl bg-black/5 border border-black/5 text-sm leading-7 text-black/80 whitespace-pre-wrap">
                  {selectedPrompt.post_generation_prompt}
                </div>
              </div>
              
              {selectedPrompt.suggested_post_topics && (
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-black/40 font-bold mb-3">Suggested Topics</div>
                  <div className="flex flex-wrap gap-2">
                    {asArray(selectedPrompt.suggested_post_topics).map((topic: string, i: number) => (
                      <span key={i} className="px-3 py-1 bg-[#c9714f]/5 text-[#c9714f] text-xs font-bold rounded-lg border border-[#c9714f]/10">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="px-8 py-6 bg-black/5 border-t border-black/5 flex items-center justify-end gap-4">
              <button 
                onClick={() => setSelectedPrompt(null)}
                className="px-6 py-3 text-sm font-bold text-black/40 hover:text-black transition-colors"
              >
                Dismiss
              </button>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(selectedPrompt.post_generation_prompt);
                  toast.success('Prompt copied to clipboard!');
                }}
                className="px-8 py-3 bg-black text-white font-bold rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                <Copy size={16} /> Copy Prompt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to handle array-like structures
function asArray(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (!val) return [];
  return [val];
}
