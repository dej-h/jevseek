import assert from "node:assert/strict";
import test from "node:test";
import { selectCandidates } from "../src/core/retrieval.js";
import type { RankOption } from "../src/core/candidates.js";

test("keeps a route match outside the lexical top hundred", () => {
  const distractors: RankOption[] = Array.from({ length: 110 }, (_, index) => ({
    id: `GET /repos/{owner}/{repo}/contents/file-${String(index)}`,
    content: { method: "GET", path: `/repos/{owner}/{repo}/contents/file-${String(index)}`,
      summary: `Search file contents in a repository ${"unrelated ".repeat(200)}` },
  }));
  const target: RankOption = {
    id: "GET /search/code",
    content: { method: "GET", path: "/search/code", summary: "Search code" },
  };

  const selected = selectCandidates([...distractors, target], "Searches file contents across GitHub");
  assert.ok(selected.includes(target));
  assert.ok(selected.length < distractors.length + 1);
});

test("does not prune a bounded catalog", () => {
  const options: RankOption[] = [
    { id: "get_rates", content: { title: "Get rates" } },
    { id: "get_balances", content: { title: "Get balances" } },
  ];
  assert.equal(selectCandidates(options, "account balance"), options);
});
