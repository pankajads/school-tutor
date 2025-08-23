#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import 'source-map-support/register';
import { SchoolTutorStack } from '../lib/stacks/school-tutor-stack';
import { EvaluationStack } from '../lib/stacks/evaluation-stack';
import { MonitoringStack } from '../lib/stacks/monitoring-stack';

const app = new cdk.App();

// Environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Main application stack
const schoolTutorStack = new SchoolTutorStack(app, 'SchoolTutorStack', {
  env,
  description: 'School Tutor Agent - Main application stack with Bedrock agents',
});

// Evaluation and metrics stack
const evaluationStack = new EvaluationStack(app, 'EvaluationStack', {
  env,
  description: 'School Tutor Agent - Evaluation and metrics stack',
  tutorStack: schoolTutorStack,
});

// Monitoring and dashboard stack
const monitoringStack = new MonitoringStack(app, 'MonitoringStack', {
  env,
  description: 'School Tutor Agent - Monitoring and dashboard stack',
  tutorStack: schoolTutorStack,
  evaluationStack: evaluationStack,
});

// Add stack dependencies
evaluationStack.addDependency(schoolTutorStack);
monitoringStack.addDependency(schoolTutorStack);
monitoringStack.addDependency(evaluationStack);

// Add tags
cdk.Tags.of(app).add('Project', 'SchoolTutorAgent');
cdk.Tags.of(app).add('Environment', process.env.ENVIRONMENT || 'dev');
cdk.Tags.of(app).add('Owner', 'PankajNegi');
