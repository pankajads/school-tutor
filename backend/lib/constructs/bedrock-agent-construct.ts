import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { LearningEngineConstruct } from './learning-engine-construct';

export interface BedrockAgentConstructProps {
  readonly studentTable: dynamodb.Table;
  readonly progressTable: dynamodb.Table;
  readonly contentBucket: s3.Bucket;
  readonly learningEngine: LearningEngineConstruct;
}

export class BedrockAgentConstruct extends Construct {
  public readonly handler: lambda.Function;
  public readonly integration: apigateway.LambdaIntegration;
  public readonly agentRole: iam.Role;

  constructor(scope: Construct, id: string, props: BedrockAgentConstructProps) {
    super(scope, id);

    // IAM role for Bedrock agent
    this.agentRole = new iam.Role(this, 'BedrockAgentRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      inlinePolicies: {
        BedrockAgentPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
              ],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    // Lambda function for Bedrock agent interactions
    this.handler = new lambda.Function(this, 'BedrockAgentHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
        const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
        const { v4: uuidv4 } = require('uuid');

        const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
        const ddbClient = new DynamoDBClient({});
        const docClient = DynamoDBDocumentClient.from(ddbClient);

        const STUDENT_TABLE = process.env.STUDENT_TABLE;
        const PROGRESS_TABLE = process.env.PROGRESS_TABLE;

        exports.handler = async (event) => {
          console.log('Event:', JSON.stringify(event, null, 2));
          
          try {
            const { httpMethod, body, pathParameters } = event;
            const requestBody = body ? JSON.parse(body) : {};

            switch (httpMethod) {
              case 'POST':
                if (event.resource === '/agent/chat') {
                  return await handleChatInteraction(requestBody);
                } else {
                  return await handleAgentInteraction(requestBody);
                }
              default:
                return createResponse(405, { error: 'Method not allowed' });
            }
          } catch (error) {
            console.error('Error:', error);
            return createResponse(500, { error: 'Internal server error', details: error.message });
          }
        };

        async function handleChatInteraction(requestBody) {
          const { studentId, message, subject, sessionId } = requestBody;

          // Get student profile
          const student = await getStudent(studentId);
          if (!student) {
            return createResponse(404, { error: 'Student not found' });
          }

          // Get recent progress for context
          const recentProgress = await getRecentProgress(studentId, subject);

          // Generate AI response using Bedrock
          const aiResponse = await generateTutorResponse(student, message, subject, recentProgress);

          // Log interaction for progress tracking
          await logInteraction(studentId, subject, message, aiResponse, sessionId);

          return createResponse(200, {
            response: aiResponse,
            studentName: student.studentName,
            subject: subject,
            sessionId: sessionId || uuidv4(),
            timestamp: new Date().toISOString()
          });
        }

        async function handleAgentInteraction(requestBody) {
          const { studentId, action, subject, data } = requestBody;

          // Get student profile
          const student = await getStudent(studentId);
          if (!student) {
            return createResponse(404, { error: 'Student not found' });
          }

          switch (action) {
            case 'start_session':
              return await startLearningSession(student, subject, data);
            case 'generate_content':
              return await generateContent(student, subject, data);
            case 'assess_knowledge':
              return await assessKnowledge(student, subject, data);
            case 'get_recommendations':
              return await getRecommendations(student, subject);
            default:
              return createResponse(400, { error: 'Invalid action' });
          }
        }

        async function startLearningSession(student, subject, data) {
          const sessionId = uuidv4();
          const timestamp = new Date().toISOString();

          // Get curriculum-compliant content prompt
          const contentPrompt = buildContentPrompt(student, subject, data);
          
          // Generate session content using Bedrock
          const sessionContent = await generateTutorResponse(student, contentPrompt, subject, []);

          // Save session start
          await docClient.send(new PutCommand({
            TableName: PROGRESS_TABLE,
            Item: {
              studentId: student.studentId,
              timestamp: timestamp,
              sessionId: sessionId,
              subject: subject,
              type: 'session_start',
              content: sessionContent,
              subjectDate: \`\${subject}#\${timestamp.split('T')[0]}\`,
              ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year TTL
            }
          }));

          return createResponse(200, {
            sessionId: sessionId,
            content: sessionContent,
            subject: subject,
            message: 'Learning session started successfully'
          });
        }

        async function generateContent(student, subject, data) {
          const { contentType, difficulty, topic } = data;
          
          const prompt = buildContentGenerationPrompt(student, subject, contentType, difficulty, topic);
          const content = await generateTutorResponse(student, prompt, subject, []);

          return createResponse(200, {
            content: content,
            contentType: contentType,
            subject: subject,
            difficulty: difficulty,
            topic: topic
          });
        }

        async function assessKnowledge(student, subject, data) {
          const { answers, questions } = data;
          
          const assessmentPrompt = buildAssessmentPrompt(student, subject, questions, answers);
          const assessment = await generateTutorResponse(student, assessmentPrompt, subject, []);

          // Log assessment results
          const timestamp = new Date().toISOString();
          await docClient.send(new PutCommand({
            TableName: PROGRESS_TABLE,
            Item: {
              studentId: student.studentId,
              timestamp: timestamp,
              sessionId: uuidv4(),
              subject: subject,
              type: 'assessment',
              questions: questions,
              answers: answers,
              assessment: assessment,
              subjectDate: \`\${subject}#\${timestamp.split('T')[0]}\`,
              ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
            }
          }));

          return createResponse(200, {
            assessment: assessment,
            subject: subject,
            timestamp: timestamp
          });
        }

        async function getRecommendations(student, subject) {
          const recentProgress = await getRecentProgress(student.studentId, subject);
          
          const recommendationPrompt = buildRecommendationPrompt(student, subject, recentProgress);
          const recommendations = await generateTutorResponse(student, recommendationPrompt, subject, recentProgress);

          return createResponse(200, {
            recommendations: recommendations,
            subject: subject,
            basedOnSessions: recentProgress.length
          });
        }

        async function generateTutorResponse(student, prompt, subject, context) {
          const systemPrompt = buildSystemPrompt(student, subject);
          
          const fullPrompt = \`\${systemPrompt}

Context from recent sessions:
\${context.map(c => \`- \${c.type}: \${c.content}\`).join('\\n')}

Student Query/Task: \${prompt}

Please provide an engaging, educational response that:
1. Is appropriate for \${student.grade} grade level
2. Follows \${student.country} \${student.board} curriculum
3. Maintains an encouraging and interactive tone
4. Includes practical examples when possible
5. Asks follow-up questions to ensure understanding
6. Provides links only when specifically requested by the student\`;

          try {
            const response = await bedrockClient.send(new InvokeModelCommand({
              modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
              contentType: 'application/json',
              accept: 'application/json',
              body: JSON.stringify({
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 1000,
                temperature: 0.7,
                system: systemPrompt,
                messages: [
                  {
                    role: 'user',
                    content: prompt
                  }
                ]
              })
            }));

            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            return responseBody.content[0].text;
          } catch (error) {
            console.error('Bedrock API error:', error);
            return 'I apologize, but I am having trouble generating a response right now. Please try again in a moment.';
          }
        }

        async function getStudent(studentId) {
          const result = await docClient.send(new GetCommand({
            TableName: STUDENT_TABLE,
            Key: { studentId, profileVersion: 'v1' }
          }));
          return result.Item;
        }

        async function getRecentProgress(studentId, subject) {
          const result = await docClient.send(new QueryCommand({
            TableName: PROGRESS_TABLE,
            KeyConditionExpression: 'studentId = :studentId',
            FilterExpression: 'subject = :subject',
            ExpressionAttributeValues: {
              ':studentId': studentId,
              ':subject': subject
            },
            ScanIndexForward: false,
            Limit: 10
          }));
          return result.Items || [];
        }

        async function logInteraction(studentId, subject, message, response, sessionId) {
          const timestamp = new Date().toISOString();
          await docClient.send(new PutCommand({
            TableName: PROGRESS_TABLE,
            Item: {
              studentId: studentId,
              timestamp: timestamp,
              sessionId: sessionId || uuidv4(),
              subject: subject,
              type: 'chat_interaction',
              userMessage: message,
              aiResponse: response,
              subjectDate: \`\${subject}#\${timestamp.split('T')[0]}\`,
              ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
            }
          }));
        }

        function buildSystemPrompt(student, subject) {
          return \`You are an expert AI tutor for \${student.studentName}, a \${student.grade} grade student from \${student.country} following the \${student.board} curriculum. 

Student Profile:
- Name: \${student.studentName}
- Grade: \${student.grade}
- School Board: \${student.board}
- Country: \${student.country}
- Learning Pace: \${student.learningPace}
- Current Subject: \${subject}

Your role is to:
1. Provide curriculum-compliant educational content
2. Adapt to the student's learning pace and level
3. Create engaging, interactive learning experiences
4. Track understanding and provide appropriate challenges
5. Maintain a supportive and encouraging tone
6. Never redirect to external websites unless specifically asked for references
7. Cover multiple subjects daily with targeted knowledge building
8. Generate assignments and homework as needed

Always remember to be patient, encouraging, and age-appropriate in your responses.\`;
        }

        function buildContentPrompt(student, subject, data) {
          const { topic, learningGoal } = data || {};
          return \`Please create an engaging lesson for \${subject} on the topic of "\${topic || 'today\\'s curriculum'}" for a \${student.grade} grade student. The lesson should include:
1. Clear learning objectives
2. Interactive explanations with examples
3. Practice questions
4. Real-world applications
\${learningGoal ? \`5. Focus on: \${learningGoal}\` : ''}

Make it curriculum-compliant for \${student.country} \${student.board} standards.\`;
        }

        function buildContentGenerationPrompt(student, subject, contentType, difficulty, topic) {
          return \`Generate \${contentType} content for \${subject} on the topic "\${topic}" at \${difficulty} difficulty level for a \${student.grade} grade student from \${student.country} following \${student.board} curriculum.

Requirements:
- Age-appropriate language and examples
- Curriculum-compliant content
- Interactive and engaging format
- Include practice exercises
- Provide clear explanations\`;
        }

        function buildAssessmentPrompt(student, subject, questions, answers) {
          return \`Please assess the following answers from \${student.studentName} (\${student.grade} grade) for \${subject}:

Questions and Answers:
\${questions.map((q, i) => \`Q\${i + 1}: \${q}\\nA\${i + 1}: \${answers[i]}\`).join('\\n\\n')}

Provide:
1. Correct/incorrect feedback for each answer
2. Explanations for incorrect answers
3. Areas of strength and improvement
4. Recommendations for further study
5. Encouragement and next steps

Be constructive and supportive in your feedback.\`;
        }

        function buildRecommendationPrompt(student, subject, recentProgress) {
          return \`Based on \${student.studentName}'s recent learning sessions in \${subject}, provide personalized recommendations for:

1. Topics to review or strengthen
2. New concepts to explore
3. Practice exercises
4. Study strategies
5. Learning pace adjustments

Recent session summary:
\${recentProgress.slice(0, 5).map(p => \`- \${p.type}: \${p.content ? p.content.substring(0, 100) + '...' : 'N/A'}\`).join('\\n')}

Make recommendations specific to \${student.grade} grade \${student.country} \${student.board} curriculum.\`;
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
        CONTENT_BUCKET: props.contentBucket.bucketName,
      },
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_WEEK,
      role: new iam.Role(this, 'BedrockAgentLambdaRole', {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        ],
        inlinePolicies: {
          BedrockAccess: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                  'bedrock:InvokeModel',
                  'bedrock:InvokeModelWithResponseStream',
                  'bedrock:GetFoundationModel',
                  'bedrock:ListFoundationModels',
                ],
                resources: ['*'],
              }),
              new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                  'dynamodb:GetItem',
                  'dynamodb:PutItem',
                  'dynamodb:Query',
                  'dynamodb:UpdateItem',
                ],
                resources: [
                  props.studentTable.tableArn,
                  props.progressTable.tableArn,
                  `${props.studentTable.tableArn}/index/*`,
                  `${props.progressTable.tableArn}/index/*`,
                ],
              }),
            ],
          }),
        },
      }),
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
