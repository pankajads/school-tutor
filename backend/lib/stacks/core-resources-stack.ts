/**
 * Core Resources Stack - Just database and S3
 *
 * This stack contains only the core resources without API Gateway
 * to avoid circular dependency issues.
 */

import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface CoreResourcesStackProps extends cdk.StackProps {
  readonly maxStudents?: number;
}

export class CoreResourcesStack extends cdk.Stack {
  public readonly studentTable: dynamodb.Table;
  public readonly progressTable: dynamodb.Table;
  public readonly contentBucket: s3.Bucket;

  constructor(
    scope: Construct,
    id: string,
    props: CoreResourcesStackProps = {},
  ) {
    super(scope, id, props);

    // S3 Bucket
    this.contentBucket = new s3.Bucket(this, "ContentBucket", {
      bucketName: `school-tutor-content-${this.account}-${this.region}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Student Table
    this.studentTable = new dynamodb.Table(this, "StudentTable", {
      tableName: "school-tutor-students",
      partitionKey: { name: "studentId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "profileVersion", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Progress Table
    this.progressTable = new dynamodb.Table(this, "ProgressTable", {
      tableName: "school-tutor-progress",
      partitionKey: { name: "studentId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Outputs
    new cdk.CfnOutput(this, "StudentTableName", {
      value: this.studentTable.tableName,
      description: "DynamoDB table for student profiles",
      exportName: "SchoolTutorStudentTable",
    });

    new cdk.CfnOutput(this, "ProgressTableName", {
      value: this.progressTable.tableName,
      description: "DynamoDB table for progress tracking",
      exportName: "SchoolTutorProgressTable",
    });

    new cdk.CfnOutput(this, "ContentBucketName", {
      value: this.contentBucket.bucketName,
      description: "S3 bucket for content storage",
      exportName: "SchoolTutorContentBucket",
    });
  }
}
