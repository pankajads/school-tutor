# API Documentation

This document describes the REST API endpoints for the School Tutor Agent system.

## Base URL

```
https://<api-gateway-url>/api/v1
```

## Authentication

Currently, the API uses API Key authentication. Include the API key in the request headers:

```
x-api-key: <your-api-key>
```

## Students API

### Create Student

Creates a new student profile.

**Endpoint**: `POST /students`

**Request Body**:
```json
{
  "name": "Alice Smith",
  "grade": 8,
  "country": "United States",
  "board": "Common Core",
  "subjects": ["Mathematics", "Science"],
  "preferences": {
    "learningStyle": "visual",
    "difficulty": "medium",
    "pace": "moderate"
  }
}
```

**Response**:
```json
{
  "studentId": "student-123",
  "name": "Alice Smith",
  "grade": 8,
  "country": "United States",
  "board": "Common Core",
  "subjects": ["Mathematics", "Science"],
  "preferences": {
    "learningStyle": "visual",
    "difficulty": "medium",
    "pace": "moderate"
  },
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

**Status Codes**:
- `201`: Student created successfully
- `400`: Invalid request data
- `409`: Maximum students limit reached

### Get Student

Retrieves a student profile by ID.

**Endpoint**: `GET /students/{studentId}`

**Response**:
```json
{
  "studentId": "student-123",
  "name": "Alice Smith",
  "grade": 8,
  "country": "United States",
  "board": "Common Core",
  "subjects": ["Mathematics", "Science"],
  "preferences": {
    "learningStyle": "visual",
    "difficulty": "medium",
    "pace": "moderate"
  },
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

**Status Codes**:
- `200`: Student found
- `404`: Student not found

### List Students

Retrieves all student profiles.

**Endpoint**: `GET /students`

**Query Parameters**:
- `grade` (optional): Filter by grade
- `country` (optional): Filter by country
- `board` (optional): Filter by educational board

**Response**:
```json
{
  "students": [
    {
      "studentId": "student-123",
      "name": "Alice Smith",
      "grade": 8,
      "country": "United States",
      "board": "Common Core",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 1,
  "limit": 5,
  "remaining": 4
}
```

**Status Codes**:
- `200`: Success

### Update Student

Updates a student profile.

**Endpoint**: `PUT /students/{studentId}`

**Request Body**:
```json
{
  "name": "Alice Johnson",
  "grade": 9,
  "preferences": {
    "learningStyle": "kinesthetic",
    "difficulty": "hard",
    "pace": "fast"
  }
}
```

**Response**:
```json
{
  "studentId": "student-123",
  "name": "Alice Johnson",
  "grade": 9,
  "country": "United States",
  "board": "Common Core",
  "subjects": ["Mathematics", "Science"],
  "preferences": {
    "learningStyle": "kinesthetic",
    "difficulty": "hard",
    "pace": "fast"
  },
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T12:00:00Z"
}
```

**Status Codes**:
- `200`: Student updated successfully
- `404`: Student not found
- `400`: Invalid request data

### Delete Student

Deletes a student profile and all associated data.

**Endpoint**: `DELETE /students/{studentId}`

**Response**:
```json
{
  "message": "Student deleted successfully",
  "studentId": "student-123"
}
```

**Status Codes**:
- `200`: Student deleted successfully
- `404`: Student not found

## Learning API

### Start Learning Session

Initiates a new learning session for a student.

**Endpoint**: `POST /learning/sessions`

**Request Body**:
```json
{
  "studentId": "student-123",
  "subjects": ["Mathematics", "Science"],
  "duration": 60,
  "type": "adaptive"
}
```

**Response**:
```json
{
  "sessionId": "session-456",
  "studentId": "student-123",
  "subjects": ["Mathematics", "Science"],
  "status": "active",
  "startTime": "2024-01-01T10:00:00Z",
  "plannedEndTime": "2024-01-01T11:00:00Z",
  "currentSubject": "Mathematics"
}
```

**Status Codes**:
- `201`: Session started successfully
- `400`: Invalid request data
- `404`: Student not found

### Generate Content

Generates educational content for a specific topic.

**Endpoint**: `POST /learning/content`

**Request Body**:
```json
{
  "studentId": "student-123",
  "subject": "Mathematics",
  "topic": "Linear Equations",
  "contentType": "lesson",
  "difficulty": "medium"
}
```

**Response**:
```json
{
  "contentId": "content-789",
  "subject": "Mathematics",
  "topic": "Linear Equations",
  "contentType": "lesson",
  "content": {
    "title": "Introduction to Linear Equations",
    "explanation": "Linear equations are...",
    "examples": [...],
    "exercises": [...],
    "resources": [...]
  },
  "metadata": {
    "difficulty": "medium",
    "estimatedTime": 20,
    "learningObjectives": [...]
  },
  "generatedAt": "2024-01-01T10:00:00Z"
}
```

**Status Codes**:
- `201`: Content generated successfully
- `400`: Invalid request data
- `404`: Student not found

### Chat with Tutor

Interactive chat endpoint for real-time tutoring.

**Endpoint**: `POST /learning/chat`

**Request Body**:
```json
{
  "studentId": "student-123",
  "sessionId": "session-456",
  "message": "I don't understand how to solve this equation",
  "context": {
    "subject": "Mathematics",
    "topic": "Linear Equations",
    "currentProblem": "2x + 5 = 13"
  }
}
```

**Response**:
```json
{
  "response": "Let me help you solve this step by step...",
  "suggestions": [
    "Would you like to see another example?",
    "Should we practice a similar problem?"
  ],
  "hints": [
    "Start by isolating the term with x",
    "Remember to do the same operation on both sides"
  ],
  "followUp": {
    "type": "exercise",
    "content": "Try solving: 3x + 7 = 22"
  },
  "engagement": {
    "score": 8.5,
    "factors": ["asked_question", "showed_confusion", "engaged_actively"]
  }
}
```

**Status Codes**:
- `200`: Response generated successfully
- `400`: Invalid request data
- `404`: Student or session not found

## Progress API

### Get Progress Overview

Retrieves overall progress for a student.

**Endpoint**: `GET /progress/{studentId}`

**Query Parameters**:
- `period` (optional): Time period (7d, 30d, 90d)
- `subjects` (optional): Comma-separated list of subjects

**Response**:
```json
{
  "studentId": "student-123",
  "period": "30d",
  "overall": {
    "completionRate": 75,
    "engagementScore": 8.2,
    "skillsImprovement": 15,
    "timeSpent": 1200
  },
  "subjects": {
    "Mathematics": {
      "completionRate": 80,
      "topicsCompleted": 12,
      "averageScore": 85,
      "timeSpent": 720
    },
    "Science": {
      "completionRate": 70,
      "topicsCompleted": 8,
      "averageScore": 78,
      "timeSpent": 480
    }
  },
  "recentAchievements": [
    {
      "achievement": "Algebra Master",
      "dateEarned": "2024-01-01T10:00:00Z",
      "subject": "Mathematics"
    }
  ]
}
```

**Status Codes**:
- `200`: Progress retrieved successfully
- `404`: Student not found

### Get Detailed Analytics

Retrieves detailed analytics and insights.

**Endpoint**: `GET /progress/{studentId}/analytics`

**Response**:
```json
{
  "studentId": "student-123",
  "analytics": {
    "learningPattern": {
      "peakHours": ["14:00", "16:00"],
      "preferredDuration": 45,
      "bestPerformingDay": "Tuesday"
    },
    "skillProgression": {
      "strengths": ["Geometry", "Basic Algebra"],
      "improvementAreas": ["Word Problems", "Fractions"],
      "recommendations": [
        "Focus on practical applications of fractions",
        "Practice more word problems with real-world context"
      ]
    },
    "engagement": {
      "averageSessionLength": 42,
      "questionsAsked": 156,
      "hintsUsed": 23,
      "interactionRate": 8.7
    }
  },
  "trends": {
    "weekly": [...],
    "monthly": [...]
  }
}
```

**Status Codes**:
- `200`: Analytics retrieved successfully
- `404`: Student not found

## Evaluation API

### Run Evaluation

Triggers an evaluation of the tutoring system.

**Endpoint**: `POST /evaluation/run`

**Request Body**:
```json
{
  "type": "comprehensive",
  "students": ["student-123"],
  "frameworks": ["ragas", "deepeval", "trulens"],
  "metrics": ["relevance", "groundedness", "context_recall"]
}
```

**Response**:
```json
{
  "evaluationId": "eval-101",
  "status": "running",
  "estimatedCompletion": "2024-01-01T11:00:00Z",
  "frameworks": ["ragas", "deepeval", "trulens"],
  "students": ["student-123"]
}
```

**Status Codes**:
- `202`: Evaluation started
- `400`: Invalid request data

### Get Evaluation Results

Retrieves evaluation results.

**Endpoint**: `GET /evaluation/{evaluationId}`

**Response**:
```json
{
  "evaluationId": "eval-101",
  "status": "completed",
  "completedAt": "2024-01-01T11:00:00Z",
  "results": {
    "ragas": {
      "relevance": 0.87,
      "groundedness": 0.92,
      "context_recall": 0.85
    },
    "deepeval": {
      "factual_consistency": 0.89,
      "answer_relevancy": 0.86
    },
    "trulens": {
      "context_relevance": 0.88,
      "groundedness": 0.91,
      "answer_relevance": 0.84
    }
  },
  "summary": {
    "overallScore": 0.87,
    "passed": true,
    "recommendations": [
      "Improve context recall for complex topics",
      "Enhance answer relevancy for advanced questions"
    ]
  }
}
```

**Status Codes**:
- `200`: Results retrieved successfully
- `404`: Evaluation not found
- `202`: Evaluation still running

## System API

### Health Check

Checks system health and status.

**Endpoint**: `GET /system/health`

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T10:00:00Z",
  "services": {
    "database": "healthy",
    "bedrock": "healthy",
    "storage": "healthy",
    "evaluation": "healthy"
  },
  "metrics": {
    "activeStudents": 3,
    "activeSessions": 1,
    "totalRequests": 1245,
    "averageResponseTime": 120
  }
}
```

**Status Codes**:
- `200`: System is healthy
- `503`: System is experiencing issues

### Get Configuration

Retrieves system configuration.

**Endpoint**: `GET /system/config`

**Response**:
```json
{
  "limits": {
    "maxStudents": 5,
    "currentStudents": 3,
    "maxSessionDuration": 120,
    "maxDailyRequests": 1000
  },
  "features": {
    "adaptiveLearning": true,
    "progressTracking": true,
    "evaluation": true,
    "multiLanguage": false
  },
  "models": {
    "primary": "anthropic.claude-3-sonnet-20240229-v1:0",
    "fallback": "anthropic.claude-3-haiku-20240307-v1:0"
  }
}
```

**Status Codes**:
- `200`: Configuration retrieved successfully

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "Bad Request",
  "message": "Invalid request data",
  "details": {
    "field": "grade",
    "issue": "must be between 1 and 12"
  }
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing API key"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Student not found",
  "studentId": "student-123"
}
```

