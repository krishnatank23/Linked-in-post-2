export interface User {
  id: number;
  unique_id: string;
  username: string;
}

export interface LoginResponse {
  access_token: string;
  user_id: number;
  unique_id: string;
  username: string;
}

export interface AgentResult {
  agent_name: string;
  agent_description?: string;
  status: "success" | "error" | "running" | "pending" | "skipped";
  output?: Record<string, unknown>;
  error?: string;
}

export interface PipelineResponse {
  results: AgentResult[];
}

export interface LiveStatus {
  active: boolean;
  message: string;
  wait_seconds?: number;
}

export interface Influencer {
  title: string;
  snippet: string;
  link: string;
}
