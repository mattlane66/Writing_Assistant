// Dependency-free, local latent semantic analysis. This learns co-occurrence
// only from the supplied card corpus; it is not a pretrained language encoder.
// It cannot understand out-of-vocabulary synonyms or verify a claim.
const dot = (left, right) => left.reduce((sum, value, i) => sum + value * right[i], 0);
function normalize(vector) {
  const norm = Math.sqrt(dot(vector, vector));
  return norm > 1e-10 ? vector.map((value) => value / norm) : vector.map(() => 0);
}

export function buildLocalLatentIndex(documents, frequencies) {
  const count = documents.length;
  if (count < 2) return { documents: [], axes: [], dimensions: 0, vocabularySize: 0 };
  const vocabulary = [...frequencies.keys()];
  const idfs = vocabulary.map((word) => Math.log(1 + count / (frequencies.get(word) ?? 1)));
  const vectors = documents.map((doc) => normalize(vocabulary.map((word, i) => Math.log1p(doc.counts.get(word) ?? 0) * idfs[i])));
  const gram = vectors.map((left) => vectors.map((right) => dot(left, right)));
  const dimensions = Math.min(12, Math.max(2, Math.floor(Math.sqrt(count))), count - 1);
  const axes = [];
  for (let axis = 0; axis < dimensions; axis += 1) {
    let vector = normalize(Array.from({ length: count }, (_, i) => Math.sin((i + 1) * (axis + 1.17))));
    for (let iteration = 0; iteration < 80; iteration += 1) {
      let next = gram.map((row) => dot(row, vector));
      for (const previous of axes) {
        const projection = dot(next, previous.vector);
        next = next.map((value, i) => value - projection * previous.vector[i]);
      }
      next = normalize(next);
      const delta = Math.abs(dot(next, vector));
      vector = next;
      if (delta > 1 - 1e-9) break;
    }
    const eigenvalue = dot(vector, gram.map((row) => dot(row, vector)));
    if (eigenvalue <= 1e-8) break;
    axes.push({ vector, eigenvalue });
  }
  const projected = documents.map((doc, i) => ({
    id: doc.card.id,
    vector: normalize(axes.map((axis) => Math.sqrt(axis.eigenvalue) * axis.vector[i])),
  }));
  return { documents: projected, axes, vectors, vocabulary, idfs, dimensions: axes.length, vocabularySize: vocabulary.length };
}

export function scoreLocalLatentIndex(index, queryWords) {
  if (!index.axes.length) return [];
  const query = normalize(index.vocabulary.map((word, i) => queryWords.has(word) ? index.idfs[i] : 0));
  if (!query.some(Boolean)) return [];
  const similarities = index.vectors.map((vector) => dot(vector, query));
  const projected = normalize(index.axes.map((axis) => dot(similarities, axis.vector) / Math.sqrt(axis.eigenvalue)));
  return index.documents.map((doc) => ({ cardId: doc.id, score: Math.min(1, Math.max(0, dot(doc.vector, projected))) }));
}
