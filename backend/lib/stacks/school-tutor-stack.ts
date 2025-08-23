/**
 * School Tutor Stack - Main Infrastructure Stack
 * 
 * This is the primary AWS CDK stack that creates all the core infrastructure
 * for the School Tutor Agent system. Think of this as the "blueprint" that
 * tells AWS what resources to create and how they should be connected.
 * 
 * Key Concepts for New Developers:
 * - CDK Stack: A collection of AWS resources that are deployed together
 * - Construct: A reusable component that creates one or more AWS resources
 * - Props: Configuration parameters passed to constructs (like function parameters)
 * 
 * Architecture Overview:
 * 1. Storage Layer: DynamoDB tables + S3 bucket for data persistence
 * 2. Compute Layer: Lambda functions for business logic
 * 3. API Layer: API Gateway for HTTP endpoints
 * 4. AI Layer: Bedrock integration for AI tutoring capabilities
 * 
 * @author Pankaj Negi
 * @since 1.0.0
 */

import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { BedrockAgentConstruct } from '../constructs/bedrock-agent-construct';
import { StudentProfileConstruct } from '../constructs/student-profile-construct';
import { LearningEngineConstruct } from '../constructs/learning-engine-construct';
import { ProgressTrackingConstruct } from '../constructs/progress-tracking-construct';

/**
 * Configuration Properties for the School Tutor Stack
 * 
 * This interface defines what configuration options can be passed
 * when creating the stack. Think of it as the "settings" for our system.
 */
export interface SchoolTutorStackProps extends cdk.StackProps {
  /** 
   * Maximum number of students the system can support
   * Default: 5 (can be increased based on needs and AWS limits)
   * This helps control costs and ensures system performance
   */
  readonly maxStudents?: number;
}

/**
 * Main School Tutor Stack Class
 * 
 * This class creates all the AWS resources needed for the tutoring system.
 * It's like the "master constructor" that builds our entire application
 * infrastructure in the cloud.
 * 
 * Key AWS Services Used:
 * - DynamoDB: NoSQL database for storing student and progress data
 * - S3: Object storage for educational content and files
 * - Lambda: Serverless functions for business logic
 * - API Gateway: HTTP API endpoints for client applications
 * - Bedrock: AWS's AI service for natural language processing
 */
export class SchoolTutorStack extends cdk.Stack {
  // Public properties - these can be accessed by other stacks or external code
  
  /** API Gateway instance - the main entry point for HTTP requests */
  public readonly api: apigateway.RestApi;
  
  /** DynamoDB table storing student profiles and information */
  public readonly studentTable: dynamodb.Table;
  
  /** DynamoDB table storing learning progress and analytics */
  public readonly progressTable: dynamodb.Table;
  
  /** S3 bucket for storing educational content, images, documents */
  public readonly contentBucket: s3.Bucket;
  
  /** Bedrock AI agent for intelligent tutoring interactions */
  public readonly bedrockAgent: BedrockAgentConstruct;
  
  /** Student profile management service */
  public readonly studentProfile: StudentProfileConstruct;
  
  /** Learning content generation and management service */
  public readonly learningEngine: LearningEngineConstruct;
  
  /** Progress tracking and analytics service */
  public readonly progressTracking: ProgressTrackingConstruct;

