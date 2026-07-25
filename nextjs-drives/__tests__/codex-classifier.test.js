import test from "node:test";
import assert from "node:assert/strict";
import { parseClassifierResponse } from "../worker/codex-classifier.mjs";

const proposals = [
  { drive: { id: 7 } },
  { drive: { id: 9 } },
];

test("accepts one structured Codex decision per proposed drive", () => {
  const decisions = parseClassifierResponse(JSON.stringify({ decisions: [
    { driveId: 7, associate: true, confidence: 0.9, reason: "Client visit implies travel" },
    { driveId: 9, associate: false, confidence: 0.8, reason: "Coding does not document travel" },
  ] }), proposals);

  assert.equal(decisions.length, 2);
  assert.equal(decisions[0].associate, true);
});

test("rejects incomplete Codex output before any drive can be edited", () => {
  assert.throws(
    () => parseClassifierResponse(JSON.stringify({ decisions: [
      { driveId: 7, associate: true, confidence: 0.9, reason: "Client visit implies travel" },
    ] }), proposals),
    /did not classify every proposed drive/,
  );
});
