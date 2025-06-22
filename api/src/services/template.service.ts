import { injectable } from 'tsyringe';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { config } from '../config';
import { logger } from '../utils/logger';

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

interface Template {
  id: string;
  name: string;
  description: string;
  provider: string;
  type: string;
  tags: string[];
  files: Array<{
    path: string;
    content: string;
  }>;
  metadata: {
    author?: string;
    version?: string;
    lastUpdated?: string;
    complexity?: 'beginner' | 'intermediate' | 'advanced';
  };
}

@injectable()
export class TemplateService {
  private templates: Map<string, Template> = new Map();
  private templatesLoaded: boolean = false;
  private readonly TEMPLATES_DIR = path.join(__dirname, '../../templates');

  constructor() {
    this.loadTemplates().catch((error) => {
      logger.error('Failed to load templates:', error);
    });
  }

  async listTemplates(
    provider?: string,
    type?: string,
    search?: string,
  ): Promise<Template[]> {
    if (!this.templatesLoaded) {
      await this.loadTemplates();
    }

    let templates = Array.from(this.templates.values());

    if (provider) {
      templates = templates.filter(
        (t) => t.provider.toLowerCase() === provider.toLowerCase(),
      );
    }

    if (type) {
      templates = templates.filter(
        (t) => t.type.toLowerCase() === type.toLowerCase(),
      );
    }

    if (search) {
      const searchLower = search.toLowerCase();
      templates = templates.filter(
        (t) =>
          t.name.toLowerCase().includes(searchLower) ||
          t.description.toLowerCase().includes(searchLower) ||
          t.tags.some((tag) => tag.toLowerCase().includes(searchLower)),
      );
    }

    return templates;
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    if (!this.templatesLoaded) {
      await this.loadTemplates();
    }
    return this.templates.get(id);
  }

  async findTemplatesForComponents(
    components: string[],
    provider: string,
  ): Promise<Template[]> {
    if (!this.templatesLoaded) {
      await this.loadTemplates();
    }

    const componentSet = new Set(components.map((c) => c.toLowerCase()));
    const templates = Array.from(this.templates.values());

    return templates.filter((template) => {
      // Filter by provider if specified
      if (template.provider.toLowerCase() !== provider.toLowerCase()) {
        return false;
      }

      // Check if template tags match any of the required components
      return template.tags.some((tag) => componentSet.has(tag.toLowerCase()));
    });
  }

  async generateTemplates(analysis: any): Promise<Record<string, any>> {
    // This would generate actual IaC templates based on the analysis
    // For now, return mock templates
    return {
      terraform: {
        'main.tf': '# Terraform configuration...',
        'variables.tf': '# Variables...',
        'outputs.tf': '# Outputs...',
      },
      kubernetes: {
        'deployment.yaml': '# Kubernetes deployment...',
        'service.yaml': '# Kubernetes service...',
      },
      dockerCompose: {
        'docker-compose.yml': '# Docker Compose configuration...',
      },
      monitoring: {
        'dashboard.json': '{}',
        'alerts.yaml': '# Alert rules...',
      },
    };
  }

  private async loadTemplates(): Promise<void> {
    try {
      if (this.templatesLoaded) {
        return;
      }

      logger.info('Loading templates...');
      
      if (!fs.existsSync(this.TEMPLATES_DIR)) {
        logger.warn(`Templates directory not found: ${this.TEMPLATES_DIR}`);
        this.templatesLoaded = true;
        return;
      }

      const providerDirs = await readdir(this.TEMPLATES_DIR, { withFileTypes: true });
      
      for (const providerDir of providerDirs) {
        if (!providerDir.isDirectory()) continue;
        
        const providerPath = path.join(this.TEMPLATES_DIR, providerDir.name);
        const templateDirs = await readdir(providerPath, { withFileTypes: true });
        
        for (const templateDir of templateDirs) {
          if (!templateDir.isDirectory()) continue;
          
          const templatePath = path.join(providerPath, templateDir.name);
          const templateJsonPath = path.join(templatePath, 'template.json');
          
          try {
            // Read template metadata
            const templateJson = JSON.parse(await readFile(templateJsonPath, 'utf-8'));
            const template: Template = {
              id: `${providerDir.name}-${templateDir.name}`,
              name: templateJson.name || templateDir.name,
              description: templateJson.description || '',
              provider: providerDir.name,
              type: templateJson.type || 'unknown',
              tags: templateJson.tags || [],
              files: [],
              metadata: {
                author: templateJson.author,
                version: templateJson.version,
                lastUpdated: templateJson.lastUpdated,
                complexity: templateJson.complexity,
              },
            };
            
            // Read template files
            const files = await this.readDirectoryRecursive(templatePath);
            for (const file of files) {
              if (file === 'template.json') continue; // Skip the template.json file
              
              const filePath = path.join(templatePath, file);
              const content = await readFile(filePath, 'utf-8');
              
              template.files.push({
                path: file,
                content,
              });
            }
            
            this.templates.set(template.id, template);
          } catch (error) {
            logger.error(`Error loading template ${templateDir.name}:`, error);
          }
        }
      }
      
      this.templatesLoaded = true;
      logger.info(`Loaded ${this.templates.size} templates`);
    } catch (error) {
      logger.error('Failed to load templates:', error);
      throw error;
    }
  }

  private async readDirectoryRecursive(dir: string, baseDir: string = ''): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = baseDir ? path.join(baseDir, entry.name) : entry.name;
      
      if (entry.isDirectory()) {
        const subFiles = await this.readDirectoryRecursive(fullPath, relativePath);
        files.push(...subFiles);
      } else {
        files.push(relativePath);
      }
    }
    
    return files;
  }
}
