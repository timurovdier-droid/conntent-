export type RankedChunk = {
  id: string;
  documentId: string;
  workspaceId: string;
  text: string;
  pageNumber: number | null;
  documentTitle: string;
  embedding: number[] | null;
  embeddingModel: string | null;
};

export function cosine(left: number[], right: number[]) {
  if (left.length === 0 || left.length !== right.length) return -1;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (leftNorm === 0 || rightNorm === 0) return -1;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

export function chunksForWorkspace<T extends { workspaceId: string }>(chunks: T[], workspaceId: string) {
  return chunks.filter((chunk) => chunk.workspaceId === workspaceId);
}

export function rankByVector(chunks: RankedChunk[], vector: number[], model: string, dimensions: number, limit: number) {
  return chunks
    .map((chunk) => ({
      chunk,
      score:
        chunk.embedding && chunk.embeddingModel === model && chunk.embedding.length === dimensions
          ? cosine(vector, chunk.embedding)
          : -1,
    }))
    .filter((item) => item.score >= 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.chunk);
}

export function rankByKeyword(chunks: RankedChunk[], query: string, limit: number) {
  const words = Array.from(new Set(query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 3)));
  return chunks
    .map((chunk) => {
      const haystack = chunk.text.toLowerCase();
      const score = words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
      return { chunk, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.chunk);
}
