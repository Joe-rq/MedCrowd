// Extract consensus points from agent responses using n-gram Jaccard similarity

import type { AgentResponseRecord } from "../types";
import { extractKeyPoints } from "./key-points";

const SIMILARITY_THRESHOLD = 0.35;

/** Generate character bigrams from text (works for CJK and Latin) */
function bigrams(text: string): Set<string> {
  const normalized = text.replace(/\s+/g, "");
  const set = new Set<string>();
  for (let i = 0; i < normalized.length - 1; i++) {
    set.add(normalized.slice(i, i + 2));
  }
  return set;
}

/** Jaccard similarity between two bigram sets */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const gram of a) {
    if (b.has(gram)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

interface PointWithSource {
  text: string;
  bigrams: Set<string>;
  agentIndex: number;
}

/**
 * Cluster key points by semantic similarity (bigram Jaccard).
 * Returns clusters where each cluster has points from ≥2 different agents.
 */
function clusterPoints(
  points: PointWithSource[]
): { representative: string; agentIndices: Set<number> }[] {
  const clusters: {
    representative: string;
    representativeBigrams: Set<string>;
    agentIndices: Set<number>;
  }[] = [];

  for (const point of points) {
    let merged = false;
    for (const cluster of clusters) {
      if (
        jaccardSimilarity(point.bigrams, cluster.representativeBigrams) >=
        SIMILARITY_THRESHOLD
      ) {
        cluster.agentIndices.add(point.agentIndex);
        // Keep the longer text as representative (more informative)
        if (point.text.length > cluster.representative.length) {
          cluster.representative = point.text;
          cluster.representativeBigrams = point.bigrams;
        }
        merged = true;
        break;
      }
    }
    if (!merged) {
      clusters.push({
        representative: point.text,
        representativeBigrams: point.bigrams,
        agentIndices: new Set([point.agentIndex]),
      });
    }
  }

  return clusters.map((c) => ({
    representative: c.representative,
    agentIndices: c.agentIndices,
  }));
}

export function extractConsensus(
  responses: AgentResponseRecord[]
): { point: string; agentCount: number; totalAgents: number }[] {
  const substantive = responses.filter(
    (r) => r.isValid && !r.invalidReason?.includes("无相关经历")
  );
  if (substantive.length < 2) return [];

  // Extract key points with agent source tracking
  const allPoints: PointWithSource[] = [];
  substantive.forEach((r, agentIndex) => {
    const points = extractKeyPoints(r.rawResponse);
    for (const text of points) {
      allPoints.push({ text, bigrams: bigrams(text), agentIndex });
    }
  });

  // Cluster by similarity and filter for ≥2 agents agreeing
  const clusters = clusterPoints(allPoints);
  return clusters
    .filter((c) => c.agentIndices.size >= 2)
    .sort((a, b) => b.agentIndices.size - a.agentIndices.size)
    .slice(0, 5)
    .map((c) => ({
      point: c.representative,
      agentCount: c.agentIndices.size,
      totalAgents: substantive.length,
    }));
}
