/**
 * Renderer-side type contracts for daemon side-agent live data.
 *
 * Provenance: canonical daemon package at
 * `ch5-company/packages/ch5pm-daemon/src/babysitter/types.ts` and
 * `ch5-company/packages/ch5pm-daemon/src/babysitter/hub.ts` and
 * `ch5-company/packages/ch5pm-daemon/src/babysitter/http.ts`.
 *
 * These types describe the live babysitter feed and are kept intentionally
 * separate from `Ch5PmLiveState` and `Ch5PmAttentionQueue` to avoid mixing
 * daemon live-feed semantics with existing PM snapshot state.
 */

export type Ch5PmSideAgentClassification =
  | "healthy"
  | "idle"
  | "wedged"
  | "aborted"
  | "looping"
  | "decision-needed"
  | "stale-skip";

/** Canonical field map for side-agent babysitter session reports. */
export interface Ch5PmSideAgentSessionReport {
  sessionId: string;
  title: string;
  dir: string;
  classification: Ch5PmSideAgentClassification;
  /** Minutes since last session activity; null when unknown. */
  ageMin: number | null;
  /** Short human gist: last progress / model finding summary. */
  gist: string;
  /** Why the classifier chose this classification (one line). */
  reason: string;
  /** Run-continuation stop marker present — NEVER auto-resume. */
  parked: boolean;
  /** Manual-owned (session-bind --manual convention) — NEVER auto-act. */
  manualOwned: boolean;
  /** Model-pass severity when the deep-read ran (high|medium|low|none|error). */
  severity: string | null;
}

export type Ch5PmSideAgentActionName =
  | "resume"
  | "unwedge"
  | "park"
  | "surface"
  | "escalate-cap-exceeded"
  | "skip";

/** Canonical field map for daemon loop auto-action log rows. */
export interface Ch5PmSideAgentAction {
  at: string;
  boxId: string;
  sessionId: string;
  action: Ch5PmSideAgentActionName;
  reason: string;
  ok: boolean;
  detail: string;
  /** Set by the ladder when a parked looping session needs a fresh session. */
  respawnNeeded: boolean;
}

/** Canonical field map for per-box digest aggregated by the hub. */
export interface Ch5PmSideAgentBoxDigest {
  boxId: string;
  generatedAt: string;
  intervalSeconds: number;
  sessions: Ch5PmSideAgentSessionReport[];
  actions: Ch5PmSideAgentAction[];
  notes: string[];
  modelPassRan: boolean;
}

/** Status of the running babysitter loop on the hub box. */
export interface Ch5PmSideAgentLoopStatus {
  enabled: boolean;
  running: boolean;
  intervalSeconds: number;
  lastRunAt: string | null;
  lastDigestAt: string | null;
  lastError: string | null;
  passes: number;
}

/** Attention row derived from decision-needed sessions or cap escalations. */
export interface Ch5PmSideAgentAttentionRow {
  boxId: string;
  sessionId: string;
  title: string;
  classification: Ch5PmSideAgentClassification | "cap-exceeded";
  reason: string;
  gist: string;
}

/** Aggregated live feed state from the hub. */
export interface Ch5PmSideAgentFeed {
  generatedAt: string;
  hubBoxId: string;
  boxes: Ch5PmSideAgentBoxDigest[];
  recentActions: Ch5PmSideAgentAction[];
  attention: Ch5PmSideAgentAttentionRow[];
}

/** Full payload shape returned by GET /pm/babysitter daemon endpoint. */
export interface Ch5PmSideAgentPayload {
  ok: boolean;
  health?: string;
  helper?: string;
  hubBoxId: string;
  generatedAt: string;
  boxes: Ch5PmSideAgentBoxDigest[];
  recentActions: Ch5PmSideAgentAction[];
  attention: Ch5PmSideAgentAttentionRow[];
  babysitterLoop: Ch5PmSideAgentLoopStatus | null;
  degradedReasons: string[];
  dataAges: {
    feed: string;
  } | null;
}

/**
 * Full payload shape returned by GET /pm/health daemon endpoint.
 *
 * Provenance: proxied via `apps/server/src/routes/ch5pm.ts` → daemon `/health`.
 * Live audit 2026-06-11: ok, health, helper, runtimeStateFile, generatedAt,
 * version, babysitterLoop, dataAges, degradedReasons.
 */
export interface Ch5PmSideAgentHealthPayload {
  ok?: boolean;
  health?: string;
  helper?: string;
  runtimeStateFile?: string;
  generatedAt?: string;
  version?: { commit: string; boxId: string } | null;
  babysitterLoop?: Ch5PmSideAgentLoopStatus | null;
  dataAges?: Record<string, string> | null;
  degradedReasons?: string[];
}

/**
 * Queue job row from the daemon dispatch queue.
 *
 * Provenance: proxied via `apps/server/src/routes/ch5pm.ts` → daemon `/queue`.
 * Live audit 2026-06-11: fields are jobId, ticketId, repoId, boxId, workerId,
 * sessionId, state, enqueuedAt, startedAt, endedAt, completedSteps, failedStep,
 * failedStepReason, rollbackSteps, metadata.
 */
export interface Ch5PmSideAgentQueueJob {
  jobId: string;
  ticketId?: string | null;
  repoId?: string | null;
  boxId?: string | null;
  workerId?: string | null;
  sessionId?: string | null;
  state: string;
  enqueuedAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  completedSteps?: string[];
  failedStep?: string | null;
  failedStepReason?: string | null;
  rollbackSteps?: string[];
  metadata?: Record<string, unknown> | null;
}

/**
 * Queue claim row from the daemon dispatch queue.
 *
 * Provenance: same source as jobs — daemon `/queue` via `rows.claims[]`.
 * Claim fields follow the same naming convention as jobs.
 */
export interface Ch5PmSideAgentQueueClaim {
  claimId: string;
  jobId?: string | null;
  boxId?: string | null;
  workerId?: string | null;
  state: string;
  claimedAt?: string | null;
  releasedAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Full payload shape returned by GET /pm/queue daemon endpoint.
 *
 * Provenance: proxied via `apps/server/src/routes/ch5pm.ts` → daemon `/queue`.
 * Live audit 2026-06-11: envelope with top-level ok, health, helper, rows,
 * generatedAt, degradedReasons, dataAges. `rows` is an OBJECT containing
 * `jobs[]` and `claims[]` — NOT flat top-level arrays.
 */
export interface Ch5PmSideAgentQueuePayload {
  ok?: boolean;
  health?: string;
  helper?: string;
  rows: {
    jobs: Ch5PmSideAgentQueueJob[];
    claims: Ch5PmSideAgentQueueClaim[];
  };
  generatedAt?: string;
  degradedReasons?: string[];
  dataAges?: Record<string, string> | null;
}
