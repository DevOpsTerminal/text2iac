// api/src/controllers/text2iac.controller.ts - Core Text2IaC Logic
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';

import { logger } from '../utils/logger';
import { LLMService } from '../services/llm.service';
import { TemplateService } from '../services/template.service';
import { DeploymentService } from '../services/deployment.service';
import { DatabaseService } from '../services/database.service';
import { RedisService } from '../services/redis.service';
import { MermaidGenerator } from '../utils/mermaid.generator';

const router = Router();

interface GenerateRequest {
  description: string;
  environment?: 'development' | 'staging' | 'production';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  requestor?: string;
  template?: string;
  options?: {
    includeMonitoring?: boolean;
    includeCI?: boolean;
    cloudProvider?: 'aws' | 'azure' | 'gcp' | 'local';
    region?: string;
  };
}

interface GenerateResponse {
  requestId: string;
  name: string;
  status: string;
  eta: string;
  description: string;
  environment: string;
  components: string[];
  urls: {
    backstage_url?: string;
    argocd_url?: string;
    grafana_url?: string;
    github_url?: string;
  };
  files: {
    terraform?: string;
    kubernetes?: string;
    docker_compose?: string;
    monitoring?: string;
  };
  mermaid_diagram?: string;
  estimated_cost?: string;
  next_steps?: string[];
}

// Validation middleware
const validateGenerateRequest = [
  body('description')
    .isString()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),
  body('environment')
    .optional()
    .isIn(['development', 'staging', 'production'])
    .withMessage('Environment must be development, staging, or production'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Priority must be low, medium, high, or critical'),
  body('requestor')
    .optional()
    .isEmail()
    .withMessage('Requestor must be a valid email'),
];

// POST /api/generate - Main infrastructure generation endpoint
router.post('/', validateGenerateRequest, async (req: Request, res: Response) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const generateRequest: GenerateRequest = req.body;
    const requestId = uuidv4();

    logger.info(`New infrastructure request: ${requestId}`, {
      requestId,
      description: generateRequest.description.substring(0, 100),
      environment: generateRequest.environment,
      requestor: generateRequest.requestor,
    });

    // Quick response to client
    const initialResponse: Partial<GenerateResponse> = {
      requestId,
      status: 'processing',
      eta: '2-5 minutes',
      description: generateRequest.description,
      environment: generateRequest.environment || 'development',
    };

    res.status(202).json(initialResponse);

    // Process request asynchronously
    processInfrastructureRequest(requestId, generateRequest)
      .catch(error => {
        logger.error(`Failed to process request ${requestId}:`, error);
      });

  } catch (error) {
    logger.error('Error in generate endpoint:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process infrastructure request',
    });
  }
});

// GET /api/generate/:requestId - Get generation status
router.get('/:requestId', async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;

    // Get status from Redis cache first
    const cachedStatus = await RedisService.get(`request:${requestId}`);
    if (cachedStatus) {
      return res.json(JSON.parse(cachedStatus));
    }

    // Fallback to database
    const request = await DatabaseService.getRequest(requestId);
    if (!request) {
      return res.status(404).json({
        error: 'Request not found',
        requestId,
      });
    }

    res.json(request);

  } catch (error) {
    logger.error('Error getting request status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get request status',
    });
  }
});

// DELETE /api/generate/:requestId - Cancel generation
router.delete('/:requestId', async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;

    // Mark as cancelled in database
    await DatabaseService.updateRequestStatus(requestId, 'cancelled');
    
    // Remove from Redis cache
    await RedisService.del(`request:${requestId}`);

    logger.info(`Request cancelled: ${requestId}`);

    res.json({
      message: 'Request cancelled successfully',
      requestId,
    });

  } catch (error) {
    logger.error('Error cancelling request:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to cancel request',
    });
  }
});

