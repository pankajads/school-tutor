/**
 * AI Judge Evaluator - Independent AI Quality Assessment System
 * 
 * This system:
 * 1. Sends test questions to the AI tutor
 * 2. Receives AI responses 
 * 3. Uses a separate AI judge to evaluate response quality
 * 4. Provides objective scoring independent of student data
 */

require('dotenv').config();
const { OpenAI } = require('openai');

class AIJudgeEvaluator {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // AI Tutor endpoint configuration
    this.aiTutorEndpoint = process.env.AI_TUTOR_ENDPOINT || 'https://0mcvthborg.execute-api.ap-southeast-1.amazonaws.com/prod';
    
    // Test scenarios for different subjects and grades
    this.testScenarios = {
      mathematics: {
        grade8: [
          {
            question: "Explain the concept of rational numbers with examples",
            expectedCriteria: ["definition", "examples", "age-appropriate language", "clear explanation"],
            difficulty: "medium"
          },
          {
            question: "Solve: 2x + 5 = 13 and explain each step",
            expectedCriteria: ["step-by-step solution", "explanation of operations", "correct answer", "mathematical reasoning"],
            difficulty: "medium"
          }
        ],
        grade10: [
          {
            question: "Explain quadratic equations and provide the quadratic formula",
            expectedCriteria: ["definition", "formula", "when to use", "example application"],
            difficulty: "hard"
          }
        ]
      },
      science: {
        grade8: [
          {
            question: "What is photosynthesis and why is it important?",
            expectedCriteria: ["process explanation", "importance", "scientific accuracy", "clear language"],
            difficulty: "medium"
          }
        ]
      }
    };
  }

  /**
   * Run comprehensive AI evaluation
   */
  async runEvaluation(options = {}) {
    const {
      subject = 'mathematics',
      grade = 'grade8',
      numTests = 3,
      studentProfile = null
    } = options;

    console.log(`🎯 Starting AI Judge Evaluation for ${subject} - ${grade}`);
    console.log(`📊 Running ${numTests} test scenarios`);

    const results = {
      evaluationId: `eval_${Date.now()}`,
      timestamp: new Date().toISOString(),
      subject,
      grade,
      studentProfile,
      testResults: [],
      overallScore: 0,
      summary: {}
    };

    try {
      const scenarios = this.getTestScenarios(subject, grade, numTests);
      
      for (let i = 0; i < scenarios.length; i++) {
        console.log(`\n🧪 Running test ${i + 1}/${scenarios.length}: ${scenarios[i].question.substring(0, 50)}...`);
        
        const testResult = await this.runSingleTest(scenarios[i], studentProfile);
        results.testResults.push(testResult);
        
        // Add delay between tests
        await this.delay(1000);
      }

      // Calculate overall metrics
      results.overallScore = this.calculateOverallScore(results.testResults);
      results.summary = this.generateSummary(results.testResults);

      console.log(`\n✅ Evaluation completed! Overall Score: ${results.overallScore.toFixed(1)}%`);
      
      return results;

    } catch (error) {
      console.error('❌ Evaluation failed:', error);
      throw error;
    }
  }

  /**
   * Run a single test scenario
   */
  async runSingleTest(scenario, studentProfile) {
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
        testId: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        scenario: scenario,
        aiResponse: aiResponse,
        judgeEvaluation: judgeEvaluation,
        duration: duration,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`  ❌ Test failed:`, error.message);
      return {
        testId: `test_${Date.now()}_error`,
        scenario: scenario,
        aiResponse: null,
        judgeEvaluation: {
          score: 0,
          reasoning: `Test failed: ${error.message}`,
          criteria_scores: {},
          issues: [error.message]
        },
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Query the AI tutor with a test question
   */
  async queryAITutor(question, studentProfile) {
    const sessionContext = {
      sessionId: `eval_session_${Date.now()}`,
      studentId: studentProfile?.studentId || 'eval_student',
      subject: studentProfile?.subject || 'Mathematics',
      topic: 'Evaluation Test',
      studentName: studentProfile?.name || 'Test Student',
      grade: studentProfile?.grade || '8',
      board: studentProfile?.board || 'CBSE',
      country: studentProfile?.country || 'India'
    };

    const payload = {
      sessionContext,
      message: question,
      conversationHistory: []
    };

    try {
      const response = await fetch(`${this.aiTutorEndpoint}/learning/interact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`AI Tutor API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        content: data.content || data.response || 'No response received',
        responseTime: data.responseTime || 0,
        tokenUsage: data.tokenUsage || {},
        rawResponse: data
      };

    } catch (error) {
      console.error('Error querying AI tutor:', error);
      throw new Error(`Failed to get AI tutor response: ${error.message}`);
    }
  }

  /**
   * Evaluate AI response using GPT-4 as judge
   */
  async evaluateWithAIJudge(scenario, aiResponse) {
    const judgePrompt = `
You are an expert educational AI evaluator. Your task is to evaluate the quality of an AI tutor's response to a student question.

QUESTION ASKED: "${scenario.question}"
DIFFICULTY LEVEL: ${scenario.difficulty}
EXPECTED CRITERIA: ${scenario.expectedCriteria.join(', ')}

AI TUTOR'S RESPONSE:
"${aiResponse.content}"

Please evaluate this response on a scale of 0-100 for each criterion:

1. ACCURACY: Is the information factually correct?
2. CLARITY: Is the explanation clear and easy to understand?
3. COMPLETENESS: Does it address all parts of the question?
4. AGE_APPROPRIATENESS: Is the language and complexity suitable for the grade level?
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
  "strengths": ["list of strengths"],
  "weaknesses": ["list of weaknesses"],
  "reasoning": "detailed explanation of the evaluation",
  "suggestions": ["suggestions for improvement"]
}

Be thorough but fair in your evaluation. Consider that this is educational content for students.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an expert educational AI evaluator. Provide objective, detailed evaluations of AI tutor responses. Always respond with valid JSON."
          },
          {
            role: "user", 
            content: judgePrompt
          }
        ],
        temperature: 0.1, // Low temperature for consistent evaluation
        max_tokens: 1000
      });

      const evaluationText = response.choices[0].message.content;
      
      // Parse JSON response
      try {
        const evaluation = JSON.parse(evaluationText);
        
        // Validate and normalize scores
        if (typeof evaluation.overall_score !== 'number') {
          evaluation.overall_score = 0;
        }
        
        evaluation.overall_score = Math.max(0, Math.min(100, evaluation.overall_score));
        
        return evaluation;
        
      } catch (parseError) {
        console.error('Failed to parse judge evaluation JSON:', parseError);
        
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
          strengths: [],
          weaknesses: ["Unable to parse detailed evaluation"],
          reasoning: "Evaluation parsing failed, using default scores",
          suggestions: ["Review AI judge evaluation system"]
        };
      }

    } catch (error) {
      console.error('AI Judge evaluation failed:', error);
      
      // Return basic fallback evaluation
      return {
        overall_score: 0,
        criteria_scores: {},
        strengths: [],
        weaknesses: [`AI Judge evaluation failed: ${error.message}`],
        reasoning: "Could not complete AI judge evaluation",
        suggestions: ["Check AI judge system configuration"]
      };
    }
  }

  /**
   * Get test scenarios for subject and grade
   */
  getTestScenarios(subject, grade, numTests) {
    const scenarios = this.testScenarios[subject]?.[grade] || [];
    
    if (scenarios.length === 0) {
      // Generate default scenarios if none exist
      return this.generateDefaultScenarios(subject, grade, numTests);
    }
    
    // Return requested number of scenarios (cycling if needed)
    const result = [];
    for (let i = 0; i < numTests; i++) {
      result.push(scenarios[i % scenarios.length]);
    }
    
    return result;
  }

  /**
   * Generate default test scenarios
   */
  generateDefaultScenarios(subject, grade, numTests) {
    const gradeNum = parseInt(grade.replace('grade', ''));
    
    const defaultScenarios = [
      {
        question: `Explain a key concept in ${subject} appropriate for grade ${gradeNum}`,
        expectedCriteria: ["accuracy", "clarity", "age-appropriateness"],
        difficulty: gradeNum <= 8 ? "medium" : "hard"
      },
      {
        question: `Provide an example problem and solution in ${subject}`,
        expectedCriteria: ["step-by-step explanation", "correct solution", "clear reasoning"],
        difficulty: "medium"
      },
      {
        question: `Why is this ${subject} concept important for students to learn?`,
        expectedCriteria: ["relevance explanation", "real-world applications", "motivation"],
        difficulty: "easy"
      }
    ];

    return defaultScenarios.slice(0, numTests);
  }

  /**
   * Calculate overall score from test results
   */
  calculateOverallScore(testResults) {
    if (testResults.length === 0) return 0;
    
    const validScores = testResults
      .map(test => test.judgeEvaluation?.overall_score || 0)
      .filter(score => score > 0);
    
    if (validScores.length === 0) return 0;
    
    return validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
  }

  /**
   * Generate evaluation summary
   */
  generateSummary(testResults) {
    const totalTests = testResults.length;
    const successfulTests = testResults.filter(test => test.judgeEvaluation?.overall_score > 0).length;
    const failedTests = totalTests - successfulTests;
    
    const avgResponseTime = testResults.reduce((sum, test) => sum + (test.duration || 0), 0) / totalTests;
    
    const criteriaAverages = {};
    const allCriteria = ['accuracy', 'clarity', 'completeness', 'age_appropriateness', 'engagement', 'structure'];
    
    allCriteria.forEach(criterion => {
      const scores = testResults
        .map(test => test.judgeEvaluation?.criteria_scores?.[criterion])
        .filter(score => typeof score === 'number');
      
      criteriaAverages[criterion] = scores.length > 0 
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length 
        : 0;
    });

    // Collect all strengths and weaknesses
    const allStrengths = [];
    const allWeaknesses = [];
    
    testResults.forEach(test => {
      if (test.judgeEvaluation?.strengths) {
        allStrengths.push(...test.judgeEvaluation.strengths);
      }
      if (test.judgeEvaluation?.weaknesses) {
        allWeaknesses.push(...test.judgeEvaluation.weaknesses);
      }
    });

    return {
      totalTests,
      successfulTests,
      failedTests,
      successRate: (successfulTests / totalTests) * 100,
      avgResponseTime: Math.round(avgResponseTime),
      criteriaAverages,
      commonStrengths: this.getTopItems(allStrengths, 3),
      commonWeaknesses: this.getTopItems(allWeaknesses, 3),
      grade: this.calculateGrade(criteriaAverages),
      recommendations: this.generateRecommendations(criteriaAverages, allWeaknesses)
    };
  }

  /**
   * Get most common items from array
   */
  getTopItems(items, limit) {
    const counts = {};
    items.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });
    
    return Object.entries(counts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([item]) => item);
  }

  /**
   * Calculate letter grade from criteria averages
   */
  calculateGrade(criteriaAverages) {
    const overallAvg = Object.values(criteriaAverages).reduce((sum, score) => sum + score, 0) / Object.keys(criteriaAverages).length;
    
    if (overallAvg >= 90) return 'A+';
    if (overallAvg >= 85) return 'A';
    if (overallAvg >= 80) return 'B+';
    if (overallAvg >= 75) return 'B';
    if (overallAvg >= 70) return 'C+';
    if (overallAvg >= 65) return 'C';
    if (overallAvg >= 60) return 'D';
    return 'F';
  }

  /**
   * Generate improvement recommendations
   */
  generateRecommendations(criteriaAverages, weaknesses) {
    const recommendations = [];
    
    // Check each criterion
    Object.entries(criteriaAverages).forEach(([criterion, score]) => {
      if (score < 70) {
        switch (criterion) {
          case 'accuracy':
            recommendations.push('Improve factual accuracy with better knowledge base validation');
            break;
          case 'clarity':
            recommendations.push('Enhance explanation clarity with simpler language and examples');
            break;
          case 'completeness':
            recommendations.push('Ensure responses address all parts of student questions');
            break;
          case 'age_appropriateness':
            recommendations.push('Better adapt language and concepts to student grade level');
            break;
          case 'engagement':
            recommendations.push('Add more interactive elements and relatable examples');
            break;
          case 'structure':
            recommendations.push('Improve response organization and logical flow');
            break;
        }
      }
    });

    // Add specific recommendations based on common weaknesses
    if (weaknesses.includes('too complex')) {
      recommendations.push('Simplify explanations for better student comprehension');
    }
    if (weaknesses.includes('missing examples')) {
      recommendations.push('Include more concrete examples in explanations');
    }

    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  }

  /**
   * Utility function for delays
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Save evaluation results to file
   */
  async saveResults(results, filename = null) {
    const fs = require('fs').promises;
    const path = require('path');
    
    if (!filename) {
      filename = `evaluation_${results.evaluationId}_${Date.now()}.json`;
    }
    
    const filepath = path.join(__dirname, 'results', filename);
    
    // Ensure results directory exists
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    await fs.writeFile(filepath, JSON.stringify(results, null, 2));
    
    console.log(`💾 Results saved to: ${filepath}`);
    return filepath;
  }
}

module.exports = { AIJudgeEvaluator };
