export interface StudentProfile {
  studentId: string;
  name: string;
  grade: number;
  subjects: string[];
  board: string;
  country: string;
  school?: string;
  learningPace: 'slow' | 'medium' | 'fast';
  challenges?: string[];
  strengths?: string[];
  learningStyle?: string[];
  notes?: string;
}

export interface TestScenario {
  subject: string;
  grade: number;
  question: string;
  expectedTopics: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  context?: string;
}

export interface AITutorResponse {
  response: string;
  success: boolean;
  error?: string;
  metadata?: {
    timestamp: string;
    processingTime: number;
    model?: string;
  };
}

export interface EvaluationCriteria {
  accuracy: number;
  clarity: number;
  completeness: number;
  age_appropriateness: number;
  engagement: number;
  structure: number;
}

export interface AIJudgeResponse {
  overall_score: number;
  criteria_scores: EvaluationCriteria;
  detailed_feedback: string;
  strengths: string[];
  areas_for_improvement: string[];
  confidence_level: number;
}

export interface EvaluationResult {
  scenario: TestScenario;
  tutorResponse: AITutorResponse;
  judgeEvaluation: AIJudgeResponse;
  timestamp: string;
  processingTime: number;
}

export interface EvaluationSummary {
  totalTests: number;
  averageScore: number;
  criteriaAverages: EvaluationCriteria;
  passedTests: number;
  failedTests: number;
  results: EvaluationResult[];
  metadata: {
    timestamp: string;
    duration: number;
    studentProfile?: StudentProfile;
    configuration: EvaluationConfig;
  };
}

export interface EvaluationConfig {
  backendApiEndpoint: string;
  tutorApiEndpoint: string;
  judgeModel: string; // AWS Bedrock model (e.g., 'aws-nitro-lite')
  maxTokens: number;
  temperature: number;
  passingScore: number;
  timeoutMs: number;
  maxRetries: number;
  apiKey?: string; // Optional API key for backend authentication
}

export interface EvaluationOptions {
  subject?: string;
  grade?: number;
  numberOfTests?: number;
  studentProfile?: string;
  outputFile?: string;
  verbose?: boolean;
  fullSuite?: boolean;
  timeout?: number;
  passingScore?: number;
}
