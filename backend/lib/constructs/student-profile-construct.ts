/**
 * Student Profile Construct - AWS CDK Component
 * 
 * This file creates a complete AWS infrastructure component for managing student profiles.
 * It demonstrates several important software engineering concepts that every developer
 * should understand.
 * 
 * Key Concepts for New Developers:
 * 
 * 1. Infrastructure as Code (IaC):
 *    - We define cloud infrastructure using code instead of clicking in AWS console
 *    - Benefits: Version control, reproducibility, automation, collaboration
 * 
 * 2. AWS CDK Construct Pattern:
 *    - A "construct" is a reusable component that creates related AWS resources
 *    - Like a "blueprint" that can be used to create similar infrastructure
 *    - Encapsulates complexity and promotes code reuse
 * 
 * 3. Serverless Architecture:
 *    - Lambda functions: Code that runs without managing servers
 *    - DynamoDB: Managed NoSQL database
 *    - API Gateway: Managed HTTP API endpoints
 * 
 * 4. Single Responsibility Principle:
 *    - This construct only handles student profile operations
 *    - Each Lambda function has one clear purpose
 *    - Makes code easier to understand, test, and maintain
 * 
 * What This Construct Creates:
 * - Lambda function for student CRUD operations
 * - API Gateway integration for HTTP endpoints
 * - IAM permissions for secure database access
 * - CloudWatch logs for monitoring and debugging
 * 
 * @author School Tutor Development Team
 * @since 1.0.0
 */

import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

/**
 * Configuration Properties for Student Profile Construct
 * 
 * TypeScript interfaces define the "contract" for what data this construct needs.
 * This is like a checklist of required inputs when creating this component.
 * 
 * Why use interfaces?
 * - Type safety: Prevents runtime errors by catching mistakes at compile time
 * - Documentation: Self-documenting code that shows what's expected
 * - IDE support: Better autocomplete and error detection
 */
export interface StudentProfileConstructProps {
  /** DynamoDB table for storing student data */
  readonly studentTable: dynamodb.Table;
  
  /** Maximum number of students the system can support (business rule) */
  readonly maxStudents: number;
}

/**
 * Student Profile Construct Class
 * 
 * This class creates all the AWS resources needed for student profile management.
 * It follows the AWS CDK pattern of extending the base "Construct" class.
 * 
 * Public Properties (what other parts of the system can access):
 * - handler: The Lambda function for processing requests
 * - integration: API Gateway connection to the Lambda function
 * 
 * Why make these public?
 * - Other constructs need to reference these resources
 * - Enables integration between different parts of the system
 */
export class StudentProfileConstruct extends Construct {
  /** Lambda function that handles all student profile operations */
  public readonly handler: lambda.Function;
  
  /** API Gateway integration that connects HTTP requests to the Lambda function */
  public readonly integration: apigateway.LambdaIntegration;

