#!/usr/bin/env node

/**
 * AI Judge Evaluation CLI Runner
 * 
 * Usage:
 *   pnpm dev --subject mathematics --grade 8 --tests 3
 *   pnpm run evaluate --full-suite
 *   pnpm run evaluate --student-profile ./student.json
 */

import { AIJudgeEvaluator } from './ai-judge-evaluator.js';
import { promises as fs } from 'fs';
import type { StudentProfile, EvaluationOptions, EvaluationSummary } from './types/index.js';

interface CliArgs {
  subject: string;
  grade: string;
  tests: number;
  fullSuite: boolean;
  studentProfile: string | null;
  output: string | null;
  verbose: boolean;
}

interface TestConfig {
  subject: string;
  grade: string;
  tests: number;
}

interface ComprehensiveResult extends EvaluationSummary {
  error?: string;
}

interface ComprehensiveReportData {
  timestamp: string;
  summary: {
    totalSuites: number;
    successful: number;
    failed: number;
    averageScore: number;
  };
  results: ComprehensiveResult[];
}

export class EvaluationRunner {
  private evaluator: AIJudgeEvaluator;

  constructor() {
    this.evaluator = new AIJudgeEvaluator();
  }

  async run(): Promise<void> {
    const args = this.parseArgs();
    
    console.log('🚀 AI Judge Evaluation System');
    console.log('===========================\n');

    try {
      if (args.fullSuite) {
        await this.runFullSuite();
      } else {
        await this.runSingleEvaluation(args);
      }
    } catch (error) {
      console.error('❌ Evaluation failed:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  private parseArgs(): CliArgs {
    const args: CliArgs = {
      subject: 'mathematics',
      grade: '8',
      tests: 3,
      fullSuite: false,
      studentProfile: null,
      output: null,
      verbose: false
    };

    for (let i = 2; i < process.argv.length; i++) {
      const arg = process.argv[i];
      const nextArg = process.argv[i + 1];

      switch (arg) {
        case '--subject':
        case '-s':
          if (nextArg) {
            args.subject = nextArg;
            i++;
          }
          break;
        case '--grade':
        case '-g':
          if (nextArg) {
            args.grade = nextArg;
            i++;
          }
          break;
        case '--tests':
        case '-t':
          if (nextArg) {
            args.tests = parseInt(nextArg) || 3;
            i++;
          }
          break;
        case '--full-suite':
        case '-f':
          args.fullSuite = true;
          break;
        case '--student-profile':
        case '-p':
          if (nextArg) {
            args.studentProfile = nextArg;
            i++;
          }
          break;
        case '--output':
        case '-o':
          if (nextArg) {
            args.output = nextArg;
            i++;
          }
          break;
        case '--verbose':
        case '-v':
          args.verbose = true;
          break;
        case '--help':
        case '-h':
          this.showHelp();
          process.exit(0);
      }
    }

    return args;
  }

  private showHelp(): void {
    console.log(`
AI Judge Evaluation CLI

USAGE:
  pnpm dev [options]
  pnpm run evaluate [options]

OPTIONS:
  -s, --subject <subject>     Subject to test (mathematics, science) [default: mathematics]
  -g, --grade <grade>         Grade level (8, 9, 10, etc.) [default: 8]
  -t, --tests <number>        Number of test scenarios to run [default: 3]
  -f, --full-suite           Run comprehensive evaluation across all subjects/grades
  -p, --student-profile <file> Use specific student profile JSON file
  -o, --output <file>         Save results to specific file
  -v, --verbose              Enable verbose output
  -h, --help                 Show this help message

EXAMPLES:
  # Basic evaluation for grade 8 mathematics
  pnpm dev --subject mathematics --grade 8 --tests 5

  # Full comprehensive suite
  pnpm run evaluate --full-suite

  # Test with specific student profile
  pnpm dev --student-profile ./profiles/aman-negi.json

  # Save results to specific file
  pnpm dev --subject science --grade 10 --output results/science-eval.json

ENVIRONMENT VARIABLES:
  BACKEND_API_ENDPOINT        Required: Backend API endpoint for AI judge (AWS Bedrock)
  AI_TUTOR_ENDPOINT          Required: AI tutor endpoint URL
  BACKEND_API_KEY            Optional: Backend API key for authentication
`);
  }

  private async runSingleEvaluation(args: CliArgs): Promise<void> {
    console.log(`📚 Subject: ${args.subject}`);
    console.log(`🎓 Grade: ${args.grade}`);
    console.log(`🧪 Tests: ${args.tests}`);

    let studentProfile: StudentProfile | undefined;
    if (args.studentProfile) {
      try {
        const profileData = await fs.readFile(args.studentProfile, 'utf8');
        studentProfile = JSON.parse(profileData) as StudentProfile;
        console.log(`👤 Student Profile: ${studentProfile.name || 'Unknown'}`);
      } catch (error) {
        console.error(`⚠️  Failed to load student profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log('\n🔄 Starting evaluation...\n');

    const evaluationOptions: EvaluationOptions = {
      subject: args.subject,
      grade: parseInt(args.grade),
      numberOfTests: args.tests,
      verbose: args.verbose
    };

    if (args.studentProfile) {
      evaluationOptions.studentProfile = args.studentProfile;
    }

    const results = await this.evaluator.runEvaluation(evaluationOptions);

    await this.displayResults(results, args.verbose);
    
    if (args.output) {
      await this.evaluator.saveResults(results, args.output);
    } else {
      await this.evaluator.saveResults(results);
    }
  }

  private async runFullSuite(): Promise<void> {
    console.log('🏆 Running Full Evaluation Suite\n');

    const testMatrix: TestConfig[] = [
      { subject: 'mathematics', grade: '8', tests: 5 },
      { subject: 'mathematics', grade: '10', tests: 5 },
      { subject: 'science', grade: '8', tests: 3 },
      { subject: 'science', grade: '10', tests: 3 }
    ];

    const allResults: ComprehensiveResult[] = [];

    for (const testConfig of testMatrix) {
      console.log(`\n📋 Testing ${testConfig.subject} - Grade ${testConfig.grade}`);
      console.log('='.repeat(50));

      try {
        const evaluationOptions: EvaluationOptions = {
          subject: testConfig.subject,
          grade: parseInt(testConfig.grade),
          numberOfTests: testConfig.tests
        };

        const results = await this.evaluator.runEvaluation(evaluationOptions);

        allResults.push(results);
        await this.displayResults(results, false);

        // Brief pause between test suites
        await this.delay(2000);

      } catch (error) {
        console.error(`❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
        
        const failedResult: ComprehensiveResult = {
          totalTests: 0,
          averageScore: 0,
          criteriaAverages: {
            accuracy: 0,
            clarity: 0,
            completeness: 0,
            age_appropriateness: 0,
            engagement: 0,
            structure: 0
          },
          passedTests: 0,
          failedTests: 0,
          results: [],
          metadata: {
            timestamp: new Date().toISOString(),
            duration: 0,
            configuration: {
              backendApiEndpoint: '',
              tutorApiEndpoint: '',
              judgeModel: 'aws-nitro-lite',
              maxTokens: 1000,
              temperature: 0.1,
              passingScore: 70,
              timeoutMs: 30000,
              maxRetries: 3
            }
          },
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        
        allResults.push(failedResult);
      }
    }

    // Generate comprehensive report
    console.log('\n📊 COMPREHENSIVE EVALUATION REPORT');
    console.log('='.repeat(60));
    
    await this.generateComprehensiveReport(allResults);
  }

  private async displayResults(results: EvaluationSummary, verbose = false): Promise<void> {
    console.log('\n📊 EVALUATION RESULTS');
    console.log('='.repeat(40));
    
    console.log(`\n🎯 Average Score: ${results.averageScore.toFixed(1)}%`);
    console.log(`🧪 Tests Completed: ${results.totalTests}`);
    console.log(`✅ Passed Tests: ${results.passedTests}`);
    console.log(`❌ Failed Tests: ${results.failedTests}`);
    
    const successRate = results.totalTests > 0 ? (results.passedTests / results.totalTests) * 100 : 0;
    console.log(`📈 Success Rate: ${successRate.toFixed(1)}%`);

    // Criteria breakdown
    console.log('\n📋 Criteria Scores:');
    Object.entries(results.criteriaAverages).forEach(([criterion, score]) => {
      const emoji = this.getScoreEmoji(score);
      console.log(`   ${emoji} ${criterion.replace('_', ' ')}: ${score.toFixed(1)}%`);
    });

    // Detailed test results (if verbose)
    if (verbose && results.results.length > 0) {
      console.log('\n🔍 DETAILED TEST RESULTS');
      console.log('='.repeat(40));
      
      results.results.forEach((test, index) => {
        console.log(`\n📝 Test ${index + 1}:`);
        console.log(`   Question: ${test.scenario.question}`);
        console.log(`   Score: ${test.judgeEvaluation.overall_score}%`);
        console.log(`   Duration: ${test.processingTime}ms`);
        
        if (test.judgeEvaluation.detailed_feedback) {
          console.log(`   Feedback: ${test.judgeEvaluation.detailed_feedback.substring(0, 100)}...`);
        }
      });
    }
  }

  private async generateComprehensiveReport(allResults: ComprehensiveResult[]): Promise<void> {
    const successfulResults = allResults.filter(r => !r.error);
    const failedResults = allResults.filter(r => r.error);

    console.log(`\n📈 Overall Performance:`);
    console.log(`   Total Test Suites: ${allResults.length}`);
    console.log(`   Successful: ${successfulResults.length}`);
    console.log(`   Failed: ${failedResults.length}`);

    if (successfulResults.length > 0) {
      const avgOverallScore = successfulResults.reduce((sum, r) => sum + r.averageScore, 0) / successfulResults.length;
      console.log(`   Average Score: ${avgOverallScore.toFixed(1)}%`);

      // Subject breakdown
      const subjectScores: Record<string, number[]> = {};
      successfulResults.forEach(result => {
        // Extract subject from metadata or use a default grouping
        const subject = result.metadata.studentProfile?.subjects[0] || 'unknown';
        if (!subjectScores[subject]) {
          subjectScores[subject] = [];
        }
        subjectScores[subject]!.push(result.averageScore);
      });

      console.log(`\n📚 Subject Performance:`);
      Object.entries(subjectScores).forEach(([subject, scores]) => {
        if (scores.length > 0) {
          const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
          const emoji = this.getScoreEmoji(avgScore);
          console.log(`   ${emoji} ${subject}: ${avgScore.toFixed(1)}% (${scores.length} tests)`);
        }
      });
    }

    if (failedResults.length > 0) {
      console.log(`\n❌ Failed Test Suites:`);
      failedResults.forEach(result => {
        console.log(`   • ${result.error || 'Unknown error'}`);
      });
    }

    // Save comprehensive report
    const reportData: ComprehensiveReportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalSuites: allResults.length,
        successful: successfulResults.length,
        failed: failedResults.length,
        averageScore: successfulResults.length > 0 
          ? successfulResults.reduce((sum, r) => sum + r.averageScore, 0) / successfulResults.length 
          : 0
      },
      results: allResults
    };

    // Save as JSON file manually since this is a different format than EvaluationSummary
    const filename = `comprehensive_report_${Date.now()}.json`;
    const { promises: fs } = await import('fs');
    const { join, dirname } = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const filepath = join(__dirname, '..', 'results', filename);
    
    await fs.mkdir(dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(reportData, null, 2));
    
    console.log(`\n💾 Comprehensive report saved to: ${filepath}`);
  }

  private getScoreEmoji(score: number): string {
    if (score >= 90) return '🟢';
    if (score >= 80) return '🟡';
    if (score >= 70) return '🟠';
    return '🔴';
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
const runner = new EvaluationRunner();
runner.run().catch(error => {
  console.error('❌ Critical error:', error);
  process.exit(1);
});
