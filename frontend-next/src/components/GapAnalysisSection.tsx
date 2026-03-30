"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { apiFetch } from "@/lib/api";
import { TagSection } from "./renderers/InfoItem";
import PostGeneratorOutput from "./renderers/PostGeneratorOutput";
import EmailReminderOutput from "./renderers/EmailReminderOutput";
import type { AgentResult, PipelineResponse } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Props {
  results: AgentResult[];
}

export default function GapAnalysisSection({ results }: Props) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [generatingPosts, setGeneratingPosts] = useState(false);
  const [postResults, setPostResults] = useState<AgentResult[]>([]);
  const [postsGenerated, setPostsGenerated] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState<AgentResult | null>(null);

  const gapResult = results.find((r) => r.agent_name?.includes("Gap Analysis"));
  if (!gapResult || gapResult.status !== "success" || !gapResult.output) return null;

  const output = gapResult.output as any;
  const gap = output.gap_analysis || {};
  const strategy = output.content_strategy || {};
  const schedule: any[] = strategy.proposed_schedule || [];
  const actions: string[] = output.action_plan || [];

  const generatePosts = async () => {
    setGeneratingPosts(true);
    try {
      const data = await apiFetch<PipelineResponse>("/pipeline/generate-posts", {
        method: "POST",
        body: JSON.stringify({ user_id: user!.id, gap_analysis_data: output }),
      });
      setPostResults(data.results);
      setPostsGenerated(true);
      showToast("Posts generated successfully!", "success");
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setGeneratingPosts(false);
    }
  };

  const sendReminder = async () => {
    const postOutput = postResults.find((r) => r.agent_name?.includes("Post Generator"))?.output as any;
    if (!postOutput?.posts?.length) {
      showToast("No posts to send", "error");
      return;
    }
    setSendingEmail(true);
    try {
      const data = await apiFetch<PipelineResponse>("/pipeline/send-reminder", {
        method: "POST",
        body: JSON.stringify({ user_id: user!.id, posts_data: postOutput }),
      });
      setEmailResult(data.results[0]);
      showToast("Reminder email sent successfully!", "success");
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="agent-outputs" style={{ marginTop: "1rem" }}>
      <div className="studio-hero glass-card" style={{ marginTop: "1rem" }}>
        <div className="hero-content">
          <h2>Gap Analysis & Post Strategy</h2>
          <p>Detailed comparison and ready-to-publish content based on your selected influencer.</p>
        </div>
      </div>

      <div className="strategy-card" style={{ background: "var(--gradient-card)", backdropFilter: "blur(20px)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "1.5rem" }}>
        {/* Gap Summary */}
        <div className="output-section">
          <div className="output-section-title">{gapResult.agent_name}</div>
          <div className="gap-grid">
            <div className="gap-card">
              <h4>Profile Authority</h4>
              <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-secondary)" }}>{gap.profile_completeness_gap || "N/A"}</p>
            </div>
            <div className="gap-card">
              <h4>Content Impact</h4>
              <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-secondary)" }}>{gap.content_authority_gap || "N/A"}</p>
            </div>
            <div className="gap-card">
              <h4>Engagement Potential</h4>
              <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-secondary)" }}>{gap.engagement_gap || "N/A"}</p>
            </div>
          </div>
          <div className="gap-card" style={{ width: "100%" }}>
            <h4>Missing Success Elements</h4>
            <div className="tag-list">
              {(gap.key_missing_elements || []).map((item: string, i: number) => (
                <span key={i} className="tag tag-rose">{item}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Strategy */}
        <div className="output-section">
          <div className="output-section-title">Strategy & 7-Day Plan</div>
          {strategy.tone_adjustment && (
            <div className="text-block highlight" style={{ marginBottom: "1.5rem" }}>
              <strong>Tone Tweak:</strong> {strategy.tone_adjustment}
            </div>
          )}
          <TagSection label="Core Content Pillars" items={strategy.content_pillars} tagClass="tag-purple" />

          {schedule.length > 0 && (
            <div className="schedule-list" style={{ marginTop: "1.5rem" }}>
              {schedule.map((item: any, i: number) => (
                <div key={i} className="schedule-item">
                  <div className="schedule-day">{item.day}</div>
                  <div className="schedule-content">
                    <span className="badge-post-type">{item.post_type}</span>
                    <h5>{item.topic}</h5>
                    <p><strong>Goal:</strong> {item.topic}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Plan */}
        {actions.length > 0 && (
          <div className="output-section">
            <div className="output-section-title">Immediate Action Plan</div>
            <div className="action-plan-list">
              {actions.map((act, i) => (
                <div key={i} className="action-item">
                  <div className="step-icon" style={{ background: "var(--accent-emerald)", width: 24, height: 24, fontSize: 10, color: "white" }}>
                    {i + 1}
                  </div>
                  <span>{act}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Generate Posts Button */}
      {!postsGenerated && (
        <div style={{ marginTop: "2rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", borderTop: "2px solid var(--border-subtle)", paddingTop: "2rem" }}>
          <p style={{ color: "var(--text-secondary)", textAlign: "center", fontSize: "1.1rem" }}>
            Ready to turn this strategy into action?
          </p>
          <button
            id="btn-generate-posts"
            className="btn btn-primary"
            onClick={generatePosts}
            disabled={generatingPosts}
            style={{ width: "auto", fontSize: "1rem", padding: "12px 24px" }}
          >
            {generatingPosts ? (
              <span className="btn-loader"><span className="spinner" /> Generating...</span>
            ) : (
              <span className="btn-text">Generate LinkedIn Posts from Strategy</span>
            )}
          </button>
        </div>
      )}

      {/* Post Results */}
      {postResults.map((pr, i) => (
        <div key={i} style={{ marginTop: "2rem" }}>
          {pr.agent_name?.includes("Post Generator") && pr.output && (
            <div className="agent-card status-success">
              <div className="agent-card-header">
                <div className="agent-header-left">
                  <div className="agent-icon">✍️</div>
                  <div className="agent-info">
                    <h3>{pr.agent_name}</h3>
                  </div>
                </div>
                <span className="agent-status-badge badge-success">
                  <span className="badge-dot" />Completed
                </span>
              </div>
              <div className="agent-card-body">
                <PostGeneratorOutput output={pr.output} />
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Send Email Button */}
      {postsGenerated && !emailResult && (
        <div style={{ marginTop: "2rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", borderTop: "2px solid var(--border-subtle)", paddingTop: "2rem" }}>
          <p style={{ color: "var(--text-secondary)", textAlign: "center", fontSize: "1.05rem" }}>
            Posts are ready. Send reminder email now?
          </p>
          <button
            id="btn-send-reminder"
            className="btn btn-primary"
            onClick={sendReminder}
            disabled={sendingEmail}
            style={{ width: "auto", fontSize: "1rem", padding: "12px 24px" }}
          >
            {sendingEmail ? (
              <span className="btn-loader"><span className="spinner" /> Sending...</span>
            ) : (
              <span className="btn-text">Send Reminder Email</span>
            )}
          </button>
        </div>
      )}

      {/* Email Result */}
      {emailResult && (
        <div style={{ marginTop: "1rem" }}>
          <EmailReminderOutput status={emailResult.status} output={emailResult.output} />
        </div>
      )}
    </div>
  );
}
