/**
 * AI Judge Evaluator - Independent AI Quality Assessment System
 * 
 * This system:
 * 1. Sends test questions to the AI tutor
 * 2. Receives AI responses 
 * 3. Uses a separate AI judge (AWS Bedrock via backend API) to evaluate response quality
 * 4. Provides objective scoring independent of student data
 */

import { config } from 'dotenv';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type {
  StudentProfile,
  TestScenario,
  AITutorResponse,
  EvaluationResult,
  EvaluationSummary,
  EvaluationConfig,
  EvaluationOptions,
  AIJudgeResponse,
  EvaluationCriteria
} from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config();

interface TestScenarioInternal extends Omit<TestScenario, 'expectedTopics'> {
  expectedCriteria: string[];
}

interface TestCriteriaCounts {
  [key: string]: number;
}

export class AIJudgeEvaluator {
  private config: EvaluationConfig;
  private testScenarios: Record<string, Record<string, TestScenarioInternal[]>>;

  constructor(customConfig?: Partial<EvaluationConfig>) {
    this.config = {
      backendApiEndpoint: process.env.BACKEND_API_ENDPOINT || 'https://0mcvthborg.execute-api.ap-southeast-1.amazonaws.com/prod',
      tutorApiEndpoint: process.env.AI_TUTOR_ENDPOINT || 'https://0mcvthborg.execute-api.ap-southeast-1.amazonaws.com/prod',
      judgeModel: 'aws-nitro-lite', // AWS Bedrock Foundation Model
      maxTokens: 1000,
      temperature: 0.1,
      passingScore: 70,
      timeoutMs: 30000,
      maxRetries: 3,
      ...customConfig
    };

    // Only set apiKey if it exists
    if (process.env.BACKEND_API_KEY) {
      this.config.apiKey = process.env.BACKEND_API_KEY;
    }
    
    // Test scenarios for different subjects and grades
    this.testScenarios = {
      mathematics: {
        grade8: [
          {
            subject: 'mathematics',
            grade: 8,
            question: "Explain the concept of rational numbers with examples",
            expectedCriteria: ["definition", "examples", "age-appropriate language", "clear explanation"],
            difficulty: "intermediate"
          },
          {
            subject: 'mathematics',
            grade: 8,
            question: "Solve: 2x + 5 = 13 and explain each step",
            expectedCriteria: ["step-by-step solution", "explanation of operations", "correct answer", "mathematical reasoning"],
            difficulty: "intermediate"
          }
        ],
        grade10: [
          {
            subject: 'mathematics',
            grade: 10,
            question: "Explain quadratic equations and provide the quadratic formula",
            expectedCriteria: ["definition", "formula", "when to use", "example application"],
            difficulty: "advanced"
          }
        ]
      },
      science: {
        grade8: [
          {
            subject: 'science',
            grade: 8,
            question: "What is photosynthesis and why is it important?",
            expectedCriteria: ["process explanation", "importance", "scientific accuracy", "clear language"],
            difficulty: "intermediate"
          }
        ]
      }
    };
  }

