# School Tutor Agent

An AI-powered intelligent tutoring system for 8th and 4th standard students, built with AWS Bedrock agents and modern evaluation frameworks.

## 🎯 Features

### Core Functionality
- **Student Profile Management**: Persistent student profiles with recognition and adaptive learning paths
- **Multi-Subject Support**: Covers two subjects daily with targeted knowledge building
- **Adaptive Learning**: Adjusts content difficulty based on student pace and understanding
- **Progress Tracking**: Comprehensive analytics and scorecards for learning progress
- **Interactive Content**: Engaging materials that keep students motivated
- **Compliance**: Content aligned with specific countries, boards, and school curricula

### Technical Features
- **AWS Bedrock Integration**: Advanced AI agents for personalized tutoring
- **Student Limit Management**: Configurable system supporting up to 5 students
- **Real-time Evaluation**: Modern LLM evaluation frameworks (Ragas, DeepEval, Evals, TruLens)
- **Comprehensive Dashboard**: Infrastructure health, model quality, and business KPIs
- **CLI Interface**: Command-line interface for backend operations
- **Future-ready Frontend**: React + TypeScript with AWS Amplify integration

## 🏗️ Architecture

```
school-tutor/
├── backend/                 # AWS CDK + Bedrock Agents
│   ├── lib/                # CDK stacks and constructs
│   ├── src/                # Lambda functions and agents
│   ├── evaluation/         # LLM evaluation frameworks
│   └── cli/                # Command-line interface
├── frontend/               # React + TypeScript (Amplify)
│   ├── src/               # React components and pages
│   └── public/            # Static assets
├── evaluation/            # Evaluation and monitoring
│   ├── frameworks/        # Ragas, DeepEval, TruLens
│   └── dashboard/         # Analytics dashboard
└── docs/                  # Documentation
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- AWS CLI configured
- AWS CDK installed globally
- pnpm package manager
- TypeScript

### Installation
```bash
pnpm install
```

### Development
```bash
# Start both backend and frontend
pnpm run dev

# Backend only
pnpm run start:backend

# Frontend only
pnpm run start:frontend
```

### Deployment
```bash
# Deploy backend infrastructure
pnpm run deploy

# Build and deploy frontend
pnpm run build:frontend
```

## 📊 Evaluation & Monitoring

The system includes comprehensive evaluation using:
- **Ragas**: RAG evaluation framework
- **DeepEval**: LLM evaluation metrics
- **TruLens**: Evaluation and monitoring
- **Custom Metrics**: Education-specific KPIs

### Dashboard Metrics
- **Infrastructure Health**: Latency, cost, scale
- **Model Quality**: Accuracy, factuality, success rate, hallucination detection
- **Business KPIs**: Student satisfaction, completion rates, ROI

## 🎓 Educational Features

### Student Management
- Profile creation and recognition
- Learning pace analysis
- Knowledge gap identification
- Progress tracking and scorecards

### Content Delivery
- Curriculum-compliant materials
- Interactive assignments
- Adaptive difficulty adjustment
- Engagement measurement

### Multi-Subject Support
- Two subjects per day minimum
- Targeted knowledge building
- Homework and assignment generation
- Reference link sharing

## 🛠️ Technology Stack

### Backend
- **AWS CDK**: Infrastructure as Code
- **AWS Bedrock**: LLM and AI agents
- **AWS Lambda**: Serverless functions
- **DynamoDB**: Student profiles and progress data
- **API Gateway**: REST API endpoints

### Frontend (Planned)
- **React**: UI framework
- **TypeScript**: Type safety
- **AWS Amplify**: Hosting and deployment
- **Material-UI**: Component library

### Evaluation
- **Ragas**: RAG evaluation
- **DeepEval**: Model quality metrics
- **TruLens**: Monitoring and observability
- **Custom Analytics**: Education-specific metrics

## 📝 Configuration

### Student Limits
- Default: 5 students maximum
- Configurable through environment variables
- Runtime limit management

### Curriculum Compliance
- Country-specific content
- Board/school alignment
- Grade-appropriate materials

## 🔧 Development

### Project Structure
```
backend/
├── lib/
│   ├── stacks/           # CDK stacks
│   ├── constructs/       # Reusable constructs
│   └── agents/           # Bedrock agent configurations
├── src/
│   ├── handlers/         # Lambda function handlers
│   ├── services/         # Business logic
│   └── models/           # Data models
└── evaluation/
    ├── ragas/            # RAG evaluation
    ├── deepeval/         # Model evaluation
    └── truLens/          # Monitoring
```

### CLI Commands
```bash
# Student management
pnpm run cli student:create
pnpm run cli student:list
pnpm run cli student:progress

# Content management
pnpm run cli content:generate
pnpm run cli assignments:create

# Evaluation
pnpm run cli evaluate:model
pnpm run cli dashboard:metrics
```

## 🎯 Roadmap

### Phase 1 (Current)
- [x] Project structure setup
- [ ] AWS CDK infrastructure
- [ ] Bedrock agent configuration
- [ ] Student profile management
- [ ] CLI interface

### Phase 2
- [ ] Content generation system
- [ ] Progress tracking
- [ ] Evaluation frameworks integration
- [ ] Dashboard development

### Phase 3
- [ ] React frontend
- [ ] Amplify integration
- [ ] Advanced analytics
- [ ] Mobile responsiveness

## 📚 Documentation

- [Setup Guide](docs/setup.md)
- [API Documentation](docs/api.md)
- [Deployment Guide](docs/deployment.md)
- [Evaluation Metrics](docs/evaluation.md)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the troubleshooting guide
