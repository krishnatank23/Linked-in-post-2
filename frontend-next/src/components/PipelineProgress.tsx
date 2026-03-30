"use client";

interface Props {
  stepStates: Record<string, string>;
  currentStep: number;
  liveStatus: string;
}

export default function PipelineProgress({ stepStates, currentStep, liveStatus }: Props) {
  const steps = [
    { id: "step-1", label: "Resume Parser" },
    { id: "step-2", label: "Brand Voice" },
    { id: "step-3", label: "Influence Scout" },
  ];

  return (
    <div className="pipeline-progress">
      <div className="progress-steps">
        {steps.map((step, i) => {
          const isNextActive = currentStep > i;
          const statusClass = stepStates[step.id] || (currentStep === i ? "ready" : "");

          return (
            <div key={step.id} style={{ display: "contents" }}>
              <div className={`progress-step ${statusClass}`}>
                <div className="step-icon">
                  {stepStates[step.id] === "success" ? "\u2713" : i + 1}
                </div>
                <span className="step-label">{step.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`progress-connector ${isNextActive ? "active" : ""}`} />
              )}
            </div>
          );
        })}
      </div>
      {liveStatus && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)", minHeight: 18 }}>
          {liveStatus}
        </div>
      )}
    </div>
  );
}
