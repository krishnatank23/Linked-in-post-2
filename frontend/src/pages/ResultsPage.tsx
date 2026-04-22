import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, RefreshCw, Send, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import AgentCard from '../components/AgentCard';
import { useAuth } from '../context/AuthContext';
import { btnPrimary, btnSecondary, glassCard, pageInner, pageShell } from '../styles/classes';

export default function ResultsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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

  const handleRefresh = async () => {
    if (!user) return;
    const response = await api.get(`/pipeline/results/${user.id}`);
    setResults(response.data.results || []);
  };

  const latestPostResult = useMemo(() => {
    return [...results].reverse().find((result) => String(result.agent_name || '').includes('Post Generator')) || null;
  }, [results]);

  const latestDeliveryResult = useMemo(() => {
    return [...results].reverse().find((result) => String(result.agent_name || '').includes('Post Delivery')) || null;
  }, [results]);

  const sendGeneratedPosts = async () => {
    if (!user || !latestPostResult?.output) return;

    try {
      setSendingEmail(true);
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

      const deliveryStatus = response?.data?.results?.[0]?.status;
      const deliveryError = response?.data?.results?.[0]?.error || response?.data?.results?.[0]?.output?.message;
      if (deliveryStatus && deliveryStatus !== 'success') {
        throw new Error(deliveryError || 'Email delivery failed.');
      }

      toast.success(response.data?.message || `Sent to ${user.email || 'your registered email'}`);
      await handleRefresh();
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
        <header className={`${glassCard} p-5 md:p-6 mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between`}>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                <Sparkles size={20} />
              </div>
              <h1 className="text-2xl font-bold">PostPilot Studio Results</h1>
            </div>
            <p className="text-[#1c1a17]/50">Full agent output history for {user?.username || 'your account'}.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={handleRefresh} className={`${btnSecondary} flex items-center gap-2`}>
              <RefreshCw size={16} /> Refresh
            </button>
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

        {loading ? (
          <div className={`${glassCard} p-10 text-center text-[#1c1a17]/60`}>Loading results...</div>
        ) : results.length ? (
          <div className="space-y-6">
            {latestPostResult ? (
              <section className={`${glassCard} p-6 md:p-7`}>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-[#1c1a17]/35 mb-2">Post Delivery</div>
                    <h2 className="font-heading text-2xl font-semibold">Send this post to {user?.email || 'your registered email'}</h2>
                    <p className="text-[#1c1a17]/55 mt-2 leading-7">
                      The generated LinkedIn posts will be emailed from the Outlook sender account after you click the button below.
                    </p>
                  </div>
                  <button
                    onClick={sendGeneratedPosts}
                    disabled={sendingEmail}
                    className={`${btnPrimary} gap-2 whitespace-nowrap`}
                  >
                    {sendingEmail ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />} Send this post to email
                  </button>
                </div>
                {latestDeliveryResult ? (
                  <div className="mt-5 rounded-2xl border border-accent/20 bg-accent/10 p-4 text-sm text-[#1c1a17]/75 flex items-start gap-3">
                    <Mail size={18} className="mt-0.5 text-accent" />
                    <div>
                      <div className="font-semibold text-[#1c1a17]/90 mb-1">Latest delivery status</div>
                      <div>{String(latestDeliveryResult.output?.message || latestDeliveryResult.error || 'Email delivery completed.')} </div>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {results.map((result, index) => (
                <AgentCard key={`${result.agent_name}-${index}`} data={result} index={index} />
              ))}
            </div>
          </div>
        ) : (
          <div className={`${glassCard} p-12 text-center text-[#1c1a17]/50`}>
            No results yet. Run the studio pipeline first.
          </div>
        )}
      </div>
    </div>
  );
}
