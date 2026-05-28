import crypto from 'crypto';
import { BLUE_KNOWLEDGE } from './blue-knowledge';
import { isDbConfigured, sqlQuery } from './db';
import { ensureBlueRagSchema } from './ensureBlueRagSchema';
import { embedBlueRagTexts, toPgVectorLiteral } from './blue-rag-embeddings';

export interface BlueRagSeedResult {
  sources: number;
  chunks: number;
  embeddingModel: string;
  embeddingProvider: string;
}

interface SourceChunk {
  sourceId: string;
  sourceType: string;
  title: string;
  route: string | null;
  chunkIndex: number;
  content: string;
  metadata: Record<string, unknown>;
}

export async function ensureBlueRagReady() {
  if (!isDbConfigured()) return { ready: false, reason: 'db_unconfigured' as const };

  await ensureBlueRagSchema();

  const rows = await sqlQuery<Array<{ count: string }>>(
    `SELECT COUNT(*)::text AS count FROM blue_rag_chunks`
  );
  const count = Number(rows[0]?.count ?? 0);
  if (count > 0) return { ready: true as const, seeded: false, chunkCount: count };

  if (process.env.BLUE_RAG_AUTO_SEED === '0') {
    return { ready: false as const, reason: 'index_empty' as const };
  }

  const seeded = await seedBlueRagKnowledgeBase();
  return { ready: true as const, seeded: true, chunkCount: seeded.chunks };
}

export async function seedBlueRagKnowledgeBase(): Promise<BlueRagSeedResult> {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured; cannot seed Blue RAG index');
  }

  await ensureBlueRagSchema();

  const chunks = buildKnowledgeChunks();
  const embeddingTexts = chunks.map((chunk) => [chunk.title, chunk.content].join('\n\n'));
  const { embeddings, model, dimension, provider } = await embedBlueRagTexts(embeddingTexts);

  const sources = new Map<string, SourceChunk[]>();
  for (const chunk of chunks) {
    const existing = sources.get(chunk.sourceId) ?? [];
    existing.push(chunk);
    sources.set(chunk.sourceId, existing);
  }

  for (const [sourceId, sourceChunks] of sources.entries()) {
    const first = sourceChunks[0];
    const contentHash = hashText(sourceChunks.map((chunk) => chunk.content).join('\n\n'));

    await sqlQuery(
      `INSERT INTO blue_rag_sources (
         id, source_type, title, route, url, content_hash, metadata, enabled
       )
       VALUES (
         :id, :sourceType, :title, :route, :url, :contentHash, :metadata::jsonb, TRUE
       )
       ON CONFLICT (id)
       DO UPDATE SET
         source_type = EXCLUDED.source_type,
         title = EXCLUDED.title,
         route = EXCLUDED.route,
         url = EXCLUDED.url,
         content_hash = EXCLUDED.content_hash,
         metadata = EXCLUDED.metadata,
         enabled = TRUE,
         updated_at = CURRENT_TIMESTAMP`,
      {
        id: sourceId,
        sourceType: first.sourceType,
        title: first.title,
        route: first.route,
        url: first.route,
        contentHash,
        metadata: JSON.stringify({ seed: 'BLUE_KNOWLEDGE' }),
      }
    );
  }

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const embedding = toPgVectorLiteral(embeddings[index]);
    const contentHash = hashText(chunk.content);

    await sqlQuery(
      `INSERT INTO blue_rag_chunks (
         source_id, source_type, title, route, chunk_index, content, content_hash,
         token_count, metadata, embedding, embedding_model, embedding_dim
       )
       VALUES (
         :sourceId, :sourceType, :title, :route, :chunkIndex, :content, :contentHash,
         :tokenCount, :metadata::jsonb, :embedding::vector, :embeddingModel, :embeddingDim
       )
       ON CONFLICT (source_id, chunk_index)
       DO UPDATE SET
         source_type = EXCLUDED.source_type,
         title = EXCLUDED.title,
         route = EXCLUDED.route,
         content = EXCLUDED.content,
         content_hash = EXCLUDED.content_hash,
         token_count = EXCLUDED.token_count,
         metadata = EXCLUDED.metadata,
         embedding = EXCLUDED.embedding,
         embedding_model = EXCLUDED.embedding_model,
         embedding_dim = EXCLUDED.embedding_dim,
         updated_at = CURRENT_TIMESTAMP`,
      {
        sourceId: chunk.sourceId,
        sourceType: chunk.sourceType,
        title: chunk.title,
        route: chunk.route,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        contentHash,
        tokenCount: approximateTokenCount(chunk.content),
        metadata: JSON.stringify(chunk.metadata),
        embedding,
        embeddingModel: model,
        embeddingDim: dimension,
      }
    );
  }

  for (const [sourceId, sourceChunks] of sources.entries()) {
    await sqlQuery(
      `DELETE FROM blue_rag_chunks
       WHERE source_id = $1 AND chunk_index >= $2`,
      [sourceId, sourceChunks.length]
    );
  }

  return {
    sources: sources.size,
    chunks: chunks.length,
    embeddingModel: model,
    embeddingProvider: provider,
  };
}

function buildKnowledgeChunks(): SourceChunk[] {
  return BLUE_KNOWLEDGE.flatMap((entry) => {
    const route = entry.routes.find((candidate) => candidate !== '*') ?? null;
    const parts = chunkText(entry.body, 900);
    return parts.map((content, index) => ({
      sourceId: entry.id,
      sourceType: 'blue_knowledge',
      title: entry.title,
      route,
      chunkIndex: index,
      content,
      metadata: {
        routes: entry.routes,
        keywords: entry.keywords,
      },
    }));
  });
}

function chunkText(text: string, maxLength: number) {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= maxLength) return [trimmed];

  const sentences = trimmed.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [trimmed];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence.trim()}` : sentence.trim();
    if (next.length > maxLength && current) {
      chunks.push(current);
      current = sentence.trim();
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function approximateTokenCount(text: string) {
  return Math.ceil(text.length / 4);
}

function hashText(text: string) {
  return crypto.createHash('sha256').update(text).digest('hex');
}