// Main processing function
async function processInfrastructureRequest(
  requestId: string, 
  request: GenerateRequest
): Promise<void> {
  try {
    // Update status to processing
    await updateRequestStatus(requestId, 'analyzing', 'Analyzing requirements with LLM...');

    // Step 1: Analyze requirements with LLM
    const analysis = await LLMService.analyzeRequirements(request.description, {
      environment: request.environment || 'development',
      template: request.template,
      options: request.options,
    });

    logger.info(`Analysis completed for ${requestId}:`, {
      requestId,
      detectedComponents: analysis.components,
      estimatedComplexity: analysis.complexity,
    });

    // Step 2: Generate infrastructure templates
    await updateRequestStatus(requestId, 'generating', 'Generating infrastructure templates...');

    const templates = await TemplateService.generateTemplates(analysis);

    // Step 3: Create Mermaid diagram
    const mermaidDiagram = MermaidGenerator.generateArchitectureDiagram(analysis);

    // Step 4: Estimate costs (basic estimation)
    const estimatedCost = calculateEstimatedCost(analysis);

    // Step 5: Generate next steps
    const nextSteps = generateNextSteps(analysis, request.environment || 'development');

    // Step 6: Save files and create response
    const files = await saveGeneratedFiles(requestId, templates);

    const response: GenerateResponse = {
      requestId,
      name: analysis.projectName || 'Generated Infrastructure',
      status: 'completed',
      eta: 'Ready for deployment',
      description: request.description,
      environment: request.environment || 'development',
      components: analysis.components,
      urls: generateUrls(requestId, analysis.projectName),
      files,
      mermaid_diagram: mermaidDiagram,
      estimated_cost: estimatedCost,
      next_steps: nextSteps,
    };

    // Update final status
    await updateRequestStatus(requestId, 'completed', 'Infrastructure generated successfully', response);

    logger.info(`Request completed successfully: ${requestId}`);

  } catch (error) {
    logger.error(`Error processing request ${requestId}:`, error);
    
    await updateRequestStatus(requestId, 'failed', `Error: ${error.message}`);
  }
}

// Helper function to update request status
async function updateRequestStatus(
  requestId: string, 
  status: string, 
  message?: string, 
  data?: any
): Promise<void> {
  const statusUpdate = {
    requestId,
    status,
    message,
    timestamp: new Date().toISOString(),
    ...data,
  };

  // Save to Redis (fast access)
  await RedisService.setex(`request:${requestId}`, 3600, JSON.stringify(statusUpdate));

  // Save to database (persistent storage)
  await DatabaseService.updateRequest(requestId, statusUpdate);

  // Broadcast via WebSocket (if app instance available)
  // Note: In a real implementation, you'd use Redis pub/sub for this
  logger.info(`Status update for ${requestId}: ${status} - ${message}`);
}

// Helper function to calculate estimated costs
function calculateEstimatedCost(analysis: any): string {
  // Basic cost estimation based on components
  let monthlyCost = 0;

  analysis.components.forEach((component: string) => {
    switch (component.toLowerCase()) {
      case 'database':
      case 'postgresql':
      case 'mysql':
        monthlyCost += 50; // RDS instance
        break;
      case 'redis':
      case 'cache':
        monthlyCost += 30; // ElastiCache
        break;
      case 'load balancer':
      case 'alb':
        monthlyCost += 25; // Application Load Balancer
        break;
      case 'cdn':
      case 'cloudfront':
        monthlyCost += 20; // CloudFront
        break;
      case 'kubernetes':
      case 'eks':
        monthlyCost += 150; // EKS cluster + nodes
        break;
      default:
        monthlyCost += 10; // Basic compute
    }
  });

  return `$${monthlyCost}/month (estimated)`;
}

// Helper function to generate next steps
function generateNextSteps(analysis: any, environment: string): string[] {
  const steps = [
    'Review generated infrastructure templates',
    'Configure environment variables in .env file',
  ];

  if (environment === 'development') {
    steps.push(
      'Run `docker-compose up -d` to start locally',
      'Test the application endpoints',
      'Review monitoring dashboards'
    );
  } else {
    steps.push(
      'Deploy Terraform infrastructure: `terraform apply`',
      'Deploy applications via ArgoCD or kubectl',
      'Configure monitoring and alerting',
      'Set up backup and disaster recovery',
      'Configure CI/CD pipelines'
    );
  }

  return steps;
}

// Helper function to save generated files
async function saveGeneratedFiles(requestId: string, templates: any): Promise<any> {
  const baseDir = `generated/${requestId}`;
  
  // This would involve actual file writing in a real implementation
  // For now, return mock file paths
  
  return {
    terraform: templates.terraform ? `${baseDir}/terraform/main.tf` : undefined,
    kubernetes: templates.kubernetes ? `${baseDir}/k8s/` : undefined,
    docker_compose: templates.dockerCompose ? `${baseDir}/docker-compose.yml` : undefined,
    monitoring: templates.monitoring ? `${baseDir}/monitoring/` : undefined,
  };
}

// Helper function to generate URLs
function generateUrls(requestId: string, projectName?: string): any {
  const baseUrl = process.env.BASE_URL || 'http://localhost:8080';
  
  return {
    backstage_url: `${baseUrl}/catalog/default/component/${projectName || requestId}`,
    argocd_url: `${baseUrl}/argocd/applications/${projectName || requestId}`,
    grafana_url: `${baseUrl}/grafana/d/${requestId}`,
    github_url: `${process.env.GITHUB_BASE_URL || 'https://github.com/company'}/infrastructure-${requestId}`,
  };
}

export default router;