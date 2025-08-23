import { DynamoDBClient, QueryCommand, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

export interface ProgressData {
  studentId: string;
  period: string;
  overall: {
    completionRate: number;
    engagementScore: number;
    skillsImprovement: number;
    timeSpent: number;
  };
  subjects: Record<string, {
    completionRate: number;
    topicsCompleted: number;
    averageScore: number;
    timeSpent: number;
    strengths: string[];
    improvements: string[];
  }>;
  recentAchievements: Array<{
    achievement: string;
    dateEarned: string;
    subject: string;
  }>;
}

export interface AnalyticsData {
  studentId: string;
  analytics: {
    learningPattern: {
      peakHours: string[];
      preferredDuration: number;
      bestPerformingDay: string;
    };
    skillProgression: {
      strengths: string[];
      improvementAreas: string[];
      recommendations: string[];
    };
    engagement: {
      averageSessionLength: number;
      questionsAsked: number;
      hintsUsed: number;
      interactionRate: number;
    };
  };
  trends: {
    weekly: any[];
    monthly: any[];
  };
}

export interface ScorecardData {
  studentId: string;
  generatedAt: string;
  period: string;
  summary: {
    overallGrade: string;
    totalTimeSpent: number;
    sessionsCompleted: number;
    topicsLearned: number;
  };
  subjectScores: Record<string, {
    grade: string;
    score: number;
    progress: number;
    feedback: string;
  }>;
  achievements: string[];
  recommendations: string[];
  nextGoals: string[];
}

export class ProgressCommands {
  private dynamodb: DynamoDBClient;
  private progressTable: string;
  private studentsTable: string;

  constructor() {
    this.dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.progressTable = process.env.PROGRESS_TABLE_NAME || 'school-tutor-progress';
    this.studentsTable = process.env.STUDENTS_TABLE_NAME || 'school-tutor-students';
  }

  async viewProgress(studentId: string, period: string = '30d', subjects?: string[]): Promise<ProgressData> {
    try {
      // Get student info first
      const student = await this.getStudent(studentId);
      if (!student) {
        throw new Error(`Student ${studentId} not found`);
      }

      // Calculate date range based on period
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }

      // Get progress data from DynamoDB
      const progressData = await this.getProgressData(studentId, startDate, endDate);
      
      // Calculate overall metrics
      const overall = this.calculateOverallMetrics(progressData);
      
      // Calculate subject-specific metrics
      const subjectMetrics = this.calculateSubjectMetrics(progressData, subjects);
      
      // Get recent achievements
      const achievements = await this.getRecentAchievements(studentId, startDate);

      const result: ProgressData = {
        studentId,
        period,
        overall,
        subjects: subjectMetrics,
        recentAchievements: achievements
      };

      return result;
    } catch (error) {
      console.error('❌ Failed to get progress data:', error);
      throw error;
    }
  }

  async getAnalytics(studentId: string, period: string = '30d'): Promise<AnalyticsData> {
    try {
      // Get comprehensive analytics data
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - parseInt(period.replace('d', '')));

      const progressData = await this.getProgressData(studentId, startDate, endDate);
      
      const analytics: AnalyticsData = {
        studentId,
        analytics: {
          learningPattern: this.analyzeLearningPattern(progressData),
          skillProgression: this.analyzeSkillProgression(progressData),
          engagement: this.analyzeEngagement(progressData)
        },
        trends: {
          weekly: this.calculateWeeklyTrends(progressData),
          monthly: this.calculateMonthlyTrends(progressData)
        }
      };

      return analytics;
    } catch (error) {
      console.error('❌ Failed to get analytics:', error);
      throw error;
    }
  }

  async generateScorecard(studentId: string, period: string = '30d'): Promise<ScorecardData> {
    try {
      const student = await this.getStudent(studentId);
      if (!student) {
        throw new Error(`Student ${studentId} not found`);
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - parseInt(period.replace('d', '')));

      const progressData = await this.getProgressData(studentId, startDate, endDate);
      const analytics = await this.getAnalytics(studentId, period);

      const scorecard: ScorecardData = {
        studentId,
        generatedAt: new Date().toISOString(),
        period,
        summary: this.generateSummary(progressData),
        subjectScores: this.generateSubjectScores(progressData, student.subjects || []),
        achievements: this.generateAchievements(progressData, analytics),
        recommendations: this.generateRecommendations(analytics),
        nextGoals: this.generateNextGoals(analytics, student)
      };

      // Store scorecard for future reference
      await this.storeScorecard(scorecard);

      return scorecard;
    } catch (error) {
      console.error('❌ Failed to generate scorecard:', error);
      throw error;
    }
  }

  private async getStudent(studentId: string): Promise<any> {
    const command = new GetItemCommand({
      TableName: this.studentsTable,
      Key: marshall({ studentId })
    });

    try {
      const result = await this.dynamodb.send(command);
      return result.Item ? unmarshall(result.Item) : null;
    } catch (error) {
      console.error('Failed to get student:', error);
      return null;
    }
  }

  private async getProgressData(studentId: string, startDate: Date, endDate: Date): Promise<any[]> {
    const command = new QueryCommand({
      TableName: this.progressTable,
      KeyConditionExpression: 'studentId = :studentId AND #timestamp BETWEEN :start AND :end',
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp'
      },
      ExpressionAttributeValues: marshall({
        ':studentId': studentId,
        ':start': startDate.toISOString(),
        ':end': endDate.toISOString()
      })
    });

    try {
      const result = await this.dynamodb.send(command);
      return result.Items?.map(item => unmarshall(item)) || [];
    } catch (error) {
      console.error('Failed to get progress data:', error);
      return [];
    }
  }

  private calculateOverallMetrics(progressData: any[]): ProgressData['overall'] {
    if (progressData.length === 0) {
      return {
        completionRate: 0,
        engagementScore: 0,
        skillsImprovement: 0,
        timeSpent: 0
      };
    }

    const totalSessions = progressData.length;
    const completedSessions = progressData.filter(p => p.status === 'completed').length;
    const totalEngagement = progressData.reduce((sum, p) => sum + (p.engagementScore || 0), 0);
    const totalTime = progressData.reduce((sum, p) => sum + (p.timeSpent || 0), 0);

    // Calculate skills improvement based on score trends
    const scores = progressData.map(p => p.score || 0).filter(s => s > 0);
    const skillsImprovement = scores.length > 1 
      ? ((scores[scores.length - 1] - scores[0]) / scores[0]) * 100
      : 0;

    return {
      completionRate: Math.round((completedSessions / totalSessions) * 100),
      engagementScore: Math.round(totalEngagement / totalSessions * 10) / 10,
      skillsImprovement: Math.round(skillsImprovement),
      timeSpent: Math.round(totalTime)
    };
  }

  private calculateSubjectMetrics(progressData: any[], subjects?: string[]): Record<string, any> {
    const subjectMap: Record<string, any> = {};
    
    // Group data by subject
    const subjectData = progressData.reduce((acc, item) => {
      const subject = item.subject || 'Unknown';
      if (!acc[subject]) acc[subject] = [];
      acc[subject].push(item);
      return acc;
    }, {} as Record<string, any[]>);

    // Calculate metrics for each subject
    Object.entries(subjectData).forEach(([subject, data]) => {
      if (subjects && !subjects.includes(subject)) return;

      const completedTopics = new Set(data.map(d => d.topic).filter(Boolean)).size;
      const totalScore = data.reduce((sum, d) => sum + (d.score || 0), 0);
      const totalTime = data.reduce((sum, d) => sum + (d.timeSpent || 0), 0);
      const validScores = data.filter(d => d.score > 0);

      subjectMap[subject] = {
        completionRate: Math.round((data.filter(d => d.status === 'completed').length / data.length) * 100),
        topicsCompleted: completedTopics,
        averageScore: validScores.length > 0 ? Math.round(totalScore / validScores.length) : 0,
        timeSpent: Math.round(totalTime),
        strengths: this.identifyStrengths(data),
        improvements: this.identifyImprovements(data)
      };
    });

    return subjectMap;
  }

  private async getRecentAchievements(studentId: string, startDate: Date): Promise<any[]> {
    // Mock achievements for now - in real implementation, query achievements table
    return [
      {
        achievement: 'Mathematics Master',
        dateEarned: new Date().toISOString(),
        subject: 'Mathematics'
      },
      {
        achievement: 'Problem Solver',
        dateEarned: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        subject: 'Science'
      }
    ];
  }

  private analyzeLearningPattern(progressData: any[]): AnalyticsData['analytics']['learningPattern'] {
    // Analyze when student is most active and performs best
    const hourMap: Record<number, number> = {};
    const dayMap: Record<string, number> = {};

    progressData.forEach(item => {
      if (item.timestamp) {
        const date = new Date(item.timestamp);
        const hour = date.getHours();
        const day = date.toLocaleDateString('en-US', { weekday: 'long' });
        
        hourMap[hour] = (hourMap[hour] || 0) + 1;
        dayMap[day] = (dayMap[day] || 0) + (item.score || 0);
      }
    });

    const peakHours = Object.entries(hourMap)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 2)
      .map(([hour]) => `${hour}:00`);

    const bestDay = Object.entries(dayMap)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Monday';

    const sessions = progressData.filter(p => p.timeSpent > 0);
    const avgDuration = sessions.length > 0 
      ? Math.round(sessions.reduce((sum, s) => sum + s.timeSpent, 0) / sessions.length)
      : 45;

    return {
      peakHours,
      preferredDuration: avgDuration,
      bestPerformingDay: bestDay
    };
  }

  private analyzeSkillProgression(progressData: any[]): AnalyticsData['analytics']['skillProgression'] {
    const topicScores: Record<string, number[]> = {};
    
    progressData.forEach(item => {
      if (item.topic && item.score) {
        if (!topicScores[item.topic]) topicScores[item.topic] = [];
        topicScores[item.topic].push(item.score);
      }
    });

    const topicAverages = Object.entries(topicScores).map(([topic, scores]) => ({
      topic,
      average: scores.reduce((sum, score) => sum + score, 0) / scores.length
    }));

    const strengths = topicAverages
      .filter(t => t.average >= 80)
      .sort((a, b) => b.average - a.average)
      .slice(0, 3)
      .map(t => t.topic);

    const improvementAreas = topicAverages
      .filter(t => t.average < 70)
      .sort((a, b) => a.average - b.average)
      .slice(0, 3)
      .map(t => t.topic);

    const recommendations = improvementAreas.map(area => 
      `Focus more practice on ${area} with additional exercises and examples`
    );

    return {
      strengths,
      improvementAreas,
      recommendations
    };
  }

  private analyzeEngagement(progressData: any[]): AnalyticsData['analytics']['engagement'] {
    const sessions = progressData.filter(p => p.timeSpent > 0);
    const interactions = progressData.filter(p => p.interactionType);

    const avgSessionLength = sessions.length > 0 
      ? Math.round(sessions.reduce((sum, s) => sum + s.timeSpent, 0) / sessions.length)
      : 0;

    const questionsAsked = interactions.filter(i => i.interactionType === 'question').length;
    const hintsUsed = interactions.filter(i => i.interactionType === 'hint').length;
    
    const engagementScores = progressData
      .map(p => p.engagementScore)
      .filter(score => score !== undefined);
    
    const interactionRate = engagementScores.length > 0
      ? Math.round(engagementScores.reduce((sum, score) => sum + score, 0) / engagementScores.length * 10) / 10
      : 0;

    return {
      averageSessionLength: avgSessionLength,
      questionsAsked,
      hintsUsed,
      interactionRate
    };
  }

  private calculateWeeklyTrends(progressData: any[]): any[] {
    // Calculate weekly performance trends
    const weeklyData: Record<string, any> = {};
    
    progressData.forEach(item => {
      if (item.timestamp) {
        const week = this.getWeekKey(new Date(item.timestamp));
        if (!weeklyData[week]) {
          weeklyData[week] = { sessions: 0, totalScore: 0, totalTime: 0 };
        }
        weeklyData[week].sessions++;
        weeklyData[week].totalScore += item.score || 0;
        weeklyData[week].totalTime += item.timeSpent || 0;
      }
    });

    return Object.entries(weeklyData).map(([week, data]) => ({
      week,
      averageScore: data.totalScore / data.sessions,
      totalTime: data.totalTime,
      sessions: data.sessions
    }));
  }

  private calculateMonthlyTrends(progressData: any[]): any[] {
    // Similar to weekly trends but grouped by month
    const monthlyData: Record<string, any> = {};
    
    progressData.forEach(item => {
      if (item.timestamp) {
        const month = new Date(item.timestamp).toISOString().substring(0, 7); // YYYY-MM
        if (!monthlyData[month]) {
          monthlyData[month] = { sessions: 0, totalScore: 0, totalTime: 0 };
        }
        monthlyData[month].sessions++;
        monthlyData[month].totalScore += item.score || 0;
        monthlyData[month].totalTime += item.timeSpent || 0;
      }
    });

    return Object.entries(monthlyData).map(([month, data]) => ({
      month,
      averageScore: data.totalScore / data.sessions,
      totalTime: data.totalTime,
      sessions: data.sessions
    }));
  }

  private generateSummary(progressData: any[]): ScorecardData['summary'] {
    const sessions = progressData.filter(p => p.timeSpent > 0);
    const completedSessions = sessions.filter(s => s.status === 'completed');
    const topics = new Set(progressData.map(p => p.topic).filter(Boolean));
    const totalTime = sessions.reduce((sum, s) => sum + s.timeSpent, 0);
    const avgScore = sessions.length > 0 
      ? sessions.reduce((sum, s) => sum + (s.score || 0), 0) / sessions.length
      : 0;

    let overallGrade = 'F';
    if (avgScore >= 90) overallGrade = 'A+';
    else if (avgScore >= 85) overallGrade = 'A';
    else if (avgScore >= 80) overallGrade = 'B+';
    else if (avgScore >= 75) overallGrade = 'B';
    else if (avgScore >= 70) overallGrade = 'C+';
    else if (avgScore >= 65) overallGrade = 'C';
    else if (avgScore >= 60) overallGrade = 'D';

    return {
      overallGrade,
      totalTimeSpent: Math.round(totalTime),
      sessionsCompleted: completedSessions.length,
      topicsLearned: topics.size
    };
  }

  private generateSubjectScores(progressData: any[], subjects: string[]): Record<string, any> {
    const subjectScores: Record<string, any> = {};
    
    subjects.forEach(subject => {
      const subjectData = progressData.filter(p => p.subject === subject);
      const avgScore = subjectData.length > 0
        ? subjectData.reduce((sum, d) => sum + (d.score || 0), 0) / subjectData.length
        : 0;
      
      let grade = 'F';
      if (avgScore >= 90) grade = 'A+';
      else if (avgScore >= 85) grade = 'A';
      else if (avgScore >= 80) grade = 'B+';
      else if (avgScore >= 75) grade = 'B';
      else if (avgScore >= 70) grade = 'C+';
      else if (avgScore >= 65) grade = 'C';
      else if (avgScore >= 60) grade = 'D';

      const completedTopics = new Set(subjectData.map(d => d.topic).filter(Boolean)).size;
      const totalTopics = 20; // Estimated total topics per subject
      const progress = Math.round((completedTopics / totalTopics) * 100);

      subjectScores[subject] = {
        grade,
        score: Math.round(avgScore),
        progress,
        feedback: this.generateSubjectFeedback(subject, avgScore, progress)
      };
    });

    return subjectScores;
  }

  private generateAchievements(progressData: any[], analytics: AnalyticsData): string[] {
    const achievements: string[] = [];
    
    // Check for various achievements based on data
    if (analytics.analytics.engagement.averageSessionLength >= 45) {
      achievements.push('Focused Learner - Maintains long study sessions');
    }
    
    if (analytics.analytics.engagement.questionsAsked >= 10) {
      achievements.push('Curious Mind - Asks many questions');
    }
    
    if (analytics.analytics.engagement.interactionRate >= 8) {
      achievements.push('Highly Engaged - Shows excellent participation');
    }

    const totalSessions = progressData.filter(p => p.timeSpent > 0).length;
    if (totalSessions >= 10) {
      achievements.push('Consistent Student - Regular learning schedule');
    }

    return achievements;
  }

  private generateRecommendations(analytics: AnalyticsData): string[] {
    const recommendations: string[] = [];
    
    // Add recommendations based on analytics
    if (analytics.analytics.skillProgression.improvementAreas.length > 0) {
      recommendations.push(
        `Focus on improving: ${analytics.analytics.skillProgression.improvementAreas.join(', ')}`
      );
    }
    
    if (analytics.analytics.engagement.averageSessionLength < 30) {
      recommendations.push('Try to extend study sessions for better retention');
    }
    
    if (analytics.analytics.engagement.questionsAsked < 5) {
      recommendations.push('Ask more questions to deepen understanding');
    }

    recommendations.push('Continue practicing strengths while working on improvement areas');
    
    return recommendations;
  }

  private generateNextGoals(analytics: AnalyticsData, student: any): string[] {
    const goals: string[] = [];
    
    // Generate goals based on current performance and grade level
    const improvementAreas = analytics.analytics.skillProgression.improvementAreas;
    const strengths = analytics.analytics.skillProgression.strengths;
    
    if (improvementAreas.length > 0) {
      goals.push(`Master ${improvementAreas[0]} within the next 2 weeks`);
    }
    
    if (strengths.length > 0) {
      goals.push(`Apply ${strengths[0]} skills to solve complex problems`);
    }
    
    goals.push('Complete all daily learning sessions this week');
    goals.push('Achieve 85% average score across all subjects');
    
    return goals;
  }

  private identifyStrengths(data: any[]): string[] {
    const topicScores: Record<string, number[]> = {};
    
    data.forEach(item => {
      if (item.topic && item.score >= 80) {
        if (!topicScores[item.topic]) topicScores[item.topic] = [];
        topicScores[item.topic].push(item.score);
      }
    });

    return Object.entries(topicScores)
      .filter(([, scores]) => scores.length >= 2)
      .map(([topic]) => topic)
      .slice(0, 3);
  }

  private identifyImprovements(data: any[]): string[] {
    const topicScores: Record<string, number[]> = {};
    
    data.forEach(item => {
      if (item.topic && item.score < 70) {
        if (!topicScores[item.topic]) topicScores[item.topic] = [];
        topicScores[item.topic].push(item.score);
      }
    });

    return Object.entries(topicScores)
      .filter(([, scores]) => scores.length >= 2)
      .map(([topic]) => topic)
      .slice(0, 3);
  }

  private generateSubjectFeedback(subject: string, score: number, progress: number): string {
    if (score >= 85 && progress >= 80) {
      return `Excellent performance in ${subject}! Keep up the great work.`;
    } else if (score >= 75 && progress >= 60) {
      return `Good progress in ${subject}. Focus on consistent practice.`;
    } else if (score >= 65) {
      return `${subject} needs more attention. Consider additional practice sessions.`;
    } else {
      return `${subject} requires significant improvement. Recommend extra help and practice.`;
    }
  }

  private async storeScorecard(scorecard: ScorecardData): Promise<void> {
    const command = new PutItemCommand({
      TableName: this.progressTable,
      Item: marshall({
        studentId: scorecard.studentId,
        timestamp: scorecard.generatedAt,
        type: 'scorecard',
        data: scorecard
      })
    });

    try {
      await this.dynamodb.send(command);
    } catch (error) {
      console.error('Failed to store scorecard:', error);
      // Don't throw - scorecard generation succeeded even if storage failed
    }
  }

  private getWeekKey(date: Date): string {
    const year = date.getFullYear();
    const week = Math.ceil(((date.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + new Date(year, 0, 1).getDay() + 1) / 7);
    return `${year}-W${week}`;
  }

  async displayProgress(progress: ProgressData): Promise<void> {
    console.log('\n📊 Progress Report:');
    console.log('─'.repeat(60));
    console.log(`👤 Student: ${progress.studentId}`);
    console.log(`📅 Period: ${progress.period}`);
    console.log('─'.repeat(60));
    
    console.log('\n📈 Overall Performance:');
    console.log(`   ✅ Completion Rate: ${progress.overall.completionRate}%`);
    console.log(`   🎯 Engagement Score: ${progress.overall.engagementScore}/10`);
    console.log(`   📚 Skills Improvement: ${progress.overall.skillsImprovement}%`);
    console.log(`   ⏰ Time Spent: ${progress.overall.timeSpent} minutes`);
    
    console.log('\n📚 Subject Performance:');
    Object.entries(progress.subjects).forEach(([subject, data]) => {
      console.log(`\n   📖 ${subject}:`);
      console.log(`      Completion: ${data.completionRate}%`);
      console.log(`      Topics Completed: ${data.topicsCompleted}`);
      console.log(`      Average Score: ${data.averageScore}%`);
      console.log(`      Time Spent: ${data.timeSpent} minutes`);
      if (data.strengths.length > 0) {
        console.log(`      💪 Strengths: ${data.strengths.join(', ')}`);
      }
      if (data.improvements.length > 0) {
        console.log(`      🎯 Areas to Improve: ${data.improvements.join(', ')}`);
      }
    });
    
    if (progress.recentAchievements.length > 0) {
      console.log('\n🏆 Recent Achievements:');
      progress.recentAchievements.forEach(achievement => {
        console.log(`   🥇 ${achievement.achievement} (${achievement.subject})`);
        console.log(`      Earned: ${new Date(achievement.dateEarned).toLocaleDateString()}`);
      });
    }
    
    console.log('─'.repeat(60));
  }

  async displayAnalytics(analytics: AnalyticsData): Promise<void> {
    console.log('\n🔍 Learning Analytics:');
    console.log('─'.repeat(60));
    console.log(`👤 Student: ${analytics.studentId}`);
    console.log('─'.repeat(60));
    
    console.log('\n⏰ Learning Patterns:');
    console.log(`   🕐 Peak Hours: ${analytics.analytics.learningPattern.peakHours.join(', ')}`);
    console.log(`   ⏱️  Preferred Duration: ${analytics.analytics.learningPattern.preferredDuration} minutes`);
    console.log(`   📅 Best Day: ${analytics.analytics.learningPattern.bestPerformingDay}`);
    
    console.log('\n📈 Skill Progression:');
    if (analytics.analytics.skillProgression.strengths.length > 0) {
      console.log(`   💪 Strengths: ${analytics.analytics.skillProgression.strengths.join(', ')}`);
    }
    if (analytics.analytics.skillProgression.improvementAreas.length > 0) {
      console.log(`   🎯 Improvement Areas: ${analytics.analytics.skillProgression.improvementAreas.join(', ')}`);
    }
    if (analytics.analytics.skillProgression.recommendations.length > 0) {
      console.log('\n   💡 Recommendations:');
      analytics.analytics.skillProgression.recommendations.forEach(rec => {
        console.log(`      • ${rec}`);
      });
    }
    
    console.log('\n🎯 Engagement Metrics:');
    console.log(`   ⏰ Average Session: ${analytics.analytics.engagement.averageSessionLength} minutes`);
    console.log(`   ❓ Questions Asked: ${analytics.analytics.engagement.questionsAsked}`);
    console.log(`   💡 Hints Used: ${analytics.analytics.engagement.hintsUsed}`);
    console.log(`   📊 Interaction Rate: ${analytics.analytics.engagement.interactionRate}/10`);
    
    console.log('─'.repeat(60));
  }

  async displayScorecard(scorecard: ScorecardData): Promise<void> {
    console.log('\n🎓 Student Scorecard:');
    console.log('═'.repeat(60));
    console.log(`👤 Student: ${scorecard.studentId}`);
    console.log(`📅 Generated: ${new Date(scorecard.generatedAt).toLocaleString()}`);
    console.log(`📊 Period: ${scorecard.period}`);
    console.log('═'.repeat(60));
    
    console.log('\n📋 Summary:');
    console.log(`   🎯 Overall Grade: ${scorecard.summary.overallGrade}`);
    console.log(`   ⏰ Total Time: ${scorecard.summary.totalTimeSpent} minutes`);
    console.log(`   📚 Sessions Completed: ${scorecard.summary.sessionsCompleted}`);
    console.log(`   📖 Topics Learned: ${scorecard.summary.topicsLearned}`);
    
    console.log('\n📚 Subject Scores:');
    Object.entries(scorecard.subjectScores).forEach(([subject, data]) => {
      console.log(`\n   📖 ${subject}:`);
      console.log(`      Grade: ${data.grade}`);
      console.log(`      Score: ${data.score}%`);
      console.log(`      Progress: ${data.progress}%`);
      console.log(`      Feedback: ${data.feedback}`);
    });
    
    if (scorecard.achievements.length > 0) {
      console.log('\n🏆 Achievements:');
      scorecard.achievements.forEach(achievement => {
        console.log(`   🥇 ${achievement}`);
      });
    }
    
    if (scorecard.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      scorecard.recommendations.forEach(rec => {
        console.log(`   • ${rec}`);
      });
    }
    
    if (scorecard.nextGoals.length > 0) {
      console.log('\n🎯 Next Goals:');
      scorecard.nextGoals.forEach(goal => {
        console.log(`   • ${goal}`);
      });
    }
    
    console.log('═'.repeat(60));
  }
}
