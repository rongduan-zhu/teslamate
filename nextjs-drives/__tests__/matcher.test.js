import test from "node:test";
import assert from "node:assert/strict";
import { matchDrive, overlapSeconds } from "../worker/matcher.mjs";

const drive = {
  startDate: "2026-07-19T17:00:00Z",
  endDate: "2026-07-19T17:30:00Z",
};

test("calculates overlap between a drive and a Toggl entry", () => {
  assert.equal(overlapSeconds(drive, {
    start: "2026-07-19T16:50:00Z",
    stop: "2026-07-19T17:10:00Z",
    duration: 1200,
  }), 600);
});

test("builds reviewable notes and tags from overlapping entries", () => {
  const result = matchDrive(drive, [{
    id: 42,
    start: "2026-07-19T17:05:00Z",
    stop: "2026-07-19T17:25:00Z",
    duration: 1200,
    description: "Client visit",
    project_name: "Field work",
    tags: ["customer"],
  }]);

  assert.deepEqual(result.tags, ["toggl", "Field work", "customer"]);
  assert.equal(result.notes, "Toggl: Client visit (20 min overlap)");
  assert.deepEqual(result.togglEntryIds, [42]);
  assert.deepEqual(result.candidateEntries, [{
    id: 42,
    start: "2026-07-19T17:05:00Z",
    stop: "2026-07-19T17:25:00Z",
    description: "Client visit",
    project: "Field work",
    tags: ["customer"],
    overlapSeconds: 1200,
  }]);
});

test("ignores entries below the minimum overlap", () => {
  assert.equal(matchDrive(drive, [{
    id: 1,
    start: "2026-07-19T16:59:30Z",
    stop: "2026-07-19T17:00:30Z",
    duration: 60,
    tags: [],
  }]), null);
});
