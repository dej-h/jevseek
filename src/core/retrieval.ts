import { estimateQuestionTokens, type RankOption } from "./candidates.js";

const MAX_LEXICAL_CANDIDATES = 100;
const MAX_ROUTE_GROUP = 100;
const MAX_DIRECT_CATALOG_TOKENS = 64_000;
const STOPWORDS = new Set([
  "a", "all", "an", "and", "by", "endpoint", "for", "from", "get", "github",
  "i", "in", "me", "my", "need", "of", "on", "one", "post", "put",
  "repository", "return", "returns", "that", "the", "to", "which", "with",
]);

interface CandidateDocument {
  option: RankOption;
  terms: Map<string, number>;
  length: number;
  routeRoot?: string;
}

/** A cheap, high-recall first pass over source-derived operation labels. */
export function selectCandidates(
  options: RankOption[],
  need: string,
  limit = MAX_LEXICAL_CANDIDATES,
): RankOption[] {
  if (options.length <= limit
    || options.reduce((sum, option) => sum + estimateQuestionTokens(option), 0) <= MAX_DIRECT_CATALOG_TOKENS) {
    return options;
  }
  const query = new Set(tokenize(need));
  if (query.size === 0) return options;

  const documents = options.map(toCandidateDocument);
  const documentFrequency = new Map<string, number>();
  const routeGroupSize = new Map<string, number>();
  let totalLength = 0;
  for (const document of documents) {
    totalLength += document.length;
    for (const term of document.terms.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
    if (document.routeRoot) {
      routeGroupSize.set(document.routeRoot, (routeGroupSize.get(document.routeRoot) ?? 0) + 1);
    }
  }
  const averageLength = totalLength / documents.length;
  const ranked = documents.map((document, index) => ({
    index,
    score: bm25(document, query, documentFrequency, documents.length, averageLength),
  })).sort((left, right) => right.score - left.score || left.index - right.index);

  const selected = new Set(ranked.slice(0, limit).map((entry) => entry.index));
  for (const [index, document] of documents.entries()) {
    if (document.routeRoot && query.has(document.routeRoot)
      && (routeGroupSize.get(document.routeRoot) ?? 0) <= MAX_ROUTE_GROUP) {
      selected.add(index);
    }
  }
  return documents.filter((_, index) => selected.has(index)).map((document) => document.option);
}

function toCandidateDocument(option: RankOption): CandidateDocument {
  const content = option.content;
  const fields = typeof content === "string" ? [content]
    : Array.isArray(content) ? content
    : [option.id, ...[content.operationId, content.summary, content.title, content.description,
      ...(Array.isArray(content.tags) ? content.tags : [])].filter((value): value is string => typeof value === "string")];
  const words = fields.flatMap(tokenize);
  const terms = new Map<string, number>();
  for (const word of words) terms.set(word, (terms.get(word) ?? 0) + 1);
  const path = typeof content === "object" && !Array.isArray(content) && typeof content.path === "string"
    ? content.path : option.id.replace(/^[A-Z]+\s+/, "");
  const routeRoot = path.startsWith("/") ? tokenize(path.split("/")[1] ?? "")[0] : undefined;
  return { option, terms, length: words.length, routeRoot };
}

function bm25(
  document: CandidateDocument,
  query: Set<string>,
  frequencies: Map<string, number>,
  documentCount: number,
  averageLength: number,
): number {
  let score = 0;
  for (const term of query) {
    const frequency = document.terms.get(term) ?? 0;
    if (frequency === 0) continue;
    const documentFrequency = frequencies.get(term) ?? 0;
    const idf = Math.log(1 + (documentCount - documentFrequency + 0.5) / (documentFrequency + 0.5));
    const normalizedLength = 0.25 + 0.75 * document.length / averageLength;
    score += idf * (frequency * 2.2) / (frequency + 1.2 * normalizedLength);
  }
  return score;
}

function tokenize(value: string): string[] {
  return (value.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .map((word) => {
      if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
      if (word.endsWith("es") && /(ch|sh|ss|x|z)es$/.test(word)) return word.slice(0, -2);
      if (word.endsWith("s") && word.length > 4) return word.slice(0, -1);
      return word;
    })
    .filter((word) => !STOPWORDS.has(word));
}
