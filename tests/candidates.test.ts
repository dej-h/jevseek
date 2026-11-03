import assert from "node:assert/strict";
import test from "node:test";
import { estimateQuestionTokens, normalizeOptions, packBatches } from "../src/core/candidates.js";

test("option input rejects values that cannot be sent as JSON", () => {
  assert.throws(() => normalizeOptions([{ metadata: { missing: undefined } }]), /option 0/);
  assert.throws(() => normalizeOptions([{ price: Number.NaN }]), /option 0/);
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  assert.throws(() => normalizeOptions([cyclic]), /option 0/);
});

test("batch packing retains order when a larger option starts a new batch", () => {
  const options = normalizeOptions(["small", "small", "a much longer third option", "small"]);
  const stateTokens = 10;
  const firstTwo = options.slice(0, 2).reduce((sum, option) => sum + estimateQuestionTokens(option), 0);
  const longest = Math.max(...options.map(estimateQuestionTokens));
  const batches = packBatches(options, stateTokens, {
    total: stateTokens + firstTwo,
    statePlusLongest: stateTokens + longest,
  });
  assert.deepEqual(batches.map((batch) => batch.map((option) => option.id)), [
    ["opt_0", "opt_1"], ["opt_2"], ["opt_3"],
  ]);
});