  /**
   * Constructor - Creates the Student Profile Infrastructure
   * 
   * This is where we define what AWS resources to create and how they connect.
   * 
   * @param scope - Parent construct (usually the main stack)
   * @param id - Unique identifier for this construct
   * @param props - Configuration properties (defined above)
   */
  constructor(scope: Construct, id: string, props: StudentProfileConstructProps) {
    super(scope, id);

    /**
     * Lambda Function for Student Profile Management
     * 
     * AWS Lambda is a "serverless" compute service - you upload code and AWS
     * runs it without you managing servers. You only pay for actual usage.
     * 
     * This Lambda function handles all student profile operations:
     * - CREATE: Add new students to the system
     * - READ: Get student information (individual or list)
     * - UPDATE: Modify existing student profiles
     * - DELETE: Remove students from the system
     * 
     * Why put everything in one function?
     * - Related operations grouped together
     * - Shared code and database connections
     * - Simpler infrastructure management
     * 
     * Lambda Configuration Explained:
     * - Runtime: Node.js 18.x (JavaScript environment)
     * - Handler: Entry point function name
     * - Code: The actual business logic (embedded inline for simplicity)
     * - Environment variables: Configuration passed to the function
     */
    this.handler = new lambda.Function(this, 'StudentProfileHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,          // JavaScript runtime version
      handler: 'index.handler',                     // Function entry point: exports.handler
      
      /**
       * Lambda Function Code
       * 
       * For production systems, this code would typically be in separate files.
       * We're using inline code here for simplicity and to keep everything
       * visible in one place for learning purposes.
       * 
       * The code implements a complete REST API for student management:
       * - HTTP method routing (GET, POST, PUT, DELETE)
       * - Request/response handling
       * - Database operations
       * - Error handling
       * - Business logic validation
       */
      code: lambda.Code.fromInline(`
        /**
         * Student Profile Lambda Function
         * 
         * This is the actual business logic that runs when API calls are made.
         * It's written in JavaScript and uses AWS SDK to interact with DynamoDB.
         * 
         * Key Libraries Used:
         * - @aws-sdk/client-dynamodb: AWS SDK for database operations
         * - @aws-sdk/lib-dynamodb: Higher-level DynamoDB operations
         * - uuid: Generate unique identifiers for students
         * 
         * Architecture Pattern: REST API Handler
         * - Single function handles multiple HTTP methods
         * - Routes requests to appropriate business logic functions
         * - Returns standardized HTTP responses
         */
        
        // Import AWS SDK components for database operations
        const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, UpdateCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
        const crypto = require('crypto');   // For generating unique student IDs

        // Initialize AWS DynamoDB client
        // This creates a connection to the DynamoDB service
        const ddbClient = new DynamoDBClient({});
        const docClient = DynamoDBDocumentClient.from(ddbClient);

        // Environment variables (configuration passed from CDK)
        const STUDENT_TABLE = process.env.STUDENT_TABLE;    // Table name
        const MAX_STUDENTS = parseInt(process.env.MAX_STUDENTS || '5');  // Business limit

        /**
         * Main Lambda Handler Function
         * 
         * This is the entry point that AWS Lambda calls when an HTTP request comes in.
         * It receives an "event" object containing all the request details.
         * 
         * Event Structure:
         * - httpMethod: GET, POST, PUT, DELETE
         * - pathParameters: URL parameters like {studentId}
         * - body: Request payload (JSON)
         * - queryStringParameters: URL query parameters
         * 
         * @param {Object} event - AWS Lambda event object with request details
         * @returns {Object} HTTP response object with status code and body
         */
        exports.handler = async (event) => {
          // Log the incoming request for debugging
          // In production, be careful not to log sensitive information
          console.log('Event:', JSON.stringify(event, null, 2));
          
          try {
            // Extract request components from the event
            const { httpMethod, pathParameters, body, queryStringParameters } = event;
            
            // Parse JSON body if present (for POST/PUT requests)
            const requestBody = body ? JSON.parse(body) : {};

            /**
             * HTTP Method Routing
             * 
             * This switch statement implements REST API conventions:
             * - GET: Retrieve data (read operations)
             * - POST: Create new resources
             * - PUT: Update existing resources
             * - DELETE: Remove resources
             * 
             * URL patterns:
             * - GET /students -> list all students
             * - GET /students/{id} -> get specific student
             * - POST /students -> create new student
             * - PUT /students/{id} -> update student
             * - DELETE /students/{id} -> delete student
             */
            switch (httpMethod) {
              case 'GET':
                // Check if this is a request for a specific student or a list
                if (pathParameters && pathParameters.studentId) {
                  return await getStudent(pathParameters.studentId);
                } else {
                  return await listStudents(queryStringParameters);
                }
                
              case 'POST':
                return await createStudent(requestBody);
              case 'PUT':
                return await updateStudent(pathParameters.studentId, requestBody);
              case 'DELETE':
                return await deleteStudent(pathParameters.studentId);
              default:
                return createResponse(405, { error: 'Method not allowed' });
            }
          } catch (error) {
            console.error('Error:', error);
            return createResponse(500, { error: 'Internal server error', details: error.message });
          }
        };

        async function createStudent(studentData) {
          // Check student limit
          const activeStudentsCount = await getActiveStudentsCount();
          if (activeStudentsCount >= MAX_STUDENTS) {
            return createResponse(400, { 
              error: 'Maximum student limit reached', 
              maxStudents: MAX_STUDENTS,
              currentCount: activeStudentsCount 
            });
          }

          // Check if student with same name already exists
          const existingStudent = await getStudentByName(studentData.name);
          if (existingStudent) {
            return createResponse(400, { 
              error: 'Student with this name already exists',
              existingStudentId: existingStudent.studentId 
            });
          }

          const studentId = crypto.randomUUID();
          const timestamp = new Date().toISOString();
          
          const student = {
            studentId,
            profileVersion: 'v1',
            studentName: studentData.name,
            grade: studentData.grade,
            country: studentData.country,
            board: studentData.board,
            school: studentData.school,
            subjects: studentData.subjects || [],
            learningPace: studentData.learningPace || 'medium',
            knowledgeLevel: studentData.knowledgeLevel || {},
            preferences: studentData.preferences || {},
            isActive: 'true',
            createdAt: timestamp,
            updatedAt: timestamp,
            lastInteraction: timestamp,
            profileCompleteness: calculateProfileCompleteness(studentData)
          };

          await docClient.send(new PutCommand({
            TableName: STUDENT_TABLE,
            Item: student
          }));

          return createResponse(201, { 
            message: 'Student created successfully', 
            student,
            remainingSlots: MAX_STUDENTS - activeStudentsCount - 1
          });
        }

        async function getStudent(studentId) {
          const result = await docClient.send(new GetCommand({
            TableName: STUDENT_TABLE,
            Key: { studentId, profileVersion: 'v1' }
          }));

          if (!result.Item) {
            return createResponse(404, { error: 'Student not found' });
          }

          return createResponse(200, { student: result.Item });
        }

        async function listStudents(queryParams) {
          const params = {
            TableName: STUDENT_TABLE,
            FilterExpression: 'profileVersion = :version',
            ExpressionAttributeValues: {
              ':version': 'v1'
            }
          };

          if (queryParams && queryParams.active === 'true') {
            params.FilterExpression += ' AND isActive = :active';
            params.ExpressionAttributeValues[':active'] = 'true';
          }

          const result = await docClient.send(new ScanCommand(params));
          
          return createResponse(200, { 
            students: result.Items || [],
            count: result.Items ? result.Items.length : 0,
            maxStudents: MAX_STUDENTS
          });
        }

        async function updateStudent(studentId, updateData) {
          const timestamp = new Date().toISOString();
          
          const updateExpression = [];
          const expressionAttributeValues = {};
          const expressionAttributeNames = {};
          
          Object.keys(updateData).forEach(key => {
            if (key !== 'studentId' && key !== 'profileVersion') {
              updateExpression.push(\`#\${key} = :\${key}\`);
              expressionAttributeNames[\`#\${key}\`] = key;
              expressionAttributeValues[\`:\${key}\`] = updateData[key];
            }
          });
          
          updateExpression.push('#updatedAt = :updatedAt');
          expressionAttributeNames['#updatedAt'] = 'updatedAt';
          expressionAttributeValues[':updatedAt'] = timestamp;

          if (updateData.name && updateData.name !== '') {
            updateExpression.push('#lastInteraction = :lastInteraction');
            expressionAttributeNames['#lastInteraction'] = 'lastInteraction';
            expressionAttributeValues[':lastInteraction'] = timestamp;
          }

          await docClient.send(new UpdateCommand({
            TableName: STUDENT_TABLE,
            Key: { studentId, profileVersion: 'v1' },
            UpdateExpression: \`SET \${updateExpression.join(', ')}\`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues
          }));

          return createResponse(200, { message: 'Student updated successfully' });
        }

        async function deleteStudent(studentId) {
          await docClient.send(new DeleteCommand({
            TableName: STUDENT_TABLE,
            Key: { studentId, profileVersion: 'v1' }
          }));

          return createResponse(200, { message: 'Student deleted successfully' });
        }

        async function getStudentByName(name) {
          const result = await docClient.send(new QueryCommand({
            TableName: STUDENT_TABLE,
            IndexName: 'StudentNameIndex',
            KeyConditionExpression: 'studentName = :name',
            ExpressionAttributeValues: {
              ':name': name
            },
            Limit: 1
          }));

          return result.Items && result.Items.length > 0 ? result.Items[0] : null;
        }

        async function getActiveStudentsCount() {
          const result = await docClient.send(new QueryCommand({
            TableName: STUDENT_TABLE,
            IndexName: 'ActiveStudentsIndex',
            KeyConditionExpression: 'isActive = :active',
            ExpressionAttributeValues: {
              ':active': 'true'
            },
            Select: 'COUNT'
          }));

          return result.Count || 0;
        }

        function calculateProfileCompleteness(studentData) {
          const requiredFields = ['name', 'grade', 'country', 'board', 'school'];
          const completedFields = requiredFields.filter(field => studentData[field] && studentData[field] !== '');
          return (completedFields.length / requiredFields.length) * 100;
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
        MAX_STUDENTS: props.maxStudents.toString(),
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
      role: new iam.Role(this, 'StudentProfileRole', {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        ],
        inlinePolicies: {
          DynamoDBAccess: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                  'dynamodb:GetItem',
                  'dynamodb:PutItem',
                  'dynamodb:UpdateItem',
                  'dynamodb:DeleteItem',
                  'dynamodb:Query',
                  'dynamodb:Scan',
                ],
                resources: [
                  props.studentTable.tableArn,
                  `${props.studentTable.tableArn}/index/*`,
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
