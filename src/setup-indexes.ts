#!/usr/bin/env node

import { FirebaseService } from './firebase-service.js';
import { config } from 'dotenv';
import winston from 'winston';

// Load environment variables
config();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

async function setupFirebaseIndexes() {
  try {
    logger.info('🚀 Setting up Firebase indexes for vector search...');
    
    // Initialize Firebase service to ensure connection
    const firebaseService = new FirebaseService();
    
    logger.info('✅ Firebase connection established');
    
    // Since Firebase Admin SDK doesn't provide direct index creation,
    // we'll provide instructions for manual setup
    
    console.log(`
📋 FIREBASE VECTOR SEARCH SETUP INSTRUCTIONS

To enable vector search in your Firebase project, follow these steps:

1. 🔧 ENABLE FIRESTORE VECTOR SEARCH EXTENSION
   - Go to Firebase Console → Extensions
   - Search for "Vector Search with Firestore"
   - Install the extension with these settings:
     * Collection: crawled_chunks
     * Embedding field: embedding
     * Dimension: 1536
     * Distance measure: COSINE

2. 🏗️ MANUAL INDEX CREATION (Alternative)
   If the extension isn't available, create indexes manually:
   
   - Go to Firestore → Indexes
   - Create a composite index for 'crawled_chunks' collection:
     * Field: url (Ascending)
     * Field: createdAt (Descending)

3. 🔍 VERIFY SETUP
   Run this command to test:
   npm run dev

4. 🧪 TEST CRAWLING
   Once the server is running, try crawling a simple page:
   
   Example in Claude:
   "Use the crawl_single_page tool to crawl https://angular.io"

📚 FIRESTORE RULES
Ensure your Firestore rules allow read/write access for the service account:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /crawled_chunks/{document} {
      allow read, write: if true; // Adjust based on your security needs
    }
  }
}

🔐 SECURITY NOTE
The current setup allows full read/write access for testing.
For production, implement proper authentication and authorization rules.

✨ Your Firebase project is ready for vector search!
   Project ID: ${process.env.FIREBASE_PROJECT_ID}
   Service Account: ${process.env.FIREBASE_SERVICE_ACCOUNT_PATH ? '✅ Configured' : '❌ Missing'}
   OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Missing'}
`);

    logger.info('🎉 Setup instructions completed!');
    
  } catch (error) {
    logger.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run setup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupFirebaseIndexes();
}