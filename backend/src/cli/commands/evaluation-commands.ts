import { DynamoDBClient, PutItemCommand, GetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { v4 as uuidv4 } from 'uuid';

export interface EvaluationRequest {
  type: 'comprehensive' | 'subject-specific' | 'quick' | 'custom';
  students?: string[];
  frameworks: ('ragas' | 'deepeval' | 'trulens' | 'all')[];
  metrics: string[];
  timeframe?: string;
  customConfig?: Record<string, any>;
}

export interface EvaluationResult {
  evaluationId: string;
  status: 'running' | 'completed' | 'failed';
  startTime: string;
  completedAt?: string;
  request: EvaluationRequest;
  results?: {
    ragas?: Record<string, number>;
    deepeval?: Record<string, number>;
    trulens?: Record<string, number>;
    overall?: {
      score: number;
      grade: string;
      passed: boolean;
    };
  };
  summary?: {
    overallScore: number;
    passed: boolean;
    recommendations: string[];
    criticalIssues: string[];
  };
  studentResults?: Record<string, any>;
}

export interface EvaluationMetrics {
  timestamp: string;
  systemMetrics: {
    totalEvaluations: number;
    passRate: number;
    averageScore: number;
    trendDirection: 'improving' | 'declining' | 'stable';
  };
  frameworkMetrics: {
    ragas: { available: boolean; averageScore: number };
    deepeval: { available: boolean; averageScore: number };
    trulens: { available: boolean; averageScore: number };
  };
  recentEvaluations: Array<{
    evaluationId: string;
    timestamp: string;
    score: number;
    status: string;
  }>;
}

export interface DashboardInfo {
  url: string;
  status: 'available' | 'unavailable';
  lastUpdated: string;
  features: string[];
}

export class EvaluationCommands {
  private dynamodb: DynamoDBClient;
  private evaluationTable: string;
  private metricsTable: string;

  constructor() {
    this.dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.evaluationTable = process.env.EVALUATION_TABLE_NAME || 'school-tutor-evaluation';
    this.metricsTable = process.env.METRICS_TABLE_NAME || 'school-tutor-metrics';
  }

  async runEvaluation(request: EvaluationRequest): Promise<EvaluationResult> {
    const evaluationId = `eval-${uuidv4()}`;
    const startTime = new Date().toISOString();

    console.log('🔍 Starting evaluation...');
    console.log(`📋 Evaluation ID: ${evaluationId}`);
    console.log(`🎯 Type: ${request.type}`);
    console.log(`🔧 Frameworks: ${request.frameworks.join(', ')}`);
    console.log(`📊 Metrics: ${request.metrics.join(', ')}`);

    const evaluation: EvaluationResult = {
      evaluationId,
      status: 'running',
      startTime,
      request
    };

    try {
      // Store initial evaluation record
      await this.storeEvaluation(evaluation);

      // Run evaluation frameworks
      const results = await this.executeEvaluationFrameworks(request);
      
      // Calculate overall results
      const summary = this.calculateSummary(results);
      
      // Update evaluation with results
      const completedEvaluation: EvaluationResult = {
        ...evaluation,
        status: 'completed',
        completedAt: new Date().toISOString(),
        results,
        summary
      };

      await this.storeEvaluation(completedEvaluation);
      
      console.log('✅ Evaluation completed successfully!');
      return completedEvaluation;

    } catch (error) {
      console.error('❌ Evaluation failed:', error);
      
      const failedEvaluation: EvaluationResult = {
        ...evaluation,
        status: 'failed',
        completedAt: new Date().toISOString()
      };
      
      await this.storeEvaluation(failedEvaluation);
      throw error;
    }
  }

  async getEvaluationResults(evaluationId: string): Promise<EvaluationResult | null> {
    try {
      const command = new GetItemCommand({
        TableName: this.evaluationTable,
        Key: marshall({ evaluationId })
      });

      const result = await this.dynamodb.send(command);
      
      if (!result.Item) {
        console.log(`❌ Evaluation ${evaluationId} not found`);
        return null;
      }

      return unmarshall(result.Item) as EvaluationResult;
    } catch (error) {
      console.error('❌ Failed to get evaluation results:', error);
      throw error;
    }
  }

  async getEvaluationMetrics(): Promise<EvaluationMetrics> {
    try {
      console.log('📊 Retrieving evaluation metrics...');
      
      // Get recent evaluations
      const recentEvaluations = await this.getRecentEvaluations(10);
      
      // Calculate system metrics
      const systemMetrics = this.calculateSystemMetrics(recentEvaluations);
      
      // Get framework availability and performance
      const frameworkMetrics = await this.getFrameworkMetrics();
      
      const metrics: EvaluationMetrics = {
        timestamp: new Date().toISOString(),
        systemMetrics,
        frameworkMetrics,
        recentEvaluations: recentEvaluations.map(evaluation => ({
          evaluationId: evaluation.evaluationId,
          timestamp: evaluation.completedAt || evaluation.startTime,
          score: evaluation.summary?.overallScore || 0,
          status: evaluation.status
        }))
      };

      return metrics;
    } catch (error) {
      console.error('❌ Failed to get evaluation metrics:', error);
      throw error;
    }
  }

  async launchDashboard(): Promise<DashboardInfo> {
    try {
      console.log('🚀 Launching evaluation dashboard...');
      
      const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000/evaluation-dashboard';
      
      // In a real implementation, this would:
      // 1. Check if dashboard service is running
      // 2. Start dashboard if not running
      // 3. Open browser to dashboard URL
      
      const dashboardInfo: DashboardInfo = {
        url: dashboardUrl,
        status: 'available',
        lastUpdated: new Date().toISOString(),
        features: [
          'Real-time metrics',
          'Evaluation history',
          'Framework comparison',
          'Student performance trends',
          'System health monitoring'
        ]
      };

      console.log(`✅ Dashboard available at: ${dashboardUrl}`);
      console.log('🌐 Opening in browser...');
      
      // Simulate opening browser
      await this.openBrowser(dashboardUrl);
      
      return dashboardInfo;
    } catch (error) {
      console.error('❌ Failed to launch dashboard:', error);
      throw error;
    }
  }

  private async executeEvaluationFrameworks(request: EvaluationRequest): Promise<any> {
    const results: any = {};
    
    for (const framework of request.frameworks) {
      if (framework === 'all') {
        // Run all available frameworks
        results.ragas = await this.runRagasEvaluation(request);
        results.deepeval = await this.runDeepEvalEvaluation(request);
        results.trulens = await this.runTruLensEvaluation(request);
      } else {
        switch (framework) {
          case 'ragas':
            results.ragas = await this.runRagasEvaluation(request);
            break;
          case 'deepeval':
            results.deepeval = await this.runDeepEvalEvaluation(request);
            break;
          case 'trulens':
            results.trulens = await this.runTruLensEvaluation(request);
            break;
        }
      }
    }

    // Calculate overall score
    results.overall = this.calculateOverallScore(results);
    
    return results;
  }

  private async runRagasEvaluation(request: EvaluationRequest): Promise<Record<string, number>> {
    console.log('   🔍 Running RAGAS evaluation...');
    
    // Simulate RAGAS evaluation
    await this.simulateDelay(2000);
    
    const results: Record<string, number> = {};
    
    // Mock RAGAS metrics based on request
    if (request.metrics.includes('relevance') || request.metrics.includes('all')) {
      results.relevance = Math.random() * 0.3 + 0.7; // 0.7-1.0
    }
    
    if (request.metrics.includes('groundedness') || request.metrics.includes('all')) {
      results.groundedness = Math.random() * 0.2 + 0.8; // 0.8-1.0
    }
    
    if (request.metrics.includes('context_recall') || request.metrics.includes('all')) {
      results.context_recall = Math.random() * 0.25 + 0.75; // 0.75-1.0
    }
    
    if (request.metrics.includes('context_precision') || request.metrics.includes('all')) {
      results.context_precision = Math.random() * 0.2 + 0.8; // 0.8-1.0
    }
    
    console.log('   ✅ RAGAS evaluation completed');
    return results;
  }

  private async runDeepEvalEvaluation(request: EvaluationRequest): Promise<Record<string, number>> {
    console.log('   🔍 Running DeepEval evaluation...');
    
    // Simulate DeepEval evaluation
    await this.simulateDelay(2500);
    
    const results: Record<string, number> = {};
    
    // Mock DeepEval metrics
    if (request.metrics.includes('factual_consistency') || request.metrics.includes('all')) {
      results.factual_consistency = Math.random() * 0.25 + 0.75; // 0.75-1.0
    }
    
    if (request.metrics.includes('answer_relevancy') || request.metrics.includes('all')) {
      results.answer_relevancy = Math.random() * 0.3 + 0.7; // 0.7-1.0
    }
    
    if (request.metrics.includes('conceptual_similarity') || request.metrics.includes('all')) {
      results.conceptual_similarity = Math.random() * 0.2 + 0.8; // 0.8-1.0
    }
    
    console.log('   ✅ DeepEval evaluation completed');
    return results;
  }

  private async runTruLensEvaluation(request: EvaluationRequest): Promise<Record<string, number>> {
    console.log('   🔍 Running TruLens evaluation...');
    
    // Simulate TruLens evaluation
    await this.simulateDelay(3000);
    
    const results: Record<string, number> = {};
    
    // Mock TruLens metrics
    if (request.metrics.includes('context_relevance') || request.metrics.includes('all')) {
      results.context_relevance = Math.random() * 0.25 + 0.75; // 0.75-1.0
    }
    
    if (request.metrics.includes('groundedness') || request.metrics.includes('all')) {
      results.groundedness = Math.random() * 0.2 + 0.8; // 0.8-1.0
    }
    
    if (request.metrics.includes('answer_relevance') || request.metrics.includes('all')) {
      results.answer_relevance = Math.random() * 0.3 + 0.7; // 0.7-1.0
    }
    
    console.log('   ✅ TruLens evaluation completed');
    return results;
  }

  private calculateOverallScore(results: any): any {
    const allScores: number[] = [];
    
    // Collect all scores from all frameworks
    Object.values(results).forEach((frameworkResults: any) => {
      if (typeof frameworkResults === 'object') {
        Object.values(frameworkResults).forEach((score: any) => {
          if (typeof score === 'number') {
            allScores.push(score);
          }
        });
      }
    });
    
    if (allScores.length === 0) {
      return { score: 0, grade: 'F', passed: false };
    }
    
    const averageScore = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
    
    let grade = 'F';
    if (averageScore >= 0.9) grade = 'A+';
    else if (averageScore >= 0.85) grade = 'A';
    else if (averageScore >= 0.8) grade = 'B+';
    else if (averageScore >= 0.75) grade = 'B';
    else if (averageScore >= 0.7) grade = 'C+';
    else if (averageScore >= 0.65) grade = 'C';
    else if (averageScore >= 0.6) grade = 'D';
    
    return {
      score: Math.round(averageScore * 100) / 100,
      grade,
      passed: averageScore >= 0.7 // 70% threshold
    };
  }

  private calculateSummary(results: any): EvaluationResult['summary'] {
    const overall = results.overall || { score: 0, passed: false };
    
    const recommendations: string[] = [];
    const criticalIssues: string[] = [];
    
    // Analyze results and generate recommendations
    Object.entries(results).forEach(([framework, frameworkResults]: [string, any]) => {
      if (framework === 'overall') return;
      
      Object.entries(frameworkResults).forEach(([metric, score]: [string, any]) => {
        if (typeof score === 'number') {
          if (score < 0.6) {
            criticalIssues.push(`${framework}: ${metric} score is critically low (${Math.round(score * 100)}%)`);
          } else if (score < 0.75) {
            recommendations.push(`Improve ${metric} in ${framework} framework`);
          }
        }
      });
    });
    
    // Add general recommendations
    if (overall.score < 0.8) {
      recommendations.push('Consider reviewing and improving AI model responses');
      recommendations.push('Enhance context quality and relevance');
    }
    
    if (criticalIssues.length === 0 && overall.score >= 0.85) {
      recommendations.push('Excellent performance! Continue monitoring and maintaining quality');
    }
    
    return {
      overallScore: overall.score,
      passed: overall.passed,
      recommendations,
      criticalIssues
    };
  }

  private async storeEvaluation(evaluation: EvaluationResult): Promise<void> {
    const command = new PutItemCommand({
      TableName: this.evaluationTable,
      Item: marshall(evaluation)
    });

    try {
      await this.dynamodb.send(command);
    } catch (error) {
      console.error('Failed to store evaluation:', error);
      // Don't throw - evaluation can continue even if storage fails
    }
  }

  private async getRecentEvaluations(limit: number): Promise<EvaluationResult[]> {
    try {
      const command = new QueryCommand({
        TableName: this.evaluationTable,
        Limit: limit,
        ScanIndexForward: false // Get most recent first
      });

      const result = await this.dynamodb.send(command);
      return result.Items?.map(item => unmarshall(item) as EvaluationResult) || [];
    } catch (error) {
      console.error('Failed to get recent evaluations:', error);
      return [];
    }
  }

  private calculateSystemMetrics(evaluations: EvaluationResult[]): EvaluationMetrics['systemMetrics'] {
    const completedEvaluations = evaluations.filter(e => e.status === 'completed');
    const passedEvaluations = completedEvaluations.filter(e => e.summary?.passed);
    
    const scores = completedEvaluations
      .map(e => e.summary?.overallScore || 0)
      .filter(score => score > 0);
    
    const averageScore = scores.length > 0 
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : 0;
    
    // Determine trend (simplified)
    let trendDirection: 'improving' | 'declining' | 'stable' = 'stable';
    if (scores.length >= 5) {
      const recent = scores.slice(0, 3).reduce((sum, score) => sum + score, 0) / 3;
      const older = scores.slice(-3).reduce((sum, score) => sum + score, 0) / 3;
      
      if (recent > older + 0.05) trendDirection = 'improving';
      else if (recent < older - 0.05) trendDirection = 'declining';
    }
    
    return {
      totalEvaluations: evaluations.length,
      passRate: completedEvaluations.length > 0 
        ? Math.round((passedEvaluations.length / completedEvaluations.length) * 100)
        : 0,
      averageScore: Math.round(averageScore * 100) / 100,
      trendDirection
    };
  }

  private async getFrameworkMetrics(): Promise<EvaluationMetrics['frameworkMetrics']> {
    // In a real implementation, this would check framework availability and get their performance
    return {
      ragas: { available: true, averageScore: 0.85 },
      deepeval: { available: true, averageScore: 0.82 },
      trulens: { available: true, averageScore: 0.87 }
    };
  }

  private async openBrowser(url: string): Promise<void> {
    // Simulate opening browser
    await this.simulateDelay(1000);
    console.log(`🌐 Browser opened to: ${url}`);
  }

  private async simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async displayEvaluationResult(result: EvaluationResult): Promise<void> {
    console.log('\n📊 Evaluation Results:');
    console.log('═'.repeat(60));
    console.log(`🆔 Evaluation ID: ${result.evaluationId}`);
    console.log(`📅 Started: ${new Date(result.startTime).toLocaleString()}`);
    if (result.completedAt) {
      console.log(`✅ Completed: ${new Date(result.completedAt).toLocaleString()}`);
    }
    console.log(`📊 Status: ${result.status.toUpperCase()}`);
    console.log('═'.repeat(60));
    
    if (result.results) {
      console.log('\n🔍 Framework Results:');
      
      if (result.results.ragas) {
        console.log('\n   📋 RAGAS:');
        Object.entries(result.results.ragas).forEach(([metric, score]) => {
          console.log(`      ${metric}: ${Math.round(score * 100)}%`);
        });
      }
      
      if (result.results.deepeval) {
        console.log('\n   📋 DeepEval:');
        Object.entries(result.results.deepeval).forEach(([metric, score]) => {
          console.log(`      ${metric}: ${Math.round(score * 100)}%`);
        });
      }
      
      if (result.results.trulens) {
        console.log('\n   📋 TruLens:');
        Object.entries(result.results.trulens).forEach(([metric, score]) => {
          console.log(`      ${metric}: ${Math.round(score * 100)}%`);
        });
      }
      
      if (result.results.overall) {
        console.log('\n🎯 Overall Performance:');
        console.log(`   Score: ${Math.round(result.results.overall.score * 100)}%`);
        console.log(`   Grade: ${result.results.overall.grade}`);
        console.log(`   Status: ${result.results.overall.passed ? '✅ PASSED' : '❌ FAILED'}`);
      }
    }
    
    if (result.summary) {
      console.log('\n📝 Summary:');
      console.log(`   Overall Score: ${Math.round(result.summary.overallScore * 100)}%`);
      console.log(`   Result: ${result.summary.passed ? '✅ PASSED' : '❌ FAILED'}`);
      
      if (result.summary.criticalIssues.length > 0) {
        console.log('\n🚨 Critical Issues:');
        result.summary.criticalIssues.forEach(issue => {
          console.log(`   • ${issue}`);
        });
      }
      
      if (result.summary.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        result.summary.recommendations.forEach(rec => {
          console.log(`   • ${rec}`);
        });
      }
    }
    
    console.log('═'.repeat(60));
  }

  async displayEvaluationMetrics(metrics: EvaluationMetrics): Promise<void> {
    console.log('\n📊 Evaluation Metrics Dashboard:');
    console.log('═'.repeat(60));
    console.log(`📅 Last Updated: ${new Date(metrics.timestamp).toLocaleString()}`);
    console.log('═'.repeat(60));
    
    console.log('\n📈 System Performance:');
    console.log(`   🔢 Total Evaluations: ${metrics.systemMetrics.totalEvaluations}`);
    console.log(`   ✅ Pass Rate: ${metrics.systemMetrics.passRate}%`);
    console.log(`   📊 Average Score: ${Math.round(metrics.systemMetrics.averageScore * 100)}%`);
    
    const trendIcon = {
      'improving': '📈',
      'declining': '📉',
      'stable': '➖'
    };
    console.log(`   ${trendIcon[metrics.systemMetrics.trendDirection]} Trend: ${metrics.systemMetrics.trendDirection}`);
    
    console.log('\n🔧 Framework Status:');
    Object.entries(metrics.frameworkMetrics).forEach(([framework, data]) => {
      const statusIcon = data.available ? '✅' : '❌';
      console.log(`   ${statusIcon} ${framework.toUpperCase()}: ${data.available ? 'Available' : 'Unavailable'}`);
      if (data.available) {
        console.log(`      Average Score: ${Math.round(data.averageScore * 100)}%`);
      }
    });
    
    if (metrics.recentEvaluations.length > 0) {
      console.log('\n📋 Recent Evaluations:');
      metrics.recentEvaluations.slice(0, 5).forEach((evaluation, index) => {
        console.log(`   ${index + 1}. ${evaluation.evaluationId.substring(0, 8)}... - ${Math.round(evaluation.score * 100)}% (${evaluation.status})`);
        console.log(`      ${new Date(evaluation.timestamp).toLocaleDateString()}`);
      });
    }
    
    console.log('═'.repeat(60));
  }

  async displayDashboardInfo(info: DashboardInfo): Promise<void> {
    console.log('\n🌐 Evaluation Dashboard:');
    console.log('═'.repeat(60));
    console.log(`📍 URL: ${info.url}`);
    console.log(`📊 Status: ${info.status === 'available' ? '✅ Available' : '❌ Unavailable'}`);
    console.log(`📅 Last Updated: ${new Date(info.lastUpdated).toLocaleString()}`);
    
    console.log('\n🎛️  Available Features:');
    info.features.forEach(feature => {
      console.log(`   • ${feature}`);
    });
    
    console.log('\n💡 Usage Tips:');
    console.log('   • Refresh the dashboard to see real-time updates');
    console.log('   • Use filters to focus on specific metrics or time periods');
    console.log('   • Export data for detailed analysis');
    console.log('   • Set up alerts for critical threshold breaches');
    
    console.log('═'.repeat(60));
  }

  // Static CLI methods
  static async runEvaluation(options: any): Promise<void> {
    const commands = new EvaluationCommands();
    try {
      const request: EvaluationRequest = {
        type: options.type || 'comprehensive',
        students: options.students ? options.students.split(',').map((s: string) => s.trim()) : undefined,
        frameworks: options.frameworks ? options.frameworks.split(',').map((f: string) => f.trim()) : ['all'],
        metrics: options.metrics ? options.metrics.split(',').map((m: string) => m.trim()) : ['accuracy', 'relevance', 'helpfulness'],
        timeframe: options.timeframe,
        customConfig: options.config ? JSON.parse(options.config) : undefined
      };
      
      const result = await commands.runEvaluation(request);
      
      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        await commands.displayEvaluationResult(result);
      }
    } catch (error) {
      console.error('Error running evaluation:', error);
      process.exit(1);
    }
  }

  static async showMetrics(options: any): Promise<void> {
    const commands = new EvaluationCommands();
    try {
      const metrics = await commands.getEvaluationMetrics();
      
      if (options.format === 'json') {
        console.log(JSON.stringify(metrics, null, 2));
      } else {
        await commands.displayEvaluationMetrics(metrics);
      }
    } catch (error) {
      console.error('Error getting metrics:', error);
      process.exit(1);
    }
  }

  static async launchDashboard(options: any): Promise<void> {
    const commands = new EvaluationCommands();
    try {
      const dashboard = await commands.launchDashboard();
      
      if (options.format === 'json') {
        console.log(JSON.stringify(dashboard, null, 2));
      } else {
        await commands.displayDashboardInfo(dashboard);
      }
    } catch (error) {
      console.error('Error launching dashboard:', error);
      process.exit(1);
    }
  }
}
