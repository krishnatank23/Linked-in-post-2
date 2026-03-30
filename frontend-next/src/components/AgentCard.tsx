"use client";

import { useState } from "react";
import type { AgentResult, Influencer } from "@/lib/types";
import ResumeParserOutput from "./renderers/ResumeParserOutput";
import BrandVoiceOutput from "./renderers/BrandVoiceOutput";
import InfluencerOutput from "./renderers/InfluencerOutput";
import GapAnalysisOutput from "./renderers/GapAnalysisOutput";
import PostGeneratorOutput from "./renderers/PostGeneratorOutput";
import EmailReminderOutput from "./renderers/EmailReminderOutput";

interface Props {
  result: AgentResult;
  index: number;
  selectedInfluencers: Influencer[];
  setSelectedInfluencers: React.Dispatch<React.SetStateAction<Influencer[]>>;
}

export default function AgentCard({ result, index, selectedInfluencers, setSelectedInfluencers }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const icons = ["🔍", "✨", "🌟"];
  const icon = icons[index] || "🤖";

  const badgeClass = result.status === "success" ? "badge-success" : result.status === "error" ? "badge-error" : "badge-running";
  const statusText = result.status === "success" ? "Completed" : result.status === "error" ? "Failed" : "Running";

  const renderContent = () => {
    console.log(`[AgentCard] Rendering "${result.agent_name}" | status=${result.status} | hasOutput=${!!result.output}`);
    if (result.status === "error") {
      return <div className="error-display">{result.error || "Unknown error"}</div>;
    }
    if (!result.output) {
      return <p style={{ color: "var(--text-muted)" }}>No output data</p>;
    }

    const name = result.agent_name;
    if (name.includes("Resume Parser")) return <ResumeParserOutput output={result.output} />;
    if (name.includes("Brand Voice")) return <BrandVoiceOutput output={result.output} />;
    if (name.includes("Influence")) {
      console.log("[AgentCard] Using InfluencerOutput renderer for:", name);
      return <InfluencerOutput output={result.output} selectedInfluencers={selectedInfluencers} setSelectedInfluencers={setSelectedInfluencers} />;
    }
    if (name.includes("Gap Analysis")) return <GapAnalysisOutput output={result.output} />;
    if (name.includes("Post Generator")) return <PostGeneratorOutput output={result.output} />;
    if (name.includes("Email Reminder")) return <EmailReminderOutput status={result.status} output={result.output} />;

    return (
      <pre className="text-block" style={{ fontSize: "var(--fs-xs)", overflowX: "auto" }}>
        {JSON.stringify(result.output, null, 2)}
      </pre>
    );
  };

  return (
    <div
      className={`agent-card status-${result.status}`}
      style={{ animationDelay: `${index * 0.15}s` }}
    >
      <div className="agent-card-header" onClick={() => setCollapsed(!collapsed)}>
        <div className="agent-header-left">
          <div className="agent-icon">{icon}</div>
          <div className="agent-info">
            <h3>{result.agent_name}</h3>
            <p>{result.agent_description || ""}</p>
          </div>
        </div>
        <span className={`agent-status-badge ${badgeClass}`}>
          <span className="badge-dot" />
          {statusText}
        </span>
      </div>
      <div className={`agent-card-body ${collapsed ? "collapsed" : ""}`}>
        {renderContent()}
      </div>
    </div>
  );
}