  /**
   * Run comprehensive AI evaluation
   */
  async runEvaluation(options: EvaluationOptions = {}): Promise<EvaluationSummary> {
    const {
      subject = 'mathematics',
      grade = 8,
      numberOfTests = 3,
      studentProfile: studentProfilePath = null,
      verbose = false
    } = options;

    const gradeKey = `grade${grade}`;

    if (verbose) {
      console.log(`🎯 Starting AI Judge Evaluation for ${subject} - ${gradeKey}`);
      console.log(`📊 Running ${numberOfTests} test scenarios`);
    }

    const startTime = Date.now();
    let studentProfile: StudentProfile | undefined;

    // Load student profile if provided
    if (studentProfilePath) {
      try {
        const profileData = await fs.readFile(studentProfilePath, 'utf-8');
        studentProfile = JSON.parse(profileData) as StudentProfile;
        if (verbose) {
          console.log(`👤 Loaded student profile: ${studentProfile.name}`);
        }
      } catch (error) {
        console.warn(`⚠️  Could not load student profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    const results: EvaluationResult[] = [];

    try {
      const scenarios = this.getTestScenarios(subject, gradeKey, numberOfTests);
      
      for (let i = 0; i < scenarios.length; i++) {
        if (verbose) {
          console.log(`\n🧪 Running test ${i + 1}/${scenarios.length}: ${scenarios[i]!.question.substring(0, 50)}...`);
        }
        
        const testResult = await this.runSingleTest(scenarios[i]!, studentProfile);
        results.push(testResult);
        
        // Add delay between tests
        await this.delay(1000);
      }

      // Calculate overall metrics
      const metadata: EvaluationSummary['metadata'] = {
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        configuration: this.config
      };

      if (studentProfile) {
        metadata.studentProfile = studentProfile;
      }

      const summary = this.generateSummary(results, metadata);

      if (verbose) {
        console.log(`\n✅ Evaluation completed! Average Score: ${summary.averageScore.toFixed(1)}%`);
      }
      
      return summary;

    } catch (error) {
      console.error('❌ Evaluation failed:', error);
      throw error;
    }
  }

  /**
   * Run a single test scenario
   */
  private async runSingleTest(scenario: TestScenarioInternal, studentProfile?: StudentProfile): Promise<EvaluationResult> {
    const startTime = Date.now();
    
    try {
      // Step 1: Send question to AI tutor
      console.log(`  📤 Sending question to AI tutor...`);
      const aiResponse = await this.queryAITutor(scenario.question, studentProfile);
      
      // Step 2: Evaluate response with AI judge
      console.log(`  🔍 Evaluating response with AI judge...`);
      const judgeEvaluation = await this.evaluateWithAIJudge(scenario, aiResponse);
      
      const duration = Date.now() - startTime;
      
      return {
        scenario: {
          ...scenario,
          expectedTopics: scenario.expectedCriteria
        },
        tutorResponse: aiResponse,
        judgeEvaluation,
        timestamp: new Date().toISOString(),
        processingTime: duration
      };

    } catch (error) {
      console.error(`  ❌ Test failed:`, error instanceof Error ? error.message : 'Unknown error');
      
      const failedJudgeEvaluation: AIJudgeResponse = {
        overall_score: 0,
        criteria_scores: {
          accuracy: 0,
          clarity: 0,
          completeness: 0,
          age_appropriateness: 0,
          engagement: 0,
          structure: 0
        },
        detailed_feedback: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        strengths: [],
        areas_for_improvement: [error instanceof Error ? error.message : 'Unknown error'],
        confidence_level: 0
      };

      return {
        scenario: {
          ...scenario,
          expectedTopics: scenario.expectedCriteria
        },
        tutorResponse: {
          response: '',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        judgeEvaluation: failedJudgeEvaluation,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Query the AI tutor with a test question
   */
  private async queryAITutor(question: string, studentProfile?: StudentProfile): Promise<AITutorResponse> {
    const sessionContext = {
      sessionId: `eval_session_${Date.now()}`,
      studentId: studentProfile?.studentId || 'eval_student',
      subject: studentProfile?.subjects[0] || 'Mathematics',
      topic: 'Evaluation Test',
      studentName: studentProfile?.name || 'Test Student',
      grade: studentProfile?.grade.toString() || '8',
      board: studentProfile?.board || 'CBSE',
      country: studentProfile?.country || 'India'
    };

    const payload = {
      sessionContext,
      message: question,
      conversationHistory: []
    };

    try {
      const response = await fetch(`${this.config.tutorApiEndpoint}/learning/interact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.timeoutMs)
      });

      if (!response.ok) {
        throw new Error(`AI Tutor API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      
      return {
        response: data.content || data.response || 'No response received',
        success: true,
        metadata: {
          timestamp: new Date().toISOString(),
          processingTime: data.responseTime || 0,
          model: data.model
        }
      };

    } catch (error) {
      console.error('Error querying AI tutor:', error);
      throw new Error(`Failed to get AI tutor response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Evaluate AI response using AWS Bedrock via backend API
   */
  private async evaluateWithAIJudge(scenario: TestScenarioInternal, aiResponse: AITutorResponse): Promise<AIJudgeResponse> {
    const judgePrompt = `
You are an expert educational AI evaluator. Your task is to evaluate the quality of an AI tutor's response to a student question.

QUESTION ASKED: "${scenario.question}"
DIFFICULTY LEVEL: ${scenario.difficulty}
EXPECTED CRITERIA: ${scenario.expectedCriteria.join(', ')}

AI TUTOR'S RESPONSE:
"${aiResponse.response}"

Please evaluate this response on a scale of 0-100 for each criterion:

1. ACCURACY: Is the information factually correct?
2. CLARITY: Is the explanation clear and easy to understand?
3. COMPLETENESS: Does it address all parts of the question?
4. AGE_APPROPRIATENESS: Is the language and complexity suitable for grade ${scenario.grade}?
5. ENGAGEMENT: Is the response engaging and likely to help student learning?
6. STRUCTURE: Is the response well-organized and logical?

Provide your evaluation in the following JSON format:
{
  "overall_score": [0-100],
  "criteria_scores": {
    "accuracy": [0-100],
    "clarity": [0-100], 
    "completeness": [0-100],
    "age_appropriateness": [0-100],
    "engagement": [0-100],
    "structure": [0-100]
  },
  "detailed_feedback": "detailed explanation of the evaluation",
  "strengths": ["list of strengths"],
  "areas_for_improvement": ["list of areas for improvement"],
  "confidence_level": [0-100]
}

Be thorough but fair in your evaluation. Consider that this is educational content for students.
`;

    const evaluationPayload = {
      prompt: judgePrompt,
      model: this.config.judgeModel,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      systemPrompt: "You are an expert educational AI evaluator. Provide objective, detailed evaluations of AI tutor responses. Always respond with valid JSON."
    };

    try {
      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      // Add API key if available
      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }

      const response = await fetch(`${this.config.backendApiEndpoint}/ai/evaluate`, {
        method: 'POST',
        headers,
        body: JSON.stringify(evaluationPayload),
        signal: AbortSignal.timeout(this.config.timeoutMs)
      });

      if (!response.ok) {
        throw new Error(`Backend AI Evaluator API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      
      // Extract the evaluation from the backend response
      let evaluationText: string;
      if (data.evaluation) {
        evaluationText = data.evaluation;
      } else if (data.response) {
        evaluationText = data.response;
      } else if (data.content) {
        evaluationText = data.content;
      } else {
        throw new Error('No evaluation response received from backend AI judge');
      }

      // Parse JSON response
      try {
        const evaluation = JSON.parse(evaluationText) as AIJudgeResponse;
        
        // Validate and normalize scores
        if (typeof evaluation.overall_score !== 'number') {
          evaluation.overall_score = 0;
        }
        
        evaluation.overall_score = Math.max(0, Math.min(100, evaluation.overall_score));
        
        // Ensure all criteria scores are present and valid
        const defaultCriteria: EvaluationCriteria = {
          accuracy: 0,
          clarity: 0,
          completeness: 0,
          age_appropriateness: 0,
          engagement: 0,
          structure: 0
        };

        evaluation.criteria_scores = {
          ...defaultCriteria,
          ...evaluation.criteria_scores
        };

        // Normalize criteria scores
        Object.keys(evaluation.criteria_scores).forEach(key => {
          const criteriaKey = key as keyof EvaluationCriteria;
          evaluation.criteria_scores[criteriaKey] = Math.max(0, Math.min(100, evaluation.criteria_scores[criteriaKey]));
        });
        
        return evaluation;
        
      } catch (parseError) {
        console.error('Failed to parse judge evaluation JSON:', parseError);
        console.error('Raw response:', evaluationText);
        
        // Fallback evaluation
        return {
          overall_score: 50,
          criteria_scores: {
            accuracy: 50,
            clarity: 50,
            completeness: 50,
            age_appropriateness: 50,
            engagement: 50,
            structure: 50
          },
          detailed_feedback: "Evaluation parsing failed, using default scores",
          strengths: [],
          areas_for_improvement: ["Unable to parse detailed evaluation"],
          confidence_level: 0
        };
      }

    } catch (error) {
      console.error('Backend AI Judge evaluation failed:', error);
      
      // Return basic fallback evaluation
      return {
        overall_score: 0,
        criteria_scores: {
          accuracy: 0,
          clarity: 0,
          completeness: 0,
          age_appropriateness: 0,
          engagement: 0,
          structure: 0
        },
        detailed_feedback: "Could not complete backend AI judge evaluation",
        strengths: [],
        areas_for_improvement: [`Backend AI Judge evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        confidence_level: 0
      };
    }
  }

  /**
   * Get test scenarios for subject and grade
   */
  private getTestScenarios(subject: string, grade: string, numTests: number): TestScenarioInternal[] {
    const scenarios = this.testScenarios[subject]?.[grade] || [];
    
    if (scenarios.length === 0) {
      // Generate default scenarios if none exist
      return this.generateDefaultScenarios(subject, grade, numTests);
    }
    
    // Return requested number of scenarios (cycling if needed)
    const result: TestScenarioInternal[] = [];
    for (let i = 0; i < numTests; i++) {
      const scenario = scenarios[i % scenarios.length];
      if (scenario) {
        result.push(scenario);
      }
    }
    
    return result;
  }

  /**
   * Generate default test scenarios
   */
  private generateDefaultScenarios(subject: string, grade: string, numTests: number): TestScenarioInternal[] {
    const gradeNum = parseInt(grade.replace('grade', ''));
    
    const defaultScenarios: TestScenarioInternal[] = [
      {
        subject,
        grade: gradeNum,
        question: `Explain a key concept in ${subject} appropriate for grade ${gradeNum}`,
        expectedCriteria: ["accuracy", "clarity", "age-appropriateness"],
        difficulty: gradeNum <= 8 ? "intermediate" : "advanced"
      },
      {
        subject,
        grade: gradeNum,
        question: `Provide an example problem and solution in ${subject}`,
        expectedCriteria: ["step-by-step explanation", "correct solution", "clear reasoning"],
        difficulty: "intermediate"
      },
      {
        subject,
        grade: gradeNum,
        question: `Why is this ${subject} concept important for students to learn?`,
        expectedCriteria: ["relevance explanation", "real-world applications", "motivation"],
        difficulty: "beginner"
      }
    ];

    return defaultScenarios.slice(0, numTests);
  }

  /**
   * Generate evaluation summary
   */
  private generateSummary(
    results: EvaluationResult[], 
    metadata: EvaluationSummary['metadata']
  ): EvaluationSummary {
    const totalTests = results.length;
    const passedTests = results.filter(test => 
      test.judgeEvaluation.overall_score >= this.config.passingScore
    ).length;
    const failedTests = totalTests - passedTests;
    
    // Calculate average scores
    const validScores = results
      .map(test => test.judgeEvaluation.overall_score)
      .filter(score => score > 0);
    
    const averageScore = validScores.length > 0 
      ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length 
      : 0;

    // Calculate criteria averages
    const criteriaAverages: EvaluationCriteria = {
      accuracy: 0,
      clarity: 0,
      completeness: 0,
      age_appropriateness: 0,
      engagement: 0,
      structure: 0
    };
    
    const allCriteria = Object.keys(criteriaAverages) as (keyof EvaluationCriteria)[];
    
    allCriteria.forEach(criterion => {
      const scores = results
        .map(test => test.judgeEvaluation.criteria_scores[criterion])
        .filter(score => typeof score === 'number' && score > 0);
      
      criteriaAverages[criterion] = scores.length > 0 
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length 
        : 0;
    });

    return {
      totalTests,
      averageScore,
      criteriaAverages,
      passedTests,
      failedTests,
      results,
      metadata
    };
  }

  /**
   * Utility function for delays
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Save evaluation results to file
   */
  async saveResults(results: EvaluationSummary, filename?: string): Promise<string> {
    if (!filename) {
      filename = `evaluation_${Date.now()}.json`;
    }
    
    const filepath = join(__dirname, '..', 'results', filename);
    
    // Ensure results directory exists
    await fs.mkdir(dirname(filepath), { recursive: true });
    
    await fs.writeFile(filepath, JSON.stringify(results, null, 2));
    
    console.log(`💾 Results saved to: ${filepath}`);
    return filepath;
  }
}
