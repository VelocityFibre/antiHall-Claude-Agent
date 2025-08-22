#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  CallToolResult,
  TextContent
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { config } from 'dotenv';
import winston from 'winston';

import { CodebaseParser } from './codebase-parser.js';
import { HallucinationDetector } from './hallucination-detector.js';
import { KnowledgeStorage } from './knowledge-storage.js';

// Load environment variables
config();

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

// Validation schemas
const ParseCodebaseSchema = z.object({
  path: z.string().optional().default('../'),
  projectName: z.string().optional().default('fibreflow')
});

const CheckHallucinationsSchema = z.object({
  code: z.string().min(1, 'Code cannot be empty'),
  context: z.string().optional()
});

const SearchKnowledgeSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  type: z.enum(['services', 'components', 'all']).optional().default('all')
});

class FibreFlowKnowledgeServer {
  private server: Server;
  private codebaseParser: CodebaseParser;
  private knowledgeStorage: KnowledgeStorage | null = null;
  private hallucinationDetector: HallucinationDetector | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'fibreflow-knowledge-graph',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.codebaseParser = new CodebaseParser();

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private ensureKnowledgeStorage(): void {
    if (!this.knowledgeStorage) {
      this.knowledgeStorage = new KnowledgeStorage();
    }
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = [
        {
          name: 'parse_fibreflow_codebase',
          description: 'Parse the FibreFlow Angular codebase and store it in the knowledge graph',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Path to the FibreFlow codebase (default: ../ relative to this MCP server)',
                default: '../'
              },
              projectName: {
                type: 'string',
                description: 'Project name for the knowledge graph (default: fibreflow)',
                default: 'fibreflow'
              }
            }
          }
        },
        {
          name: 'check_hallucinations',
          description: 'Check AI-generated Angular/TypeScript code for hallucinations (non-existent methods, wrong imports, etc.)',
          inputSchema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'The TypeScript/Angular code to check'
              },
              context: {
                type: 'string',
                description: 'Optional context about what the code is supposed to do'
              }
            },
            required: ['code']
          }
        },
        {
          name: 'search_knowledge',
          description: 'Search the knowledge graph for services, components, or methods',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query (service name, component name, method name, etc.)'
              },
              type: {
                type: 'string',
                enum: ['services', 'components', 'all'],
                description: 'Type of items to search for',
                default: 'all'
              }
            },
            required: ['query']
          }
        },
        {
          name: 'get_codebase_stats',
          description: 'Get statistics about the parsed FibreFlow codebase',
          inputSchema: {
            type: 'object',
            properties: {
              projectName: {
                type: 'string',
                description: 'Project name (default: fibreflow)',
                default: 'fibreflow'
              }
            }
          }
        },
        {
          name: 'validate_service_usage',
          description: 'Validate if a service method call is correct based on the knowledge graph',
          inputSchema: {
            type: 'object',
            properties: {
              serviceName: {
                type: 'string',
                description: 'Name of the service (e.g., AuthService, ProjectService)'
              },
              methodName: {
                type: 'string',
                description: 'Name of the method being called'
              },
              parameters: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional: parameter types being passed'
              }
            },
            required: ['serviceName', 'methodName']
          }
        }
      ];

      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'parse_fibreflow_codebase':
            return await this.handleParseCodebase(args);
          
          case 'check_hallucinations':
            return await this.handleCheckHallucinations(args);
          
          case 'search_knowledge':
            return await this.handleSearchKnowledge(args);
          
          case 'get_codebase_stats':
            return await this.handleGetCodebaseStats(args);
          
          case 'validate_service_usage':
            return await this.handleValidateServiceUsage(args);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error(`Error in tool ${name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
            } as TextContent
          ]
        };
      }
    });
  }

  private async handleParseCodebase(args: unknown): Promise<CallToolResult> {
    const { path, projectName } = ParseCodebaseSchema.parse(args);
    
    logger.info(`Parsing codebase at: ${path}`);
    
    try {
      // Ensure knowledge storage is initialized
      this.ensureKnowledgeStorage();
      
      // Parse the codebase
      const codebase = await this.codebaseParser.parseCodebase(path);
      
      // Store in Firebase
      await this.knowledgeStorage!.storeCodebaseKnowledge(codebase, projectName);
      
      // Initialize hallucination detector with the parsed codebase
      this.hallucinationDetector = new HallucinationDetector(codebase);
      
      const responseText = `✅ Successfully parsed FibreFlow codebase!

📊 **Codebase Statistics:**
- Components: ${codebase.components.length}
- Services: ${codebase.services.length}
- Interfaces: ${codebase.interfaces.length}
- Models: ${codebase.models.length}

🔍 **Sample Components:**
${codebase.components.slice(0, 3).map(c => `- ${c.name} (${c.selector || 'no selector'})`).join('\\n')}

🛠️ **Sample Services:**
${codebase.services.slice(0, 3).map(s => `- ${s.name} (${s.methods.length} methods)`).join('\\n')}

The knowledge graph is now ready for hallucination detection!`;

      return {
        content: [
          {
            type: 'text',
            text: responseText
          } as TextContent
        ]
      };
    } catch (error) {
      throw new Error(`Failed to parse codebase: ${error}`);
    }
  }

  private async handleCheckHallucinations(args: unknown): Promise<CallToolResult> {
    const { code, context } = CheckHallucinationsSchema.parse(args);
    
    // Ensure we have a knowledge base loaded
    if (!this.hallucinationDetector) {
      this.ensureKnowledgeStorage();
      const codebase = await this.knowledgeStorage!.getStoredCodebase();
      if (!codebase) {
        return {
          content: [
            {
              type: 'text',
              text: '❌ No knowledge graph found. Please run `parse_fibreflow_codebase` first to analyze your codebase.'
            } as TextContent
          ]
        };
      }
      this.hallucinationDetector = new HallucinationDetector(codebase);
    }
    
    const result = await this.hallucinationDetector.detectHallucinations(code, context);
    
    let responseText = '';
    
    if (!result.hasHallucinations) {
      responseText = `✅ **No hallucinations detected!**

The code appears to be valid based on the FibreFlow codebase.
Confidence: ${(result.confidence * 100).toFixed(0)}%`;
    } else {
      responseText = `⚠️ **Potential hallucinations detected!**

Found ${result.issues.length} issue(s):

`;
      
      result.issues.forEach((issue, index) => {
        const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        responseText += `${index + 1}. ${icon} **${issue.type}**: ${issue.description}\\n`;
        if (issue.suggestion) {
          responseText += `   💡 Suggestion: ${issue.suggestion}\\n`;
        }
        responseText += '\\n';
      });
      
      if (result.suggestions.length > 0) {
        responseText += `\\n📝 **Recommendations:**\\n`;
        result.suggestions.forEach(suggestion => {
          responseText += `- ${suggestion}\\n`;
        });
      }
      
      responseText += `\\nConfidence: ${(result.confidence * 100).toFixed(0)}%`;
    }
    
    return {
      content: [
        {
          type: 'text',
          text: responseText
        } as TextContent
      ]
    };
  }

  private async handleSearchKnowledge(args: unknown): Promise<CallToolResult> {
    const { query, type } = SearchKnowledgeSchema.parse(args);
    
    this.ensureKnowledgeStorage();
    const results: any[] = [];
    
    if (type === 'services' || type === 'all') {
      const services = await this.knowledgeStorage!.searchServices(query);
      results.push(...services.map(s => ({ type: 'service', item: s })));
    }
    
    if (type === 'components' || type === 'all') {
      const components = await this.knowledgeStorage!.searchComponents(query);
      results.push(...components.map(c => ({ type: 'component', item: c })));
    }
    
    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No results found for "${query}". Try searching for specific service or component names.`
          } as TextContent
        ]
      };
    }
    
    let responseText = `🔍 Found ${results.length} result(s) for "${query}":\\n\\n`;
    
    results.forEach(result => {
      if (result.type === 'service') {
        const service = result.item;
        responseText += `📦 **Service: ${service.name}**\\n`;
        responseText += `   Injectable: ${service.injectable ? 'Yes' : 'No'}\\n`;
        responseText += `   Dependencies: ${service.dependencies.join(', ') || 'None'}\\n`;
        responseText += `   Methods:\\n`;
        service.methods.slice(0, 5).forEach((method: any) => {
          const params = method.parameters.map((p: any) => `${p.name}: ${p.type || 'any'}`).join(', ');
          responseText += `   - ${method.name}(${params})${method.returnType ? ': ' + method.returnType : ''}\\n`;
        });
        if (service.methods.length > 5) {
          responseText += `   ... and ${service.methods.length - 5} more methods\\n`;
        }
        responseText += '\\n';
      } else if (result.type === 'component') {
        const component = result.item;
        responseText += `🎨 **Component: ${component.name}**\\n`;
        responseText += `   Selector: ${component.selector || 'N/A'}\\n`;
        responseText += `   Inputs: ${component.inputs.join(', ') || 'None'}\\n`;
        responseText += `   Outputs: ${component.outputs.join(', ') || 'None'}\\n`;
        responseText += `   Methods: ${component.methods.map((m: any) => m.name).slice(0, 3).join(', ')}`;
        if (component.methods.length > 3) {
          responseText += ` ... (${component.methods.length} total)`;
        }
        responseText += '\\n\\n';
      }
    });
    
    return {
      content: [
        {
          type: 'text',
          text: responseText
        } as TextContent
      ]
    };
  }

  private async handleGetCodebaseStats(args: unknown): Promise<CallToolResult> {
    const { projectName } = z.object({
      projectName: z.string().optional().default('fibreflow')
    }).parse(args);
    
    this.ensureKnowledgeStorage();
    const stats = await this.knowledgeStorage!.getProjectStats(projectName);
    
    if (!stats) {
      return {
        content: [
          {
            type: 'text',
            text: `No knowledge graph found for project: ${projectName}. Run parse_fibreflow_codebase first.`
          } as TextContent
        ]
      };
    }
    
    const responseText = `📊 **FibreFlow Codebase Statistics**

🎨 Components: ${stats.components || 0}
📦 Services: ${stats.services || 0}
🔗 Interfaces: ${stats.interfaces || 0}
📋 Models: ${stats.models || 0}

Last Updated: ${stats.lastUpdated ? new Date(stats.lastUpdated.toDate()).toLocaleString() : 'Unknown'}

Use the search_knowledge tool to explore specific components or services.`;
    
    return {
      content: [
        {
          type: 'text',
          text: responseText
        } as TextContent
      ]
    };
  }

  private async handleValidateServiceUsage(args: unknown): Promise<CallToolResult> {
    const { serviceName, methodName, parameters } = z.object({
      serviceName: z.string(),
      methodName: z.string(),
      parameters: z.array(z.string()).optional()
    }).parse(args);
    
    // Search for the service
    this.ensureKnowledgeStorage();
    const services = await this.knowledgeStorage!.searchServices(serviceName);
    const service = services.find(s => s.name === serviceName);
    
    if (!service) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Service '${serviceName}' not found in the codebase.\\n\\nAvailable services: ${services.slice(0, 5).map(s => s.name).join(', ')}`
          } as TextContent
        ]
      };
    }
    
    // Find the method
    const method = service.methods.find(m => m.name === methodName);
    
    if (!method) {
      const publicMethods = service.methods
        .filter((m: any) => m.visibility === 'public')
        .map(m => `${m.name}(${m.parameters.map(p => p.type || 'any').join(', ')})`);
      
      return {
        content: [
          {
            type: 'text',
            text: `❌ Method '${methodName}' not found on ${serviceName}.\\n\\nAvailable public methods:\\n${publicMethods.join('\\n')}`
          } as TextContent
        ]
      };
    }
    
    // Validate method usage
    const paramSignature = method.parameters.map(p => `${p.name}: ${p.type || 'any'}`).join(', ');
    const returnInfo = method.returnType ? `: ${method.returnType}` : '';
    
    let responseText = `✅ **Valid method found!**\\n\\n`;
    responseText += `${serviceName}.${methodName}(${paramSignature})${returnInfo}\\n\\n`;
    responseText += `Visibility: ${method.visibility}\\n`;
    responseText += `Async: ${method.isAsync ? 'Yes' : 'No'}\\n`;
    
    if (parameters && parameters.length > 0) {
      if (parameters.length !== method.parameters.length) {
        responseText += `\\n⚠️ Warning: Expected ${method.parameters.length} parameters but got ${parameters.length}`;
      }
    }
    
    return {
      content: [
        {
          type: 'text',
          text: responseText
        } as TextContent
      ]
    };
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      logger.error('Server error:', error);
    };

    process.on('SIGINT', async () => {
      logger.info('Shutting down server...');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Shutting down server...');
      process.exit(0);
    });
  }

  async run(): Promise<void> {
    logger.info('Starting FibreFlow Knowledge Graph MCP Server...');
    
    // Environment variables will be validated when tools are actually used
    logger.info('Environment validation deferred to tool usage');

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    logger.info('FibreFlow Knowledge Graph MCP Server ready!');
  }
}

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new FibreFlowKnowledgeServer();
  server.run().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { FibreFlowKnowledgeServer };