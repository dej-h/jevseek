# Discovery evaluation, November 2026

JevSeek ranks operation descriptors from an OpenAPI document or public MCP catalog. This evaluation checks whether a source-derived shortlist reduces ranking cost without losing the requested operation, and whether a compact top-match preview reduces agent inspection work. The [development questions](../evals/discovery-development-20261102.json) and [unseen-target questions](../evals/discovery-holdout-20261102.json) preserve the capability need and expected source operation for review.

## Sources and questions

The direct evaluation used frozen local OpenAPI snapshots. Their hashes prevent a later specification revision from silently changing the answers.

| Source | Operations | SHA-256 |
| --- | ---: | --- |
| GitHub REST API | 1,254 | `0f85424a3c9603e75d11d3819c47f7e67f51d24bd6deb19cbb6b006e953195e1` |
| DigitalOcean API | 873 | `5f1156a780a769db54abb39183c8b5f1c39a8ba7bf111726f408110965bcaf6f` |
| Stripe API | 626 | `2c31317cdff103e4495b5b3501004d9ddc0af61f43b0ab819e2db392eef008f6` |

The 172-question development set has 101 curated needs, including three requests with no direct operation, and 71 questions derived from source summaries. Its 169 positive needs cover 168 distinct operations. The 150-question holdout selects 50 additional operation targets per source, none present in the development set. In total, the two sets contain 322 questions covering 318 distinct positive operations. Summary-derived questions test catalog breadth with wording close to the source; the curated questions are the stronger paraphrase check. A Stripe subscription update need accepts either of two source-supported routes.

The case files store source names rather than machine-specific file paths. With the three snapshots available locally and `TYPESAFE_API_KEY` set, run one set with:

```bash
node --import tsx evals/run-discovery-accuracy.ts \
  evals/discovery-development-20261102.json \
  /path/to/github-openapi.json \
  /path/to/digitalocean-openapi.yaml \
  /path/to/stripe-openapi.json > development-results.jsonl
```

The evaluator checks each source hash before making paid Jev requests. It writes one result per question with the selected target, confidence status, operations ranked, input tokens, and cost. Its final summary is written to stderr. Substitute the holdout case file for the second set. The snapshots are not packaged with JevSeek; a different source revision requires a separately reviewed answer key.

## Product-level agent comparison

The [per-run results](../evals/agent-product-comparison-20261103.json) include prompts, final answers, elapsed times, Codex usage counters, Jev calls, and checks against the source targets. For the local OpenAPI comparison, 36 distinct curated needs were run once with and once without JevSeek: 12 each for GitHub, DigitalOcean, and Stripe. Both Codex processes in each pair used `gpt-6.1-sol` at medium reasoning, the same source path and prompt, read-only permissions, and web search enabled. The JevSeek condition enabled its MCP server and discovery skill; the control disabled both and retained ordinary shell and web tools. The prompts named the source snapshot but did not require JevSeek. The enabled agent called `jevseek_discover` in all 36 tasks. Neither side used web search for these local files.

The checked answer contained the exact method, path, operation ID, and each top-level required request-body field from the frozen source. Both conditions passed all 36. “Uncached Codex input” is the sum of Codex's reported input tokens minus cached input tokens; it excludes Jev's separately billed ranking input. Time changes are medians of the 12 paired differences for each source, so they need not equal the difference between the two independent medians.

| Source | Tasks | Without JevSeek: uncached Codex input | With JevSeek | Change | Median paired time change |
| --- | ---: | ---: | ---: | ---: | ---: |
| Stripe | 12 | 233,277 | 159,106 | 32% less | 5.736 s slower |
| DigitalOcean | 12 | 220,397 | 188,100 | 15% less | 3.822 s slower |
| GitHub | 12 | 155,859 | 176,094 | 13% more | 0.070 s faster |
| **All local OpenAPI** | **36** | **609,533** | **523,300** | **14% less** | **3.698 s slower** |

The JevSeek condition also sent 806,194 input tokens to Jev across the 36 tasks, at a total reported Jev cost of $0.0339. Those tokens are outside the Codex column and must be counted when comparing total model work. JevSeek reduced uncached Codex input on 25 of 36 individual tasks, and the enabled agent finished faster on 11 of 36. Both conditions returned the right checked contract, so this set does not establish an accuracy gain. Several DigitalOcean requests needed repeated reference inspection; one NFS action task made ten JevSeek tool calls and finished 21 seconds later than its control.

