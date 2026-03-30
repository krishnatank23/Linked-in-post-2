"use client";

import { useToast } from "@/context/ToastContext";
import type { AgentResult } from "@/lib/types";

interface Props {
  results: AgentResult[];
  setGapResults: React.Dispatch<React.SetStateAction<AgentResult[]>>;
  setShowGapSection: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function ActionPanel({ results }: Props) {
  const { showToast } = useToast();
  const successAgents = results.filter((r) => r.status === "success");
  if (successAgents.length === 0) return null;

  const buttons: { label: string; onClick: () => void }[] = [];

  successAgents.forEach((agent) => {
    const name = agent.agent_name;

    if (name.includes("Influence")) {
      buttons.push({
        label: "Select Influencers & Analyze",
        onClick: () => {
          const el = document.querySelector(".influencer-item");
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          } else {
            showToast("Influencer list not found", "error");
          }
        },
      });
    }

    if (name.includes("Gap Analysis")) {
      buttons.push({
        label: "Generate LinkedIn Posts",
        onClick: () => {
          const btn = document.getElementById("btn-generate-posts") as HTMLButtonElement;
          if (btn) {
            btn.click();
          } else {
            showToast("Gap analysis output not found", "error");
          }
        },
      });
    }

    if (name.includes("Post Generator")) {
      buttons.push({
        label: "Send Reminder Email",
        onClick: () => {
          const btn = document.getElementById("btn-send-reminder") as HTMLButtonElement;
          if (btn) {
            btn.click();
          } else {
            showToast("Posts not yet generated", "error");
          }
        },
      });
    }
  });

  if (buttons.length === 0) return null;

  return (
    <div
      style={{
        marginTop: "2rem",
        padding: "1.5rem",
        background: "linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(99,102,241,0.08) 100%)",
        border: "1px solid rgba(6,182,212,0.3)",
        borderRadius: 16,
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
      }}
    >
      <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: "1.1rem" }}>
        Next Steps
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "1rem",
        }}
      >
        {buttons.map((b, i) => (
          <button
            key={i}
            className="btn btn-primary"
            style={{ background: "var(--gradient-primary)", padding: "12px 16px", textAlign: "center", cursor: "pointer" }}
            onClick={b.onClick}
          >
            <span className="btn-text">{b.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