### 429 Too Many Requests
```json
{
  "error": "Rate Limit Exceeded",
  "message": "Too many requests",
  "retryAfter": 60
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred",
  "requestId": "req-12345"
}
```

## Rate Limits

- **Default**: 100 requests per minute per API key
- **Burst**: Up to 200 requests in a 10-second window
- **Daily**: 10,000 requests per day per API key

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Requests per minute limit
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Time when the current window resets

## SDK and Examples

### JavaScript/Node.js Example

```javascript
const axios = require('axios');

const client = axios.create({
  baseURL: 'https://your-api-gateway-url/api/v1',
  headers: {
    'x-api-key': 'your-api-key',
    'Content-Type': 'application/json'
  }
});

// Create a student
const student = await client.post('/students', {
  name: 'Alice Smith',
  grade: 8,
  country: 'United States',
  board: 'Common Core'
});

// Start a learning session
const session = await client.post('/learning/sessions', {
  studentId: student.data.studentId,
  subjects: ['Mathematics', 'Science']
});
```

### Python Example

```python
import requests

class TutorAPI:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.headers = {
            'x-api-key': api_key,
            'Content-Type': 'application/json'
        }
    
    def create_student(self, name, grade, country, board):
        response = requests.post(
            f"{self.base_url}/students",
            json={
                'name': name,
                'grade': grade,
                'country': country,
                'board': board
            },
            headers=self.headers
        )
        return response.json()

# Usage
api = TutorAPI('https://your-api-gateway-url/api/v1', 'your-api-key')
student = api.create_student('Alice Smith', 8, 'United States', 'Common Core')
```