An earlier matched comparison used three needs from the live [Oxford Ledge public MCP catalog](https://www.oxfordledge.com/mcp), each repeated three times with web search available. The control used web and shell tools; the JevSeek condition called discovery and inspection. Both conditions reported the checked tool name and required inputs in all nine runs. Mean uncached Codex input fell from 32,395 to 17,256 tokens per task, a 47% reduction; the median paired run was 1.204 seconds faster with JevSeek. These November 2 runs used the previously installed client and an older discovery-skill instruction, so they are shown separately from the November 3 OpenAPI runs and are not pooled into their total. The endpoint is live and has no frozen source hash.

For the 36 OpenAPI JevSeek runs, the frozen GitHub source was 13,917,893 bytes, Stripe 4,518,735 bytes, and DigitalOcean 4,281,270 bytes. Median complete serialized MCP discovery results, including text and structured content, were 4,350, 5,204, and 3,629 bytes respectively. This is the amount of source material returned by JevSeek, not a measurement of how much source an agent without JevSeek would read. The matched agent counters above measure the actual alternative behavior. A single run per distinct OpenAPI task and three repeated remote needs leave timing and broader generalization uncertain.

## Direct ranking

The measured baseline ranked each full catalog. The lean variant used compact source descriptors from at most 100 lexical candidates for large catalogs, with a full-catalog retry after a weak result. Stripe's catalog stayed below the shortlist threshold and was ranked whole in both variants.

| Question set | Baseline accepted | Lean accepted | Baseline Jev input tokens | Lean Jev input tokens |
| --- | ---: | ---: | ---: | ---: |
| Development: 169 positive, 3 negative | 168/169 positive, 3/3 negative | 169/169 positive, 3/3 negative | 12,854,026 | 3,607,108 |
| Holdout: 150 positive | 146/150 exact | 145/150 exact | 9,870,740 | 2,863,445 |

On the holdout, both branches chose the same top operation for all 100 GitHub and DigitalOcean needs. Their only disagreement was a Stripe account-disconnection query, where shortlisting was disabled. Four shared exact-path misses involved source-summary ambiguity, including alternate subscription cancellation routes. These raw exact scores are retained in the case file rather than rewriting questions after observing rankings. The lean variant reduced Jev input tokens by 72% on the development set and 71% on the holdout.

## Codex workflows

The agent evaluation used 36 distinct curated tasks, 12 per source, with four matched Codex sessions per task: baseline, lean shortlist, compact preview, and both changes. All sessions used `gpt-6.1-sol` with medium reasoning, the same prompt and source snapshot, read-only permissions, the installed discovery skill, and web search enabled. The prompts named the source but did not require JevSeek. All 144 sessions chose discovery; none used web search. Each returned the expected method, path, operation ID, and checked top-level required request-body fields.

| Variant | Faster than baseline | Median paired time change | Jev input tokens | Inspection calls |
| --- | ---: | ---: | ---: | ---: |
| Baseline | reference | reference | 2,368,628 | 90 |
| Lean shortlist | 15/36 | +0.953 s | 1,222,624 | 86 |
| Compact preview | 18/36 | +0.178 s | 2,273,758 | 68 |
| Combined | 21/36 | -0.809 s | 1,286,750 | 67 |

Negative time change means faster. The combined variant reduced ranking tokens and inspection calls, but its median end-to-end time gain was under one second. A second 36-task comparison held the combined code fixed and varied only the local discovery skill. A preview-aware instruction reduced inspections from 57 to 46, enabled 12 discovery-only answers, and was faster in 19/36 pairs with a median paired gain of 0.777 seconds. All answers passed the same target and field checks. Stripe supplied most of the speed gain; several DigitalOcean schemas still required multiple reference inspections, and individual Codex runs had large timing outliers.

In the 36-task agent run, the largest recorded MCP discovery result with preview was 26,915 UTF-8 bytes, including both text and structured content. Its preview was 11,660 bytes. This PR adds an explicit 16 KiB preview cap with an inspection hint for larger source fields; the cap and packaging changes were tested after these agent measurements, but the full agent set was not rerun on the final PR branch.

This evaluation covers three large OpenAPI snapshots. It does not establish accuracy or speed across other providers or large live MCP catalogs. The source summary holdout tests breadth rather than difficult language variation, and one agent run per distinct task leaves end-to-end timing noisy.
