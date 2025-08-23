import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface LearningEngineConstructProps {
  readonly studentTable: dynamodb.Table;
  readonly progressTable: dynamodb.Table;
  readonly contentBucket: s3.Bucket;
}

export class LearningEngineConstruct extends Construct {
  public readonly handler: lambda.Function;
  public readonly integration: apigateway.LambdaIntegration;

  constructor(scope: Construct, id: string, props: LearningEngineConstructProps) {
    super(scope, id);

    // Lambda function for learning engine
    this.handler = new lambda.Function(this, 'LearningEngineHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
        const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
        const crypto = require('crypto');

        const ddbClient = new DynamoDBClient({});
        const docClient = DynamoDBDocumentClient.from(ddbClient);
        const s3Client = new S3Client({});

        const STUDENT_TABLE = process.env.STUDENT_TABLE;
        const PROGRESS_TABLE = process.env.PROGRESS_TABLE;
        const CONTENT_BUCKET = process.env.CONTENT_BUCKET;

        exports.handler = async (event) => {
          console.log('Event:', JSON.stringify(event, null, 2));
          
          try {
            const { httpMethod, pathParameters, body, queryStringParameters } = event;
            const requestBody = body ? JSON.parse(body) : {};

            switch (httpMethod) {
              case 'GET':
                if (event.resource === '/learning/content') {
                  return await getContent(queryStringParameters);
                }
                break;
              case 'POST':
                if (event.resource === '/learning/session') {
                  return await startLearningSession(requestBody);
                } else if (event.resource === '/learning/content') {
                  return await generateContent(requestBody);
                }
                break;
              default:
                return createResponse(405, { error: 'Method not allowed' });
            }
          } catch (error) {
            console.error('Error:', error);
            return createResponse(500, { error: 'Internal server error', details: error.message });
          }
        };

        async function startLearningSession(requestBody) {
          const { studentId, subjects, sessionType, preferences } = requestBody;

          // Get student profile
          const student = await getStudent(studentId);
          if (!student) {
            return createResponse(404, { error: 'Student not found' });
          }

          // Ensure we cover two subjects minimum
          const selectedSubjects = subjects && subjects.length >= 2 ? subjects : 
            await getDefaultSubjects(student, subjects);

          if (selectedSubjects.length < 2) {
            return createResponse(400, { 
              error: 'Minimum two subjects required per session',
              availableSubjects: getAvailableSubjects(student.grade, student.board)
            });
          }

          const sessionId = crypto.randomUUID();
          const timestamp = new Date().toISOString();

          // Generate adaptive content for each subject
          const sessionContent = await generateSessionContent(student, selectedSubjects, sessionType, preferences);

          // Save session
          await docClient.send(new PutCommand({
            TableName: PROGRESS_TABLE,
            Item: {
              studentId: student.studentId,
              timestamp: timestamp,
              sessionId: sessionId,
              type: 'learning_session',
              subjects: selectedSubjects,
              sessionType: sessionType || 'regular',
              content: sessionContent,
              status: 'started',
              subjectDate: \`multi#\${timestamp.split('T')[0]}\`,
              ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
            }
          }));

          // Update last interaction
          await updateLastInteraction(student.studentId);

          return createResponse(200, {
            sessionId: sessionId,
            subjects: selectedSubjects,
            content: sessionContent,
            studentName: student.studentName,
            estimatedDuration: calculateSessionDuration(sessionContent),
            message: 'Learning session started successfully'
          });
        }

        async function generateContent(requestBody) {
          const { studentId, subject, contentType, difficulty, topic, assignment } = requestBody;

          // Get student profile
          const student = await getStudent(studentId);
          if (!student) {
            return createResponse(404, { error: 'Student not found' });
          }

          // Get learning history for adaptation
          const learningHistory = await getLearningHistory(studentId, subject);
          
          // Generate adaptive content based on student's pace and knowledge
          const adaptiveContent = await generateAdaptiveContent(
            student, 
            subject, 
            contentType, 
            difficulty, 
            topic, 
            learningHistory,
            assignment
          );

          // Store content in S3 for future reference
          const contentKey = \`content/\${studentId}/\${subject}/\${Date.now()}.json\`;
          await s3Client.send(new PutObjectCommand({
            Bucket: CONTENT_BUCKET,
            Key: contentKey,
            Body: JSON.stringify(adaptiveContent),
            ContentType: 'application/json'
          }));

          // Log content generation
          const timestamp = new Date().toISOString();
          await docClient.send(new PutCommand({
            TableName: PROGRESS_TABLE,
            Item: {
              studentId: studentId,
              timestamp: timestamp,
              sessionId: crypto.randomUUID(),
              subject: subject,
              type: 'content_generated',
              contentType: contentType,
              difficulty: difficulty,
              topic: topic,
              contentKey: contentKey,
              subjectDate: \`\${subject}#\${timestamp.split('T')[0]}\`,
              ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
            }
          }));

          return createResponse(200, {
            content: adaptiveContent,
            subject: subject,
            contentType: contentType,
            difficulty: difficulty,
            topic: topic,
            adaptationNotes: generateAdaptationNotes(student, learningHistory)
          });
        }

        async function getContent(queryParams) {
          const { studentId, subject, contentType, limit } = queryParams || {};

          if (!studentId) {
            return createResponse(400, { error: 'studentId is required' });
          }

          // Query recent content
          const queryParams_ddb = {
            TableName: PROGRESS_TABLE,
            KeyConditionExpression: 'studentId = :studentId',
            ExpressionAttributeValues: {
              ':studentId': studentId
            },
            ScanIndexForward: false,
            Limit: parseInt(limit) || 20
          };

          if (subject) {
            queryParams_ddb.FilterExpression = 'subject = :subject';
            queryParams_ddb.ExpressionAttributeValues[':subject'] = subject;
          }

          if (contentType) {
            queryParams_ddb.FilterExpression = queryParams_ddb.FilterExpression ? 
              queryParams_ddb.FilterExpression + ' AND contentType = :contentType' :
              'contentType = :contentType';
            queryParams_ddb.ExpressionAttributeValues[':contentType'] = contentType;
          }

          const result = await docClient.send(new QueryCommand(queryParams_ddb));

          // Fetch full content from S3 if available
          const contentWithDetails = await Promise.all(
            (result.Items || []).map(async (item) => {
              if (item.contentKey) {
                try {
                  const s3Object = await s3Client.send(new GetObjectCommand({
                    Bucket: CONTENT_BUCKET,
                    Key: item.contentKey
                  }));
                  const fullContent = JSON.parse(await s3Object.Body.transformToString());
                  return { ...item, fullContent };
                } catch (error) {
                  console.error('Error fetching content from S3:', error);
                  return item;
                }
              }
              return item;
            })
          );

          return createResponse(200, {
            content: contentWithDetails,
            count: contentWithDetails.length,
            studentId: studentId
          });
        }

        async function getStudent(studentId) {
          const result = await docClient.send(new GetCommand({
            TableName: STUDENT_TABLE,
            Key: { studentId, profileVersion: 'v1' }
          }));
          return result.Item;
        }

        async function getLearningHistory(studentId, subject) {
          const result = await docClient.send(new QueryCommand({
            TableName: PROGRESS_TABLE,
            KeyConditionExpression: 'studentId = :studentId',
            FilterExpression: 'subject = :subject',
            ExpressionAttributeValues: {
              ':studentId': studentId,
              ':subject': subject
            },
            ScanIndexForward: false,
            Limit: 50
          }));
          return result.Items || [];
        }

        async function updateLastInteraction(studentId) {
          const timestamp = new Date().toISOString();
          await docClient.send(new UpdateCommand({
            TableName: STUDENT_TABLE,
            Key: { studentId, profileVersion: 'v1' },
            UpdateExpression: 'SET lastInteraction = :timestamp',
            ExpressionAttributeValues: {
              ':timestamp': timestamp
            }
          }));
        }

        async function getDefaultSubjects(student, requestedSubjects) {
          const gradeSubjects = getAvailableSubjects(student.grade, student.board);
          const studentPreferredSubjects = student.subjects || [];
          
          const combined = [...(requestedSubjects || []), ...studentPreferredSubjects];
          const unique = [...new Set(combined)];
          
          // Ensure we have at least 2 subjects
          return unique.slice(0, 2).length === 2 ? unique.slice(0, 2) : 
            gradeSubjects.slice(0, 2);
        }

        function getAvailableSubjects(grade, board) {
          const gradeNum = parseInt(grade);
          
          const commonSubjects = ['Mathematics', 'Science', 'English', 'Social Studies'];
          
          if (gradeNum >= 6) {
            commonSubjects.push('History', 'Geography', 'Physics', 'Chemistry', 'Biology');
          }
          
          if (gradeNum >= 8) {
            commonSubjects.push('Computer Science', 'Economics');
          }
          
          return commonSubjects;
        }

        async function generateSessionContent(student, subjects, sessionType, preferences) {
          const sessionContent = {};
          
          for (const subject of subjects) {
            const subjectHistory = await getLearningHistory(student.studentId, subject);
            const difficulty = calculateDifficulty(student, subjectHistory);
            
            sessionContent[subject] = {
              introduction: generateIntroduction(student, subject),
              mainContent: generateMainContent(student, subject, difficulty, sessionType),
              activities: generateActivities(student, subject, difficulty),
              assessment: generateAssessment(student, subject, difficulty),
              homework: generateHomework(student, subject, difficulty),
              resources: generateResources(student, subject),
              difficulty: difficulty,
              estimatedTime: 30 // minutes per subject
            };
          }
          
          return sessionContent;
        }

        async function generateAdaptiveContent(student, subject, contentType, difficulty, topic, history, assignment) {
          const adaptiveContent = {
            metadata: {
              studentId: student.studentId,
              studentName: student.studentName,
              subject: subject,
              contentType: contentType,
              difficulty: difficulty || calculateDifficulty(student, history),
              topic: topic,
              grade: student.grade,
              board: student.board,
              country: student.country,
              generatedAt: new Date().toISOString()
            },
            content: {}
          };

          switch (contentType) {
            case 'lesson':
              adaptiveContent.content = generateLessonContent(student, subject, topic, difficulty, history);
              break;
            case 'exercise':
              adaptiveContent.content = generateExerciseContent(student, subject, topic, difficulty, history);
              break;
            case 'assignment':
              adaptiveContent.content = generateAssignmentContent(student, subject, topic, difficulty, assignment);
              break;
            case 'quiz':
              adaptiveContent.content = generateQuizContent(student, subject, topic, difficulty, history);
              break;
            case 'explanation':
              adaptiveContent.content = generateExplanationContent(student, subject, topic, difficulty);
              break;
            default:
              adaptiveContent.content = generateGeneralContent(student, subject, topic, difficulty);
          }

          return adaptiveContent;
        }

        function calculateDifficulty(student, history) {
          const recentPerformance = history.slice(0, 10);
          const avgSuccess = recentPerformance.length > 0 ? 
            recentPerformance.filter(h => h.success === true).length / recentPerformance.length : 0.5;
          
          if (avgSuccess > 0.8) return 'challenging';
          if (avgSuccess > 0.6) return 'moderate';
          return 'basic';
        }

        function generateIntroduction(student, subject) {
          return \`Welcome back, \${student.studentName}! Today we'll explore exciting concepts in \${subject}. Let's make learning fun and engaging!\`;
        }

        function generateMainContent(student, subject, difficulty, sessionType) {
          return {
            overview: \`Today's \${subject} session focuses on \${difficulty} level concepts suitable for \${student.grade} grade.\`,
            learningObjectives: [
              \`Understand key concepts in \${subject}\`,
              \`Apply knowledge through practical examples\`,
              \`Develop problem-solving skills\`
            ],
            content: \`Curriculum-compliant content for \${student.country} \${student.board} board.\`
          };
        }

        function generateActivities(student, subject, difficulty) {
          return [
            {
              type: 'interactive',
              title: \`\${subject} Explorer\`,
              description: 'Hands-on activity to reinforce learning',
              duration: 10
            },
            {
              type: 'problem-solving',
              title: 'Challenge Questions',
              description: \`\${difficulty} level problems to test understanding\`,
              duration: 15
            }
          ];
        }

        function generateAssessment(student, subject, difficulty) {
          return {
            type: 'formative',
            questions: 5,
            difficulty: difficulty,
            timeLimit: 10,
            description: \`Quick assessment to check \${subject} understanding\`
          };
        }

        function generateHomework(student, subject, difficulty) {
          return {
            title: \`\${subject} Practice Assignment\`,
            description: \`Take-home exercises to reinforce today's learning\`,
            difficulty: difficulty,
            estimatedTime: 20,
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          };
        }

        function generateResources(student, subject) {
          return {
            supplementaryMaterial: \`Additional \${subject} resources for \${student.grade} grade\`,
            practiceProblems: 'Extra problems for skill building',
            referenceLinks: 'Curriculum-compliant reference materials (shared on request only)'
          };
        }

        function generateLessonContent(student, subject, topic, difficulty, history) {
          return {
            title: \`\${topic} - \${subject} Lesson\`,
            introduction: \`Let's explore \${topic} in \${subject}\`,
            sections: [
              {
                title: 'Concepts',
                content: \`Key concepts about \${topic}\`,
                examples: [\`Example 1 for \${topic}\`, \`Example 2 for \${topic}\`]
              },
              {
                title: 'Practice',
                content: 'Hands-on practice exercises',
                exercises: [\`Exercise 1 on \${topic}\`, \`Exercise 2 on \${topic}\`]
              }
            ],
            summary: \`Summary of \${topic} lesson\`,
            nextSteps: 'Recommended next learning steps'
          };
        }

        function generateExerciseContent(student, subject, topic, difficulty, history) {
          return {
            title: \`\${topic} Exercises\`,
            instructions: \`Complete these \${difficulty} level exercises on \${topic}\`,
            exercises: [
              { id: 1, question: \`Question 1 about \${topic}\`, difficulty: difficulty },
              { id: 2, question: \`Question 2 about \${topic}\`, difficulty: difficulty },
              { id: 3, question: \`Question 3 about \${topic}\`, difficulty: difficulty }
            ],
            hints: [\`Hint for solving \${topic} problems\`],
            solutions: 'Available after completion'
          };
        }

        function generateAssignmentContent(student, subject, topic, difficulty, assignment) {
          return {
            title: \`\${topic} Assignment\`,
            description: assignment?.description || \`Assignment on \${topic} for \${subject}\`,
            instructions: assignment?.instructions || 'Complete all questions carefully',
            questions: assignment?.questions || [
              \`Question 1 on \${topic}\`,
              \`Question 2 on \${topic}\`,
              \`Question 3 on \${topic}\`
            ],
            rubric: 'Grading criteria and expectations',
            submissionGuidelines: 'How to submit your work',
            dueDate: assignment?.dueDate || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0]
          };
        }

        function generateQuizContent(student, subject, topic, difficulty, history) {
          return {
            title: \`\${topic} Quiz\`,
            instructions: \`Answer all questions about \${topic}\`,
            questions: [
              {
                id: 1,
                type: 'multiple-choice',
                question: \`Question 1 about \${topic}\`,
                options: ['Option A', 'Option B', 'Option C', 'Option D'],
                difficulty: difficulty
              },
              {
                id: 2,
                type: 'short-answer',
                question: \`Question 2 about \${topic}\`,
                difficulty: difficulty
              },
              {
                id: 3,
                type: 'true-false',
                question: \`Question 3 about \${topic}\`,
                difficulty: difficulty
              }
            ],
            timeLimit: 15,
            passingScore: 70
          };
        }

        function generateExplanationContent(student, subject, topic, difficulty) {
          return {
            title: \`Understanding \${topic}\`,
            explanation: \`Detailed explanation of \${topic} concepts\`,
            keyPoints: [
              \`Key point 1 about \${topic}\`,
              \`Key point 2 about \${topic}\`,
              \`Key point 3 about \${topic}\`
            ],
            examples: [
              \`Real-world example 1 of \${topic}\`,
              \`Real-world example 2 of \${topic}\`
            ],
            commonMistakes: \`Common mistakes to avoid when learning \${topic}\`,
            practiceSteps: 'Steps to practice and master this topic'
          };
        }

        function generateGeneralContent(student, subject, topic, difficulty) {
          return {
            title: \`\${topic} - \${subject}\`,
            content: \`General educational content about \${topic}\`,
            gradeLevel: student.grade,
            difficulty: difficulty,
            curriculum: \`\${student.country} \${student.board}\`,
            learningObjectives: [\`Learn about \${topic}\`, 'Apply new knowledge', 'Build understanding']
          };
        }

        function calculateSessionDuration(sessionContent) {
          const subjects = Object.keys(sessionContent);
          return subjects.length * 30; // 30 minutes per subject
        }

        function generateAdaptationNotes(student, history) {
          const recentSessions = history.slice(0, 5);
          return {
            pace: student.learningPace,
            recentPerformance: recentSessions.length > 0 ? 'Available' : 'No recent data',
            adaptations: [
              'Content difficulty adjusted based on performance',
              'Learning pace considered in material selection',
              'Curriculum compliance maintained'
            ]
          };
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
