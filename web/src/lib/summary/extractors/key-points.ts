// Extract key points from response text

export function extractKeyPoints(text: string): string[] {
  const sentences = text.split(/[。！？\n]+/).filter((s) => s.trim().length > 5);
  return sentences.slice(0, 3).map((s) => s.trim());
}
