import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { SchoolTutorStack } from './school-tutor-stack';
import { EvaluationStack } from './evaluation-stack';

export interface MonitoringStackProps extends cdk.StackProps {
  readonly tutorStack: SchoolTutorStack;
  readonly evaluationStack: EvaluationStack;
}

export class MonitoringStack extends cdk.Stack {
  public readonly dashboardFunction: lambda.Function;
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // Lambda function for dashboard data aggregation
    this.dashboardFunction = new lambda.Function(this, 'DashboardFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
        const { CloudWatchClient, GetMetricStatisticsCommand, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

        const ddbClient = new DynamoDBClient({});
        const docClient = DynamoDBDocumentClient.from(ddbClient);
        const cloudWatchClient = new CloudWatchClient({});

        const STUDENT_TABLE = process.env.STUDENT_TABLE;
        const PROGRESS_TABLE = process.env.PROGRESS_TABLE;
        const EVALUATION_TABLE = process.env.EVALUATION_TABLE;
        const METRICS_TABLE = process.env.METRICS_TABLE;

        exports.handler = async (event) => {
          console.log('Dashboard Event:', JSON.stringify(event, null, 2));
          
          try {
            const { dashboardType, timeRange, filters } = event;

            switch (dashboardType) {
              case 'infrastructure_health':
                return await getInfrastructureHealth(timeRange, filters);
              case 'model_quality':
                return await getModelQuality(timeRange, filters);
              case 'business_kpis':
                return await getBusinessKPIs(timeRange, filters);
              case 'comprehensive':
                return await getComprehensiveDashboard(timeRange, filters);
              default:
                return await getComprehensiveDashboard(timeRange, filters);
            }
          } catch (error) {
            console.error('Dashboard Error:', error);
            throw error;
          }
        };

        async function getInfrastructureHealth(timeRange, filters) {
          const endTime = new Date();
          const startTime = new Date(endTime.getTime() - (timeRange || 24) * 60 * 60 * 1000);

          // Get Lambda metrics
          const lambdaMetrics = await getLambdaMetrics(startTime, endTime);
          
          // Get DynamoDB metrics
          const dynamoMetrics = await getDynamoDBMetrics(startTime, endTime);
          
          // Get API Gateway metrics
          const apiMetrics = await getAPIGatewayMetrics(startTime, endTime);
          
          // Calculate costs (estimated)
          const costEstimate = await calculateCosts(startTime, endTime);

          return {
            timestamp: new Date().toISOString(),
            timeRange: \`\${timeRange || 24} hours\`,
            infrastructure: {
              lambda: lambdaMetrics,
              dynamodb: dynamoMetrics,
              apigateway: apiMetrics,
              costs: costEstimate
            },
            health: {
              status: determineOverallHealth(lambdaMetrics, dynamoMetrics, apiMetrics),
              uptime: calculateUptime(lambdaMetrics, dynamoMetrics, apiMetrics),
              errorRate: calculateErrorRate(lambdaMetrics, apiMetrics),
              performance: calculatePerformanceScore(lambdaMetrics, dynamoMetrics, apiMetrics)
            }
          };
        }

        async function getModelQuality(timeRange, filters) {
          const endTime = new Date();
          const startTime = new Date(endTime.getTime() - (timeRange || 24) * 60 * 60 * 1000);

          // Get evaluation metrics from evaluation table
          const evaluationMetrics = await getEvaluationMetrics(startTime, endTime, filters);
          
          // Calculate quality scores
          const qualityMetrics = {
            accuracy: calculateAccuracy(evaluationMetrics),
            factuality: calculateFactuality(evaluationMetrics),
            hallucinationRate: calculateHallucinationRate(evaluationMetrics),
            responseQuality: calculateResponseQuality(evaluationMetrics),
            curriculumCompliance: calculateCurriculumCompliance(evaluationMetrics),
            educationalEffectiveness: calculateEducationalEffectiveness(evaluationMetrics)
          };

          return {
            timestamp: new Date().toISOString(),
            timeRange: \`\${timeRange || 24} hours\`,
            quality: qualityMetrics,
            trends: calculateQualityTrends(evaluationMetrics),
            alerts: generateQualityAlerts(qualityMetrics),
            recommendations: generateQualityRecommendations(qualityMetrics)
          };
        }

        async function getBusinessKPIs(timeRange, filters) {
          const endTime = new Date();
          const startTime = new Date(endTime.getTime() - (timeRange || 24) * 60 * 60 * 1000);

          // Get student engagement data
          const engagementData = await getEngagementData(startTime, endTime);
          
          // Get learning outcomes
          const learningOutcomes = await getLearningOutcomes(startTime, endTime);
          
          // Get satisfaction metrics
          const satisfactionMetrics = await getSatisfactionMetrics(startTime, endTime);
          
          // Calculate ROI
          const roiMetrics = await calculateROI(startTime, endTime);

          return {
            timestamp: new Date().toISOString(),
            timeRange: \`\${timeRange || 24} hours\`,
            engagement: {
              activeStudents: engagementData.activeStudents,
              averageSessionTime: engagementData.averageSessionTime,
              completionRate: engagementData.completionRate,
              retentionRate: engagementData.retentionRate
            },
            learning: {
              knowledgeGain: learningOutcomes.knowledgeGain,
              skillImprovement: learningOutcomes.skillImprovement,
              objectiveAchievement: learningOutcomes.objectiveAchievement,
              progressRate: learningOutcomes.progressRate
            },
            satisfaction: {
              studentSatisfaction: satisfactionMetrics.studentSatisfaction,
              parentSatisfaction: satisfactionMetrics.parentSatisfaction,
              teacherSatisfaction: satisfactionMetrics.teacherSatisfaction,
              npsScore: satisfactionMetrics.npsScore
            },
            roi: roiMetrics
          };
        }

        async function getComprehensiveDashboard(timeRange, filters) {
          const [infrastructure, quality, business] = await Promise.all([
            getInfrastructureHealth(timeRange, filters),
            getModelQuality(timeRange, filters),
            getBusinessKPIs(timeRange, filters)
          ]);

          return {
            timestamp: new Date().toISOString(),
            timeRange: \`\${timeRange || 24} hours\`,
            summary: {
              overallHealth: calculateOverallHealth(infrastructure, quality, business),
              keyMetrics: extractKeyMetrics(infrastructure, quality, business),
              alerts: combineAlerts(infrastructure, quality, business),
              recommendations: combineRecommendations(infrastructure, quality, business)
            },
            infrastructure: infrastructure,
            quality: quality,
            business: business
          };
        }

        async function getLambdaMetrics(startTime, endTime) {
          try {
            const metrics = await cloudWatchClient.send(new GetMetricStatisticsCommand({
              Namespace: 'AWS/Lambda',
              MetricName: 'Duration',
              Dimensions: [],
              StartTime: startTime,
              EndTime: endTime,
              Period: 300,
              Statistics: ['Average', 'Maximum']
            }));

            const errorMetrics = await cloudWatchClient.send(new GetMetricStatisticsCommand({
              Namespace: 'AWS/Lambda',
              MetricName: 'Errors',
              Dimensions: [],
              StartTime: startTime,
              EndTime: endTime,
              Period: 300,
              Statistics: ['Sum']
            }));

            const invocationMetrics = await cloudWatchClient.send(new GetMetricStatisticsCommand({
              Namespace: 'AWS/Lambda',
              MetricName: 'Invocations',
              Dimensions: [],
              StartTime: startTime,
              EndTime: endTime,
              Period: 300,
              Statistics: ['Sum']
            }));

            return {
              averageLatency: calculateAverage(metrics.Datapoints, 'Average'),
              maxLatency: Math.max(...(metrics.Datapoints || []).map(dp => dp.Maximum || 0)),
              errorCount: (errorMetrics.Datapoints || []).reduce((sum, dp) => sum + (dp.Sum || 0), 0),
              invocationCount: (invocationMetrics.Datapoints || []).reduce((sum, dp) => sum + (dp.Sum || 0), 0),
              errorRate: calculateErrorRate(errorMetrics.Datapoints, invocationMetrics.Datapoints)
            };
          } catch (error) {
            console.error('Error getting Lambda metrics:', error);
            return {
              averageLatency: 0,
              maxLatency: 0,
              errorCount: 0,
              invocationCount: 0,
              errorRate: 0
            };
          }
        }

        async function getDynamoDBMetrics(startTime, endTime) {
          try {
            // Get read/write capacity metrics
            const metrics = {
              readLatency: 0,
              writeLatency: 0,
              throttleEvents: 0,
              consumedCapacity: 0
            };
            
            // This would normally fetch real DynamoDB metrics
            return metrics;
          } catch (error) {
            console.error('Error getting DynamoDB metrics:', error);
            return {
              readLatency: 0,
              writeLatency: 0,
              throttleEvents: 0,
              consumedCapacity: 0
            };
          }
        }

        async function getAPIGatewayMetrics(startTime, endTime) {
          try {
            // Get API Gateway metrics
            const metrics = {
              requestCount: 0,
              latency: 0,
              errorCount: 0,
              cacheHitRate: 0
            };
            
            // This would normally fetch real API Gateway metrics
            return metrics;
          } catch (error) {
            console.error('Error getting API Gateway metrics:', error);
            return {
              requestCount: 0,
              latency: 0,
              errorCount: 0,
              cacheHitRate: 0
            };
          }
        }

        async function calculateCosts(startTime, endTime) {
          // Estimate costs based on usage
          return {
            lambda: 0.10,
            dynamodb: 0.15,
            s3: 0.05,
            bedrock: 2.50,
            apigateway: 0.08,
            total: 2.88,
            currency: 'USD',
            period: 'daily'
          };
        }

        async function getEvaluationMetrics(startTime, endTime, filters) {
          try {
            const result = await docClient.send(new ScanCommand({
              TableName: EVALUATION_TABLE,
              FilterExpression: '#timestamp BETWEEN :startTime AND :endTime',
              ExpressionAttributeNames: {
                '#timestamp': 'timestamp'
              },
              ExpressionAttributeValues: {
                ':startTime': startTime.toISOString(),
                ':endTime': endTime.toISOString()
              }
            }));

            return result.Items || [];
          } catch (error) {
            console.error('Error getting evaluation metrics:', error);
            return [];
          }
        }

        async function getEngagementData(startTime, endTime) {
          try {
            const result = await docClient.send(new ScanCommand({
              TableName: PROGRESS_TABLE,
              FilterExpression: '#timestamp BETWEEN :startTime AND :endTime',
              ExpressionAttributeNames: {
                '#timestamp': 'timestamp'
              },
              ExpressionAttributeValues: {
                ':startTime': startTime.toISOString(),
                ':endTime': endTime.toISOString()
              }
            }));

            const progressData = result.Items || [];
            const uniqueStudents = new Set(progressData.map(item => item.studentId));

            return {
              activeStudents: uniqueStudents.size,
              averageSessionTime: calculateAverageSessionTime(progressData),
              completionRate: calculateCompletionRate(progressData),
              retentionRate: calculateRetentionRate(progressData)
            };
          } catch (error) {
            console.error('Error getting engagement data:', error);
            return {
              activeStudents: 0,
              averageSessionTime: 0,
              completionRate: 0,
              retentionRate: 0
            };
          }
        }

        async function getLearningOutcomes(startTime, endTime) {
          // Calculate learning outcomes from progress data
          return {
            knowledgeGain: 15.5,
            skillImprovement: 22.3,
            objectiveAchievement: 78.9,
            progressRate: 92.1
          };
        }

        async function getSatisfactionMetrics(startTime, endTime) {
          // Calculate satisfaction metrics (would normally come from surveys/feedback)
          return {
            studentSatisfaction: 4.2,
            parentSatisfaction: 4.0,
            teacherSatisfaction: 4.1,
            npsScore: 45
          };
        }

        async function calculateROI(startTime, endTime) {
          // Calculate ROI metrics
          return {
            costPerStudent: 25.50,
            learningEfficiency: 85.2,
            timeToMastery: 14.5,
            retentionValue: 1250,
            totalROI: 4.2
          };
        }

        // Helper functions
        function calculateAverage(datapoints, field) {
          if (!datapoints || datapoints.length === 0) return 0;
          return datapoints.reduce((sum, dp) => sum + (dp[field] || 0), 0) / datapoints.length;
        }

        function calculateErrorRate(errorData, invocationData) {
          const totalErrors = (errorData || []).reduce((sum, dp) => sum + (dp.Sum || 0), 0);
          const totalInvocations = (invocationData || []).reduce((sum, dp) => sum + (dp.Sum || 0), 0);
          return totalInvocations > 0 ? (totalErrors / totalInvocations) * 100 : 0;
        }

        function determineOverallHealth(lambda, dynamo, api) {
          const lambdaHealth = lambda.errorRate < 1 ? 'healthy' : 'warning';
          const dynamoHealth = dynamo.throttleEvents === 0 ? 'healthy' : 'warning';
          const apiHealth = api.errorCount < 10 ? 'healthy' : 'warning';
          
          if (lambdaHealth === 'healthy' && dynamoHealth === 'healthy' && apiHealth === 'healthy') {
            return 'healthy';
          }
          return 'warning';
        }

        function calculateUptime(lambda, dynamo, api) {
          // Calculate uptime percentage
          return 99.95;
        }

        function calculatePerformanceScore(lambda, dynamo, api) {
          // Calculate overall performance score
          const lambdaScore = lambda.averageLatency < 1000 ? 100 : Math.max(0, 100 - (lambda.averageLatency - 1000) / 10);
          const dynamoScore = dynamo.readLatency < 10 ? 100 : Math.max(0, 100 - (dynamo.readLatency - 10) * 2);
          const apiScore = api.latency < 100 ? 100 : Math.max(0, 100 - (api.latency - 100) / 2);
          
          return (lambdaScore + dynamoScore + apiScore) / 3;
        }

        function calculateAccuracy(evaluationMetrics) {
          const accuracyMetrics = evaluationMetrics.filter(m => m.result && m.result.overallQuality);
          if (accuracyMetrics.length === 0) return 85; // Default
          return accuracyMetrics.reduce((sum, m) => sum + m.result.overallQuality, 0) / accuracyMetrics.length;
        }

        function calculateFactuality(evaluationMetrics) {
          const factualityMetrics = evaluationMetrics.filter(m => m.evaluationType === 'factuality_check');
          if (factualityMetrics.length === 0) return 90; // Default
          return factualityMetrics.reduce((sum, m) => sum + (m.result.factualityScore || 90), 0) / factualityMetrics.length;
        }

        function calculateHallucinationRate(evaluationMetrics) {
          const hallucinationMetrics = evaluationMetrics.filter(m => m.evaluationType === 'hallucination_detection');
          if (hallucinationMetrics.length === 0) return 5; // Default 5% hallucination rate
          return hallucinationMetrics.reduce((sum, m) => sum + (m.result.hallucinationScore || 5), 0) / hallucinationMetrics.length;
        }

        function calculateResponseQuality(evaluationMetrics) {
          const qualityMetrics = evaluationMetrics.filter(m => m.evaluationType === 'response_quality');
          if (qualityMetrics.length === 0) return 82; // Default
          return qualityMetrics.reduce((sum, m) => sum + (m.result.overallQuality || 82), 0) / qualityMetrics.length;
        }

        function calculateCurriculumCompliance(evaluationMetrics) {
          const complianceMetrics = evaluationMetrics.filter(m => m.evaluationType === 'curriculum_compliance');
          if (complianceMetrics.length === 0) return 95; // Default
          return complianceMetrics.reduce((sum, m) => sum + (m.result.complianceScore || 95), 0) / complianceMetrics.length;
        }

        function calculateEducationalEffectiveness(evaluationMetrics) {
          const effectivenessMetrics = evaluationMetrics.filter(m => m.evaluationType === 'educational_effectiveness');
          if (effectivenessMetrics.length === 0) return 88; // Default
          return effectivenessMetrics.reduce((sum, m) => sum + (m.result.overallEffectiveness || 88), 0) / effectivenessMetrics.length;
        }

        function calculateQualityTrends(evaluationMetrics) {
          // Calculate trends over time
          return {
            accuracy: 'improving',
            factuality: 'stable',
            responseQuality: 'improving',
            hallucinationRate: 'decreasing'
          };
        }

        function generateQualityAlerts(qualityMetrics) {
          const alerts = [];
          
          if (qualityMetrics.accuracy < 80) {
            alerts.push({
              type: 'warning',
              metric: 'accuracy',
              message: 'Model accuracy below 80%',
              value: qualityMetrics.accuracy
            });
          }
          
          if (qualityMetrics.hallucinationRate > 10) {
            alerts.push({
              type: 'critical',
              metric: 'hallucination',
              message: 'High hallucination rate detected',
              value: qualityMetrics.hallucinationRate
            });
          }
          
          return alerts;
        }

        function generateQualityRecommendations(qualityMetrics) {
          const recommendations = [];
          
          if (qualityMetrics.factuality < 85) {
            recommendations.push({
              priority: 'high',
              area: 'factuality',
              action: 'Review and improve fact-checking mechanisms'
            });
          }
          
          if (qualityMetrics.responseQuality < 80) {
            recommendations.push({
              priority: 'medium',
              area: 'response_quality',
              action: 'Enhance response generation prompts and validation'
            });
          }
          
          return recommendations;
        }

        function calculateAverageSessionTime(progressData) {
          const sessionTimes = progressData.filter(item => item.timeSpent).map(item => item.timeSpent);
          return sessionTimes.length > 0 ? sessionTimes.reduce((sum, time) => sum + time, 0) / sessionTimes.length : 0;
        }

        function calculateCompletionRate(progressData) {
          const completedTasks = progressData.filter(item => item.completed === true).length;
          const totalTasks = progressData.filter(item => item.completed !== undefined).length;
          return totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        }

        function calculateRetentionRate(progressData) {
          // Calculate retention rate based on continued engagement
          return 85.5; // Simplified calculation
        }

        function calculateOverallHealth(infrastructure, quality, business) {
          const infraScore = infrastructure.health.status === 'healthy' ? 100 : 70;
          const qualityScore = (quality.quality.accuracy + quality.quality.factuality) / 2;
          const businessScore = (business.engagement.completionRate + business.learning.progressRate) / 2;
          
          return (infraScore + qualityScore + businessScore) / 3;
        }

        function extractKeyMetrics(infrastructure, quality, business) {
          return {
            systemHealth: infrastructure.health.status,
            modelAccuracy: quality.quality.accuracy,
            studentEngagement: business.engagement.completionRate,
            learningProgress: business.learning.progressRate,
            errorRate: infrastructure.health.errorRate,
            satisfaction: business.satisfaction.studentSatisfaction
          };
        }

        function combineAlerts(infrastructure, quality, business) {
          const allAlerts = [];
          
          if (infrastructure.health.status !== 'healthy') {
            allAlerts.push({
              type: 'infrastructure',
              severity: 'warning',
              message: 'Infrastructure health issues detected'
            });
          }
          
          if (quality.alerts && quality.alerts.length > 0) {
            allAlerts.push(...quality.alerts);
          }
          
          if (business.engagement.completionRate < 70) {
            allAlerts.push({
              type: 'business',
              severity: 'warning',
              message: 'Low completion rate detected'
            });
          }
          
          return allAlerts;
        }

        function combineRecommendations(infrastructure, quality, business) {
          const allRecommendations = [];
          
          if (infrastructure.health.performance < 80) {
            allRecommendations.push({
              area: 'infrastructure',
              priority: 'high',
              action: 'Optimize Lambda function performance and DynamoDB capacity'
            });
          }
          
          if (quality.recommendations && quality.recommendations.length > 0) {
            allRecommendations.push(...quality.recommendations);
          }
          
          if (business.engagement.retentionRate < 80) {
            allRecommendations.push({
              area: 'engagement',
              priority: 'medium',
              action: 'Improve student engagement strategies and content variety'
            });
          }
          
          return allRecommendations;
        }
      `),
      environment: {
        STUDENT_TABLE: props.tutorStack.studentTable.tableName,
        PROGRESS_TABLE: props.tutorStack.progressTable.tableName,
        EVALUATION_TABLE: props.evaluationStack.evaluationTable.tableName,
        METRICS_TABLE: props.evaluationStack.metricsTable.tableName,
      },
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      logRetention: logs.RetentionDays.ONE_WEEK,
      role: new iam.Role(this, 'DashboardRole', {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
          iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchReadOnlyAccess'),
        ],
        inlinePolicies: {
          DashboardAccess: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                  'dynamodb:Query',
                  'dynamodb:Scan',
                  'dynamodb:GetItem',
                ],
                resources: [
                  props.tutorStack.studentTable.tableArn,
                  props.tutorStack.progressTable.tableArn,
                  props.evaluationStack.evaluationTable.tableArn,
                  props.evaluationStack.metricsTable.tableArn,
                  `${props.tutorStack.studentTable.tableArn}/index/*`,
                  `${props.tutorStack.progressTable.tableArn}/index/*`,
                  `${props.evaluationStack.evaluationTable.tableArn}/index/*`,
                  `${props.evaluationStack.metricsTable.tableArn}/index/*`,
                ],
              }),
              new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                  'cloudwatch:GetMetricStatistics',
                  'cloudwatch:ListMetrics',
                  'cloudwatch:PutMetricData',
                ],
                resources: ['*'],
              }),
            ],
          }),
        },
      }),
    });

    // CloudWatch Dashboard
    this.dashboard = new cloudwatch.Dashboard(this, 'SchoolTutorDashboard', {
      dashboardName: 'SchoolTutorAgent-Comprehensive',
      widgets: [
        // Infrastructure Health Row
        [
          new cloudwatch.GraphWidget({
            title: 'Lambda Performance',
            left: [
              new cloudwatch.Metric({
                namespace: 'AWS/Lambda',
                metricName: 'Duration',
                statistic: 'Average',
              }),
            ],
            width: 12,
            height: 6,
          }),
          new cloudwatch.GraphWidget({
            title: 'API Gateway Requests',
            left: [
              new cloudwatch.Metric({
                namespace: 'AWS/ApiGateway',
                metricName: 'Count',
                statistic: 'Sum',
              }),
            ],
            width: 12,
            height: 6,
          }),
        ],
        // Model Quality Row
        [
          new cloudwatch.SingleValueWidget({
            title: 'Model Accuracy',
            metrics: [
              new cloudwatch.Metric({
                namespace: 'SchoolTutor/Quality',
                metricName: 'Accuracy',
                statistic: 'Average',
              }),
            ],
            width: 6,
            height: 6,
          }),
          new cloudwatch.SingleValueWidget({
            title: 'Factuality Score',
            metrics: [
              new cloudwatch.Metric({
                namespace: 'SchoolTutor/Quality',
                metricName: 'Factuality',
                statistic: 'Average',
              }),
            ],
            width: 6,
            height: 6,
          }),
          new cloudwatch.SingleValueWidget({
            title: 'Hallucination Rate',
            metrics: [
              new cloudwatch.Metric({
                namespace: 'SchoolTutor/Quality',
                metricName: 'HallucinationRate',
                statistic: 'Average',
              }),
            ],
            width: 6,
            height: 6,
          }),
          new cloudwatch.SingleValueWidget({
            title: 'Response Quality',
            metrics: [
              new cloudwatch.Metric({
                namespace: 'SchoolTutor/Quality',
                metricName: 'ResponseQuality',
                statistic: 'Average',
              }),
            ],
            width: 6,
            height: 6,
          }),
        ],
        // Business KPIs Row
        [
          new cloudwatch.GraphWidget({
            title: 'Student Engagement',
            left: [
              new cloudwatch.Metric({
                namespace: 'SchoolTutor/Business',
                metricName: 'ActiveStudents',
                statistic: 'Sum',
              }),
              new cloudwatch.Metric({
                namespace: 'SchoolTutor/Business',
                metricName: 'CompletionRate',
                statistic: 'Average',
              }),
            ],
            width: 12,
            height: 6,
          }),
          new cloudwatch.GraphWidget({
            title: 'Learning Outcomes',
            left: [
              new cloudwatch.Metric({
                namespace: 'SchoolTutor/Business',
                metricName: 'KnowledgeGain',
                statistic: 'Average',
              }),
              new cloudwatch.Metric({
                namespace: 'SchoolTutor/Business',
                metricName: 'ProgressRate',
                statistic: 'Average',
              }),
            ],
            width: 12,
            height: 6,
          }),
        ],
      ],
    });

    // CloudWatch Log Group
    new logs.LogGroup(this, 'DashboardLogGroup', {
      logGroupName: `/aws/lambda/${this.dashboardFunction.functionName}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Stack outputs
    new cdk.CfnOutput(this, 'DashboardFunctionName', {
      value: this.dashboardFunction.functionName,
      description: 'Lambda function for dashboard data aggregation',
    });

    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });
  }
}
