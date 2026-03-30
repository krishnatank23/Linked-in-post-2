"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { apiFetch } from "@/lib/api";
import { LogoSvg } from "./LogoSvg";
import PipelineProgress from "./PipelineProgress";
import AgentCard from "./AgentCard";
import ActionPanel from "./ActionPanel";
import GapAnalysisSection from "./GapAnalysisSection";
import type { AgentResult, PipelineResponse, LiveStatus, Influencer } from "@/lib/types";

// Wizard step definitions
const STEPS = [
  {
    key: "resume-parser",
    label: "Resume Parser",
    endpoint: "/pipeline/step/resume-parser",
    nextLabel: "Continue → Brand Voice Analysis",
    nextIcon: "✨",
  },
  {
    key: "brand-voice",
    label: "Brand Voice",
    endpoint: "/pipeline/step/brand-voice",
    nextLabel: "Continue → Influencer Scout",
    nextIcon: "🌟",
  },
  {
    key: "influencer-scout",
    label: "Influence Scout",
    endpoint: "/pipeline/step/influencer-scout",
    nextLabel: null, // last step
    nextIcon: null,
  },
] as const;

type WizardState = "idle" | "running" | "review" | "done";

interface StepResponse {
  message: string;
  result: AgentResult;
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(-1); // -1 = idle, 0/1/2 = step index
  const [viewStep, setViewStep] = useState(0); // Which step's output to show
  const [wizardState, setWizardState] = useState<WizardState>("idle");
  const [results, setResults] = useState<AgentResult[]>([]);
  const [stepStates, setStepStates] = useState<Record<string, string>>({});

  // Accumulated data passed between steps
  const [parsedProfile, setParsedProfile] = useState<Record<string, unknown> | null>(null);
  const [brandVoice, setBrandVoice] = useState<Record<string, unknown> | null>(null);

  // Live status polling
  const [liveStatus, setLiveStatus] = useState("");
  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Gap analysis / influencer selection
  const [selectedInfluencers, setSelectedInfluencers] = useState<Influencer[]>([]);
  const [gapResults, setGapResults] = useState<AgentResult[]>([]);
  const [showGapSection, setShowGapSection] = useState(false);

  const stopPolling = useCallback(() => {
    if (pollerRef.current) {
      clearInterval(pollerRef.current);
      pollerRef.current = null;
    }
    setLiveStatus("");
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollerRef.current = setInterval(async () => {
      if (!user?.id) return;
      try {
        const data = await apiFetch<LiveStatus>(`/pipeline/live-status/${user.id}`);
        if (data?.active && data?.message) {
          const secs = typeof data.wait_seconds === "number" ? Math.ceil(data.wait_seconds) : null;
          setLiveStatus(secs ? `${data.message.replace(/\s*\(attempt.*\)$/, "")} (${secs}s)` : data.message);
        } else {
          setLiveStatus("");
        }
      } catch {
        // ignore
      }
    }, 1200);
  }, [user?.id, stopPolling]);

