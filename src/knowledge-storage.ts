import { initializeApp, getApps, App, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { ParsedCodebase, AngularComponent, AngularService, InterfaceInfo, ModelInfo } from './codebase-parser.js';
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

export class KnowledgeStorage {
  private app!: App;
  private db: Firestore;

  private cleanData(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.cleanData(item)).filter(item => item !== null && item !== undefined);
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const cleanedValue = this.cleanData(value);
        if (cleanedValue !== null && cleanedValue !== undefined) {
          cleaned[key] = cleanedValue;
        }
      }
      return cleaned;
    }
    
    return obj;
  }

  constructor() {
    this.initializeFirebase();
    this.db = getFirestore();
  }

  private initializeFirebase(): void {
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
            credential: cert(serviceAccount),
            projectId
          });
        } catch (error) {
          logger.error('Failed to load service account key:', error);
          throw new Error('Failed to initialize Firebase with service account key');
        }
      } else {
        app = initializeApp({ 
          credential: applicationDefault(),
          projectId 
        });
      }

      this.app = app;
      logger.info('Firebase initialized for knowledge storage');
    } else {
      this.app = getApps()[0];
    }
  }

  async storeCodebaseKnowledge(codebase: ParsedCodebase, projectName: string = 'fibreflow'): Promise<void> {
    const batch = this.db.batch();
    const timestamp = FieldValue.serverTimestamp();

    try {
      // Store project metadata
      const projectRef = this.db.collection('knowledge_graph').doc(projectName);
      batch.set(projectRef, {
        name: projectName,
        lastUpdated: timestamp,
        stats: {
          components: codebase.components.length,
          services: codebase.services.length,
          interfaces: codebase.interfaces.length,
          models: codebase.models.length
        }
      }, { merge: true });

      // Store components
      for (const component of codebase.components) {
        const componentRef = this.db
          .collection('knowledge_graph')
          .doc(projectName)
          .collection('components')
          .doc(component.name);

        const cleanComponent = this.cleanData({
          ...component,
          lastUpdated: timestamp
        });
        batch.set(componentRef, cleanComponent);
      }

      // Store services
      for (const service of codebase.services) {
        const serviceRef = this.db
          .collection('knowledge_graph')
          .doc(projectName)
          .collection('services')
          .doc(service.name);

        const cleanService = this.cleanData({
          ...service,
          lastUpdated: timestamp
        });
        batch.set(serviceRef, cleanService);
      }

      // Store interfaces
      for (const iface of codebase.interfaces) {
        const interfaceRef = this.db
          .collection('knowledge_graph')
          .doc(projectName)
          .collection('interfaces')
          .doc(iface.name);

        const cleanInterface = this.cleanData({
          ...iface,
          lastUpdated: timestamp
        });
        batch.set(interfaceRef, cleanInterface);
      }

      // Store models
      for (const model of codebase.models) {
        const modelRef = this.db
          .collection('knowledge_graph')
          .doc(projectName)
          .collection('models')
          .doc(model.name);

        const cleanModel = this.cleanData({
          ...model,
          lastUpdated: timestamp
        });
        batch.set(modelRef, cleanModel);
      }

      await batch.commit();
      logger.info(`Stored knowledge graph for ${projectName}`);

    } catch (error) {
      logger.error('Error storing codebase knowledge:', error);
      throw error;
    }
  }

  async getStoredCodebase(projectName: string = 'fibreflow'): Promise<ParsedCodebase | null> {
    try {
      const projectDoc = await this.db.collection('knowledge_graph').doc(projectName).get();
      
      if (!projectDoc.exists) {
        logger.warn(`No knowledge graph found for project: ${projectName}`);
        return null;
      }

      // Fetch all collections in parallel
      const [componentsSnapshot, servicesSnapshot, interfacesSnapshot, modelsSnapshot] = await Promise.all([
        this.db.collection('knowledge_graph').doc(projectName).collection('components').get(),
        this.db.collection('knowledge_graph').doc(projectName).collection('services').get(),
        this.db.collection('knowledge_graph').doc(projectName).collection('interfaces').get(),
        this.db.collection('knowledge_graph').doc(projectName).collection('models').get()
      ]);

      const codebase: ParsedCodebase = {
        components: componentsSnapshot.docs.map(doc => doc.data() as AngularComponent),
        services: servicesSnapshot.docs.map(doc => doc.data() as AngularService),
        interfaces: interfacesSnapshot.docs.map(doc => doc.data() as InterfaceInfo),
        models: modelsSnapshot.docs.map(doc => doc.data() as ModelInfo)
      };

      logger.info(`Retrieved knowledge graph for ${projectName}`);
      return codebase;

    } catch (error) {
      logger.error('Error retrieving codebase knowledge:', error);
      throw error;
    }
  }

  async searchServices(query: string, projectName: string = 'fibreflow'): Promise<AngularService[]> {
    try {
      const servicesRef = this.db
        .collection('knowledge_graph')
        .doc(projectName)
        .collection('services');

      // Simple substring search on service names and method names
      const snapshot = await servicesRef.get();
      const results: AngularService[] = [];

      snapshot.forEach(doc => {
        const service = doc.data() as AngularService;
        const lowerQuery = query.toLowerCase();

        // Check service name
        if (service.name.toLowerCase().includes(lowerQuery)) {
          results.push(service);
          return;
        }

        // Check method names
        const hasMatchingMethod = service.methods.some(method => 
          method.name.toLowerCase().includes(lowerQuery)
        );

        if (hasMatchingMethod) {
          results.push(service);
        }
      });

      return results;
    } catch (error) {
      logger.error('Error searching services:', error);
      return [];
    }
  }

  async searchComponents(query: string, projectName: string = 'fibreflow'): Promise<AngularComponent[]> {
    try {
      const componentsRef = this.db
        .collection('knowledge_graph')
        .doc(projectName)
        .collection('components');

      const snapshot = await componentsRef.get();
      const results: AngularComponent[] = [];

      snapshot.forEach(doc => {
        const component = doc.data() as AngularComponent;
        const lowerQuery = query.toLowerCase();

        // Check component name or selector
        if (component.name.toLowerCase().includes(lowerQuery) ||
            component.selector?.toLowerCase().includes(lowerQuery)) {
          results.push(component);
        }
      });

      return results;
    } catch (error) {
      logger.error('Error searching components:', error);
      return [];
    }
  }

  async getProjectStats(projectName: string = 'fibreflow'): Promise<any> {
    try {
      const projectDoc = await this.db.collection('knowledge_graph').doc(projectName).get();
      
      if (!projectDoc.exists) {
        return null;
      }

      const data = projectDoc.data();
      return {
        ...data?.stats,
        lastUpdated: data?.lastUpdated
      };

    } catch (error) {
      logger.error('Error getting project stats:', error);
      return null;
    }
  }

  async clearKnowledgeGraph(projectName: string = 'fibreflow'): Promise<void> {
    try {
      // Delete all subcollections
      const collections = ['components', 'services', 'interfaces', 'models'];
      
      for (const collectionName of collections) {
        const collectionRef = this.db
          .collection('knowledge_graph')
          .doc(projectName)
          .collection(collectionName);
        
        const snapshot = await collectionRef.get();
        const batch = this.db.batch();
        
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
      }

      // Delete the project document
      await this.db.collection('knowledge_graph').doc(projectName).delete();
      
      logger.info(`Cleared knowledge graph for project: ${projectName}`);
    } catch (error) {
      logger.error('Error clearing knowledge graph:', error);
      throw error;
    }
  }
}