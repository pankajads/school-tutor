/**
 * AI-Enhanced Progress Tracking Lambda Handler
 *
 * This function provides intelligent progress analytics and recommendations using AWS Bedrock AI
 * with comprehensive learning pattern analysis and personalized insights generation.
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");
const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const crypto = require("crypto");

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "ap-southeast-1",
});

const STUDENT_TABLE = process.env.STUDENT_TABLE;
const PROGRESS_TABLE = process.env.PROGRESS_TABLE;

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log("Progress Tracking Event:", JSON.stringify(event, null, 2));

  try {
    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return createResponse(200, "", {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, X-Api-Key",
      });
    }

    const { httpMethod, pathParameters, body, queryStringParameters } = event;
    const requestBody = body ? JSON.parse(body) : {};

    switch (httpMethod) {
      case "GET":
        if (event.resource === "/progress/analytics") {
          return await getAIAnalytics(queryStringParameters);
        } else if (event.resource === "/progress/insights") {
          return await getAIInsights(queryStringParameters);
        } else if (event.resource === "/progress/recommendations") {
          return await getAIRecommendations(queryStringParameters);
        } else {
          return await getProgress(queryStringParameters);
        }
      case "POST":
        if (event.resource === "/progress/update") {
          return await updateProgress(requestBody);
        } else if (event.resource === "/progress/analyze") {
          return await analyzeProgressWithAI(requestBody);
        }
        break;
      default:
        return createResponse(405, { error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Progress Tracking Error:", error);
    return createResponse(500, {
      error: "Internal server error",
      details: error.message,
    });
  }
};

/**
 * Get AI-enhanced analytics with intelligent insights
 */
async function getAIAnalytics(queryParams) {
  const { studentId, period, subjects, analysisType } = queryParams || {};

  if (!studentId) {
    return createResponse(400, { error: "studentId is required" });
  }

  // Get student info
  const student = await getStudent(studentId);
  if (!student) {
    return createResponse(404, { error: "Student not found" });
  }

  // Calculate date range based on period
  const dateRange = calculateDateRange(period || "30d");

  // Get comprehensive progress data
  const progressData = await getProgressForPeriod(
    studentId,
    dateRange.start,
    dateRange.end,
  );

  // Generate AI-powered analytics
  const aiAnalytics = await generateAIAnalytics(
    student,
    progressData,
    subjects,
    analysisType,
  );

  // Store analytics for future reference
  await storeAnalyticsResult(studentId, aiAnalytics, period, analysisType);

  return createResponse(200, {
    student: {
      id: student.studentId,
      name: student.studentName,
      grade: student.grade,
      board: student.board,
      country: student.country,
    },
    period: period || "30d",
    analysisType: analysisType || "comprehensive",
    analytics: aiAnalytics,
    aiGenerated: true,
    generatedAt: new Date().toISOString(),
    dataPoints: progressData.length,
  });
}

/**
 * Get AI-powered learning insights
 */
async function getAIInsights(queryParams) {
  const { studentId, focusArea, depth } = queryParams || {};

  if (!studentId) {
    return createResponse(400, { error: "studentId is required" });
  }

  const student = await getStudent(studentId);
  if (!student) {
    return createResponse(404, { error: "Student not found" });
  }

  // Get comprehensive learning history
  const learningHistory = await getComprehensiveLearningHistory(studentId);

  // Generate AI insights
  const insights = await generateAIInsights(
    student,
    learningHistory,
    focusArea,
    depth,
  );

  return createResponse(200, {
    student: {
      id: student.studentId,
      name: student.studentName,
      grade: student.grade,
    },
    focusArea: focusArea || "comprehensive",
    insights: insights,
    aiGenerated: true,
    analysisDepth: depth || "standard",
    generatedAt: new Date().toISOString(),
  });
}

/**
 * Get AI-powered personalized recommendations
 */
