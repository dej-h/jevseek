# Packing mode benchmark (GitHub OpenAPI)

Recorded 19 September 2026. Model `jev-1.13.0`. Catalog: 1,239 operations from `examples/github/api.github.com.json`. Price used for cost: **$0.042 per million input tokens** (TypeSafe list price that day). Output tokens are free.

**`state` packing is the implementation.** On 50 capability needs it matched per-question rubric packing on every top-1, cut billed input tokens to 55% ($0.357 → $0.196 for the whole set), and still put the intended operation first with score ≥ 0.79. The per-question-rubric variant is gone from the ranker.

This page is the A/B that decided that. Re-running `npm run bench:packing` ranks with the current (state-only) packer and does not recreate the removed mode.

## What was compared

`question` (removed): shared state was only `{ need }`. Every Noul repeated the rubric and the yes/no criteria, then the operation.

`state` (kept): shared state holds `{ need, rubric, yes, no }`. Every Noul is only the operation JSON (`method`, `path`, `summary`, `operationId`, `tags`).

## Success rule (agent)

A query **passes** when Jev's rank-1 id equals the pre-declared expected operation and that score is ≥ 0.5 (the same abstain threshold `rankOptions` uses). I scored each of the 50 rows against that rule. I did not give credit for a related neighbor in slot 2.

## Totals

| | Input tokens | Cost | Top-1 hits | Mean top-1 score | Mean latency |
| --- | ---: | ---: | ---: | ---: | ---: |
| `question` | 8,489,454 | $0.3566 | 50 / 50 | 0.968 | 2.3 s |
| `state` | 4,677,102 | $0.1964 | 50 / 50 | 0.950 | 1.6 s |
| Ratio | 0.551 | 0.551 | same | −0.018 | 0.69 |

Same top-1 id on all 50. Expected operation was rank 1 on all 50, both modes. Top-5 order almost never matched (0/50 identical lists). That tail is other operations with low scores. It does not change which contract we would return.

Largest top-1 score gaps (`state` minus `question`): `search-users` +0.07, `notifications-mark-read` −0.07, `compare-commits` −0.06. All three still passed.

Weakest pass: `gists-user` (list public gists for a username) at 0.82 / 0.79. Still rank 1.

## Per query

Tokens and cost are Jev `usage.input_tokens` for that full-catalog rank, not the packing estimate. Cost = tokens / 1e6 × 0.042. "Same top-1" is whether the two modes returned the same operation first. "Judge" is the agent pass/fail above.

