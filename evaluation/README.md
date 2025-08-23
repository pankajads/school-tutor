# School Tutor Evaluation Framework

A comprehensive evaluation system for the School Tutor Agent using modern LLM evaluation frameworks and custom educational metrics.

## 🎯 Overview

This evaluation framework provides comprehensive assessment of the AI tutoring system across multiple dimensions:

### Evaluation Frameworks
- **Ragas**: RAG evaluation framework for retrieval-augmented generation
- **DeepEval**: LLM evaluation metrics for various aspects of model performance
- **TruLens**: Evaluation and monitoring for LLM applications
- **Custom Metrics**: Education-specific evaluation criteria

### Key Metrics
- **Model Quality**: Accuracy, factuality, hallucination detection
- **Educational Effectiveness**: Learning outcomes, curriculum compliance
- **Student Engagement**: Interaction quality, retention rates
- **System Performance**: Latency, cost, scalability
- **Business KPIs**: Satisfaction, completion rates, ROI

## 🏗️ Architecture

```
evaluation/
├── frameworks/              # Evaluation framework implementations
│   ├── ragas/              # RAG evaluation
│   ├── deepeval/           # Model evaluation
│   ├── trulens/            # Monitoring and evaluation
│   └── custom/             # Educational metrics
├── dashboard/              # Real-time evaluation dashboard
├── scripts/                # Automation and reporting scripts
├── tests/                  # Test suite
├── config/                 # Configuration files
└── data/                   # Evaluation datasets and results
```

## 🚀 Quick Start

### Installation
```bash
# Install all dependencies
pnpm run install:all
```

### Run Evaluations
```bash
# Run all evaluation frameworks
pnpm run eval:all

# Run specific framework
pnpm run eval:ragas
pnpm run eval:deepeval
pnpm run eval:trulens
pnpm run eval:custom
```

### Launch Dashboard
```bash
# Start evaluation dashboard
pnpm run dashboard
```

## 📊 Evaluation Frameworks

### 1. Ragas Framework
**Purpose**: Evaluate retrieval-augmented generation quality

**Metrics**:
- Context Precision
- Context Recall
- Faithfulness
- Answer Relevancy
- Answer Semantic Similarity
- Answer Correctness

**Usage**:
```python
from frameworks.ragas import RagasEvaluator

evaluator = RagasEvaluator()
results = evaluator.evaluate(
    questions=questions,
    answers=answers,
    contexts=contexts,
    ground_truths=ground_truths
)
```

### 2. DeepEval Framework
**Purpose**: Comprehensive LLM evaluation metrics

**Metrics**:
- Hallucination Detection
- Factual Consistency
- Answer Relevancy
- BLEU Score
- G-Eval
- Toxicity Detection
- Bias Assessment

**Usage**:
```python
from frameworks.deepeval import DeepEvalEvaluator

evaluator = DeepEvalEvaluator()
results = evaluator.evaluate(
    predictions=predictions,
    actual_outputs=actual_outputs
)
```

### 3. TruLens Framework
**Purpose**: LLM application monitoring and evaluation

**Metrics**:
- Groundedness
- Question-Answer Relevance
- Context Relevance
- Harmfulness Detection
- Language Mismatch
- Prompt Injection Detection

**Usage**:
```python
from frameworks.trulens import TruLensEvaluator

evaluator = TruLensEvaluator()
evaluator.start_monitoring(app=tutor_app)
results = evaluator.get_evaluation_results()
```

### 4. Custom Educational Metrics
**Purpose**: Education-specific evaluation criteria

**Metrics**:
- Curriculum Compliance Score
- Age Appropriateness
- Learning Objective Alignment
- Pedagogical Effectiveness
- Student Engagement Level
- Knowledge Retention Rate
- Skill Development Progress

**Usage**:
```python
from frameworks.custom import EducationalEvaluator

evaluator = EducationalEvaluator()
results = evaluator.evaluate_educational_content(
    content=content,
    student_profile=student_profile,
    learning_objectives=objectives
)
```

## 📈 Dashboard & Monitoring

### Real-time Dashboard
- **Infrastructure Health**: Latency, cost, scale metrics
- **Model Quality**: Accuracy, factuality, success rate
- **Educational Effectiveness**: Learning outcomes, engagement
- **Business KPIs**: Satisfaction, completion, ROI

### Key Visualizations
- Performance trends over time
- Comparative analysis across students
- Subject-wise effectiveness metrics
- Real-time alerting for quality issues

### Access Dashboard
```bash
# Launch web dashboard
pnpm run dashboard

# Access at http://localhost:8501
```

## 🔧 Configuration

### Environment Variables
```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret

# Database Configuration
STUDENT_TABLE=school-tutor-students
PROGRESS_TABLE=school-tutor-progress
EVALUATION_TABLE=school-tutor-evaluation

# Model Configuration
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
OPENAI_API_KEY=your_openai_key

# Evaluation Configuration
EVALUATION_BATCH_SIZE=10
EVALUATION_FREQUENCY=daily
ALERT_THRESHOLD_ACCURACY=80
ALERT_THRESHOLD_FACTUALITY=85
```

