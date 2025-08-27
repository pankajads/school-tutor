#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import "source-map-support/register";
import { CoreResourcesStack } from "../lib/stacks/core-resources-stack";
import { AiServiceStack } from "../lib/stacks/ai-service-stack";

const app = new cdk.App();

// Environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || "ap-southeast-1",
};

// Core resources stack - just databases and S3
const coreResourcesStack = new CoreResourcesStack(app, "CoreResourcesStack", {
  env,
  description: "School Tutor Agent - Core resources (DB, S3)",
});

// Complete AI services stack (all services with clean Lambda code separation)
const aiServiceStack = new AiServiceStack(app, "AiServiceStack", {
  coreResourcesStack: coreResourcesStack,
  env,
  description:
    "School Tutor Agent - Complete AI services with external Lambda functions",
});

// Dependencies
aiServiceStack.addDependency(coreResourcesStack);

// Add tags
cdk.Tags.of(app).add("Project", "SchoolTutorAgent");
cdk.Tags.of(app).add("Environment", process.env.ENVIRONMENT || "dev");
cdk.Tags.of(app).add("Owner", "PankajNegi");
