import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Mail, RefreshCw, Send, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import AgentCard from '../components/AgentCard';
import { useAuth } from '../context/AuthContext';
import { btnPrimary, btnSecondary, glassCard, pageInner, pageShell } from '../styles/classes';

type WorkflowStep = 0 | 1 | 2;

const STEP_CONFIG = [
  {
    title: 'Resume Parser',
    description: 'Review the parsed resume output first.',
    agentMatch: 'Resume Parser',
  },
  {
    title: 'Brand Voice',
    description: 'Then inspect the brand voice and persona output.',
    agentMatch: 'Brand Voice',
  },
  {
    title: 'Influencer Analysis',
    description: 'Finally review the influencer suggestions and links.',
    agentMatch: 'Influence',
  },
] as const;

const ALL_AGENT_SECTIONS = [
  { title: 'Resume Parser', agentMatch: 'Resume Parser' },
  { title: 'Brand Voice', agentMatch: 'Brand Voice' },
  { title: 'Influencer Analysis', agentMatch: 'Influence' },
  { title: 'Gap Analysis', agentMatch: 'Gap Analysis' },
  { title: 'Posting Recommendation', agentMatch: 'Posting Frequency Recommendation' },
  { title: 'Post Generation', agentMatch: 'Post Generator' },
] as const;

function normalizeStep(stepParam: string | undefined): WorkflowStep {
  const value = Number(stepParam ?? 0);
  if (Number.isNaN(value) || value < 0) return 0;
  if (value > 2) return 2;
  return value as WorkflowStep;
}

