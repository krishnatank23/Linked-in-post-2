"use client";

import { useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { apiFetch } from "@/lib/api";
import type { Influencer, PipelineResponse } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Props {
  output: any;
  selectedInfluencers: Influencer[];
  setSelectedInfluencers: React.Dispatch<React.SetStateAction<Influencer[]>>;
}

export default function InfluencerOutput({ output, selectedInfluencers, setSelectedInfluencers }: Props) {
  console.log("[InfluencerOutput] raw output:", output);
  const influencers: Influencer[] = Array.isArray(output?.influencers) ? output.influencers : [];
  console.log("[InfluencerOutput] influencers count:", influencers.length);
  const { user } = useAuth();
  const { showToast } = useToast();

  const toggleInfluencer = useCallback((inf: Influencer) => {
    setSelectedInfluencers((prev) => {
      const exists = prev.some((i) => i.link === inf.link);
      return exists ? prev.filter((i) => i.link !== inf.link) : [...prev, inf];
    });
  }, [setSelectedInfluencers]);

  const runGapAnalysis = async () => {
    if (selectedInfluencers.length === 0) {
      showToast("Please select at least one influencer first.", "error");
      return;
    }
    try {
      const data = await apiFetch<PipelineResponse>("/pipeline/gap-analysis", {
        method: "POST",
        body: JSON.stringify({
          user_id: user!.id,
          influencer_data: selectedInfluencers,
        }),
      });
      // Dispatch custom event for Dashboard to handle
      window.dispatchEvent(
        new CustomEvent("gap-analysis-done", { detail: data.results })
      );
      showToast("Gap Analysis & Strategy Generated!", "success");
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  if (influencers.length === 0) {
    return (
      <div className="output-section">
        <div className="output-section-title">Search Query: &ldquo;{output.search_query_used || "N/A"}&rdquo;</div>
        <div className="error-display" style={{ marginTop: "0.75rem" }}>
          No influencer profiles were found. Try running the pipeline again.
        </div>
      </div>
    );
  }

  return (
    <div className="output-section">
      <div className="output-section-title">Search Query: &ldquo;{output.search_query_used}&rdquo;</div>
      <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
        Select one or more influencers to continue. Gap analysis runs only for your selected influencers.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
        {influencers.map((inf, idx) => {
          const isSelected = selectedInfluencers.some((i) => i.link === inf.link);
          return (
            <label
              key={idx}
              className={`influencer-item ${isSelected ? "selected" : ""}`}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("a")) return;
                toggleInfluencer(inf);
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Select</span>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleInfluencer(inf)}
                    style={{ accentColor: "#06b6d4" }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <h4 style={{ margin: "0 0 0.5rem", color: "var(--text-primary)", fontSize: "var(--fs-sm)" }}>
                  {inf.title}
                </h4>
                <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-secondary)", margin: "0 0 1rem", lineHeight: 1.5, opacity: 0.8 }}>
                  {inf.snippet}
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "auto" }}>
                <a href={inf.link} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 11, width: "auto" }}>
                  View ↗
                </a>
              </div>
            </label>
          );
        })}
      </div>

      <div style={{ marginTop: "1rem", display: "flex", justifyContent: "center" }}>
        <button
          className="btn btn-primary"
          onClick={runGapAnalysis}
          disabled={selectedInfluencers.length === 0}
          style={{ width: "auto" }}
        >
          <span className="btn-text">Analyze Gap for Selected Influencers</span>
        </button>
      </div>
    </div>
  );
}