  // Load existing results on mount (for page refresh)
  const loadExistingResults = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await apiFetch<PipelineResponse>(`/pipeline/results/${user.id}`);
      if (data.results?.length > 0) {
        setResults(data.results);
        data.results.forEach((r, i) => {
          setStepStates((prev) => ({ ...prev, [`step-${i + 1}`]: r.status }));
        });

        // Restore wizard state based on loaded results
        const completedSteps = data.results.length;
        setCurrentStep(completedSteps - 1);
        setViewStep(completedSteps - 1);

        // Restore accumulated data
        for (const r of data.results) {
          if (r.agent_name.includes("Resume Parser") && r.status === "success" && r.output) {
            setParsedProfile((r.output as Record<string, unknown>).parsed_profile as Record<string, unknown> || null);
          }
          if (r.agent_name.includes("Brand Voice") && r.status === "success" && r.output) {
            setBrandVoice((r.output as Record<string, unknown>).brand_analysis as Record<string, unknown> || null);
          }
        }

        if (completedSteps >= STEPS.length) {
          setWizardState("done");
        } else {
          setWizardState("review");
        }
      }
    } catch {
      // no previous results
    }
  }, [user?.id]);

  useEffect(() => {
    loadExistingResults();
    return stopPolling;
  }, [loadExistingResults, stopPolling]);

  // Listen for gap analysis results from InfluencerOutput
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as AgentResult[];
      setGapResults(detail);
      setShowGapSection(true);
    };
    window.addEventListener("gap-analysis-done", handler);
    return () => window.removeEventListener("gap-analysis-done", handler);
  }, []);

  // Build the request body for a given step
  const buildStepPayload = (stepIndex: number): Record<string, unknown> => {
    const base: Record<string, unknown> = { user_id: user!.id };
    if (stepIndex >= 1 && parsedProfile) {
      base.parsed_profile = parsedProfile;
    }
    if (stepIndex >= 2 && brandVoice) {
      base.brand_voice = brandVoice;
    }
    return base;
  };

  // Run a single step
  const runStep = async (stepIndex: number) => {
    const step = STEPS[stepIndex];
    setCurrentStep(stepIndex);
    setViewStep(stepIndex);
    setWizardState("running");
    setStepStates((prev) => ({ ...prev, [`step-${stepIndex + 1}`]: "running" }));
    startPolling();

    try {
      const payload = buildStepPayload(stepIndex);
      const data = await apiFetch<StepResponse>(step.endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const agentResult = data.result;

      // Append or replace the result at this step index
      setResults((prev) => {
        const newResults = [...prev];
        newResults[stepIndex] = agentResult;
        return newResults.slice(0, stepIndex + 1); // trim any stale future results
      });

      setStepStates((prev) => ({ ...prev, [`step-${stepIndex + 1}`]: agentResult.status }));

      // Extract data for next steps
      if (stepIndex === 0 && agentResult.status === "success" && agentResult.output) {
        const output = agentResult.output as Record<string, unknown>;
        setParsedProfile(output.parsed_profile as Record<string, unknown> || null);
      }
      if (stepIndex === 1 && agentResult.status === "success" && agentResult.output) {
        const output = agentResult.output as Record<string, unknown>;
        setBrandVoice(output.brand_analysis as Record<string, unknown> || null);
      }

      // Determine next state
      if (agentResult.status === "error") {
        setWizardState("review"); // let user see error and retry
        showToast(`${step.label} failed. You can retry.`, "error");
      } else if (stepIndex >= STEPS.length - 1) {
        setWizardState("done");
        showToast("All agents completed! 🎉", "success");
      } else {
        setWizardState("review");
        showToast(`${step.label} completed! Review the output below.`, "success");
      }
    } catch (err) {
      setStepStates((prev) => ({ ...prev, [`step-${stepIndex + 1}`]: "error" }));
      setWizardState("review");
      showToast((err as Error).message, "error");
    } finally {
      stopPolling();
    }
  };

  // Start the pipeline from scratch
  const startPipeline = () => {
    setResults([]);
    setStepStates({});
    setParsedProfile(null);
    setBrandVoice(null);
    setGapResults([]);
    setShowGapSection(false);
    setSelectedInfluencers([]);
    runStep(0);
  };

  // Continue to next step
  const continueToNextStep = () => {
    if (currentStep < STEPS.length - 1) {
      runStep(currentStep + 1);
    }
  };

  // Retry current step
  const retryCurrentStep = () => {
    runStep(currentStep);
  };

  const handleLogout = () => {
    stopPolling();
    logout();
    showToast("Logged out successfully", "info");
  };

  const isRunning = wizardState === "running";
  const showProgress = currentStep >= 0;
  const currentResult = results[currentStep];
  const canContinue =
    wizardState === "review" &&
    currentStep < STEPS.length - 1 &&
    currentResult?.status === "success";
  const canRetry =
    wizardState === "review" &&
    currentResult?.status === "error";

  return (
    <section style={{ position: "relative", zIndex: 1, minHeight: "100vh" }}>
      {/* Top Nav */}
      <nav className="top-nav glass-card">
        <div className="nav-brand">
          <div className="logo-icon-sm">
            <LogoSvg size={24} id="nav-grad" />
          </div>
          <span className="nav-title">
            BrandForge<span className="accent">AI</span>
          </span>
        </div>
        <div className="nav-user">
          <span className="user-greeting">Hello, {user?.username}</span>
          <button className="btn btn-ghost" onClick={handleLogout}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Logout
          </button>
        </div>
      </nav>

      {/* Studio Content */}
      <div className="studio-container">
        {/* Hero */}
        <div className="studio-hero glass-card">
          <div className="hero-content">
            <h2>AI Branding Studio</h2>
            <p>Analyze your resume and generate a powerful personal brand with our AI agents</p>
          </div>
          {wizardState === "idle" ? (
            <button
              className="btn btn-primary btn-lg"
              onClick={startPipeline}
              style={{ width: "auto" }}
            >
              <span className="btn-text">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Run AI Analysis
              </span>
            </button>
          ) : wizardState === "done" ? (
            <button
              className="btn btn-primary btn-lg"
              onClick={startPipeline}
              style={{ width: "auto", opacity: 0.85 }}
            >
              <span className="btn-text">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                Re-run Analysis
              </span>
            </button>
          ) : null}
        </div>

        {/* Pipeline Progress */}
        {showProgress && (
          <PipelineProgress
            stepStates={stepStates}
            currentStep={currentStep}
            liveStatus={liveStatus}
          />
        )}

        {/* Running Indicator */}
        {isRunning && (
          <div className="wizard-running glass-card">
            <div className="wizard-running-content">
              <span className="spinner" />
              <span>Running {STEPS[currentStep]?.label}...</span>
            </div>
          </div>
        )}

        {/* Agent Outputs — show one page at a time */}
        <div className="agent-outputs">
          {results.map((result, index) => (
            <div 
              key={result.agent_name + index} 
              style={{ display: index === viewStep ? "block" : "none", animation: "fadeInUp 0.3s ease-out" }}
            >
              <AgentCard
                result={result}
                index={index}
                selectedInfluencers={selectedInfluencers}
                setSelectedInfluencers={setSelectedInfluencers}
              />
            </div>
          ))}
        </div>

        {/* Wizard Navigation — Continue / Retry / Pagination */}
        {(canContinue || canRetry || results.length > 1) && (
          <div className="wizard-nav" style={{ justifyContent: "space-between", width: "100%", margin: "2rem 0 0" }}>
            
            <div style={{ flex: 1, display: "flex", justifyContent: "flex-start" }}>
              {viewStep > 0 && !isRunning && (
                <button
                  className="btn btn-ghost"
                  onClick={() => setViewStep(viewStep - 1)}
                  style={{ gap: "0.5rem" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                  Previous Stage
                </button>
              )}
            </div>

            <div style={{ flex: 1, display: "flex", justifyContent: "center", gap: "1rem" }}>
              {canRetry && viewStep === currentStep && (
                <button
                  className="btn btn-ghost wizard-retry-btn"
                  onClick={retryCurrentStep}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                  Retry {STEPS[currentStep]?.label}
                </button>
              )}
              {canContinue && viewStep === currentStep && (
                <button
                  className="btn btn-primary btn-lg wizard-next-btn"
                  onClick={continueToNextStep}
                >
                  <span className="btn-text">
                    <span>{STEPS[currentStep]?.nextIcon}</span>
                    {STEPS[currentStep]?.nextLabel}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </span>
                </button>
              )}
            </div>

            <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
              {viewStep < results.length - 1 && !isRunning && (
                <button
                  className="btn btn-ghost"
                  onClick={() => setViewStep(viewStep + 1)}
                  style={{ gap: "0.5rem" }}
                >
                  Next Stage
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              )}
            </div>

          </div>
        )}

        {/* Action Panel — after all steps done */}
        {wizardState === "done" && results.length > 0 && (
          <ActionPanel
            results={results}
            setGapResults={setGapResults}
            setShowGapSection={setShowGapSection}
          />
        )}

        {/* Gap Analysis Section */}
        {showGapSection && (
          <GapAnalysisSection results={gapResults} />
        )}
      </div>
    </section>
  );
}