export default function WorkflowReviewPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { step } = useParams();
  const activeStep = normalizeStep(step);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);

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

  const orderedSteps = useMemo(() => {
    return STEP_CONFIG.map((config) => {
      const matched = [...results].reverse().find((result) => String(result.agent_name || '').includes(config.agentMatch));
      return matched || null;
    }).filter(Boolean);
  }, [results]);

  const allAgentOutputs = useMemo(() => {
    return ALL_AGENT_SECTIONS.map((section) => {
      const matched = [...results].reverse().find((result) => String(result.agent_name || '').includes(section.agentMatch));
      return matched || null;
    }).filter(Boolean);
  }, [results]);

  const gapResult = useMemo(() => {
    return [...results].reverse().find((result) => String(result.agent_name || '').includes('Gap Analysis')) || null;
  }, [results]);

  const postResult = useMemo(() => {
    return [...results].reverse().find((result) => String(result.agent_name || '').includes('Post Generator')) || null;
  }, [results]);

  const deliveryResult = useMemo(() => {
    return [...results].reverse().find((result) => String(result.agent_name || '').includes('Post Delivery')) || null;
  }, [results]);

  const currentResult = orderedSteps[activeStep] || null;
  const isLastStep = activeStep >= STEP_CONFIG.length - 1;

  const goToStep = (nextStep: WorkflowStep) => {
    navigate(`/studio/review/${nextStep}`);
  };

  const goNext = () => {
    if (activeStep < 2) goToStep((activeStep + 1) as WorkflowStep);
    else navigate('/studio');
  };

  const goBack = () => {
    if (activeStep > 0) goToStep((activeStep - 1) as WorkflowStep);
    else navigate('/studio');
  };

  const sendGeneratedPosts = async () => {
    if (!user || !postResult?.output) return;

    try {
      setSendingEmail(true);
      const payload = {
        user_id: user.id,
        posts_data: postResult.output,
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

      toast.success(response.data?.message || `Sent to ${user.email || 'your registered email'}`);

      const refreshResponse = await api.get(`/pipeline/results/${user.id}`);
      setResults(refreshResponse.data.results || []);
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.detail ||
        error?.response?.data?.results?.[0]?.error ||
        error?.message ||
        'Failed to send generated posts by email';
      toast.error(String(errorMessage));
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className={`${pageShell} px-4 py-6 md:px-8 lg:px-12`}>
      <div className={pageInner}>
        <header className={`${glassCard} p-5 md:p-6 mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between`}>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                <Sparkles size={20} />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">Workflow Review</h1>
                <p className="text-white/50 text-sm">Review each output in order before moving to the next step.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/studio" className={`${btnSecondary} flex items-center gap-2`}>
              <ArrowLeft size={16} /> Back to Studio
            </Link>
            <button
              onClick={() => {
                logout();
                navigate('/');
              }}
              className={btnSecondary}
            >
              Sign Out
            </button>
          </div>
        </header>

        <section className="grid xl:grid-cols-[0.32fr_0.68fr] gap-6">
          <aside className={`${glassCard} p-5 md:p-6 h-fit`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/35 mb-1">Step {activeStep + 1} of 3</div>
                <h2 className="font-heading text-2xl font-semibold">{STEP_CONFIG[activeStep].title}</h2>
              </div>
              <Clock3 size={18} className="text-white/35" />
            </div>
            <p className="text-sm text-white/55 leading-6 mb-5">{STEP_CONFIG[activeStep].description}</p>

            <div className="space-y-3">
              {STEP_CONFIG.map((config, index) => {
                const completed = index < activeStep;
                const isActive = index === activeStep;
                return (
                  <button
                    key={config.title}
                    type="button"
                    onClick={() => goToStep(index as WorkflowStep)}
                    className={`w-full text-left rounded-2xl border p-4 transition-all ${isActive ? 'border-primary bg-primary/10' : completed ? 'border-accent/30 bg-white/5' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-white/35 mb-1">{index + 1}</div>
                        <div className="font-semibold">{config.title}</div>
                      </div>
                      {completed ? <CheckCircle2 size={18} className="text-accent" /> : null}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={goBack} className={`${btnSecondary} flex-1`}>
                Back
              </button>
              <button onClick={goNext} className={`${btnPrimary} flex-1`}>
                {isLastStep ? 'Finish' : 'Next'}
                <ArrowRight size={16} className="ml-2" />
              </button>
            </div>
          </aside>

          <main>
            {loading ? (
              <div className={`${glassCard} p-10 text-center text-white/60`}>Loading workflow results...</div>
            ) : currentResult ? (
              <div className="space-y-4">
                <div className={`${glassCard} p-5 md:p-6`}>
                  <div className="text-xs uppercase tracking-[0.2em] text-white/35 mb-2">Current Output</div>
                  <h3 className="font-heading text-3xl font-semibold">{STEP_CONFIG[activeStep].title}</h3>
                  <p className="text-white/55 mt-2 leading-7">Review this output carefully, then move to the next page for the next stage.</p>
                </div>
                <AgentCard data={currentResult} index={activeStep} />

                {activeStep === 2 ? (
                  <>
                    <div className={`${glassCard} p-5 md:p-6`}>
                      <div className="text-xs uppercase tracking-[0.2em] text-white/35 mb-2">Gap Analyzed</div>
                      {gapResult ? (
                        <div className="space-y-3">
                          <div className="rounded-2xl border border-primary/25 bg-primary/10 p-4">
                            <div className="text-sm font-semibold text-white/90 mb-2">Overall Gap Summary</div>
                            <p className="text-sm text-white/70 leading-7">
                              {String(
                                gapResult.output?.overall_gap_analysis?.content_authority_gap ||
                                gapResult.output?.gap_analysis?.content_authority_gap ||
                                'Gap analysis completed and strategy generated from selected influencer benchmarks.'
                              )}
                            </p>
                          </div>

                          {(gapResult.output?.overall_gap_analysis?.key_missing_elements || gapResult.output?.gap_analysis?.key_missing_elements || []).length ? (
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                              <div className="text-xs uppercase tracking-[0.18em] text-white/35 mb-3">Key Missing Elements</div>
                              <div className="flex flex-wrap gap-2">
                                {(gapResult.output?.overall_gap_analysis?.key_missing_elements || gapResult.output?.gap_analysis?.key_missing_elements || [])
                                  .slice(0, 8)
                                  .map((item: any, idx: number) => (
                                    <span key={`${item}-${idx}`} className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-[11px] font-semibold text-white/75">
                                      {String(item)}
                                    </span>
                                  ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/15 p-6 text-sm text-white/55">
                          Gap analysis is not available yet. Select influencer(s) and run gap analysis from Studio, then come back here.
                        </div>
                      )}
                    </div>

                    <div className={`${glassCard} p-5 md:p-6`}>
                      <div className="text-xs uppercase tracking-[0.2em] text-white/35 mb-2">Post Generation</div>
                      <p className="text-white/80 text-sm leading-7 mb-2">Beyond templates, Strategic LinkedIn growth powered by autonomous agent workflows..</p>
                      <p className="text-white/55 text-sm leading-7 mb-4">
                        This section shows the latest post-generation output if available.
                      </p>
                      {postResult ? (
                        <div className="space-y-4">
                          <AgentCard data={postResult} index={5} />

                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div>
                                <div className="text-xs uppercase tracking-[0.2em] text-white/35 mb-1">Send To Email</div>
                                <div className="text-sm text-white/70 leading-6">
                                  Email these generated posts to {user?.email || 'your registered Outlook inbox'}.
                                </div>
                              </div>
                              <button onClick={sendGeneratedPosts} disabled={sendingEmail} className={`${btnPrimary} gap-2 whitespace-nowrap`}>
                                {sendingEmail ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />} Send this post to email
                              </button>
                            </div>

                            {deliveryResult ? (
                              <div className="rounded-2xl border border-accent/20 bg-accent/10 p-4 text-sm text-white/75 flex items-start gap-3">
                                <Mail size={18} className="mt-0.5 text-accent" />
                                <div>
                                  <div className="font-semibold text-white/90 mb-1">Latest delivery status</div>
                                  <div>{String(deliveryResult.output?.message || deliveryResult.error || 'Email delivery completed.')}</div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/15 p-6 text-sm text-white/55">
                          No generated posts found yet. Run post generation in Studio after completing gap analysis.
                        </div>
                      )}
                    </div>

                    <div className={`${glassCard} p-5 md:p-6`}>
                      <div className="text-xs uppercase tracking-[0.2em] text-white/35 mb-2">All Agent Outputs</div>
                      <p className="text-white/55 text-sm leading-7 mb-4">
                        Full pipeline visibility on one page: parser, brand voice, influencer analysis, gap strategy, recommendation, and posts.
                      </p>
                      <div className="grid xl:grid-cols-2 gap-4">
                        {allAgentOutputs.map((result: any, idx: number) => (
                          <AgentCard key={`${result.agent_name}-${idx}`} data={result} index={idx} />
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            ) : (
              <div className={`${glassCard} p-10 text-center text-white/60`}>
                No workflow results found yet. Run the pipeline first from Studio.
              </div>
            )}
          </main>
        </section>
      </div>
    </div>
  );
}