### Framework Configuration
```python
# config/evaluation_config.py
EVALUATION_CONFIG = {
    "ragas": {
        "metrics": ["context_precision", "faithfulness", "answer_relevancy"],
        "model": "gpt-3.5-turbo",
        "batch_size": 10
    },
    "deepeval": {
        "metrics": ["hallucination", "factual_consistency", "answer_relevancy"],
        "threshold": 0.8
    },
    "trulens": {
        "feedback_functions": ["groundedness", "qa_relevance", "context_relevance"],
        "app_id": "school_tutor_agent"
    },
    "custom": {
        "curriculum_compliance": True,
        "age_appropriateness": True,
        "learning_outcomes": True
    }
}
```

## 📊 Evaluation Reports

### Automated Reports
```bash
# Generate comprehensive evaluation report
pnpm run report

# Generate benchmark comparison
pnpm run benchmark
```

### Report Types
- **Daily Quality Report**: Model performance metrics
- **Weekly Progress Report**: Student learning outcomes
- **Monthly Business Report**: KPIs and ROI analysis
- **Quarterly Review**: Comprehensive system assessment

### Report Format
- PDF reports for stakeholders
- JSON/CSV for data analysis
- Interactive HTML dashboards
- API endpoints for integration

## 🧪 Testing & Validation

### Test Suite
```bash
# Run all tests
pnpm test

# Run specific test category
python -m pytest tests/test_ragas.py
python -m pytest tests/test_deepeval.py
python -m pytest tests/test_trulens.py
python -m pytest tests/test_custom.py
```

### Validation Framework
- Unit tests for each evaluation metric
- Integration tests for end-to-end workflows
- Performance benchmarks
- Regression testing

### Continuous Evaluation
- Automated daily evaluations
- Continuous monitoring
- Alert system for quality degradation
- A/B testing framework

## 📋 Quality Metrics

### Model Quality (0-100 scale)
- **Accuracy**: Overall correctness of responses
- **Factuality**: Factual correctness and consistency
- **Relevancy**: Response relevance to student queries
- **Clarity**: Response clarity and comprehensibility
- **Completeness**: Coverage of query requirements

### Educational Effectiveness (0-100 scale)
- **Curriculum Compliance**: Alignment with educational standards
- **Age Appropriateness**: Suitability for student grade level
- **Learning Outcomes**: Achievement of learning objectives
- **Engagement**: Student interaction and participation
- **Retention**: Knowledge retention and skill development

### System Performance
- **Latency**: Response time (target: <2 seconds)
- **Throughput**: Requests per second
- **Availability**: System uptime (target: 99.9%)
- **Cost Efficiency**: Cost per student session
- **Scalability**: Performance under load

### Business KPIs
- **Student Satisfaction**: 1-5 rating scale
- **Completion Rate**: Percentage of completed sessions
- **Retention Rate**: Student return rate
- **Learning Progress**: Measurable skill improvement
- **ROI**: Return on investment metrics

## 🔍 Alert System

### Quality Alerts
- Accuracy drops below 80%
- Factuality issues detected
- High hallucination rate (>10%)
- Student engagement declining

### Performance Alerts
- Response latency >3 seconds
- Error rate >1%
- System downtime
- Cost overruns

### Business Alerts
- Satisfaction rating <4.0
- Completion rate <70%
- Retention rate declining
- Learning objectives not met

## 📚 Integration

### AWS Integration
- DynamoDB for evaluation data storage
- CloudWatch for metrics and monitoring
- Lambda for automated evaluations
- S3 for report storage

### API Integration
```python
# REST API for evaluation results
GET /api/evaluation/results
POST /api/evaluation/trigger
GET /api/evaluation/dashboard
```

### Webhook Integration
```python
# Webhook for real-time alerts
POST /webhook/quality_alert
POST /webhook/performance_alert
POST /webhook/business_alert
```

## 🎯 Future Enhancements

### Advanced Features
- Real-time evaluation streaming
- Multi-language support
- Custom metric development
- Advanced visualizations
- Predictive analytics

### Integration Expansion
- Learning Management Systems (LMS)
- Student Information Systems (SIS)
- Parent/teacher portals
- Third-party analytics tools

### Research Capabilities
- Experimental evaluation metrics
- A/B testing frameworks
- Student behavior analysis
- Personalization effectiveness

## 📖 Documentation

- [Ragas Integration Guide](docs/ragas.md)
- [DeepEval Setup](docs/deepeval.md)
- [TruLens Configuration](docs/trulens.md)
- [Custom Metrics Development](docs/custom_metrics.md)
- [Dashboard User Guide](docs/dashboard.md)
- [API Reference](docs/api.md)

## 🤝 Contributing

1. Add new evaluation metrics to appropriate framework
2. Update configuration files
3. Add comprehensive tests
4. Update documentation
5. Submit pull request with evaluation results

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
