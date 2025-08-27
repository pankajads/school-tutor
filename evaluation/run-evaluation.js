#!/usr/bin/env node

/**
 * AI Judge Evaluation CLI Runner
 * 
 * Usage:
 *   node run-evaluation.js --subject mathematics --grade 8 --tests 3
 *   node run-evaluation.js --full-suite
 *   node run-evaluation.js --student-profile ./student.json
 */

const { AIJudgeEvaluator } = require('./ai-judge-evaluator');
const fs = require('fs').promises;
const path = require('path');

class EvaluationRunner {
  constructor() {
    this.evaluator = new AIJudgeEvaluator();
  }

  async run() {
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
      console.error('❌ Evaluation failed:', error.message);
      process.exit(1);
    }
  }

  parseArgs() {
    const args = {
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
          args.subject = nextArg;
          i++;
          break;
        case '--grade':
        case '-g':
          args.grade = nextArg;
          i++;
          break;
        case '--tests':
        case '-t':
          args.tests = parseInt(nextArg) || 3;
          i++;
          break;
        case '--full-suite':
        case '-f':
          args.fullSuite = true;
          break;
        case '--student-profile':
        case '-p':
          args.studentProfile = nextArg;
          i++;
          break;
        case '--output':
        case '-o':
          args.output = nextArg;
          i++;
          break;
        case '--verbose':
        case '-v':
          args.verbose = true;
          break;
        case '--help':
        case '-h':
          this.showHelp();
          process.exit(0);
          break;
      }
    }

    return args;
  }

  showHelp() {
    console.log(`
AI Judge Evaluation CLI

USAGE:
  node run-evaluation.js [options]

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
  node run-evaluation.js --subject mathematics --grade 8 --tests 5

  # Full comprehensive suite
  node run-evaluation.js --full-suite

  # Test with specific student profile
  node run-evaluation.js --student-profile ./profiles/aman-negi.json

  # Save results to specific file
  node run-evaluation.js --subject science --grade 10 --output results/science-eval.json

ENVIRONMENT VARIABLES:
  OPENAI_API_KEY              Required: OpenAI API key for AI judge
  AI_TUTOR_ENDPOINT          Optional: AI tutor endpoint URL
`);
  }

  async runSingleEvaluation(args) {
    console.log(`📚 Subject: ${args.subject}`);
    console.log(`🎓 Grade: ${args.grade}`);
    console.log(`🧪 Tests: ${args.tests}`);

    let studentProfile = null;
    if (args.studentProfile) {
      try {
        const profileData = await fs.readFile(args.studentProfile, 'utf8');
        studentProfile = JSON.parse(profileData);
        console.log(`👤 Student Profile: ${studentProfile.name || 'Unknown'}`);
      } catch (error) {
        console.error(`⚠️  Failed to load student profile: ${error.message}`);
      }
    }

    console.log('\n🔄 Starting evaluation...\n');

    const results = await this.evaluator.runEvaluation({
      subject: args.subject,
      grade: `grade${args.grade}`,
      numTests: args.tests,
      studentProfile: studentProfile
    });

    await this.displayResults(results, args.verbose);
    
    if (args.output) {
      await this.evaluator.saveResults(results, args.output);
    } else {
      await this.evaluator.saveResults(results);
    }
  }

  async runFullSuite() {
    console.log('🏆 Running Full Evaluation Suite\n');

    const testMatrix = [
      { subject: 'mathematics', grade: '8', tests: 5 },
      { subject: 'mathematics', grade: '10', tests: 5 },
      { subject: 'science', grade: '8', tests: 3 },
      { subject: 'science', grade: '10', tests: 3 }
    ];

    const allResults = [];

    for (const testConfig of testMatrix) {
      console.log(`\n📋 Testing ${testConfig.subject} - Grade ${testConfig.grade}`);
      console.log('='.repeat(50));

      try {
        const results = await this.evaluator.runEvaluation({
          subject: testConfig.subject,
          grade: `grade${testConfig.grade}`,
          numTests: testConfig.tests
        });

        allResults.push(results);
        await this.displayResults(results, false);

        // Brief pause between test suites
        await this.delay(2000);

      } catch (error) {
        console.error(`❌ Failed: ${error.message}\n`);
        allResults.push({
          subject: testConfig.subject,
          grade: testConfig.grade,
          error: error.message,
          overallScore: 0
        });
      }
    }

    // Generate comprehensive report
    console.log('\n📊 COMPREHENSIVE EVALUATION REPORT');
    console.log('='.repeat(60));
    
    await this.generateComprehensiveReport(allResults);
  }

  async displayResults(results, verbose = false) {
    console.log('\n📊 EVALUATION RESULTS');
    console.log('='.repeat(40));
    
    console.log(`\n🎯 Overall Score: ${results.overallScore.toFixed(1)}%`);
    console.log(`📚 Subject: ${results.subject}`);
    console.log(`🎓 Grade: ${results.grade}`);
    console.log(`🧪 Tests Completed: ${results.testResults.length}`);
    
    if (results.summary) {
      console.log(`✅ Success Rate: ${results.summary.successRate.toFixed(1)}%`);
      console.log(`⏱️  Avg Response Time: ${results.summary.avgResponseTime}ms`);
      console.log(`📈 Grade: ${results.summary.grade}`);
    }

    // Criteria breakdown
    if (results.summary?.criteriaAverages) {
      console.log('\n📋 Criteria Scores:');
      Object.entries(results.summary.criteriaAverages).forEach(([criterion, score]) => {
        const emoji = this.getScoreEmoji(score);
        console.log(`   ${emoji} ${criterion.replace('_', ' ')}: ${score.toFixed(1)}%`);
      });
    }

    // Strengths and weaknesses
    if (results.summary?.commonStrengths?.length > 0) {
      console.log('\n💪 Common Strengths:');
      results.summary.commonStrengths.forEach(strength => {
        console.log(`   ✅ ${strength}`);
      });
    }

    if (results.summary?.commonWeaknesses?.length > 0) {
      console.log('\n⚠️  Common Weaknesses:');
      results.summary.commonWeaknesses.forEach(weakness => {
        console.log(`   ❌ ${weakness}`);
      });
    }

    // Recommendations
    if (results.summary?.recommendations?.length > 0) {
      console.log('\n💡 Recommendations:');
      results.summary.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }

    // Detailed test results (if verbose)
    if (verbose && results.testResults.length > 0) {
      console.log('\n🔍 DETAILED TEST RESULTS');
      console.log('='.repeat(40));
      
      results.testResults.forEach((test, index) => {
        console.log(`\n📝 Test ${index + 1}:`);
        console.log(`   Question: ${test.scenario.question}`);
        console.log(`   Score: ${test.judgeEvaluation?.overall_score || 0}%`);
        console.log(`   Duration: ${test.duration}ms`);
        
        if (test.judgeEvaluation?.reasoning) {
          console.log(`   Reasoning: ${test.judgeEvaluation.reasoning.substring(0, 100)}...`);
        }
      });
    }
  }

  async generateComprehensiveReport(allResults) {
    const successfulResults = allResults.filter(r => !r.error);
    const failedResults = allResults.filter(r => r.error);

    console.log(`\n📈 Overall Performance:`);
    console.log(`   Total Test Suites: ${allResults.length}`);
    console.log(`   Successful: ${successfulResults.length}`);
    console.log(`   Failed: ${failedResults.length}`);

    if (successfulResults.length > 0) {
      const avgOverallScore = successfulResults.reduce((sum, r) => sum + r.overallScore, 0) / successfulResults.length;
      console.log(`   Average Score: ${avgOverallScore.toFixed(1)}%`);

      // Subject breakdown
      const subjectScores = {};
      successfulResults.forEach(result => {
        if (!subjectScores[result.subject]) {
          subjectScores[result.subject] = [];
        }
        subjectScores[result.subject].push(result.overallScore);
      });

      console.log(`\n📚 Subject Performance:`);
      Object.entries(subjectScores).forEach(([subject, scores]) => {
        const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        const emoji = this.getScoreEmoji(avgScore);
        console.log(`   ${emoji} ${subject}: ${avgScore.toFixed(1)}% (${scores.length} tests)`);
      });
    }

    if (failedResults.length > 0) {
      console.log(`\n❌ Failed Test Suites:`);
      failedResults.forEach(result => {
        console.log(`   • ${result.subject} Grade ${result.grade}: ${result.error}`);
      });
    }

    // Save comprehensive report
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalSuites: allResults.length,
        successful: successfulResults.length,
        failed: failedResults.length,
        averageScore: successfulResults.length > 0 
          ? successfulResults.reduce((sum, r) => sum + r.overallScore, 0) / successfulResults.length 
          : 0
      },
      results: allResults
    };

    const reportPath = await this.evaluator.saveResults(reportData, `comprehensive_report_${Date.now()}.json`);
    console.log(`\n💾 Comprehensive report saved to: ${reportPath}`);
  }

  getScoreEmoji(score) {
    if (score >= 90) return '🟢';
    if (score >= 80) return '🟡';
    if (score >= 70) return '🟠';
    return '🔴';
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
if (require.main === module) {
  const runner = new EvaluationRunner();
  runner.run().catch(error => {
    console.error('❌ Critical error:', error);
    process.exit(1);
  });
}

module.exports = { EvaluationRunner };