| id | question tokens | question $ | q score | state tokens | state $ | s score | same top-1 | judge |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| pr-files | 169797 | 0.0071 | 0.98 | 93546 | 0.0039 | 0.97 | yes | pass |
| pr-create | 169797 | 0.0071 | 0.97 | 93546 | 0.0039 | 0.95 | yes | pass |
| pr-merge | 169779 | 0.0071 | 0.98 | 93537 | 0.0039 | 0.95 | yes | pass |
| pr-commits | 169803 | 0.0071 | 0.99 | 93549 | 0.0039 | 0.97 | yes | pass |
| pr-list | 169785 | 0.0071 | 0.98 | 93540 | 0.0039 | 0.97 | yes | pass |
| pr-reviews | 169785 | 0.0071 | 0.98 | 93540 | 0.0039 | 0.97 | yes | pass |
| pr-request-reviewers | 169785 | 0.0071 | 0.98 | 93540 | 0.0039 | 0.96 | yes | pass |
| issue-create | 169791 | 0.0071 | 0.98 | 93543 | 0.0039 | 0.97 | yes | pass |
| issue-list | 169779 | 0.0071 | 0.99 | 93537 | 0.0039 | 0.97 | yes | pass |
| issue-comment | 169785 | 0.0071 | 0.98 | 93540 | 0.0039 | 0.97 | yes | pass |
| actions-runs | 169803 | 0.0071 | 0.98 | 93549 | 0.0039 | 0.97 | yes | pass |
| actions-logs | 169791 | 0.0071 | 0.98 | 93543 | 0.0039 | 0.95 | yes | pass |
| actions-cancel | 169803 | 0.0071 | 0.98 | 93549 | 0.0039 | 0.97 | yes | pass |
| actions-artifacts | 169785 | 0.0071 | 0.96 | 93540 | 0.0039 | 0.94 | yes | pass |
| gist-create | 169773 | 0.0071 | 0.98 | 93534 | 0.0039 | 0.96 | yes | pass |
| search-repos | 169797 | 0.0071 | 0.97 | 93546 | 0.0039 | 0.95 | yes | pass |
| search-code | 169785 | 0.0071 | 0.92 | 93540 | 0.0039 | 0.90 | yes | pass |
| search-users | 169779 | 0.0071 | 0.87 | 93537 | 0.0039 | 0.94 | yes | pass |
| user-me | 169791 | 0.0071 | 0.98 | 93543 | 0.0039 | 0.96 | yes | pass |
| user-emails | 169791 | 0.0071 | 0.98 | 93543 | 0.0039 | 0.97 | yes | pass |
| star-repo | 169791 | 0.0071 | 0.96 | 93543 | 0.0039 | 0.96 | yes | pass |
| collaborators-list | 169779 | 0.0071 | 0.99 | 93537 | 0.0039 | 0.97 | yes | pass |
| collaborators-add | 169815 | 0.0071 | 0.94 | 93555 | 0.0039 | 0.89 | yes | pass |
| repo-create | 169797 | 0.0071 | 0.99 | 93546 | 0.0039 | 0.97 | yes | pass |
| repo-fork | 169767 | 0.0071 | 0.98 | 93531 | 0.0039 | 0.94 | yes | pass |
| releases-list | 169779 | 0.0071 | 0.98 | 93537 | 0.0039 | 0.97 | yes | pass |
| releases-create | 169779 | 0.0071 | 0.98 | 93537 | 0.0039 | 0.96 | yes | pass |
| git-tree | 169797 | 0.0071 | 0.97 | 93546 | 0.0039 | 0.94 | yes | pass |
| git-blob-create | 169791 | 0.0071 | 0.98 | 93543 | 0.0039 | 0.95 | yes | pass |
| branches-list | 169779 | 0.0071 | 0.98 | 93537 | 0.0039 | 0.97 | yes | pass |
| teams-list | 169779 | 0.0071 | 0.97 | 93537 | 0.0039 | 0.95 | yes | pass |
| teams-create | 169785 | 0.0071 | 0.98 | 93540 | 0.0039 | 0.95 | yes | pass |
| notifications-list | 169785 | 0.0071 | 0.98 | 93540 | 0.0039 | 0.97 | yes | pass |
| notifications-mark-read | 169779 | 0.0071 | 0.94 | 93537 | 0.0039 | 0.87 | yes | pass |
| org-repos | 169779 | 0.0071 | 0.98 | 93537 | 0.0039 | 0.97 | yes | pass |
| repo-languages | 169791 | 0.0071 | 0.98 | 93543 | 0.0039 | 0.96 | yes | pass |
| repo-commits | 169779 | 0.0071 | 0.98 | 93537 | 0.0039 | 0.96 | yes | pass |
| compare-commits | 169803 | 0.0071 | 0.96 | 93549 | 0.0039 | 0.90 | yes | pass |
| labels-list | 169779 | 0.0071 | 0.98 | 93537 | 0.0039 | 0.96 | yes | pass |
| labels-create | 169785 | 0.0071 | 0.96 | 93540 | 0.0039 | 0.95 | yes | pass |
| hooks-list | 169791 | 0.0071 | 0.98 | 93543 | 0.0039 | 0.97 | yes | pass |
| hooks-create | 169785 | 0.0071 | 0.98 | 93540 | 0.0039 | 0.96 | yes | pass |
| file-get | 169797 | 0.0071 | 0.87 | 93546 | 0.0039 | 0.88 | yes | pass |
| file-put | 169809 | 0.0071 | 0.98 | 93552 | 0.0039 | 0.96 | yes | pass |
| packages-org | 169785 | 0.0071 | 0.96 | 93540 | 0.0039 | 0.95 | yes | pass |
| sbom | 169803 | 0.0071 | 0.98 | 93549 | 0.0039 | 0.96 | yes | pass |
| advisories-repo | 169797 | 0.0071 | 0.98 | 93546 | 0.0039 | 0.96 | yes | pass |
| gists-user | 169797 | 0.0071 | 0.82 | 93546 | 0.0039 | 0.79 | yes | pass |
| check-run-get | 169797 | 0.0071 | 0.98 | 93546 | 0.0039 | 0.96 | yes | pass |
| codespaces-user | 169791 | 0.0071 | 0.98 | 93543 | 0.0039 | 0.97 | yes | pass |

Needs and expected operation ids: `evals/github-packing-queries.ts`. Rank dumps (`evals/*.json`) are local-only; rerun `npm run bench:packing` to regenerate them.

## What this does not show

Descriptors were compact (no `$ref` resolution, no parameter schemas). A later, fatter descriptor will raise the catalog share of the bill and shrink the relative win from moving the rubric. The 50 needs are clear capability sentences with one obvious GitHub operation. Ambiguous needs, missing operations, and abstain behavior are untested here.

## How to rerun

```bash
# needs examples/github/api.github.com.json and TYPESAFE_API_KEY
npm run bench:packing
```

Each query ranks the full catalog once with the current packer. Expect on the order of $0.20 and a couple of minutes. The table above is the original two-mode run and is not overwritten.