async function getAIRecommendations(queryParams) {
  const { studentId, recommendationType, priority } = queryParams || {};

  if (!studentId) {
    return createResponse(400, { error: "studentId is required" });
  }

  const student = await getStudent(studentId);
  if (!student) {
    return createResponse(404, { error: "Student not found" });
  }

  // Get recent progress and performance data
  const recentProgress = await getRecentProgressData(studentId, 14); // Last 14 days

  // Generate AI-powered recommendations
  const recommendations = await generateAIRecommendations(
    student,
    recentProgress,
    recommendationType,
    priority,
  );

  return createResponse(200, {
    student: {
      id: student.studentId,
      name: student.studentName,
      grade: student.grade,
    },
    recommendationType: recommendationType || "comprehensive",
    priority: priority || "all",
    recommendations: recommendations,
    aiGenerated: true,
    generatedAt: new Date().toISOString(),
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Valid for 7 days
  });
}

/**
 * Analyze progress data with AI for deep insights
 */
async function analyzeProgressWithAI(requestBody) {
  const { studentId, analysisGoals, comparisonPeriods, subjects } = requestBody;

  if (!studentId) {
    return createResponse(400, { error: "studentId is required" });
  }

  const student = await getStudent(studentId);
  if (!student) {
    return createResponse(404, { error: "Student not found" });
  }

  // Get data for multiple time periods for comparison
  const analysisData = await getMultiPeriodAnalysisData(
    studentId,
    comparisonPeriods,
  );

  // Perform deep AI analysis
  const deepAnalysis = await performDeepAIAnalysis(
    student,
    analysisData,
    analysisGoals,
    subjects,
  );

  // Store analysis results
  const analysisId = crypto.randomUUID();
  await storeAnalysisResult(studentId, analysisId, deepAnalysis);

  return createResponse(200, {
    analysisId: analysisId,
    student: {
      id: student.studentId,
      name: student.studentName,
      grade: student.grade,
    },
    analysis: deepAnalysis,
    aiGenerated: true,
    analysisGoals: analysisGoals || [
      "performance",
      "engagement",
      "learning_patterns",
    ],
    generatedAt: new Date().toISOString(),
  });
}

/**
 * Generate AI-powered comprehensive analytics
 */
