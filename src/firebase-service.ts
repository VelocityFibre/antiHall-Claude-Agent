import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';
import { credential } from 'firebase-admin';
import { readFileSync } from 'fs';
import OpenAI from 'openai';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

export interface CrawledChunk {
  url: string;
  content: string;
  contextualContent?: string;
  embedding: number[];
  createdAt: Date;
  chunkIndex: number;
  contextualEmbeddingUsed: boolean;
  metadata?: Record<string, any>;
}

export interface SearchResult {
  content: string;
  contextualContent?: string;
  url: string;
  similarity: number;
  chunkIndex: number;
  metadata?: Record<string, any>;
}

export class FirebaseService {
  private app!: App;
  private db: Firestore;
  private openai: OpenAI;

  constructor() {
    this.initializeFirebase();
    this.db = getFirestore();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  private initializeFirebase(): void {
    // Check if Firebase is already initialized
    if (getApps().length === 0) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

      if (!projectId) {
        throw new Error('FIREBASE_PROJECT_ID environment variable is required');
      }

      let app: App;
      
      if (serviceAccountPath) {
        try {
          const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
          app = initializeApp({
            credential: credential.cert(serviceAccount),
            projectId
          });
        } catch (error) {
          logger.error('Failed to load service account key:', error);
          throw new Error('Failed to initialize Firebase with service account key');
        }
      } else {
        // Use default credentials (for Cloud environments)
        app = initializeApp({ projectId });
      }

      this.app = app;
      logger.info('Firebase initialized successfully');
    } else {
      this.app = getApps()[0];
    }
  }

  async createEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        dimensions: 1536
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('Error creating embedding:', error);
      throw new Error('Failed to create embedding');
    }
  }

  async createEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts,
        dimensions: 1536
      });

      return response.data.map((item: any) => item.embedding);
    } catch (error) {
      logger.error('Error creating batch embeddings:', error);
      // Fallback to individual embeddings
      const embeddings: number[][] = [];
      for (const text of texts) {
        try {
          const embedding = await this.createEmbedding(text);
          embeddings.push(embedding);
        } catch (err) {
          logger.warn('Failed to create individual embedding, using zero vector');
          embeddings.push(new Array(1536).fill(0));
        }
      }
      return embeddings;
    }
  }

  splitTextIntoChunks(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    if (!text) return [];

    const chunks: string[] = [];
    let start = 0;
    const textLength = text.length;

    while (start < textLength) {
      let end = start + chunkSize;

      if (end >= textLength) {
        chunks.push(text.substring(start));
        break;
      }

      // Try to break at sentence boundary
      let breakPoint = text.lastIndexOf('.', end);
      if (breakPoint === -1 || breakPoint <= start) {
        // Try to break at word boundary
        breakPoint = text.lastIndexOf(' ', end);
      }

      if (breakPoint !== -1 && breakPoint > start) {
        chunks.push(text.substring(start, breakPoint + 1));
        start = breakPoint + 1 - overlap;
      } else {
        chunks.push(text.substring(start, end));
        start = end - overlap;
      }
    }

    return chunks.filter(chunk => chunk.trim().length > 0);
  }

  async storeCrawledContent(url: string, content: string, metadata?: Record<string, any>): Promise<number> {
    try {
      const chunks = this.splitTextIntoChunks(content);
      logger.info(`Processing ${chunks.length} chunks for ${url}`);

      const embeddings = await this.createEmbeddingsBatch(chunks);
      const chunksCollection = this.db.collection('crawled_chunks');

      let storedCount = 0;
      const batchSize = 10;

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = this.db.batch();
        const endIndex = Math.min(i + batchSize, chunks.length);

        for (let j = i; j < endIndex; j++) {
          const chunkData: CrawledChunk = {
            url,
            content: chunks[j],
            embedding: embeddings[j],
            createdAt: new Date(),
            chunkIndex: j,
            contextualEmbeddingUsed: false,
            metadata
          };

          const docRef = chunksCollection.doc();
          batch.set(docRef, {
            ...chunkData,
            createdAt: FieldValue.serverTimestamp()
          });
        }

        await batch.commit();
        storedCount += endIndex - i;
        logger.info(`Stored batch ${Math.floor(i / batchSize) + 1}, total: ${storedCount} chunks`);
      }

      return storedCount;
    } catch (error) {
      logger.error('Error storing crawled content:', error);
      throw error;
    }
  }

  async semanticSearch(query: string, limit: number = 5, similarityThreshold: number = 0.7): Promise<SearchResult[]> {
    try {
      // Create embedding for the query
      const queryEmbedding = await this.createEmbedding(query);
      
      // Firebase doesn't have native vector search yet, so we'll simulate it
      // In a real implementation, you'd use Firebase's vector search extension
      // or implement approximate nearest neighbor search
      
      const chunksCollection = this.db.collection('crawled_chunks');
      const snapshot = await chunksCollection.limit(1000).get(); // Limit for performance
      
      const results: SearchResult[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data() as CrawledChunk;
        if (data.embedding && data.embedding.length === queryEmbedding.length) {
          // Calculate cosine similarity
          const similarity = this.calculateCosineSimilarity(queryEmbedding, data.embedding);
          
          if (similarity >= similarityThreshold) {
            results.push({
              content: data.content,
              contextualContent: data.contextualContent,
              url: data.url,
              similarity,
              chunkIndex: data.chunkIndex,
              metadata: data.metadata
            });
          }
        }
      });

      // Sort by similarity and return top results
      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

    } catch (error) {
      logger.error('Error in semantic search:', error);
      throw error;
    }
  }

  private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    
    return normA && normB ? dotProduct / (normA * normB) : 0;
  }

  async getAvailableSources(): Promise<string[]> {
    try {
      const chunksCollection = this.db.collection('crawled_chunks');
      const snapshot = await chunksCollection.select('url').get();
      
      const urls = new Set<string>();
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.url) {
          const domain = new URL(data.url).hostname;
          urls.add(domain);
        }
      });

      return Array.from(urls);
    } catch (error) {
      logger.error('Error getting available sources:', error);
      throw error;
    }
  }

  async clearCollection(collectionName: string): Promise<void> {
    const collection = this.db.collection(collectionName);
    const snapshot = await collection.get();
    
    const batch = this.db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    logger.info(`Cleared collection: ${collectionName}`);
  }
}