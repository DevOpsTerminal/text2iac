import { inject, injectable } from 'tsyringe';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { logger } from '../utils/logger';
import { DatabaseService } from './database.service';
import { RedisService } from './redis.service';

const exec = promisify(execCallback);
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);

interface DeploymentOptions {
  environment: 'development' | 'staging' | 'production';
  region?: string;
  variables?: Record<string, string>;
  autoApprove?: boolean;
}

interface DeploymentResult {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  timestamp: string;
  output?: string;
  error?: string;
  resources?: Array<{
    type: string;
    name: string;
    id: string;
  }>;
}

@injectable()
export class DeploymentService {
  private readonly WORKING_DIR = path.join(process.cwd(), '.deployments');

  constructor(
    @inject(DatabaseService)
    private databaseService: DatabaseService,
    @inject(RedisService)
    private redisService: RedisService,
  ) {
    // Ensure working directory exists
    if (!fs.existsSync(this.WORKING_DIR)) {
      fs.mkdirSync(this.WORKING_DIR, { recursive: true });
    }
  }

  async deployTerraform(
    code: string,
    options: DeploymentOptions = { environment: 'development' },
  ): Promise<DeploymentResult> {
    const deploymentId = `deploy-${uuidv4()}`;
    const deploymentDir = path.join(this.WORKING_DIR, deploymentId);
    
    try {
      // Create deployment directory
      await mkdir(deploymentDir, { recursive: true });
      
      // Save Terraform files
      await writeFile(path.join(deploymentDir, 'main.tf'), code, 'utf8');
      
      // Create variables file if provided
      if (options.variables) {
        const tfVars = Object.entries(options.variables)
          .map(([key, value]) => `${key} = "${value}"`)
          .join('\n');
        await writeFile(path.join(deploymentDir, 'terraform.tfvars'), tfVars, 'utf8');
      }
      
      // Initialize Terraform
      await this.executeCommand('terraform init', { cwd: deploymentDir });
      
      // Run terraform plan
      const planFile = path.join(deploymentDir, 'tfplan');
      await this.executeCommand(
        `terraform plan -out=${planFile}`,
        { cwd: deploymentDir },
      );
      
      // Apply the plan
      const applyCmd = options.autoApprove 
        ? `terraform apply -auto-approve ${planFile}`
        : `terraform apply ${planFile}`;
      
      const output = await this.executeCommand(applyCmd, { cwd: deploymentDir });
      
      // Get the outputs
      const { stdout: outputJson } = await this.executeCommand('terraform output -json', {
        cwd: deploymentDir,
      });
      
      const result: DeploymentResult = {
        id: deploymentId,
        status: 'completed',
        timestamp: new Date().toISOString(),
        output: output.stdout,
        resources: this.parseTerraformOutput(JSON.parse(outputJson)),
      };
      
      // Save deployment result
      await this.saveDeploymentResult(deploymentId, result);
      
      return result;
      
    } catch (error) {
      const errorResult: DeploymentResult = {
        id: deploymentId,
        status: 'failed',
        timestamp: new Date().toISOString(),
        error: error.message,
        output: error.stdout || error.stderr,
      };
      
      await this.saveDeploymentResult(deploymentId, errorResult);
      throw error;
    }
  }

  async deployKubernetes(
    manifests: Record<string, string>,
    options: DeploymentOptions = { environment: 'development' },
  ): Promise<DeploymentResult> {
    const deploymentId = `k8s-${uuidv4()}`;
    const deploymentDir = path.join(this.WORKING_DIR, deploymentId);
    
    try {
      // Create deployment directory
      await mkdir(deploymentDir, { recursive: true });
      
      // Save Kubernetes manifests
      const manifestFiles = [];
      for (const [filename, content] of Object.entries(manifests)) {
        const filePath = path.join(deploymentDir, filename);
        await writeFile(filePath, content, 'utf8');
        manifestFiles.push(filePath);
      }
      
      // Apply manifests
      const output = await this.executeCommand(
        `kubectl apply -f ${deploymentDir} --recursive`,
        { cwd: deploymentDir },
      );
      
      const result: DeploymentResult = {
        id: deploymentId,
        status: 'completed',
        timestamp: new Date().toISOString(),
        output: output.stdout,
        resources: this.parseKubectlOutput(output.stdout),
      };
      
      // Save deployment result
      await this.saveDeploymentResult(deploymentId, result);
      
      return result;
      
    } catch (error) {
      const errorResult: DeploymentResult = {
        id: deploymentId,
        status: 'failed',
        timestamp: new Date().toISOString(),
        error: error.message,
        output: error.stdout || error.stderr,
      };
      
      await this.saveDeploymentResult(deploymentId, errorResult);
      throw error;
    }
  }

