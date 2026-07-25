import { Codex } from "@openai/codex-sdk";

const decisionSchema = {
  type: "object",
  properties: {
    decisions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          driveId: { type: "integer" },
          associate: { type: "boolean" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          reason: { type: "string", maxLength: 240 },
        },
        required: ["driveId", "associate", "confidence", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["decisions"],
  additionalProperties: false,
};

export async function classifyDriveMatches(proposals, options = {}) {
  if (proposals.length === 0) return [];

  const model = options.model ?? process.env.CODEX_CLASSIFIER_MODEL ?? "gpt-5.6-luna";
  const codex = options.codex ?? new Codex();
  const thread = codex.startThread({
    model,
    modelReasoningEffort: "low",
    sandboxMode: "read-only",
    approvalPolicy: "never",
    webSearchMode: "disabled",
    networkAccessEnabled: false,
    workingDirectory: "/tmp",
    skipGitRepoCheck: true,
  });

  const payload = proposals.map(({ drive, match }) => ({
    driveId: drive.id,
    driveStart: drive.startDate,
    driveEnd: drive.endDate,
    driveDurationMinutes: minutesBetween(drive.startDate, drive.endDate),
    togglEntries: match.candidateEntries.map((entry) => ({
      id: entry.id,
      start: entry.start,
      stop: entry.stop,
      description: entry.description,
      project: entry.project,
      tags: entry.tags,
      overlapMinutes: Math.round(entry.overlapSeconds / 60),
    })),
  }));

  const prompt = [
    "Classify whether each Toggl entry group plausibly documents the corresponding vehicle drive.",
    "Time overlap is necessary but not sufficient. Associate activities that reasonably imply travel, such as a commute, appointment, client or site visit, errand, delivery, pickup, event, or explicitly named trip.",
    "Do not associate desk work, calls, coding, administration, or vague entries unless the label itself provides clear evidence of travel.",
    "When evidence is insufficient, set associate to false. Return exactly one decision for every driveId and do not infer locations.",
    JSON.stringify(payload),
  ].join("\n\n");

  const turn = await thread.run(prompt, { outputSchema: decisionSchema });
  const parsed = parseClassifierResponse(turn.finalResponse, proposals);
  return parsed.map((decision) => ({ ...decision, model, usage: turn.usage }));
}

export function parseClassifierResponse(response, proposals) {
  const parsed = typeof response === "string" ? JSON.parse(response) : response;
  if (!parsed || !Array.isArray(parsed.decisions)) throw new Error("Codex returned an invalid decision set");

  const expectedIds = new Set(proposals.map(({ drive }) => drive.id));
  const seenIds = new Set();
  for (const decision of parsed.decisions) {
    if (!expectedIds.has(decision.driveId)) throw new Error(`Codex returned unknown drive ${decision.driveId}`);
    if (seenIds.has(decision.driveId)) throw new Error(`Codex returned duplicate drive ${decision.driveId}`);
    if (typeof decision.associate !== "boolean") throw new Error(`Codex omitted a decision for drive ${decision.driveId}`);
    if (!Number.isFinite(decision.confidence) || decision.confidence < 0 || decision.confidence > 1) {
      throw new Error(`Codex returned invalid confidence for drive ${decision.driveId}`);
    }
    if (typeof decision.reason !== "string" || !decision.reason.trim()) {
      throw new Error(`Codex omitted a reason for drive ${decision.driveId}`);
    }
    seenIds.add(decision.driveId);
  }

  if (seenIds.size !== expectedIds.size) throw new Error("Codex did not classify every proposed drive");
  return parsed.decisions;
}

function minutesBetween(start, end) {
  const milliseconds = Date.parse(end) - Date.parse(start);
  return Number.isFinite(milliseconds) ? Math.max(0, Math.round(milliseconds / 60_000)) : null;
}
