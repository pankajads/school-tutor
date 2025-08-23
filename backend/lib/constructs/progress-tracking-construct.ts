import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface ProgressTrackingConstructProps {
  readonly studentTable: dynamodb.Table;
  readonly progressTable: dynamodb.Table;
}

export class ProgressTrackingConstruct extends Construct {
  public readonly handler: lambda.Function;
  public readonly integration: apigateway.LambdaIntegration;

  constructor(scope: Construct, id: string, props: ProgressTrackingConstructProps) {
    super(scope, id);

    // Lambda function for progress tracking
    this.handler = new lambda.Function(this, 'ProgressTrackingHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
        const crypto = require('crypto');

        const ddbClient = new DynamoDBClient({});
        const docClient = DynamoDBDocumentClient.from(ddbClient);

        const STUDENT_TABLE = process.env.STUDENT_TABLE;
        const PROGRESS_TABLE = process.env.PROGRESS_TABLE;

        exports.handler = async (event) => {
          console.log('Event:', JSON.stringify(event, null, 2));
          
          try {
            const { httpMethod, pathParameters, body, queryStringParameters } = event;
            const requestBody = body ? JSON.parse(body) : {};

            switch (httpMethod) {
              case 'GET':
                if (event.resource === '/progress/analytics') {
                  return await getAnalytics(queryStringParameters);
                } else {
                  return await getProgress(queryStringParameters);
                }
              case 'POST':
                return await updateProgress(requestBody);
              default:
                return createResponse(405, { error: 'Method not allowed' });
            }
          } catch (error) {
            console.error('Error:', error);
            return createResponse(500, { error: 'Internal server error', details: error.message });
          }
        };

        async function getProgress(queryParams) {
          const { studentId, subject, startDate, endDate, limit } = queryParams || {};

          if (!studentId) {
            return createResponse(400, { error: 'studentId is required' });
          }

          // Get student info
          const student = await getStudent(studentId);
          if (!student) {
            return createResponse(404, { error: 'Student not found' });
          }

          // Build query parameters
          const queryParams_ddb = {
            TableName: PROGRESS_TABLE,
            KeyConditionExpression: 'studentId = :studentId',
            ExpressionAttributeValues: {
              ':studentId': studentId
            },
            ScanIndexForward: false,
            Limit: parseInt(limit) || 50
          };

          // Add date range filter if provided
          if (startDate && endDate) {
            queryParams_ddb.FilterExpression = '#timestamp BETWEEN :startDate AND :endDate';
            queryParams_ddb.ExpressionAttributeNames = { '#timestamp': 'timestamp' };
            queryParams_ddb.ExpressionAttributeValues[':startDate'] = startDate;
            queryParams_ddb.ExpressionAttributeValues[':endDate'] = endDate;
          }

          // Add subject filter if provided
          if (subject) {
            queryParams_ddb.FilterExpression = queryParams_ddb.FilterExpression ? 
              queryParams_ddb.FilterExpression + ' AND subject = :subject' :
              'subject = :subject';
            queryParams_ddb.ExpressionAttributeValues[':subject'] = subject;
          }

          const result = await docClient.send(new QueryCommand(queryParams_ddb));
          const progressData = result.Items || [];

          // Calculate progress metrics
          const metrics = calculateProgressMetrics(progressData, student);

          return createResponse(200, {
            student: {
              id: student.studentId,
              name: student.studentName,
              grade: student.grade
            },
            progress: progressData,
            metrics: metrics,
            count: progressData.length
          });
        }

        async function getAnalytics(queryParams) {
          const { studentId, period, subjects } = queryParams || {};

          if (!studentId) {
            return createResponse(400, { error: 'studentId is required' });
          }

          // Get student info
          const student = await getStudent(studentId);
          if (!student) {
            return createResponse(404, { error: 'Student not found' });
          }

          // Calculate date range based on period
          const dateRange = calculateDateRange(period || '30d');
          
          // Get progress data for the period
          const progressData = await getProgressForPeriod(studentId, dateRange.start, dateRange.end);

          // Generate comprehensive analytics
          const analytics = await generateAnalytics(student, progressData, subjects);

          return createResponse(200, {
            student: {
              id: student.studentId,
              name: student.studentName,
              grade: student.grade
            },
            period: period || '30d',
            analytics: analytics,
            generatedAt: new Date().toISOString()
          });
        }

        async function updateProgress(requestBody) {
          const { 
            studentId, 
            sessionId, 
            subject, 
            activity, 
            performance, 
            engagement, 
            timeSpent, 
            completed, 
            notes 
          } = requestBody;

          if (!studentId || !subject) {
            return createResponse(400, { error: 'studentId and subject are required' });
          }

          const timestamp = new Date().toISOString();
          
          // Create progress entry
          const progressEntry = {
            studentId: studentId,
            timestamp: timestamp,
            sessionId: sessionId || crypto.randomUUID(),
            subject: subject,
            type: 'progress_update',
            activity: activity,
            performance: performance,
            engagement: engagement,
            timeSpent: timeSpent,
            completed: completed,
            notes: notes,
            subjectDate: \`\${subject}#\${timestamp.split('T')[0]}\`,
            ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
          };

          await docClient.send(new PutCommand({
            TableName: PROGRESS_TABLE,
            Item: progressEntry
          }));

          // Update student's knowledge level based on performance
          if (performance) {
            await updateStudentKnowledge(studentId, subject, performance);
          }

          // Calculate engagement score
          const engagementScore = calculateEngagementScore(engagement, timeSpent, completed);

          return createResponse(200, {
            message: 'Progress updated successfully',
            progressEntry: progressEntry,
            engagementScore: engagementScore
          });
        }

        async function getStudent(studentId) {
          const result = await docClient.send(new GetCommand({
            TableName: STUDENT_TABLE,
            Key: { studentId, profileVersion: 'v1' }
          }));
          return result.Item;
        }

        async function getProgressForPeriod(studentId, startDate, endDate) {
          const result = await docClient.send(new QueryCommand({
            TableName: PROGRESS_TABLE,
            KeyConditionExpression: 'studentId = :studentId AND #timestamp BETWEEN :startDate AND :endDate',
            ExpressionAttributeNames: {
              '#timestamp': 'timestamp'
            },
            ExpressionAttributeValues: {
              ':studentId': studentId,
              ':startDate': startDate,
              ':endDate': endDate
            },
            ScanIndexForward: false
          }));
          return result.Items || [];
        }

        async function updateStudentKnowledge(studentId, subject, performance) {
          const student = await getStudent(studentId);
          if (!student) return;

          const currentKnowledge = student.knowledgeLevel || {};
          const subjectKnowledge = currentKnowledge[subject] || { level: 50, lastUpdated: new Date().toISOString() };

          // Adjust knowledge level based on performance
          let adjustment = 0;
          if (performance.score >= 90) adjustment = 5;
          else if (performance.score >= 80) adjustment = 3;
          else if (performance.score >= 70) adjustment = 1;
          else if (performance.score >= 60) adjustment = 0;
          else adjustment = -2;

          subjectKnowledge.level = Math.max(0, Math.min(100, subjectKnowledge.level + adjustment));
          subjectKnowledge.lastUpdated = new Date().toISOString();
          currentKnowledge[subject] = subjectKnowledge;

          await docClient.send(new UpdateCommand({
            TableName: STUDENT_TABLE,
            Key: { studentId, profileVersion: 'v1' },
            UpdateExpression: 'SET knowledgeLevel = :knowledge, updatedAt = :timestamp',
            ExpressionAttributeValues: {
              ':knowledge': currentKnowledge,
              ':timestamp': new Date().toISOString()
            }
          }));
        }

        function calculateProgressMetrics(progressData, student) {
          const totalSessions = progressData.filter(p => p.type === 'learning_session' || p.type === 'session_start').length;
          const completedActivities = progressData.filter(p => p.completed === true).length;
          const totalActivities = progressData.filter(p => p.activity).length;
          
          const subjects = [...new Set(progressData.map(p => p.subject).filter(Boolean))];
          const avgTimeSpent = progressData
            .filter(p => p.timeSpent)
            .reduce((sum, p) => sum + (p.timeSpent || 0), 0) / Math.max(1, progressData.length);

          const performanceScores = progressData
            .filter(p => p.performance && p.performance.score)
            .map(p => p.performance.score);
          
          const avgPerformance = performanceScores.length > 0 ? 
            performanceScores.reduce((sum, score) => sum + score, 0) / performanceScores.length : 0;

          const engagementScores = progressData
            .filter(p => p.engagement && p.engagement.score)
            .map(p => p.engagement.score);
          
          const avgEngagement = engagementScores.length > 0 ?
            engagementScores.reduce((sum, score) => sum + score, 0) / engagementScores.length : 0;

          return {
            totalSessions: totalSessions,
            completionRate: totalActivities > 0 ? (completedActivities / totalActivities) * 100 : 0,
            subjectsStudied: subjects.length,
            subjects: subjects,
            averageTimeSpent: Math.round(avgTimeSpent),
            averagePerformance: Math.round(avgPerformance * 10) / 10,
            averageEngagement: Math.round(avgEngagement * 10) / 10,
            knowledgeLevel: student.knowledgeLevel || {},
            lastActivity: progressData.length > 0 ? progressData[0].timestamp : null
          };
        }

        async function generateAnalytics(student, progressData, subjects) {
          const analytics = {
            overview: generateOverviewAnalytics(progressData),
            performance: generatePerformanceAnalytics(progressData),
            engagement: generateEngagementAnalytics(progressData),
            subjects: generateSubjectAnalytics(progressData, subjects),
            learning: generateLearningAnalytics(student, progressData),
            recommendations: await generateRecommendations(student, progressData),
            scorecard: generateScorecard(student, progressData)
          };

          return analytics;
        }

        function generateOverviewAnalytics(progressData) {
          const today = new Date().toISOString().split('T')[0];
          const thisWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          
          const todayData = progressData.filter(p => p.timestamp.startsWith(today));
          const weekData = progressData.filter(p => p.timestamp >= thisWeek);

          return {
            totalSessions: progressData.filter(p => p.type === 'learning_session').length,
            sessionsToday: todayData.filter(p => p.type === 'learning_session').length,
            sessionsThisWeek: weekData.filter(p => p.type === 'learning_session').length,
            totalTimeSpent: progressData.reduce((sum, p) => sum + (p.timeSpent || 0), 0),
            averageSessionLength: calculateAverageSessionLength(progressData),
            streakDays: calculateLearningStreak(progressData),
            subjectsActive: [...new Set(progressData.map(p => p.subject).filter(Boolean))].length
          };
        }

        function generatePerformanceAnalytics(progressData) {
          const performanceData = progressData.filter(p => p.performance && p.performance.score);
          
          if (performanceData.length === 0) {
            return { message: 'No performance data available' };
          }

          const scores = performanceData.map(p => p.performance.score);
          const recentScores = performanceData.slice(0, 10).map(p => p.performance.score);
          
          return {
            averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
            recentAverageScore: recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length,
            highestScore: Math.max(...scores),
            lowestScore: Math.min(...scores),
            improvementTrend: calculateImprovementTrend(scores),
            consistencyScore: calculateConsistencyScore(scores),
            assessmentsCompleted: performanceData.length,
            strongSubjects: identifyStrongSubjects(performanceData),
            improvementAreas: identifyImprovementAreas(performanceData)
          };
        }

        function generateEngagementAnalytics(progressData) {
          const engagementData = progressData.filter(p => p.engagement);
          
          if (engagementData.length === 0) {
            return { message: 'No engagement data available' };
          }

          const participationScores = engagementData.map(p => p.engagement.participation || 0);
          const interactionScores = engagementData.map(p => p.engagement.interaction || 0);
          const completionRates = progressData.filter(p => p.completed !== undefined);

          return {
            averageParticipation: participationScores.reduce((sum, score) => sum + score, 0) / participationScores.length,
            averageInteraction: interactionScores.reduce((sum, score) => sum + score, 0) / interactionScores.length,
            completionRate: (completionRates.filter(p => p.completed).length / Math.max(1, completionRates.length)) * 100,
            engagementTrend: calculateEngagementTrend(engagementData),
            mostEngagingSubjects: identifyMostEngagingSubjects(engagementData),
            peakEngagementTimes: identifyPeakEngagementTimes(engagementData)
          };
        }

        function generateSubjectAnalytics(progressData, subjects) {
          const subjectData = {};
          const allSubjects = subjects ? subjects.split(',') : [...new Set(progressData.map(p => p.subject).filter(Boolean))];

          allSubjects.forEach(subject => {
            const subjectProgress = progressData.filter(p => p.subject === subject);
            const subjectPerformance = subjectProgress.filter(p => p.performance && p.performance.score);
            const subjectEngagement = subjectProgress.filter(p => p.engagement);

            subjectData[subject] = {
              totalSessions: subjectProgress.filter(p => p.type === 'learning_session').length,
              averagePerformance: subjectPerformance.length > 0 ? 
                subjectPerformance.reduce((sum, p) => sum + p.performance.score, 0) / subjectPerformance.length : 0,
              averageEngagement: subjectEngagement.length > 0 ?
                subjectEngagement.reduce((sum, p) => sum + (p.engagement.score || 0), 0) / subjectEngagement.length : 0,
              totalTimeSpent: subjectProgress.reduce((sum, p) => sum + (p.timeSpent || 0), 0),
              completionRate: calculateSubjectCompletionRate(subjectProgress),
              lastStudied: subjectProgress.length > 0 ? subjectProgress[0].timestamp : null,
              progressTrend: calculateSubjectProgressTrend(subjectProgress)
            };
          });

          return subjectData;
        }

        function generateLearningAnalytics(student, progressData) {
          return {
            learningPace: student.learningPace,
            adaptiveLevel: calculateAdaptiveLevel(progressData),
            knowledgeGrowth: calculateKnowledgeGrowth(student, progressData),
            learningStyle: identifyLearningStyle(progressData),
            retentionRate: calculateRetentionRate(progressData),
            challengeResponse: analyzeeChallengeResponse(progressData),
            preferredTopics: identifyPreferredTopics(progressData),
            learningPatterns: identifyLearningPatterns(progressData)
          };
        }

        async function generateRecommendations(student, progressData) {
          const performance = generatePerformanceAnalytics(progressData);
          const engagement = generateEngagementAnalytics(progressData);
          
          const recommendations = [];

          // Performance-based recommendations
          if (performance.averageScore < 70) {
            recommendations.push({
              type: 'performance',
              priority: 'high',
              message: 'Focus on foundational concepts to improve understanding',
              action: 'Review basic concepts and practice more exercises'
            });
          }

          // Engagement-based recommendations
          if (engagement.averageParticipation < 60) {
            recommendations.push({
              type: 'engagement',
              priority: 'medium',
              message: 'Increase interactive participation in learning sessions',
              action: 'Try more hands-on activities and interactive content'
            });
          }

          // Subject-based recommendations
          const subjectPerformance = analyzeSubjectPerformance(progressData);
          if (subjectPerformance.weakestSubject) {
            recommendations.push({
              type: 'subject-focus',
              priority: 'medium',
              message: \`Additional practice needed in \${subjectPerformance.weakestSubject}\`,
              action: \`Allocate more time to \${subjectPerformance.weakestSubject} study sessions\`
            });
          }

          // Learning pace recommendations
          const avgSessionTime = calculateAverageSessionLength(progressData);
          if (avgSessionTime < 20) {
            recommendations.push({
              type: 'pace',
              priority: 'low',
              message: 'Consider longer study sessions for better retention',
              action: 'Aim for 25-30 minute focused learning sessions'
            });
          }

          return recommendations;
        }

        function generateScorecard(student, progressData) {
          const performance = generatePerformanceAnalytics(progressData);
          const engagement = generateEngagementAnalytics(progressData);
          const overview = generateOverviewAnalytics(progressData);

          return {
            overallGrade: calculateOverallGrade(performance, engagement, overview),
            categories: {
              academicPerformance: {
                score: Math.round(performance.averageScore || 0),
                grade: getLetterGrade(performance.averageScore || 0),
                trend: performance.improvementTrend || 'stable'
              },
              engagement: {
                score: Math.round(engagement.averageParticipation || 0),
                grade: getLetterGrade(engagement.averageParticipation || 0),
                trend: engagement.engagementTrend || 'stable'
              },
              consistency: {
                score: overview.streakDays * 10,
                grade: getLetterGrade(overview.streakDays * 10),
                trend: 'improving'
              },
              timeManagement: {
                score: Math.min(100, (overview.totalTimeSpent / 600) * 100), // 600 min target per month
                grade: getLetterGrade(Math.min(100, (overview.totalTimeSpent / 600) * 100)),
                trend: 'stable'
              }
            },
            areasOfStrength: identifyStrengths(performance, engagement, overview),
            areasForImprovement: identifyImprovements(performance, engagement, overview),
            nextGoals: generateNextGoals(student, performance, engagement)
          };
        }

        // Helper functions for analytics
        function calculateDateRange(period) {
          const now = new Date();
          let start;

          switch (period) {
            case '7d':
              start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              break;
            case '30d':
              start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
              break;
            case '90d':
              start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
              break;
            default:
              start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          }

          return {
            start: start.toISOString(),
            end: now.toISOString()
          };
        }

        function calculateEngagementScore(engagement, timeSpent, completed) {
          let score = 0;
          
          if (engagement) {
            score += (engagement.participation || 0) * 0.4;
            score += (engagement.interaction || 0) * 0.3;
          }
          
          if (timeSpent && timeSpent >= 15) score += 20; // Bonus for adequate time
          if (completed) score += 30; // Bonus for completion
          
          return Math.min(100, Math.round(score));
        }

        function calculateAverageSessionLength(progressData) {
          const sessions = progressData.filter(p => p.timeSpent);
          return sessions.length > 0 ? 
            sessions.reduce((sum, p) => sum + p.timeSpent, 0) / sessions.length : 0;
        }

        function calculateLearningStreak(progressData) {
          const dates = [...new Set(progressData.map(p => p.timestamp.split('T')[0]))].sort().reverse();
          let streak = 0;
          const today = new Date().toISOString().split('T')[0];
          
          for (let i = 0; i < dates.length; i++) {
            const expectedDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            if (dates.includes(expectedDate)) {
              streak++;
            } else {
              break;
            }
          }
          
          return streak;
        }

        function calculateImprovementTrend(scores) {
          if (scores.length < 2) return 'insufficient_data';
          
          const recent = scores.slice(0, 5);
          const older = scores.slice(5, 10);
          
          if (older.length === 0) return 'insufficient_data';
          
          const recentAvg = recent.reduce((sum, score) => sum + score, 0) / recent.length;
          const olderAvg = older.reduce((sum, score) => sum + score, 0) / older.length;
          
          const diff = recentAvg - olderAvg;
          
          if (diff > 5) return 'improving';
          if (diff < -5) return 'declining';
          return 'stable';
        }

        function calculateConsistencyScore(scores) {
          if (scores.length < 3) return 0;
          
          const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
          const variance = scores.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) / scores.length;
          const standardDeviation = Math.sqrt(variance);
          
          return Math.max(0, 100 - standardDeviation);
        }

        function identifyStrongSubjects(performanceData) {
          const subjectScores = {};
          performanceData.forEach(p => {
            if (!subjectScores[p.subject]) subjectScores[p.subject] = [];
            subjectScores[p.subject].push(p.performance.score);
          });
          
          return Object.entries(subjectScores)
            .map(([subject, scores]) => ({
              subject,
              avgScore: scores.reduce((sum, score) => sum + score, 0) / scores.length
            }))
            .filter(s => s.avgScore >= 80)
            .sort((a, b) => b.avgScore - a.avgScore)
            .slice(0, 3)
            .map(s => s.subject);
        }

        function identifyImprovementAreas(performanceData) {
          const subjectScores = {};
          performanceData.forEach(p => {
            if (!subjectScores[p.subject]) subjectScores[p.subject] = [];
            subjectScores[p.subject].push(p.performance.score);
          });
          
          return Object.entries(subjectScores)
            .map(([subject, scores]) => ({
              subject,
              avgScore: scores.reduce((sum, score) => sum + score, 0) / scores.length
            }))
            .filter(s => s.avgScore < 70)
            .sort((a, b) => a.avgScore - b.avgScore)
            .slice(0, 3)
            .map(s => s.subject);
        }

        function calculateEngagementTrend(engagementData) {
          // Similar to improvement trend but for engagement
          return 'stable'; // Simplified implementation
        }

        function identifyMostEngagingSubjects(engagementData) {
          // Identify subjects with highest engagement scores
          return []; // Simplified implementation
        }

        function identifyPeakEngagementTimes(engagementData) {
          // Analyze when student is most engaged
          return []; // Simplified implementation
        }

        function calculateSubjectCompletionRate(subjectProgress) {
          const completed = subjectProgress.filter(p => p.completed === true).length;
          const total = subjectProgress.filter(p => p.completed !== undefined).length;
          return total > 0 ? (completed / total) * 100 : 0;
        }

        function calculateSubjectProgressTrend(subjectProgress) {
          // Calculate trend for specific subject
          return 'stable'; // Simplified implementation
        }

        function calculateAdaptiveLevel(progressData) {
          // Calculate current adaptive difficulty level
          return 'moderate'; // Simplified implementation
        }

        function calculateKnowledgeGrowth(student, progressData) {
          // Calculate knowledge growth over time
          return 'positive'; // Simplified implementation
        }

        function identifyLearningStyle(progressData) {
          // Identify preferred learning style based on engagement patterns
          return 'visual'; // Simplified implementation
        }

        function calculateRetentionRate(progressData) {
          // Calculate knowledge retention rate
          return 85; // Simplified implementation
        }

        function analyzeeChallengeResponse(progressData) {
          // Analyze how student responds to challenges
          return 'positive'; // Simplified implementation
        }

        function identifyPreferredTopics(progressData) {
          // Identify topics student engages with most
          return []; // Simplified implementation
        }

        function identifyLearningPatterns(progressData) {
          // Identify learning patterns and preferences
          return {}; // Simplified implementation
        }

        function analyzeSubjectPerformance(progressData) {
          // Analyze performance across subjects
          return { weakestSubject: null }; // Simplified implementation
        }

        function calculateOverallGrade(performance, engagement, overview) {
          const performanceScore = performance.averageScore || 0;
          const engagementScore = engagement.averageParticipation || 0;
          const consistencyScore = overview.streakDays * 10;
          
          const overall = (performanceScore * 0.5) + (engagementScore * 0.3) + (consistencyScore * 0.2);
          return getLetterGrade(overall);
        }

        function getLetterGrade(score) {
          if (score >= 90) return 'A';
          if (score >= 80) return 'B';
          if (score >= 70) return 'C';
          if (score >= 60) return 'D';
          return 'F';
        }

        function identifyStrengths(performance, engagement, overview) {
          const strengths = [];
          if (performance.averageScore >= 85) strengths.push('Academic Excellence');
          if (engagement.averageParticipation >= 80) strengths.push('High Engagement');
          if (overview.streakDays >= 7) strengths.push('Consistent Learning');
          return strengths;
        }

        function identifyImprovements(performance, engagement, overview) {
          const improvements = [];
          if (performance.averageScore < 70) improvements.push('Academic Performance');
          if (engagement.averageParticipation < 60) improvements.push('Active Participation');
          if (overview.streakDays < 3) improvements.push('Learning Consistency');
          return improvements;
        }

        function generateNextGoals(student, performance, engagement) {
          const goals = [];
          
          if (performance.averageScore < 80) {
            goals.push(\`Improve academic performance to 80% in \${student.grade} grade subjects\`);
          }
          
          if (engagement.averageParticipation < 75) {
            goals.push('Increase active participation in learning sessions');
          }
          
          goals.push('Maintain daily learning streak for consistent progress');
          
          return goals.slice(0, 3); // Limit to 3 goals
        }

        function createResponse(statusCode, body) {
          return {
            statusCode,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: JSON.stringify(body)
          };
        }
      `),
      environment: {
        STUDENT_TABLE: props.studentTable.tableName,
        PROGRESS_TABLE: props.progressTable.tableName,
      },
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // API Gateway integration
    this.integration = new apigateway.LambdaIntegration(this.handler, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
        {
          statusCode: '201',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
        {
          statusCode: '400',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
        {
          statusCode: '404',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
        {
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
      ],
    });
  }
}
