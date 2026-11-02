# Agent discovery with and without JevSeek: full breakdown

This report expands the [product-level comparison](discovery-evaluation.md#product-level-agent-comparison). The [raw JSON](../evals/agent-product-comparison-20261103.json) preserves prompts, final answers, usage counters, and source checks. The [flat CSV](../evals/agent-product-comparison-20261103.csv) has one row per agent run for sorting or plotting.

## Measurement

There are 36 distinct local OpenAPI needs, each run once per condition on November 3, 2026, and three public MCP needs, each repeated three times per condition on November 2, 2026. The OpenAPI runs used the frozen GitHub, DigitalOcean, and Stripe source hashes listed in [the evaluation](discovery-evaluation.md#sources-and-questions), Codex CLI 0.166.0, and JevSeek revision `1e1ad77`. Both conditions used `gpt-6.1-sol` at medium reasoning, the same task prompt and working directory, read-only permissions, and available web search. JevSeek availability and its discovery skill were enabled together for the with condition. No target API operation or MCP data tool was called.

`Codex input` is the run-wide `input_tokens` counter. `Cached` is its cached input portion. `Uncached` equals input minus cached input. `Output` is Codex output tokens. `Jev input` is a separate TypeSafe ranking-model counter and is not included in Codex input; reported Jev cost is also separate. A blank CSV field or `—` means the counter was absent, not zero. `Time` is elapsed wall time for a completed agent process. Paired Δ is with JevSeek minus without JevSeek: a negative value means the enabled run used fewer uncached tokens or less time. The automated answer check matches the source operation method, path, operation ID, and top-level required body field names for OpenAPI, or the tool name and required input for MCP. These are contract-field checks, not proof that a target request would succeed.

## By source type

| Group | Pairs | Uncached input mean, no → with | Median, no → with | Change in summed uncached input | Paired uncached mean / median Δ | Fewer uncached with | Time mean, no → with (s) | Time median, no → with (s) | Paired time mean / median Δ (s) | Faster with | Correct, no → with |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Public MCP | 9 | 32,395 → 17,256 | 29,301 → 17,523 | -46.7% | -15,140 / -11,809 | 8/9 | 28.68 → 26.15 | 25.49 → 26.64 | -2.53 / -1.20 | 5/9 | 9/9 → 9/9 |
| Local OpenAPI | 36 | 16,931 → 14,536 | 16,394 → 12,315.5 | -14.1% | -2,395 / -2,501 | 25/36 | 37.09 → 41.08 | 35.97 → 40.87 | +3.99 / +3.70 | 11/36 | 36/36 → 36/36 |

The mean and median columns describe runs within each condition. The paired columns describe the difference within each matched prompt. The 9 MCP runs repeat three needs, while the 36 OpenAPI runs use distinct needs; the two studies are not pooled.

## By source

| Group | Pairs | Uncached input mean, no → with | Median, no → with | Change in summed uncached input | Paired uncached mean / median Δ | Fewer uncached with | Time mean, no → with (s) | Time median, no → with (s) | Paired time mean / median Δ (s) | Faster with | Correct, no → with |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Oxford Ledge | 9 | 32,395 → 17,256 | 29,301 → 17,523 | -46.7% | -15,140 / -11,809 | 8/9 | 28.68 → 26.15 | 25.49 → 26.64 | -2.53 / -1.20 | 5/9 | 9/9 → 9/9 |
| Stripe | 12 | 19,440 → 13,259 | 18,366 → 11,862.5 | -31.8% | -6,181 / -4,807 | 9/12 | 34.38 → 38.88 | 33.86 → 40.09 | +4.50 / +5.74 | 3/12 | 12/12 → 12/12 |
| DigitalOcean | 12 | 18,366 → 15,675 | 16,507.5 → 13,325.5 | -14.7% | -2,691 / -1,953 | 8/12 | 39.21 → 46.08 | 38.49 → 44.66 | +6.87 / +3.82 | 1/12 | 12/12 → 12/12 |
| GitHub | 12 | 12,988 → 14,674 | 13,132 → 11,525 | +13.0% | +1,686 / -2,091.5 | 8/12 | 37.69 → 38.28 | 37.50 → 37.42 | +0.59 / -0.07 | 7/12 | 12/12 → 12/12 |

## Token accounting by source

| Source | Pairs | Codex input total, no → with | Cached input, no → with | Uncached input, no → with | Codex output, no → with | Jev input / cost with | Discover / inspect calls with | Web searches, no → with |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Oxford Ledge | 9 | 1,250,149 → 1,092,516 | 958,592 → 937,216 | 291,557 → 155,300 | 5,397 → 4,290 | 140,590 / $0.005905 (6/9 reported) | 9 / 9 | 21 → 0 |
| Stripe | 12 | 1,082,301 → 1,272,578 | 849,024 → 1,113,472 | 233,277 → 159,106 | 7,169 → 6,825 | 345,627 / $0.014516 | 12 / 4 | 0 → 0 |
| DigitalOcean | 12 | 1,201,517 → 1,615,684 | 981,120 → 1,427,584 | 220,397 → 188,100 | 7,302 → 8,005 | 205,643 / $0.008637 | 12 / 30 | 0 → 0 |
| GitHub | 12 | 888,019 → 1,290,590 | 732,160 → 1,114,496 | 155,859 → 176,094 | 7,746 → 7,058 | 254,924 / $0.010707 | 12 / 4 | 0 → 0 |
| All local OpenAPI | 36 | 3,171,837 → 4,178,852 | 2,562,304 → 3,655,552 | 609,533 → 523,300 | 22,217 → 21,888 | 806,194 / $0.033860 | 36 / 38 | 0 → 0 |

Three Oxford `get_institutional_holders` runs lack Jev usage fields in the saved summaries. Oxford Jev token and cost totals therefore cover six of nine runs; its Codex and time columns cover all nine.

## By discovery outcome

The OpenAPI agent called `jevseek_discover` in all 36 enabled runs. Its trace returned matches in 27 and `Connection error: fetch failed` in nine. The agent completed the checked answer in every case, including the nine failures, by using other available tools. All OpenAPI tables include those failures; the groups below expose their effect without excluding them from the main comparison. The Jev usage counter is zero for each failed call. The public MCP summaries do not preserve discovery result status.

| Group | Pairs | Uncached input mean, no → with | Median, no → with | Change in summed uncached input | Paired uncached mean / median Δ | Fewer uncached with | Time mean, no → with (s) | Time median, no → with (s) | Paired time mean / median Δ (s) | Faster with | Correct, no → with |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Discovery returned matches | 27 | 17,742 → 14,219 | 16,431 → 12,457 | -19.9% | -3,524 / -2,800 | 20/27 | 37.50 → 40.23 | 36.48 → 40.08 | +2.73 / +0.85 | 10/27 | 27/27 → 27/27 |
| Discovery connection failed | 9 | 14,499 → 15,488 | 13,861 → 11,549 | +6.8% | +989 / -523 | 5/9 | 35.88 → 43.64 | 34.76 → 42.80 | +7.76 / +6.83 | 1/9 | 9/9 → 9/9 |

## By OpenAPI method

| Group | Pairs | Uncached input mean, no → with | Median, no → with | Change in summed uncached input | Paired uncached mean / median Δ | Fewer uncached with | Time mean, no → with (s) | Time median, no → with (s) | Paired time mean / median Δ (s) | Faster with | Correct, no → with |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| GET | 7 | 15,970 → 12,576 | 15,138 → 11,569 | -21.3% | -3,394 / -4,987 | 4/7 | 34.11 → 37.67 | 34.64 → 38.06 | +3.56 / +3.58 | 2/7 | 7/7 → 7/7 |
| POST | 20 | 18,268 → 15,198 | 17,616 → 12,481.5 | -16.8% | -3,070 / -3,022.5 | 15/20 | 37.05 → 41.52 | 34.75 → 40.87 | +4.47 / +2.95 | 8/20 | 20/20 → 20/20 |
| PUT | 1 | 16,431 → 23,806 | 16,431 → 23,806 | +44.9% | +7,375 / 7,375 | 0/1 | 33.24 → 39.92 | 33.24 → 39.92 | +6.68 / +6.68 | 0/1 | 1/1 → 1/1 |
| PATCH | 2 | 9,266 → 11,212 | 9,266.5 → 11,211.5 | +21.0% | +1,945 / 1,945 | 1/2 | 39.81 → 41.47 | 39.81 → 41.47 | +1.66 / +1.66 | 1/2 | 2/2 → 2/2 |
| DELETE | 6 | 16,238 → 14,180 | 15,109 → 12,061 | -12.7% | -2,058 / -2,256 | 5/6 | 40.44 → 43.66 | 40.01 → 43.53 | +3.22 / +2.56 | 0/6 | 6/6 → 6/6 |

## By required request-body fields

| Group | Pairs | Uncached input mean, no → with | Median, no → with | Change in summed uncached input | Paired uncached mean / median Δ | Fewer uncached with | Time mean, no → with (s) | Time median, no → with (s) | Paired time mean / median Δ (s) | Faster with | Correct, no → with |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Required body fields | 11 | 17,848 → 16,337 | 17,207 → 14,452 | -8.5% | -1,510 / -2,538 | 9/11 | 39.81 → 39.82 | 39.31 → 40.08 | +0.01 / -1.54 | 7/11 | 11/11 → 11/11 |
| No required body fields | 25 | 16,528 → 13,744 | 16,357 → 11,569 | -16.8% | -2,785 / -2,464 | 16/25 | 35.89 → 41.63 | 34.89 → 42.64 | +5.74 / +4.26 | 4/25 | 25/25 → 25/25 |

## By public MCP task

| Group | Pairs | Uncached input mean, no → with | Median, no → with | Change in summed uncached input | Paired uncached mean / median Δ | Fewer uncached with | Time mean, no → with (s) | Time median, no → with (s) | Paired time mean / median Δ (s) | Faster with | Correct, no → with |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Institutional holders | 3 | 28,529 → 18,035 | 28,768 → 18,061 | -36.8% | -10,494 / -11,240 | 3/3 | 33.01 → 25.23 | 36.64 → 26.45 | -7.78 / -8.03 | 3/3 | 3/3 → 3/3 |
| Common institutional holdings | 3 | 31,588 → 17,629 | 24,202 → 14,099 | -44.2% | -13,960 / -18,493 | 2/3 | 28.88 → 26.55 | 25.49 → 26.64 | -2.32 / +1.15 | 1/3 | 3/3 → 3/3 |
| Ownership changes | 3 | 37,068 → 16,103 | 30,001 → 17,523 | -56.6% | -20,965 / -12,399 | 3/3 | 24.14 → 26.67 | 25.36 → 27.38 | +2.53 / +2.02 | 1/3 | 3/3 → 3/3 |

## Every local OpenAPI task

Token cells show `total input / cached input / uncached input / output` for Codex. The Jev cell shows separately billed ranking input and reported USD cost. The discovery and inspection counts refer to JevSeek tool calls in the enabled run. Each task has one matched pair, so its row has a raw elapsed time rather than a task-specific average or median. `connection_error` means the discovery tool returned `Connection error: fetch failed`; `unrecorded` means the older MCP summary did not preserve the result status.

### Stripe

| ID | Need | Codex no: input / cached / uncached / output | Codex with: input / cached / uncached / output | Jev input / cost | Time no → with (Δ s) | Discover / inspect | Discovery result | Correct no / with |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| O02 | Change an existing subscription schedule's phases or other settings. | 104,470 / 84,864 / 19,606 / 884 | 89,707 / 76,288 / 13,419 / 716 | 38,391 / $0.001612 | 28.701 → 32.964 (+4.263) | 1 / 0 | matches | pass / pass |
| O04 | Create a short-lived account session token so a platform frontend can access connected-account functionality. | 70,572 / 57,088 / 13,484 / 642 | 107,679 / 96,128 / 11,551 / 611 | 38,403 / $0.001613 | 41.988 → 38.920 (-3.068) | 1 / 0 | matches | pass / pass |
| O05 | Modify an existing saved Sigma query. | 111,582 / 90,112 / 21,470 / 490 | 141,472 / 115,968 / 25,504 / 671 | 0 / $0.000000 | 29.536 → 44.737 (+15.201) | 1 / 0 | connection_error | pass / pass |
| O08 | Add an immutable transaction that changes a customer's credit balance. | 112,992 / 91,136 / 21,856 / 564 | 105,456 / 86,400 / 19,056 / 519 | 38,393 / $0.001613 | 40.436 → 48.713 (+8.277) | 1 / 1 | matches | pass / pass |
| O10 | Retrieve one existing ForwardingRequest by its identifier. | 79,891 / 61,184 / 18,707 / 496 | 81,889 / 77,696 / 4,193 / 383 | 38,393 / $0.001613 | 32.465 → 28.705 (-3.760) | 1 / 0 | matches | pass / pass |
| O13 | In test mode, mark one card personalization design as rejected. | 76,343 / 59,136 / 17,207 / 649 | 87,176 / 76,032 / 11,144 / 437 | 38,399 / $0.001613 | 32.087 → 30.032 (-2.055) | 1 / 0 | matches | pass / pass |
| O21 | Reverse a completed connected-account payout by debiting its destination bank account, rather than cancelling a pending payout. | 71,028 / 63,488 / 7,540 / 468 | 111,374 / 99,200 / 12,174 / 547 | 38,411 / $0.001613 | 32.847 → 42.996 (+10.149) | 1 / 1 | matches | pass / pass |
| O26 | Create a new product catalog import in the Commerce API. | 75,846 / 36,864 / 38,982 / 622 | 105,601 / 95,104 / 10,497 / 625 | 38,389 / $0.001612 | 34.053 → 41.262 (+7.209) | 1 / 1 | matches | pass / pass |
| O29 | Remove one price item from a subscription while leaving the subscription itself active. | 103,781 / 87,424 / 16,357 / 612 | 82,764 / 72,448 / 10,316 / 491 | 38,397 / $0.001613 | 37.803 → 38.004 (+0.201) | 1 / 0 | matches | pass / pass |
| O30 | Confirm the small bank deposits used to verify a PaymentIntent. | 102,217 / 77,312 / 24,905 / 623 | 109,712 / 98,432 / 11,280 / 574 | 0 / $0.000000 | 33.969 → 36.059 (+2.090) | 1 / 0 | connection_error | pass / pass |
| O32 | Record that the latest attempt on a Payment Record failed or errored. | 101,481 / 83,456 / 18,025 / 587 | 137,972 / 123,520 / 14,452 / 662 | 0 / $0.000000 | 33.758 → 41.275 (+7.517) | 1 / 0 | connection_error | pass / pass |
| O35 | Retrieve the full paginated collection of payments attached to an invoice, beyond the few embedded in the invoice response. | 72,098 / 56,960 / 15,138 / 532 | 111,776 / 96,256 / 15,520 / 589 | 38,451 / $0.001615 | 34.887 → 42.887 (+8.000) | 1 / 1 | matches | pass / pass |

### DigitalOcean

| ID | Need | Codex no: input / cached / uncached / output | Codex with: input / cached / uncached / output | Jev input / cost | Time no → with (Δ s) | Discover / inspect | Discovery result | Correct no / with |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| O06 | Destroy a Droplet together with only selected associated reserved IPs, snapshots, or volumes. | 87,236 / 75,776 / 11,460 / 665 | 136,117 / 123,392 / 12,725 / 661 | 7,812 / $0.000328 | 41.606 → 45.430 (+3.824) | 1 / 3 | matches | pass / pass |
| O07 | Delete a Kubernetes cluster and only the selected associated load balancers, volumes, or snapshots. | 112,004 / 88,320 / 23,684 / 606 | 135,812 / 114,176 / 21,636 / 657 | 8,340 / $0.000350 | 42.542 → 42.642 (+0.100) | 1 / 2 | matches | pass / pass |
| O14 | Update one existing API key belonging to a GenAI agent. | 100,783 / 84,352 / 16,431 / 552 | 135,166 / 111,360 / 23,806 / 623 | 7,587 / $0.000319 | 33.243 → 39.925 (+6.682) | 1 / 2 | matches | pass / pass |
| O16 | Assign existing resources such as Droplets to a particular project. | 93,443 / 67,200 / 26,243 / 624 | 152,313 / 131,584 / 20,729 / 751 | 7,914 / $0.000332 | 39.619 → 40.471 (+0.852) | 1 / 3 | matches | pass / pass |
| O17 | Start an export of a team's Signals conversation data, with optional filters by signal type or session. | 72,735 / 44,672 / 28,063 / 561 | 128,812 / 117,248 / 11,564 / 633 | 7,920 / $0.000333 | 28.724 → 43.883 (+15.159) | 1 / 2 | matches | pass / pass |
| O18 | Allocate a new reserved IP assigned either to a Droplet or to a region. | 103,496 / 86,912 / 16,584 / 472 | 149,789 / 138,240 / 11,549 / 697 | 0 / $0.000000 | 51.585 → 55.404 (+3.819) | 1 / 0 | connection_error | pass / pass |
| O20 | Purge selected cached file paths, possibly with a wildcard, from a CDN endpoint. | 146,369 / 125,952 / 20,417 / 759 | 127,575 / 109,696 / 17,879 / 598 | 71,427 / $0.003000 | 47.527 → 48.833 (+1.306) | 1 / 2 | matches | pass / pass |
| O22 | Read the load balancer metric for frontend TLS connections closed because the rate limit was exceeded. | 95,890 / 68,224 / 27,666 / 572 | 104,621 / 84,608 / 20,013 / 513 | 8,362 / $0.000351 | 29.405 → 38.936 (+9.531) | 1 / 1 | matches | pass / pass |
| O23 | Trigger an action such as resize or snapshot on an existing NFS share. | 69,450 / 55,296 / 14,154 / 712 | 138,662 / 124,800 / 13,862 / 975 | 71,545 / $0.003005 | 32.791 → 54.107 (+21.316) | 1 / 9 | matches | pass / pass |
| O24 | Undo an active app rollback and resume deployments from the app spec that was current before it. | 85,488 / 74,752 / 10,736 / 499 | 171,850 / 160,640 / 11,210 / 674 | 0 / $0.000000 | 37.355 → 57.897 (+20.542) | 1 / 0 | connection_error | pass / pass |
| O25 | Search distributed traces in a region over a time window, optionally filtering spans and paginating results. | 150,199 / 135,552 / 14,647 / 853 | 130,677 / 117,888 / 12,789 / 760 | 7,336 / $0.000308 | 51.506 → 49.965 (-1.541) | 1 / 5 | matches | pass / pass |
| O28 | Read the current state of a specific uptime check. | 84,424 / 74,112 / 10,312 / 427 | 104,290 / 93,952 / 10,338 / 463 | 7,400 / $0.000311 | 34.644 → 35.448 (+0.804) | 1 / 1 | matches | pass / pass |

### GitHub

| ID | Need | Codex no: input / cached / uncached / output | Codex with: input / cached / uncached / output | Jev input / cost | Time no → with (Δ s) | Discover / inspect | Discovery result | Correct no / with |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| O01 | Create a new organization private registry configuration using an encrypted secret. | 107,519 / 86,912 / 20,607 / 781 | 83,528 / 64,640 / 18,888 / 520 | 103,974 / $0.004367 | 33.768 → 27.097 (-6.671) | 1 / 0 | matches | pass / pass |
| O03 | Recover one recently deleted version of a package owned by a specified user, rather than a package owned by the authenticated user. | 84,911 / 64,768 / 20,143 / 747 | 105,431 / 94,592 / 10,839 / 611 | 7,713 / $0.000324 | 35.453 → 32.634 (-2.819) | 1 / 1 | matches | pass / pass |
| O09 | Fetch a particular historical version of a gist by its revision SHA, rather than its latest contents. | 59,405 / 51,200 / 8,205 / 575 | 125,477 / 106,496 / 18,981 / 657 | 0 / $0.000000 | 26.694 → 33.527 (+6.833) | 1 / 0 | connection_error | pass / pass |
| O11 | Create a new check run for a commit as a GitHub App. | 62,393 / 51,072 / 11,321 / 750 | 84,016 / 55,936 / 28,080 / 486 | 8,043 / $0.000338 | 39.310 → 35.051 (-4.259) | 1 / 0 | matches | pass / pass |
| O12 | Manually start an existing repository automation with optional context for its prompt. | 97,286 / 82,560 / 14,726 / 598 | 87,129 / 75,648 / 11,481 / 442 | 7,728 / $0.000325 | 46.680 → 40.079 (-6.601) | 1 / 0 | matches | pass / pass |
| O15 | Stop including one repository custom property in the OIDC tokens issued for an organization's Actions jobs. | 70,181 / 56,320 / 13,861 / 593 | 132,997 / 121,600 / 11,397 / 785 | 0 / $0.000000 | 34.764 → 42.801 (+8.037) | 1 / 0 | connection_error | pass / pass |
| O19 | Download the plain text log for one workflow job, rather than logs for the entire run. | 63,902 / 44,544 / 19,358 / 596 | 110,641 / 99,072 / 11,569 / 521 | 102,844 / $0.004319 | 42.521 → 46.097 (+3.576) | 1 / 1 | matches | pass / pass |
| O27 | Read one specific status record associated with an existing deployment. | 68,723 / 56,320 / 12,403 / 488 | 104,312 / 96,896 / 7,416 / 509 | 7,953 / $0.000334 | 38.159 → 38.062 (-0.097) | 1 / 1 | matches | pass / pass |
| O31 | Append several pull requests in order to the top of an existing pull request stack. | 69,053 / 64,000 / 5,053 / 667 | 134,870 / 110,976 / 23,894 / 755 | 0 / $0.000000 | 36.831 → 36.788 (-0.043) | 1 / 0 | connection_error | pass / pass |
| O33 | Change the state or dismissal details of one existing Dependabot security alert. | 72,280 / 57,728 / 14,552 / 662 | 82,286 / 72,320 / 9,966 / 496 | 8,230 / $0.000346 | 36.481 → 33.618 (-2.863) | 1 / 0 | matches | pass / pass |
| O34 | Change an existing spending budget for an organization as its billing manager. | 66,829 / 62,848 / 3,981 / 731 | 111,913 / 99,456 / 12,457 / 532 | 8,439 / $0.000354 | 43.145 → 49.326 (+6.181) | 1 / 1 | matches | pass / pass |
| O36 | Reopen the conversation on an issue whose comments were locked. | 65,537 / 53,888 / 11,649 / 558 | 127,990 / 116,864 / 11,126 / 744 | 0 / $0.000000 | 38.418 → 44.249 (+5.831) | 1 / 0 | connection_error | pass / pass |

## Every public MCP run

Each of the three tasks below has three matched runs. The per-task mean and median are in [By public MCP task](#by-public-mcp-task); these rows show the individual runs.

| ID | Need | Codex no: input / cached / uncached / output | Codex with: input / cached / uncached / output | Jev input / cost | Time no → with (Δ s) | Discover / inspect | Discovery result | Correct no / with |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| M01 | Common institutional holdings (run 1) | 154,852 / 107,136 / 47,716 / 683 | 118,803 / 104,704 / 14,099 / 479 | 23,425 / $0.000984 | 38.896 → 27.961 (-10.935) | 1 / 1 | unrecorded | pass / pass |
| M02 | Common institutional holdings (run 2) | 115,338 / 91,136 / 24,202 / 482 | 134,913 / 100,480 / 34,433 / 501 | 23,425 / $0.000984 | 25.490 → 26.644 (+1.154) | 1 / 1 | unrecorded | pass / pass |
| M03 | Common institutional holdings (run 3) | 102,847 / 80,000 / 22,847 / 564 | 108,290 / 103,936 / 4,354 / 472 | 23,425 / $0.000984 | 22.245 → 25.053 (+2.808) | 1 / 1 | unrecorded | pass / pass |
| M04 | Ownership changes (run 1) | 125,105 / 95,104 / 30,001 / 531 | 140,678 / 121,088 / 19,590 / 490 | 23,442 / $0.000985 | 21.335 → 28.108 (+6.773) | 1 / 1 | unrecorded | pass / pass |
| M05 | Ownership changes (run 2) | 125,026 / 95,104 / 29,922 / 522 | 104,051 / 86,528 / 17,523 / 470 | 23,433 / $0.000984 | 25.742 → 24.538 (-1.204) | 1 / 1 | unrecorded | pass / pass |
| M06 | Ownership changes (run 3) | 124,753 / 73,472 / 51,281 / 531 | 108,220 / 97,024 / 11,196 / 454 | 23,440 / $0.000984 | 25.358 → 27.378 (+2.020) | 1 / 1 | unrecorded | pass / pass |
| M07 | Institutional holders (run 1) | 202,485 / 173,184 / 29,301 / 783 | 104,845 / 86,784 / 18,061 / 442 | — / — | 39.558 → 26.455 (-13.103) | 1 / 1 | unrecorded | pass / pass |
| M08 | Institutional holders (run 2) | 179,967 / 152,448 / 27,519 / 770 | 140,301 / 121,216 / 19,085 / 504 | — / — | 36.638 → 28.608 (-8.030) | 1 / 1 | unrecorded | pass / pass |
| M09 | Institutional holders (run 3) | 119,776 / 91,008 / 28,768 / 531 | 132,415 / 115,456 / 16,959 / 478 | — / — | 22.842 → 20.633 (-2.209) | 1 / 1 | unrecorded | pass / pass |

The full answers, prompts, raw counters, and source checks remain in the JSON. The CSV includes total input, cached input, uncached input, output, Jev usage when recorded, result size, shell and web calls, discovery and inspection calls, elapsed time, and the check result for every individual agent run.