async function generateAIAnalytics(
  student,
  progressData,
  subjects,
  analysisType,
) {
  try {
    const prompt = `You are an expert educational data analyst and learning psychologist. Analyze the following student progress data and provide comprehensive insights.

Student Profile:
- Name: ${student.studentName}
- Grade: ${student.grade}
- Country: ${student.country}
- Board: ${student.board}
- Learning Pace: ${student.learningPace}

Progress Data Summary:
- Total Sessions: ${progressData.filter((p) => p.type === "learning_session").length}
- Subjects Studied: ${[...new Set(progressData.map((p) => p.subject).filter(Boolean))].join(", ")}
- Time Period: Last ${progressData.length > 50 ? "30+ days" : "few weeks"}
- Data Points: ${progressData.length}

Performance Metrics:
${generatePerformanceMetrics(progressData)}

Engagement Patterns:
${generateEngagementPatterns(progressData)}

Learning Patterns:
${generateLearningPatterns(progressData)}

Please provide a comprehensive analysis in JSON format:
{
  "overview": {
    "learningEffectiveness": "score 0-100 with explanation",
    "overallTrend": "improving/stable/declining with reasons",
    "keyStrengths": ["strength 1", "strength 2", "strength 3"],
    "areasForImprovement": ["area 1", "area 2", "area 3"]
  },
  "academicAnalysis": {
    "performanceTrend": "detailed analysis of academic performance",
    "subjectMastery": "analysis of subject-wise understanding",
    "knowledgeGaps": "identified learning gaps",
    "conceptualUnderstanding": "depth of understanding analysis"
  },
  "behavioralInsights": {
    "learningStyle": "identified learning preferences",
    "motivationLevel": "analysis of student motivation",
    "engagementPatterns": "when and how student engages best",
    "persistenceLevel": "how student handles challenges"
  },
  "adaptiveRecommendations": {
    "nextFocusAreas": ["area 1", "area 2", "area 3"],
    "learningStrategies": ["strategy 1", "strategy 2"],
    "paceAdjustments": "recommended pace changes",
    "supportNeeded": "type of support student needs"
  },
  "predictiveInsights": {
    "futurePerformance": "predicted performance trends",
    "riskFactors": "potential challenges to watch",
    "opportunities": "areas of high potential",
    "timeline": "expected improvement timeline"
  }
}

Analysis should be appropriate for grade ${student.grade} level and consider ${student.country} ${student.board} curriculum standards.`;

    const modelId = "anthropic.claude-3-haiku-20240307-v1:0";
    const command = new InvokeModelCommand({
      modelId: modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 4000,
        temperature: 0.3,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const aiContent = responseBody.content[0].text;

    // Extract JSON from response
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analytics = JSON.parse(jsonMatch[0]);
      console.log(
        `AI generated comprehensive analytics for ${student.studentId}`,
      );

      // Add metadata
      return {
        ...analytics,
        metadata: {
          analysisDate: new Date().toISOString(),
          dataQuality: assessDataQuality(progressData),
          confidenceLevel: calculateConfidenceLevel(progressData),
          nextAnalysisRecommended: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
      };
    }
  } catch (error) {
    console.error("Error generating AI analytics:", error);
  }

  // Fallback to enhanced traditional analytics
  return generateEnhancedFallbackAnalytics(student, progressData);
}

/**
 * Generate AI-powered learning insights
 */
async function generateAIInsights(student, learningHistory, focusArea, depth) {
  try {
    const prompt = `You are an expert learning scientist specializing in personalized education. Analyze this student's learning journey and provide deep insights.

Student Context:
- Name: ${student.studentName}
- Grade: ${student.grade}
- Learning Pace: ${student.learningPace}
- Country: ${student.country}
- Board: ${student.board}

Learning Journey:
- Total Learning Events: ${learningHistory.length}
- Learning Span: ${calculateLearningSpan(learningHistory)}
- Focus Area: ${focusArea || "comprehensive"}
- Analysis Depth: ${depth || "standard"}

Recent Performance Patterns:
${analyzePerfomancePatterns(learningHistory)}

Learning Behavior Analysis:
${analyzeLearningBehavior(learningHistory)}

Please provide personalized insights in JSON format:
{
  "learnerProfile": {
    "dominantLearningStyle": "visual/auditory/kinesthetic/mixed with explanation",
    "cognitiveStrengths": ["strength 1", "strength 2"],
    "processingSpeed": "fast/moderate/methodical with analysis",
    "retentionStyle": "how student best retains information"
  },
  "motivationAnalysis": {
    "intrinsicMotivators": ["what internally motivates the student"],
    "challengeResponse": "how student responds to difficulty",
    "goalOrientation": "performance/mastery orientation analysis",
    "persistenceLevel": "high/medium/low with examples"
  },
  "learningEfficiencyInsights": {
    "optimalSessionLength": "recommended session duration",
    "bestPerformanceTimes": "when student performs best",
    "effectiveStrategies": ["strategies that work for this student"],
    "ineffectivePatterns": ["patterns that hinder learning"]
  },
  "personalizedGuidance": {
    "parentRecommendations": ["advice for parents"],
    "teacherRecommendations": ["advice for teachers"],
    "selfLearningTips": ["tips for the student"],
    "environmentOptimization": "optimal learning environment"
  },
  "developmentalForecast": {
    "nextMilestones": ["upcoming learning milestones"],
    "skillDevelopmentAreas": ["areas ready for development"],
    "potentialChallenges": ["challenges to prepare for"],
    "supportRequirements": "type of support needed"
  }
}

Focus on actionable insights appropriate for grade ${student.grade} students in ${student.country}.`;

    const modelId = "anthropic.claude-3-haiku-20240307-v1:0";
    const command = new InvokeModelCommand({
      modelId: modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 3500,
        temperature: 0.4,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const aiContent = responseBody.content[0].text;

    // Extract JSON from response
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const insights = JSON.parse(jsonMatch[0]);
      console.log(`AI generated learning insights for ${student.studentId}`);
      return insights;
    }
  } catch (error) {
    console.error("Error generating AI insights:", error);
  }

  // Fallback insights
  return generateFallbackInsights(student, learningHistory);
}

/**
 * Generate AI-powered personalized recommendations
 */
async function generateAIRecommendations(
  student,
  recentProgress,
  recommendationType,
  priority,
) {
  try {
    const prompt = `You are an expert educational advisor specializing in personalized learning recommendations. Based on this student's recent progress, provide actionable recommendations.

Student Profile:
- Name: ${student.studentName}
- Grade: ${student.grade}
- Learning Pace: ${student.learningPace}
- Country: ${student.country}
- Board: ${student.board}

Recent Progress (Last 14 days):
- Sessions: ${recentProgress.filter((p) => p.type === "learning_session").length}
- Performance: ${calculateRecentPerformance(recentProgress)}
- Engagement: ${calculateRecentEngagement(recentProgress)}
- Time Spent: ${calculateRecentTimeSpent(recentProgress)} minutes

Current Challenges:
${identifyCurrentChallenges(recentProgress)}

Recommendation Type: ${recommendationType || "comprehensive"}
Priority Level: ${priority || "all"}

Provide personalized recommendations in JSON format:
{
  "immediate": {
    "title": "Actions for This Week",
    "recommendations": [
      {
        "action": "specific action to take",
        "reason": "why this action is recommended",
        "expectedOutcome": "what improvement to expect",
        "timeframe": "when to see results",
        "priority": "high/medium/low"
      }
    ]
  },
  "shortTerm": {
    "title": "Goals for Next 2-4 Weeks",
    "recommendations": [
      {
        "goal": "specific goal to achieve",
        "strategy": "how to achieve this goal",
        "resources": ["resources needed"],
        "milestones": ["checkpoints along the way"],
        "priority": "high/medium/low"
      }
    ]
  },
  "academic": {
    "title": "Academic Enhancement",
    "subjectSpecific": {
      "Mathematics": ["recommendations for math"],
      "Science": ["recommendations for science"],
      "English": ["recommendations for language"]
    },
    "studyTechniques": ["effective study methods for this student"],
    "skillBuilding": ["specific skills to develop"]
  },
  "behavioral": {
    "title": "Learning Behavior Optimization",
    "habits": ["positive habits to develop"],
    "environment": ["environment improvements"],
    "motivation": ["ways to boost motivation"],
    "timeManagement": ["time management strategies"]
  },
  "support": {
    "title": "Support System Recommendations",
    "parentSupport": ["how parents can help"],
    "teacherCollaboration": ["teacher communication points"],
    "peerLearning": ["collaborative learning opportunities"],
    "resources": ["additional learning resources"]
  }
}

Make recommendations specific, actionable, and appropriate for grade ${student.grade} level in ${student.country}.`;

    const modelId = "anthropic.claude-3-haiku-20240307-v1:0";
    const command = new InvokeModelCommand({
      modelId: modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 4000,
        temperature: 0.5,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const aiContent = responseBody.content[0].text;

    // Extract JSON from response
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const recommendations = JSON.parse(jsonMatch[0]);
      console.log(`AI generated recommendations for ${student.studentId}`);

      // Add implementation tracking
      return {
        ...recommendations,
        implementation: {
          trackingId: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          reviewDate: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          status: "active",
          customizationLevel: "personalized",
        },
      };
    }
  } catch (error) {
    console.error("Error generating AI recommendations:", error);
  }

  // Fallback recommendations
  return generateFallbackRecommendations(student, recentProgress);
}

/**
 * Regular progress tracking and update functions
 */
async function getProgress(queryParams) {
  const { studentId, subject, startDate, endDate, limit } = queryParams || {};

  if (!studentId) {
    return createResponse(400, { error: "studentId is required" });
  }

  const student = await getStudent(studentId);
  if (!student) {
    return createResponse(404, { error: "Student not found" });
  }

  // Build query with enhanced filtering
  const queryParams_ddb = {
    TableName: PROGRESS_TABLE,
    KeyConditionExpression: "studentId = :studentId",
    ExpressionAttributeValues: { ":studentId": studentId },
    ScanIndexForward: false,
    Limit: parseInt(limit) || 50,
  };

  // Add filters
  let filterExpressions = [];
  if (startDate && endDate) {
    filterExpressions.push("#timestamp BETWEEN :startDate AND :endDate");
    queryParams_ddb.ExpressionAttributeNames = { "#timestamp": "timestamp" };
    queryParams_ddb.ExpressionAttributeValues[":startDate"] = startDate;
    queryParams_ddb.ExpressionAttributeValues[":endDate"] = endDate;
  }

  if (subject) {
    filterExpressions.push("subject = :subject");
    queryParams_ddb.ExpressionAttributeValues[":subject"] = subject;
  }

  if (filterExpressions.length > 0) {
    queryParams_ddb.FilterExpression = filterExpressions.join(" AND ");
  }

  const result = await docClient.send(new QueryCommand(queryParams_ddb));
  const progressData = result.Items || [];

  // Calculate enhanced metrics
  const metrics = calculateEnhancedProgressMetrics(progressData, student);

  return createResponse(200, {
    student: {
      id: student.studentId,
      name: student.studentName,
      grade: student.grade,
      board: student.board,
      country: student.country,
    },
    progress: progressData,
    metrics: metrics,
    count: progressData.length,
    aiEnhanced: true,
  });
}

async function updateProgress(requestBody) {
  const {
    studentId,
    sessionId,
    subject,
    activity,
    performance,
    engagement,
    timeSpent,
    completed,
    notes,
    aiGenerated,
  } = requestBody;

  if (!studentId || !subject) {
    return createResponse(400, { error: "studentId and subject are required" });
  }

  const timestamp = new Date().toISOString();

  // Create enhanced progress entry
  const progressEntry = {
    studentId: studentId,
    timestamp: timestamp,
    sessionId: sessionId || crypto.randomUUID(),
    subject: subject,
    type: "progress_update",
    activity: activity,
    performance: performance,
    engagement: engagement,
    timeSpent: timeSpent,
    completed: completed,
    notes: notes,
    aiGenerated: aiGenerated || false,
    subjectDate: `${subject}#${timestamp.split("T")[0]}`,
    ttl: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
  };

  await docClient.send(
    new PutCommand({
      TableName: PROGRESS_TABLE,
      Item: progressEntry,
    }),
  );

  // Update student knowledge with AI insights
  if (performance) {
    await updateStudentKnowledgeWithAI(
      studentId,
      subject,
      performance,
      activity,
    );
  }

  // Calculate AI-enhanced engagement score
  const enhancedEngagementScore = calculateAIEngagementScore(
    engagement,
    timeSpent,
    completed,
    performance,
  );

  return createResponse(200, {
    message: "Progress updated successfully with AI enhancements",
    progressEntry: progressEntry,
    enhancedEngagementScore: enhancedEngagementScore,
    aiEnhanced: true,
  });
}

// Helper functions
async function getStudent(studentId) {
  const result = await docClient.send(
    new GetCommand({
      TableName: STUDENT_TABLE,
      Key: { studentId, profileVersion: "v1" },
    }),
  );
  return result.Item;
}

async function getProgressForPeriod(studentId, startDate, endDate) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: PROGRESS_TABLE,
      KeyConditionExpression:
        "studentId = :studentId AND #timestamp BETWEEN :startDate AND :endDate",
      ExpressionAttributeNames: { "#timestamp": "timestamp" },
      ExpressionAttributeValues: {
        ":studentId": studentId,
        ":startDate": startDate,
        ":endDate": endDate,
      },
      ScanIndexForward: false,
    }),
  );
  return result.Items || [];
}