  /**
   * Constructor - This is called when the stack is created
   * 
   * @param scope - The parent construct (usually the CDK App)
   * @param id - Unique identifier for this stack
   * @param props - Configuration options (optional)
   */
  constructor(scope: Construct, id: string, props: SchoolTutorStackProps = {}) {
    super(scope, id, props);

    // Set default value for maxStudents if not provided
    // This is a common pattern in software - provide sensible defaults
    const maxStudents = props.maxStudents || 5;

    // =====================================================
    // STORAGE LAYER - Where we store our data
    // =====================================================

    /**
     * S3 Bucket for Content Storage
     * 
     * Think of S3 as a huge filing cabinet in the cloud where we can store
     * any type of file (images, PDFs, videos, etc.). Each file gets a unique
     * "address" (key) so we can find it later.
     * 
     * Security Features:
     * - Versioned: Keeps old versions of files when updated
     * - Encrypted: All data is encrypted for security
     * - Block Public Access: Prevents accidental public exposure
     */
    this.contentBucket = new s3.Bucket(this, 'ContentBucket', {
      // Unique bucket name across all of AWS (required by S3)
      bucketName: `school-tutor-content-${this.account}-${this.region}`,
      
      // Keep old versions when files are updated (useful for rollbacks)
      versioned: true,
      
      // Encrypt all data stored in the bucket
      encryption: s3.BucketEncryption.S3_MANAGED,
      
      // Security: Block all public access to prevent data leaks
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      
      // Don't delete the bucket when stack is deleted (data safety)
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      
      // Automatically delete old files to save storage costs
      lifecycleRules: [
        {
          id: 'content-lifecycle',
          expiration: cdk.Duration.days(365),        // Delete files after 1 year
          noncurrentVersionExpiration: cdk.Duration.days(30), // Delete old versions after 30 days
        },
      ],
    });

    /**
     * DynamoDB Table for Student Profiles
     * 
     * DynamoDB is AWS's NoSQL database - think of it like a super-fast
     * spreadsheet that can handle millions of rows. Unlike traditional
     * databases, it doesn't use SQL but is much faster for simple operations.
     * 
     * Table Structure:
     * - Partition Key: studentId (groups related data together)
     * - Sort Key: profileVersion (allows multiple versions of same student)
     * 
     * Why this design?
     * - Fast lookups by student ID
     * - Can store profile history (useful for analytics)
     * - Scales automatically as we add more students
     */
    this.studentTable = new dynamodb.Table(this, 'StudentTable', {
      tableName: 'school-tutor-students',
      
      // Primary key structure (partition + sort key)
      partitionKey: { name: 'studentId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'profileVersion', type: dynamodb.AttributeType.STRING },
      
      // Pay-per-request: only pay for actual database operations
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      
      // Encrypt all data at rest for student privacy
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      
      // Enable point-in-time recovery (backup feature)
      pointInTimeRecovery: true,
      
      // Enable streams to trigger other services when data changes
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      
      // Keep table even if stack is deleted (data safety)
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    /**
     * Global Secondary Index (GSI) for Student Name Lookups
     * 
     * GSIs are like creating additional "views" of your data with different
     * sort orders. This one lets us quickly find students by name instead
     * of just by ID.
     * 
     * Use case: "Find all students named John" or search functionality
     */
    this.studentTable.addGlobalSecondaryIndex({
      indexName: 'StudentNameIndex',
      partitionKey: { name: 'studentName', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL, // Include all attributes
    });

    /**
     * GSI for Active Students Count
     * 
     * This index helps us quickly count how many active students we have
     * without scanning the entire table (which would be slow and expensive).
     * 
     * Use case: Enforce maxStudents limit efficiently
     */
    this.studentTable.addGlobalSecondaryIndex({
      indexName: 'ActiveStudentsIndex',
      partitionKey: { name: 'isActive', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY, // Only need counts
    });

    /**
     * DynamoDB Table for Progress Tracking
     * 
     * This table stores all learning progress data - completed lessons,
     * quiz scores, time spent learning, etc. It's designed for time-series
     * data (events that happen over time).
     * 
     * Table Structure:
     * - Partition Key: studentId (group all progress for one student)
     * - Sort Key: timestamp (order events chronologically)
     * 
     * Why this design?
     * - Easy to get all progress for a student
     * - Natural time ordering for analytics
     * - Efficient range queries (e.g., "progress in last week")
     */
    this.progressTable = new dynamodb.Table(this, 'ProgressTable', {
      tableName: 'school-tutor-progress',
      
      // Primary key for time-series data
      partitionKey: { name: 'studentId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      
      // Pay-per-request billing
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      
      // Encrypt progress data for privacy
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      
      // Enable point-in-time recovery
      pointInTimeRecovery: true,
      
      // Auto-delete old progress data to save costs
      timeToLiveAttribute: 'ttl',
      
      // Keep table when stack is deleted
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    /**
     * GSI for Subject-based Progress Queries
     * 
     * This index allows efficient queries like "show math progress for
     * student X in the last month" without scanning all progress data.
     * 
     * Use case: Subject-specific analytics and reporting
     */
    this.progressTable.addGlobalSecondaryIndex({
      indexName: 'SubjectProgressIndex',
      partitionKey: { name: 'studentId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'subjectDate', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // =====================================================
    // BUSINESS LOGIC LAYER - Our application services
    // =====================================================

    /**
     * Student Profile Management Service
     * 
     * This construct (custom component) handles all student-related operations:
     * - Creating new student profiles
     * - Updating student information
     * - Validating student limits
     * - Managing student lifecycle
     * 
     * It's like having a dedicated "student registration office" in our system.
     */
    this.studentProfile = new StudentProfileConstruct(this, 'StudentProfile', {
      studentTable: this.studentTable,
      maxStudents,
    });

    /**
     * Learning Engine Service
     * 
     * This is the "brain" of our tutoring system. It handles:
     * - Generating personalized learning content
     * - Adapting content to student level and progress
     * - Managing learning sessions
     * - Integrating with AI models for content creation
     * 
     * Think of it as the "AI teacher" that creates lessons for each student.
     */
    this.learningEngine = new LearningEngineConstruct(this, 'LearningEngine', {
      studentTable: this.studentTable,
      progressTable: this.progressTable,
      contentBucket: this.contentBucket,
    });

    /**
     * Progress Tracking Service
     * 
     * This service monitors and analyzes student learning progress:
     * - Recording completed activities
     * - Calculating learning analytics
     * - Generating progress reports
     * - Identifying learning patterns
     * 
     * It's like having a "progress monitoring system" that tracks how
     * well each student is doing.
     */
    this.progressTracking = new ProgressTrackingConstruct(this, 'ProgressTracking', {
      studentTable: this.studentTable,
      progressTable: this.progressTable,
    });

    /**
     * Bedrock Agent for AI Tutoring
     * 
     * This integrates with AWS Bedrock (Amazon's AI service) to provide
     * intelligent tutoring capabilities:
     * - Natural language conversations with students
     * - Answering questions about lessons
     * - Providing hints and explanations
     * - Adapting teaching style to student needs
     * 
     * Think of it as the "AI tutor" that can chat with students and help
     * them learn in a conversational way.
     */
    this.bedrockAgent = new BedrockAgentConstruct(this, 'BedrockAgent', {
      studentTable: this.studentTable,
      progressTable: this.progressTable,
      contentBucket: this.contentBucket,
      learningEngine: this.learningEngine,
    });

    // =====================================================
    // API LAYER - How external applications talk to our system
    // =====================================================

    /**
     * API Gateway - The Front Door to Our System
     * 
     * API Gateway is like the "reception desk" of our application. All
     * requests from web apps, mobile apps, or CLI tools come through here.
     * It handles:
     * - Routing requests to the right service
     * - Authentication and security
     * - Rate limiting to prevent abuse
     * - Request/response transformation
     * - Monitoring and logging
     * 
     * Configuration Explained:
     * - CORS: Allows web browsers to call our API from different domains
     * - Throttling: Prevents any single user from overwhelming our system
     * - Logging: Records all API calls for debugging and monitoring
     */
    this.api = new apigateway.RestApi(this, 'SchoolTutorApi', {
      restApiName: 'School Tutor Agent API',
      description: 'API for School Tutor Agent with student management and AI tutoring',
      
      // CORS configuration for web browser compatibility
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
      
      // Deploy to specific AWS region (not global)
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL],
      },
      
      // Enable CloudWatch integration for monitoring
      cloudWatchRole: true,
      
      // Deployment and throttling settings
      deployOptions: {
        stageName: 'v1',                    // API version
        throttlingRateLimit: 100,           // Max requests per second
        throttlingBurstLimit: 200,          // Max burst requests
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,             // Log request/response data
        metricsEnabled: true,               // Enable CloudWatch metrics
      },
    });

    // Set up all the API endpoints (routes)
    this.setupApiResources();

    // =====================================================
    // SECURITY LAYER - Permissions and access control
    // =====================================================

    /**
     * IAM Role for Bedrock Access
     * 
     * IAM (Identity and Access Management) controls what AWS services
     * can do what. This role gives our Lambda functions permission to
     * use Bedrock AI services.
     * 
     * Security Principle: "Least Privilege" - only give the minimum
     * permissions needed for the job.
     */
    const bedrockExecutionRole = new iam.Role(this, 'BedrockExecutionRole', {
      // Lambda functions can "assume" (use) this role
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      
      // Basic Lambda permissions (logging, etc.)
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      
      // Custom permissions for Bedrock AI services
      inlinePolicies: {
        BedrockAccess: new iam.PolicyDocument({
          statements: [
            // Permissions to call Bedrock AI models
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock:InvokeModel',              // Call AI models
                'bedrock:InvokeModelWithResponseStream', // Streaming responses
                'bedrock:GetFoundationModel',       // Get model info
                'bedrock:ListFoundationModels',     // List available models
              ],
              resources: ['*'], // All Bedrock resources
            }),
            // Permissions to manage Bedrock agents
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock:CreateAgent',              // Create AI agents
                'bedrock:GetAgent',                 // Get agent details
                'bedrock:UpdateAgent',              // Update agent config
                'bedrock:DeleteAgent',              // Remove agents
                'bedrock:InvokeAgent',              // Interact with agents
              ],
              resources: ['*'], // All Bedrock agent resources
            }),
          ],
        }),
      },
    });

    // =====================================================
    // PERMISSIONS - Connect services securely
    // =====================================================

    /**
     * Grant Database Permissions
     * 
     * Each service needs permission to read/write only the data it needs.
     * This follows the security principle of "least privilege access."
     */
    // Student service can read/write student data
    this.studentTable.grantReadWriteData(this.studentProfile.handler);
    this.studentTable.grantReadWriteData(this.learningEngine.handler);
    this.studentTable.grantReadWriteData(this.progressTracking.handler);
    
    // Progress tracking services can read/write progress data
    this.progressTable.grantReadWriteData(this.learningEngine.handler);
    this.progressTable.grantReadWriteData(this.progressTracking.handler);
    
    // Learning engine can read/write content files
    this.contentBucket.grantReadWrite(this.learningEngine.handler);

    // =====================================================
    // MONITORING - Keep track of system health
    // =====================================================

    /**
     * CloudWatch Log Groups
     * 
     * CloudWatch is AWS's monitoring service. Log groups collect all
     * the log messages from our API Gateway so we can debug issues
     * and monitor system performance.
     */
    new logs.LogGroup(this, 'ApiGatewayLogGroup', {
      logGroupName: `/aws/apigateway/school-tutor-${this.stackName}`,
      retention: logs.RetentionDays.ONE_MONTH, // Keep logs for 30 days
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Delete when stack is deleted
    });

    // =====================================================
    // OUTPUTS - Important information after deployment
    // =====================================================

    /**
     * Stack Outputs
     * 
     * These are like "return values" from our stack deployment.
     * After AWS creates all our resources, it will show us these
     * important values that we need to use our system.
     */
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.url,
      description: 'School Tutor API Gateway endpoint',
    });

    new cdk.CfnOutput(this, 'StudentTableName', {
      value: this.studentTable.tableName,
      description: 'DynamoDB table for student profiles',
    });

    new cdk.CfnOutput(this, 'ProgressTableName', {
      value: this.progressTable.tableName,
      description: 'DynamoDB table for progress tracking',
    });

    new cdk.CfnOutput(this, 'ContentBucketName', {
      value: this.contentBucket.bucketName,
      description: 'S3 bucket for content storage',
    });

    new cdk.CfnOutput(this, 'MaxStudentsLimit', {
      value: maxStudents.toString(),
      description: 'Maximum number of students supported',
    });
  }

  /**
   * Set Up API Resources and Routes
   * 
   * This method creates all the HTTP endpoints (URLs) that clients can call.
   * Think of it like creating a "menu" of available operations.
   * 
   * REST API Design Pattern:
   * - Resources represent "things" (students, learning, progress)
   * - HTTP methods represent "actions" (GET=read, POST=create, PUT=update, DELETE=remove)
   * - URL structure is hierarchical and intuitive
   * 
   * Example URLs created:
   * - GET /students - List all students
   * - POST /students - Create a new student
   * - GET /students/{id} - Get specific student details
   * - POST /learning/session - Start a learning session
   * - GET /progress - Get progress data
   */
  private setupApiResources(): void {
    /**
     * Standard Method Response Configuration
     * 
     * API Gateway requires method responses to be defined for each HTTP status code
     * that the integration might return. This configuration matches what our
     * Lambda functions return and enables proper CORS headers.
     */
    const methodResponses: apigateway.MethodResponse[] = [
      {
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': false,
        },
      },
      {
        statusCode: '201',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': false,
        },
      },
      {
        statusCode: '400',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': false,
        },
      },
      {
        statusCode: '404',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': false,
        },
      },
      {
        statusCode: '500',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': false,
        },
      },
    ];

    // =====================================================
    // STUDENTS API ENDPOINTS
    // =====================================================
    
    /**
     * Students Resource: /students
     * Handles all student-related operations
     */
    const studentsResource = this.api.root.addResource('students');
    studentsResource.addMethod('GET', this.studentProfile.integration, {
      methodResponses,
    });   // List all students
    studentsResource.addMethod('POST', this.studentProfile.integration, {
      methodResponses,
    });  // Create new student

    /**
     * Individual Student Resource: /students/{studentId}
     * Handles operations on specific students
     */
    const studentResource = studentsResource.addResource('{studentId}');
    studentResource.addMethod('GET', this.studentProfile.integration, {
      methodResponses,
    });    // Get student details
    studentResource.addMethod('PUT', this.studentProfile.integration, {
      methodResponses,
    });    // Update student info
    studentResource.addMethod('DELETE', this.studentProfile.integration, {
      methodResponses,
    }); // Delete student

    // =====================================================
    // LEARNING API ENDPOINTS
    // =====================================================
    
    /**
     * Learning Resource: /learning
     * Handles all learning-related operations
     */
    const learningResource = this.api.root.addResource('learning');
    
    /**
     * Learning Session Resource: /learning/session
     * Manages learning sessions (start/stop learning activities)
     */
    const sessionResource = learningResource.addResource('session');
    sessionResource.addMethod('POST', this.learningEngine.integration, {
      methodResponses,
    });   // Start new learning session

    /**
     * Content Resource: /learning/content
     * Handles educational content generation and retrieval
     */
    const contentResource = learningResource.addResource('content');
    contentResource.addMethod('GET', this.learningEngine.integration, {
      methodResponses,
    });    // Get existing content
    contentResource.addMethod('POST', this.learningEngine.integration, {
      methodResponses,
    });   // Generate new content

    // =====================================================
    // PROGRESS API ENDPOINTS
    // =====================================================
    
    /**
     * Progress Resource: /progress
     * Handles progress tracking and updates
     */
    const progressResource = this.api.root.addResource('progress');
    progressResource.addMethod('GET', this.progressTracking.integration, {
      methodResponses,
    });  // Get progress data
    progressResource.addMethod('POST', this.progressTracking.integration, {
      methodResponses,
    }); // Update progress

    /**
     * Analytics Resource: /progress/analytics
     * Provides detailed analytics and insights
     */
    const analyticsResource = progressResource.addResource('analytics');
    analyticsResource.addMethod('GET', this.progressTracking.integration, {
      methodResponses,
    }); // Get analytics data

    // =====================================================
    // AI AGENT API ENDPOINTS
    // =====================================================
    
    /**
     * Bedrock Agent Resource: /agent
     * Handles AI agent interactions
     */
    const agentResource = this.api.root.addResource('agent');
    agentResource.addMethod('POST', this.bedrockAgent.integration, {
      methodResponses,
    });        // General agent interaction

    /**
     * Chat Resource: /agent/chat
     * Handles conversational AI interactions
     */
    const chatResource = agentResource.addResource('chat');
    chatResource.addMethod('POST', this.bedrockAgent.integration, {
      methodResponses,
    });         // Chat with AI tutor
  }
}