  async getDeploymentStatus(deploymentId: string): Promise<DeploymentResult | null> {
    // Try to get from Redis cache first
    const cachedResult = await this.redisService.get(`deployment:${deploymentId}`);
    if (cachedResult) {
      return JSON.parse(cachedResult);
    }
    
    // Fall back to database
    return this.databaseService.getDeployment(deploymentId);
  }

  async cancelDeployment(deploymentId: string): Promise<boolean> {
    try {
      // Update status to cancelled
      const result: DeploymentResult = {
        id: deploymentId,
        status: 'cancelled',
        timestamp: new Date().toISOString(),
      };
      
      await this.saveDeploymentResult(deploymentId, result);
      
      // TODO: Implement actual cancellation logic
      // This would involve finding and terminating any in-progress operations
      
      return true;
    } catch (error) {
      logger.error(`Failed to cancel deployment ${deploymentId}:`, error);
      return false;
    }
  }

  private async saveDeploymentResult(
    deploymentId: string,
    result: DeploymentResult,
  ): Promise<void> {
    // Save to Redis with 24h TTL
    await this.redisService.setex(
      `deployment:${deploymentId}`,
      60 * 60 * 24, // 24 hours
      JSON.stringify(result),
    );
    
    // Save to database for long-term storage
    await this.databaseService.saveDeployment(deploymentId, result);
  }

  private async executeCommand(
    command: string,
    options: { cwd: string; env?: NodeJS.ProcessEnv } = { cwd: process.cwd() },
  ): Promise<{ stdout: string; stderr: string }> {
    logger.debug(`Executing command: ${command} in ${options.cwd}`);
    
    try {
      return await exec(command, {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });
    } catch (error) {
      // Attach stdout and stderr to the error for better error handling
      error.stdout = error.stdout || '';
      error.stderr = error.stderr || '';
      logger.error(`Command failed: ${command}`, {
        error: error.message,
        stdout: error.stdout,
        stderr: error.stderr,
      });
      throw error;
    }
  }

  private parseTerraformOutput(output: Record<string, any>): Array<{ type: string; name: string; id: string }> {
    const resources: Array<{ type: string; name: string; id: string }> = [];
    
    for (const [key, value] of Object.entries(output)) {
      if (value && typeof value === 'object' && 'value' in value) {
        // Handle different types of Terraform outputs
        const val = value.value;
        
        if (Array.isArray(val)) {
          // Handle arrays (e.g., security group rules)
          val.forEach((item, index) => {
            resources.push({
              type: key,
              name: `${key}[${index}]`,
              id: String(item) || 'unknown',
            });
          });
        } else if (typeof val === 'object' && val !== null) {
          // Handle complex objects
          resources.push({
            type: key,
            name: key,
            id: JSON.stringify(val),
          });
        } else {
          // Handle primitive values
          resources.push({
            type: key,
            name: key,
            id: String(val) || 'unknown',
          });
        }
      }
    }
    
    return resources;
  }

  private parseKubectlOutput(output: string): Array<{ type: string; name: string; id: string }> {
    const resources: Array<{ type: string; name: string; id: string }> = [];
    const lines = output.split('\n');
    
    // Example: "deployment.apps/nginx created"
    const resourceRegex = /^(\S+)\/(\S+)\s+(created|configured|unchanged)/i;
    
    for (const line of lines) {
      const match = line.match(resourceRegex);
      if (match) {
        const [, type, name] = match;
        resources.push({
          type,
          name,
          id: `${type}/${name}`,
        });
      }
    }
    
    return resources;
  }
}
