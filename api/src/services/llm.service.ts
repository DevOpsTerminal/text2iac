import { inject, injectable } from 'tsyringe';
import OpenAI from 'openai';
import { config } from '../config';
import { logger } from '../utils/logger';
import { TemplateService } from './template.service';

interface IaCGenerationParams {
  description: string;
  provider: string;
  format: string;
  variables?: Record<string, unknown>;
}

interface AnalysisResult {
  components: string[];
  complexity: 'low' | 'medium' | 'high';
  projectName: string;
  requirements: string[];
  recommendations: string[];
}

@injectable()
export class LLMService {
  private openai: OpenAI;

  constructor(
    @inject(TemplateService)
    private templateService: TemplateService,
  ) {
    if (!config.llm.openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    this.openai = new OpenAI({
      apiKey: config.llm.openaiApiKey,
    });
  }

  async generateIaC(
    description: string,
    provider: string,
    format: string = 'hcl',
    variables: Record<string, unknown> = {},
  ): Promise<string> {
    try {
      // First, analyze the requirements
      const analysis = await this.analyzeRequirements(description, {
        provider,
        format,
        variables,
      });

      // Get relevant templates
      const templates = await this.templateService.findTemplatesForComponents(
        analysis.components,
        provider,
      );

      // Generate prompt for code generation
      const prompt = this.buildGenerationPrompt(description, analysis, templates, {
        provider,
        format,
        variables,
      });

      // Call OpenAI API
      const completion = await this.openai.chat.completions.create({
        model: config.llm.modelName,
        messages: [
          {
            role: 'system',
            content: 'You are an expert in Infrastructure as Code. Generate clean, secure, and production-ready code.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      });

      const generatedCode = completion.choices[0]?.message?.content?.trim();
      
      if (!generatedCode) {
        throw new Error('Failed to generate code: Empty response from LLM');
      }

      // Post-process the generated code
      return this.postProcessGeneratedCode(generatedCode, format);
    } catch (error) {
      logger.error('Error generating IaC with LLM:', error);
      throw new Error(`Failed to generate IaC: ${error.message}`);
    }
  }

  async analyzeRequirements(
    description: string,
    options: {
      provider: string;
      format?: string;
      variables?: Record<string, unknown>;
    },
  ): Promise<AnalysisResult> {
    try {
      const prompt = this.buildAnalysisPrompt(description, options);

      const completion = await this.openai.chat.completions.create({
        model: config.llm.modelName,
        messages: [
          {
            role: 'system',
            content: 'Analyze the infrastructure requirements and extract key components and requirements.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      });

      const analysisText = completion.choices[0]?.message?.content?.trim();
      
      if (!analysisText) {
        throw new Error('Failed to analyze requirements: Empty response from LLM');
      }

      // Parse the structured response
      return this.parseAnalysisResponse(analysisText);
    } catch (error) {
      logger.error('Error analyzing requirements:', error);
      throw new Error(`Failed to analyze requirements: ${error.message}`);
    }
  }

  private buildAnalysisPrompt(
    description: string,
    options: {
      provider: string;
      format?: string;
      variables?: Record<string, unknown>;
    },
  ): string {
    return `Analyze the following infrastructure requirements and provide a structured response:

Description: ${description}

Provider: ${options.provider}
Output Format: ${options.format || 'hcl'}

Please provide analysis in the following JSON format:
{
  "components": ["list", "of", "required", "components"],
  "complexity": "low|medium|high",
  "projectName": "suggested-project-name",
  "requirements": ["list", "of", "key", "requirements"],
  "recommendations": ["list", "of", "recommendations"]
}

Analysis:`;
  }

  private buildGenerationPrompt(
    description: string,
    analysis: AnalysisResult,
    templates: any[],
    options: {
      provider: string;
      format: string;
      variables?: Record<string, unknown>;
    },
  ): string {
    return `Generate ${options.provider} infrastructure as code with the following requirements:

Description: ${description}

Components identified:
${analysis.components.map(c => `- ${c}`).join('\n')}

Requirements:
${analysis.requirements.map(r => `- ${r}`).join('\n')}

Available templates (for reference only, adapt as needed):
${templates.map(t => `- ${t.name}: ${t.description}`).join('\n')}

Please generate the code in ${options.format} format following these guidelines:
- Use best practices for ${options.provider}
- Include proper error handling and security configurations
- Add relevant comments and documentation
- Use variables for all configurable values

Generated ${options.provider} ${options.format.toUpperCase()} code:`;
  }

  private parseAnalysisResponse(response: string): AnalysisResult {
    try {
      // Try to parse the response as JSON
      const startIndex = response.indexOf('{');
      const endIndex = response.lastIndexOf('}') + 1;
      const jsonStr = response.substring(startIndex, endIndex);
      
      const result = JSON.parse(jsonStr);
      
      // Validate the structure
      if (!result.components || !Array.isArray(result.components)) {
        throw new Error('Invalid analysis response: missing or invalid components');
      }
      
      return {
        components: result.components,
        complexity: result.complexity || 'medium',
        projectName: result.projectName || 'my-infrastructure',
        requirements: result.requirements || [],
        recommendations: result.recommendations || [],
      };
    } catch (error) {
      logger.error('Failed to parse analysis response:', error);
      // Fallback to a basic analysis
      return {
        components: ['basic-infrastructure'],
        complexity: 'medium',
        projectName: 'my-infrastructure',
        requirements: [],
        recommendations: [],
      };
    }
  }

  private postProcessGeneratedCode(code: string, format: string): string {
    // Remove markdown code blocks if present
    const codeBlockRegex = /```(?:[a-z]*\n)?([\s\S]*?)```/g;
    const matches = codeBlockRegex.exec(code);
    if (matches && matches[1]) {
      code = matches[1].trim();
    }

    // Format based on the output format
    switch (format.toLowerCase()) {
      case 'json':
        try {
          // Try to format JSON nicely
          return JSON.stringify(JSON.parse(code), null, 2);
        } catch (e) {
          // If not valid JSON, return as is
          return code;
        }
      case 'yaml':
      case 'yml':
        // Add YAML formatting if needed
        return code;
      case 'hcl':
      default:
        // Ensure proper HCL formatting
        return code.replace(/\n{3,}/g, '\n\n').trim();
    }
  }
}
