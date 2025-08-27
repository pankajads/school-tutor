import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cr from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { CoreResourcesStack } from "./core-resources-stack";

export interface AiServiceStackProps extends cdk.StackProps {
  coreResourcesStack: CoreResourcesStack;
}

export class AiServiceStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: AiServiceStackProps) {
    super(scope, id, props);

    const { coreResourcesStack } = props;

    // Create shared execution role for all Lambda functions
    const lambdaExecutionRole = new iam.Role(this, "LambdaExecutionRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole",
        ),
      ],
      inlinePolicies: {
        DynamoDBAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:Query",
                "dynamodb:Scan",
              ],
              resources: [
                coreResourcesStack.studentTable.tableArn,
                coreResourcesStack.progressTable.tableArn,
                `${coreResourcesStack.studentTable.tableArn}/index/*`,
                `${coreResourcesStack.progressTable.tableArn}/index/*`,
              ],
            }),
          ],
        }),
        BedrockAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream",
              ],
              resources: [
                "arn:aws:bedrock:*::foundation-model/*",
                "arn:aws:bedrock:*:*:inference-profile/*", // Add inference profile support
              ],
            }),
          ],
        }),
        S3Access: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
              resources: [`${coreResourcesStack.contentBucket.bucketArn}/*`],
            }),
          ],
        }),
      },
    });

    // 1. Curriculum AI Function
    const curriculumFunction = new lambda.Function(
      this,
      "CurriculumAiFunction",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset("lambda/curriculum"),
        environment: {
          STUDENT_TABLE: coreResourcesStack.studentTable.tableName,
          PROGRESS_TABLE: coreResourcesStack.progressTable.tableName,
          CONTENT_BUCKET: coreResourcesStack.contentBucket.bucketName,
        },
        timeout: cdk.Duration.minutes(2),
        memorySize: 1024,
        logRetention: logs.RetentionDays.ONE_WEEK,
        role: lambdaExecutionRole,
      },
    );

    // 2. Student Profile Function
    const studentFunction = new lambda.Function(this, "StudentFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/student-profile"),
      environment: {
        STUDENT_TABLE: coreResourcesStack.studentTable.tableName,
        PROGRESS_TABLE: coreResourcesStack.progressTable.tableName,
        // Will be set via CDK custom resource after API creation
      },
      timeout: cdk.Duration.minutes(1),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_WEEK,
      role: lambdaExecutionRole,
    });

    // 3. Learning Engine Function
    const learningFunction = new lambda.Function(this, "LearningFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/learning-engine"),
      environment: {
        STUDENT_TABLE: coreResourcesStack.studentTable.tableName,
        PROGRESS_TABLE: coreResourcesStack.progressTable.tableName,
        CONTENT_BUCKET: coreResourcesStack.contentBucket.bucketName,
      },
      timeout: cdk.Duration.minutes(3),
      memorySize: 1024,
      logRetention: logs.RetentionDays.ONE_WEEK,
      role: lambdaExecutionRole,
    });

    // 4. Progress Tracking Function
    const progressFunction = new lambda.Function(this, "ProgressFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/progress-tracking"),
      environment: {
        STUDENT_TABLE: coreResourcesStack.studentTable.tableName,
        PROGRESS_TABLE: coreResourcesStack.progressTable.tableName,
      },
      timeout: cdk.Duration.minutes(2),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_WEEK,
      role: lambdaExecutionRole,
    });

    // 5. Bedrock Agent Function
    const bedrockAgentFunction = new lambda.Function(
      this,
      "BedrockAgentFunction",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset("lambda/bedrock-agent"),
        environment: {
          STUDENT_TABLE: coreResourcesStack.studentTable.tableName,
          PROGRESS_TABLE: coreResourcesStack.progressTable.tableName,
        },
        timeout: cdk.Duration.minutes(2),
        memorySize: 1024,
        logRetention: logs.RetentionDays.ONE_WEEK,
        role: lambdaExecutionRole,
      },
    );

    // 6. AI Judge Function (dedicated AI evaluation using AWS Nova Micro)
    const aiJudgeFunction = new lambda.Function(this, "AiJudgeFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/ai-judge"),
      environment: {
        EVALUATION_TABLE: "school-tutor-evaluations",
        NOVA_MICRO_INFERENCE_PROFILE:
          "arn:aws:bedrock:ap-southeast-1:291412412747:inference-profile/apac.amazon.nova-micro-v1:0",
        AI_JUDGE_MODEL: "nova-micro",
      },
      timeout: cdk.Duration.minutes(3),
      memorySize: 1024,
      logRetention: logs.RetentionDays.ONE_WEEK,
      role: lambdaExecutionRole,
    });

    // 7. Evaluation API Function
    const evaluationApiFunction = new lambda.Function(
      this,
      "EvaluationApiFunction",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset("lambda/evaluation-api"),
        environment: {
          STUDENT_TABLE: coreResourcesStack.studentTable.tableName,
          PROGRESS_TABLE: coreResourcesStack.progressTable.tableName,
          EVALUATION_FUNCTION: "evaluation-function-placeholder", // Would reference evaluation function
          EVALUATION_TABLE: "evaluation-table-placeholder",
          METRICS_TABLE: "metrics-table-placeholder",
        },
        timeout: cdk.Duration.minutes(2),
        memorySize: 512,
        logRetention: logs.RetentionDays.ONE_WEEK,
        role: lambdaExecutionRole,
      },
    );

    // Create API Gateway
    this.api = new apigateway.RestApi(this, "SchoolTutorApi", {
      restApiName: "School Tutor AI API",
      description: "API for School Tutor AI application",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "X-Api-Key",
        ],
      },
    });

    // Create API integrations
    const curriculumIntegration = new apigateway.LambdaIntegration(
      curriculumFunction,
    );
    const studentIntegration = new apigateway.LambdaIntegration(
      studentFunction,
    );
    const learningIntegration = new apigateway.LambdaIntegration(
      learningFunction,
    );
    const progressIntegration = new apigateway.LambdaIntegration(
      progressFunction,
    );
    const bedrockAgentIntegration = new apigateway.LambdaIntegration(
      bedrockAgentFunction,
    );
    const aiJudgeIntegration = new apigateway.LambdaIntegration(
      aiJudgeFunction,
    );
    const evaluationApiIntegration = new apigateway.LambdaIntegration(
      evaluationApiFunction,
    );

    // Define API Gateway resources and methods

    // Curriculum routes
    const curriculumResource = this.api.root.addResource("curriculum");
    curriculumResource.addMethod("POST", curriculumIntegration); // Generate subjects

    const curriculumTopicsResource = curriculumResource.addResource("topics");
    curriculumTopicsResource.addMethod("POST", curriculumIntegration); // Generate topics for a subject

    const curriculumSubjectsResource =
      curriculumResource.addResource("subjects");
    curriculumSubjectsResource.addMethod("POST", curriculumIntegration); // Generate subjects list

    // Student routes
    const studentsResource = this.api.root.addResource("students");
    studentsResource.addMethod("GET", studentIntegration); // List students
    studentsResource.addMethod("POST", studentIntegration); // Create student

    const studentResource = studentsResource.addResource("{studentId}");
    studentResource.addMethod("GET", studentIntegration); // Get student
    studentResource.addMethod("PUT", studentIntegration); // Update student
    studentResource.addMethod("DELETE", studentIntegration); // Delete student

    // Add topics endpoints for students
    const studentTopicsResource = studentResource.addResource("topics");
    studentTopicsResource.addMethod("GET", studentIntegration); // Get student topics

    const studentTopicResource = studentTopicsResource.addResource("{topicId}");
    const studentTopicCompleteResource =
      studentTopicResource.addResource("complete");
    studentTopicCompleteResource.addMethod("PUT", studentIntegration); // Mark topic as completed

    // Add score endpoint for students
    const studentScoreResource = studentResource.addResource("score");
    studentScoreResource.addMethod("GET", studentIntegration); // Get student score

    const studentProfileResource = studentResource.addResource("profile");
    studentProfileResource.addMethod("GET", studentIntegration); // Get profile
    studentProfileResource.addMethod("PUT", studentIntegration); // Update profile

    // Learning routes
    const learningResource = this.api.root.addResource("learning");
    learningResource.addMethod("POST", learningIntegration); // Start learning session

    const learningSessionResource = learningResource.addResource("sessions");
    learningSessionResource.addMethod("GET", learningIntegration); // Get sessions
    learningSessionResource.addMethod("POST", learningIntegration); // Create session

    const sessionResource = learningSessionResource.addResource("{sessionId}");
    sessionResource.addMethod("GET", learningIntegration); // Get session
    sessionResource.addMethod("PUT", learningIntegration); // Update session

    const learningInteractResource = learningResource.addResource("interact");
    learningInteractResource.addMethod("POST", learningIntegration); // Learning interaction

    const learningRecommendationsResource =
      learningResource.addResource("recommendations");
    learningRecommendationsResource.addMethod("GET", learningIntegration); // Get recommendations

    const learningAssignmentsResource =
      learningResource.addResource("assignments");
    learningAssignmentsResource.addMethod("GET", learningIntegration); // Get assignments
    learningAssignmentsResource.addMethod("POST", learningIntegration); // Create assignment

    // Progress routes
    const progressResource = this.api.root.addResource("progress");
    progressResource.addMethod("GET", progressIntegration); // Get progress overview
    progressResource.addMethod("POST", progressIntegration); // Track progress

    const progressStudentResource = progressResource
      .addResource("student")
      .addResource("{studentId}");
    progressStudentResource.addMethod("GET", progressIntegration); // Get student progress

    const progressAnalyticsResource = progressResource.addResource("analytics");
    progressAnalyticsResource.addMethod("GET", progressIntegration); // Get analytics

    const progressMetricsResource = progressResource.addResource("metrics");
    progressMetricsResource.addMethod("GET", progressIntegration); // Get metrics

    const progressReportsResource = progressResource.addResource("reports");
    progressReportsResource.addMethod("GET", progressIntegration); // Get reports
    progressReportsResource.addMethod("POST", progressIntegration); // Generate report

    // AI routes (AI Tutor and AI Judge)
    const aiResource = this.api.root.addResource("ai");

    // AI Tutor routes
    const aiTutorResource = aiResource.addResource("tutor");
    aiTutorResource.addMethod("POST", bedrockAgentIntegration); // AI tutor chat

    // AI Judge routes - NEW: Dedicated AI evaluation endpoint
    const aiEvaluateResource = aiResource.addResource("evaluate");
    aiEvaluateResource.addMethod("POST", aiJudgeIntegration); // AI judge evaluation

    // Agent routes (alias for AI tutor)
    const agentResource = this.api.root.addResource("agent");
    agentResource.addMethod("POST", bedrockAgentIntegration); // General agent interaction

    const agentChatResource = agentResource.addResource("chat");
    agentChatResource.addMethod("POST", bedrockAgentIntegration); // Chat interaction

    // Bedrock Agent routes (legacy compatibility)
    const bedrockResource = this.api.root.addResource("bedrock");
    bedrockResource.addMethod("POST", bedrockAgentIntegration); // Bedrock agent interaction

    // Evaluation routes
    const evaluationsResource = this.api.root.addResource("evaluations");

    const evaluationTriggerResource =
      evaluationsResource.addResource("trigger");
    evaluationTriggerResource.addMethod("POST", evaluationApiIntegration); // Trigger evaluation

    const evaluationResultsResource =
      evaluationsResource.addResource("results");
    evaluationResultsResource.addMethod("GET", evaluationApiIntegration); // Get results

    const evaluationResultResource =
      evaluationResultsResource.addResource("{evaluationId}");
    evaluationResultResource.addMethod("GET", evaluationApiIntegration); // Get specific result

    const evaluationMetricsResource =
      evaluationsResource.addResource("metrics");
    evaluationMetricsResource.addMethod("GET", evaluationApiIntegration); // Get metrics

    const evaluationLiveResource = evaluationsResource.addResource("live");
    evaluationLiveResource.addMethod("POST", evaluationApiIntegration); // Live evaluation

    const evaluationBatchResource = evaluationsResource.addResource("batch");
    evaluationBatchResource.addMethod("POST", evaluationApiIntegration); // Batch evaluation

    const evaluationDashboardResource =
      evaluationsResource.addResource("dashboard");
    evaluationDashboardResource.addMethod("GET", evaluationApiIntegration); // Dashboard data

    // Output the API Gateway URL
    new cdk.CfnOutput(this, "ApiGatewayUrl", {
      value: this.api.url,
      description: "API Gateway URL",
      exportName: "SchoolTutorApiUrl",
    });

    // Use a custom resource to update the StudentFunction environment variable
    // after the API Gateway is created (breaks circular dependency)
    const updateEnvCustomResource = new cr.AwsCustomResource(
      this,
      "UpdateStudentFunctionEnv",
      {
        onCreate: {
          service: "Lambda",
          action: "updateFunctionConfiguration",
          parameters: {
            FunctionName: studentFunction.functionName,
            Environment: {
              Variables: {
                STUDENT_TABLE: coreResourcesStack.studentTable.tableName,
                PROGRESS_TABLE: coreResourcesStack.progressTable.tableName,
                CURRICULUM_API_URL: `${this.api.url}curriculum`,
              },
            },
          },
          physicalResourceId: cr.PhysicalResourceId.of(
            "student-function-env-update",
          ),
        },
        onUpdate: {
          service: "Lambda",
          action: "updateFunctionConfiguration",
          parameters: {
            FunctionName: studentFunction.functionName,
            Environment: {
              Variables: {
                STUDENT_TABLE: coreResourcesStack.studentTable.tableName,
                PROGRESS_TABLE: coreResourcesStack.progressTable.tableName,
                CURRICULUM_API_URL: `${this.api.url}curriculum`,
              },
            },
          },
          physicalResourceId: cr.PhysicalResourceId.of(
            "student-function-env-update",
          ),
        },
        policy: cr.AwsCustomResourcePolicy.fromStatements([
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["lambda:UpdateFunctionConfiguration"],
            resources: [studentFunction.functionArn],
          }),
        ]),
      },
    );

    // Ensure the custom resource runs after API Gateway is created
    updateEnvCustomResource.node.addDependency(this.api);

    // Output Lambda function names
    new cdk.CfnOutput(this, "CurriculumFunctionName", {
      value: curriculumFunction.functionName,
      description: "Curriculum AI Function Name",
    });

    new cdk.CfnOutput(this, "StudentFunctionName", {
      value: studentFunction.functionName,
      description: "Student Function Name",
    });

    new cdk.CfnOutput(this, "LearningFunctionName", {
      value: learningFunction.functionName,
      description: "Learning Engine Function Name",
    });

    new cdk.CfnOutput(this, "ProgressFunctionName", {
      value: progressFunction.functionName,
      description: "Progress Tracking Function Name",
    });

    new cdk.CfnOutput(this, "BedrockAgentFunctionName", {
      value: bedrockAgentFunction.functionName,
      description: "Bedrock Agent Function Name",
    });

    new cdk.CfnOutput(this, "AiJudgeFunctionName", {
      value: aiJudgeFunction.functionName,
      description: "AI Judge Function Name",
    });

    new cdk.CfnOutput(this, "EvaluationApiFunctionName", {
      value: evaluationApiFunction.functionName,
      description: "Evaluation API Function Name",
    });
  }
}
