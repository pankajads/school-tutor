# Setup Guide

This guide will help you set up the School Tutor Agent system from scratch.

## Prerequisites

### Required Software
- **Node.js** 18+ with pnpm package manager
- **AWS CLI** configured with appropriate permissions
- **AWS CDK** installed globally (`pnpm install -g aws-cdk`)
- **Python** 3.9+ (for evaluation frameworks)
- **Git** for version control

### AWS Permissions Required
Your AWS user/role needs the following permissions:
- Lambda (create, update, invoke)
- DynamoDB (create tables, read/write data)
- S3 (create buckets, read/write objects)
- API Gateway (create/manage APIs)
- IAM (create roles and policies)
- CloudWatch (create dashboards, metrics)
- Bedrock (invoke models)

## Initial Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd school-tutor

# Install root dependencies
pnpm install

# Install backend dependencies
cd backend
pnpm install

# Install frontend dependencies
cd ../frontend
pnpm install

# Install evaluation dependencies
cd ../evaluation
pnpm install
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env file with your configuration
nano .env
```

### 3. AWS Configuration

```bash
# Configure AWS CLI (if not already done)
aws configure

# Bootstrap CDK (first time only)
cd backend
npm run bootstrap
```

### 4. Deploy Backend Infrastructure

```bash
# Build and deploy all stacks
pnpm run deploy

# Or deploy specific stacks
cdk deploy SchoolTutorStack
cdk deploy EvaluationStack
cdk deploy MonitoringStack
```

### 5. Verify Deployment

```bash
# Check system status
pnpm run cli system status

# Test with a sample student
pnpm run cli student create --name "Test Student" --grade 8 --country "United States" --board "Common Core"
```

## Configuration Details

### Backend Configuration

The backend uses several configuration sources:

1. **Environment Variables** (`.env`)
2. **CDK Context** (`backend/cdk.json`)
3. **Stack Parameters** (passed during deployment)

Key configurations:
- `MAX_STUDENTS`: Maximum number of students (default: 5)
- `AWS_REGION`: AWS region for deployment
- `BEDROCK_MODEL_ID`: Bedrock model to use for AI responses

### Frontend Configuration (Future)

The frontend will be configured through:
1. **Amplify Configuration** (`amplify/`)
2. **Next.js Configuration** (`frontend/next.config.js`)
3. **Environment Variables** (`.env.local`)

### Evaluation Configuration

The evaluation framework is configured through:
1. **Python Configuration** (`evaluation/config/`)
2. **Requirements** (`evaluation/requirements.txt`)
3. **Framework-specific configs** in respective directories

## System Architecture

### AWS Resources Created

1. **DynamoDB Tables**:
   - `school-tutor-students`: Student profiles
   - `school-tutor-progress`: Learning progress
   - `school-tutor-evaluation`: Evaluation results
   - `school-tutor-metrics`: System metrics

2. **Lambda Functions**:
   - Student Profile Handler
   - Learning Engine Handler
   - Progress Tracking Handler
   - Bedrock Agent Handler
   - Evaluation Function
   - Dashboard Function

3. **S3 Buckets**:
   - Content storage bucket
   - Evaluation data bucket

4. **API Gateway**:
   - REST API with multiple resources and methods

5. **CloudWatch**:
   - Comprehensive dashboard
   - Log groups for all functions
   - Custom metrics

## CLI Usage

### Student Management

```bash
# Create a student
pnpm run cli student create --name "Alice Smith" --grade 8 --country "United States" --board "Common Core"

# List students
pnpm run cli student list

# Get student details
pnpm run cli student get <student-id>

# Update student
pnpm run cli student update <student-id> --grade 9

# Delete student
pnpm run cli student delete <student-id>
```

### Learning Sessions

```bash
# Start learning session
pnpm run cli learning start --student <student-id> --subjects "Mathematics,Science"

# Generate content
pnpm run cli learning generate --student <student-id> --subject Mathematics --topic "Algebra" --type lesson

# Interactive chat
pnpm run cli learning chat --student <student-id> --subject Mathematics
```

### Progress Tracking

```bash
# View progress
pnpm run cli progress view <student-id>

# Get analytics
pnpm run cli progress analytics <student-id> --period 30d

# Generate scorecard
pnpm run cli progress scorecard <student-id>
```

### Evaluation

```bash
# Run evaluation
pnpm run cli eval run --type all

# View metrics
pnpm run cli eval metrics

# Launch dashboard
pnpm run cli eval dashboard
```

### System Management

```bash
# Check status
pnpm run cli system status

# View logs
pnpm run cli system logs

# Backup data
pnpm run cli system backup

# Deploy changes
pnpm run cli system deploy
```

## Troubleshooting

### Common Issues

1. **Permission Errors**
   - Ensure AWS credentials are configured
   - Check IAM permissions
   - Verify region settings

2. **Deployment Failures**
   - Check CDK bootstrap status
   - Verify resource limits
   - Review CloudFormation events

3. **Function Timeouts**
   - Increase Lambda timeout settings
   - Optimize function performance
   - Check memory allocation

4. **Bedrock Access Issues**
   - Ensure Bedrock is available in your region
   - Check model access permissions
   - Verify model ID configuration

### Getting Help

1. **Check Logs**:
   ```bash
   pnpm run cli system logs --service <service-name>
   ```

2. **View CloudWatch Dashboard**:
   - Access the generated dashboard URL from deployment output

3. **Check System Status**:
   ```bash
   pnpm run cli system status --detailed
   ```

4. **Review Configuration**:
   ```bash
   pnpm run cli system config --list
   ```

## Next Steps

1. **Test the System**: Create test students and run learning sessions
2. **Configure Evaluation**: Set up evaluation frameworks and thresholds
3. **Monitor Performance**: Use the dashboard to monitor system health
4. **Customize Content**: Adapt content generation for specific curricula
5. **Set Up Frontend**: Deploy the React frontend when ready

## Security Considerations

1. **Access Control**: Implement proper IAM policies
2. **Data Encryption**: Ensure data is encrypted at rest and in transit
3. **Student Privacy**: Follow COPPA and GDPR guidelines
4. **API Security**: Implement authentication and rate limiting
5. **Monitoring**: Set up security monitoring and alerting

## Maintenance

### Regular Tasks
- Monitor system performance
- Review evaluation results
- Update student limits as needed
- Backup student data
- Review and update curriculum content

### Updates
- Keep dependencies updated
- Monitor AWS service updates
- Update Bedrock models as needed
- Review and improve evaluation metrics

## Support

For issues and questions:
1. Check this documentation
2. Review troubleshooting section
3. Check system logs and status
4. Create an issue in the repository