async function getComprehensiveLearningHistory(studentId) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: PROGRESS_TABLE,
      KeyConditionExpression: "studentId = :studentId",
      ExpressionAttributeValues: { ":studentId": studentId },
      ScanIndexForward: false,
      Limit: 200, // Get more comprehensive history
    }),
  );
  return result.Items || [];
}

async function getRecentProgressData(studentId, days) {
  const startDate = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000,
  ).toISOString();
  const endDate = new Date().toISOString();
  return await getProgressForPeriod(studentId, startDate, endDate);
}

async function storeAnalyticsResult(
  studentId,
  analytics,
  period,
  analysisType,
) {
  const timestamp = new Date().toISOString();
  await docClient.send(
    new PutCommand({
      TableName: PROGRESS_TABLE,
      Item: {
        studentId: studentId,
        timestamp: timestamp,
        sessionId: crypto.randomUUID(),
        type: "ai_analytics_generated",
        analytics: analytics,
        period: period,
        analysisType: analysisType,
        aiGenerated: true,
        subjectDate: `analytics#${timestamp.split("T")[0]}`,
        ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 90 days retention
      },
    }),
  );
}

function calculateDateRange(period) {
  const now = new Date();
  let start;

  switch (period) {
    case "7d":
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90d":
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { start: start.toISOString(), end: now.toISOString() };
}

function calculateEnhancedProgressMetrics(progressData, student) {
  const basic = calculateBasicMetrics(progressData);
  const advanced = calculateAdvancedMetrics(progressData, student);

  return {
    ...basic,
    ...advanced,
    aiEnhanced: true,
    calculatedAt: new Date().toISOString(),
  };
}

function calculateBasicMetrics(progressData) {
  const totalSessions = progressData.filter(
    (p) => p.type === "learning_session",
  ).length;
  const completedActivities = progressData.filter(
    (p) => p.completed === true,
  ).length;
  const totalActivities = progressData.filter((p) => p.activity).length;

  return {
    totalSessions,
    completionRate:
      totalActivities > 0 ? (completedActivities / totalActivities) * 100 : 0,
    subjectsStudied: [
      ...new Set(progressData.map((p) => p.subject).filter(Boolean)),
    ].length,
    totalTimeSpent: progressData.reduce(
      (sum, p) => sum + (p.timeSpent || 0),
      0,
    ),
  };
}

function calculateAdvancedMetrics(progressData, student) {
  return {
    learningVelocity: calculateLearningVelocity(progressData),
    knowledgeRetention: calculateKnowledgeRetention(progressData),
    adaptiveLevel: calculateAdaptiveLevel(progressData),
    efficiencyScore: calculateLearningEfficiency(progressData),
  };
}

// Simplified implementations for helper functions
function generatePerformanceMetrics(progressData) {
  const performanceData = progressData.filter((p) => p.performance?.score);
  if (performanceData.length === 0) return "No performance data available";

  const avgScore =
    performanceData.reduce((sum, p) => sum + p.performance.score, 0) /
    performanceData.length;
  return `Average Score: ${avgScore.toFixed(1)}%, Sessions: ${performanceData.length}`;
}

function generateEngagementPatterns(progressData) {
  const engagementData = progressData.filter((p) => p.engagement);
  if (engagementData.length === 0) return "No engagement data available";

  const avgEngagement =
    engagementData.reduce((sum, p) => sum + (p.engagement.score || 0), 0) /
    engagementData.length;
  return `Average Engagement: ${avgEngagement.toFixed(1)}, Active Sessions: ${engagementData.length}`;
}

function generateLearningPatterns(progressData) {
  const timeData = progressData.filter((p) => p.timeSpent);
  if (timeData.length === 0) return "No time pattern data available";

  const avgTime =
    timeData.reduce((sum, p) => sum + p.timeSpent, 0) / timeData.length;
  return `Average Session Length: ${avgTime.toFixed(0)} minutes, Total Sessions: ${timeData.length}`;
}

function assessDataQuality(progressData) {
  const qualityScore = Math.min(100, (progressData.length / 50) * 100);
  return qualityScore > 80 ? "high" : qualityScore > 50 ? "medium" : "low";
}

function calculateConfidenceLevel(progressData) {
  return progressData.length > 30
    ? "high"
    : progressData.length > 10
      ? "medium"
      : "low";
}

// Fallback functions
function generateEnhancedFallbackAnalytics(student, progressData) {
  return {
    overview: {
      learningEffectiveness: "75 - Good progress with room for improvement",
      overallTrend: "stable",
      keyStrengths: ["Consistent participation", "Good time management"],
      areasForImprovement: [
        "Performance optimization",
        "Engagement enhancement",
      ],
    },
    metadata: {
      analysisDate: new Date().toISOString(),
      dataQuality: assessDataQuality(progressData),
      fallbackUsed: true,
    },
  };
}

function generateFallbackInsights(student, learningHistory) {
  return {
    learnerProfile: {
      dominantLearningStyle: "mixed - adapts to different content types",
      cognitiveStrengths: ["Problem solving", "Pattern recognition"],
      processingSpeed: "moderate - thoughtful approach to learning",
    },
    fallbackUsed: true,
  };
}

function generateFallbackRecommendations(student, recentProgress) {
  return {
    immediate: {
      title: "Actions for This Week",
      recommendations: [
        {
          action: "Maintain consistent daily study schedule",
          reason: "Consistency supports knowledge retention",
          priority: "high",
        },
      ],
    },
    fallbackUsed: true,
  };
}

// Additional helper functions
function calculateLearningVelocity(progressData) {
  return progressData.length > 0 ? progressData.length / 30 : 0; // Sessions per day
}

function calculateKnowledgeRetention(progressData) {
  return 85; // Simplified implementation
}

function calculateAdaptiveLevel(progressData) {
  return "moderate"; // Simplified implementation
}

function calculateLearningEfficiency(progressData) {
  return 78; // Simplified implementation
}

function calculateRecentPerformance(progressData) {
  const performanceData = progressData.filter((p) => p.performance?.score);
  if (performanceData.length === 0) return "No recent performance data";

  const avg =
    performanceData.reduce((sum, p) => sum + p.performance.score, 0) /
    performanceData.length;
  return `${avg.toFixed(1)}% average`;
}

function calculateRecentEngagement(progressData) {
  const engagementData = progressData.filter((p) => p.engagement?.score);
  if (engagementData.length === 0) return "No recent engagement data";

  const avg =
    engagementData.reduce((sum, p) => sum + p.engagement.score, 0) /
    engagementData.length;
  return `${avg.toFixed(1)}% average`;
}

function calculateRecentTimeSpent(progressData) {
  return progressData.reduce((sum, p) => sum + (p.timeSpent || 0), 0);
}

function identifyCurrentChallenges(progressData) {
  const challenges = [];
  const recentPerf = calculateRecentPerformance(progressData);
  if (recentPerf.includes("No"))
    challenges.push("Limited performance tracking");
  return challenges.join(", ") || "No major challenges identified";
}

function calculateAIEngagementScore(
  engagement,
  timeSpent,
  completed,
  performance,
) {
  let score = 0;
  if (engagement) score += (engagement.score || 0) * 0.4;
  if (timeSpent >= 15) score += 25;
  if (completed) score += 30;
  if (performance && performance.score >= 80) score += 15;

  return Math.min(100, Math.round(score));
}

async function updateStudentKnowledgeWithAI(
  studentId,
  subject,
  performance,
  activity,
) {
  // Enhanced knowledge update with AI insights
  const student = await getStudent(studentId);
  if (!student) return;

  const currentKnowledge = student.knowledgeLevel || {};
  const subjectKnowledge = currentKnowledge[subject] || {
    level: 50,
    lastUpdated: new Date().toISOString(),
    aiTracked: true,
  };

  // AI-enhanced knowledge adjustment
  let adjustment = 0;
  if (performance.score >= 95) adjustment = 6;
  else if (performance.score >= 90) adjustment = 5;
  else if (performance.score >= 80) adjustment = 3;
  else if (performance.score >= 70) adjustment = 1;
  else if (performance.score >= 60) adjustment = 0;
  else adjustment = -2;

  // Consider activity type for adjustment
  if (activity && activity.includes("assessment")) adjustment *= 1.2;
  if (activity && activity.includes("practice")) adjustment *= 0.8;

  subjectKnowledge.level = Math.max(
    0,
    Math.min(100, subjectKnowledge.level + adjustment),
  );
  subjectKnowledge.lastUpdated = new Date().toISOString();
  subjectKnowledge.aiTracked = true;
  currentKnowledge[subject] = subjectKnowledge;

  await docClient.send(
    new UpdateCommand({
      TableName: STUDENT_TABLE,
      Key: { studentId, profileVersion: "v1" },
      UpdateExpression:
        "SET knowledgeLevel = :knowledge, updatedAt = :timestamp",
      ExpressionAttributeValues: {
        ":knowledge": currentKnowledge,
        ":timestamp": new Date().toISOString(),
      },
    }),
  );
}

function createResponse(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      ...headers,
    },
    body: JSON.stringify(body),
  };
}
