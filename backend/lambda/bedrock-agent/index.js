/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎓 SMART SCHOOL TUTOR - BEDROCK AI AGENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This Lambda function serves as the core AI tutoring engine using AWS Bedrock.
 * It provides intelligent, personalized educational interactions for students
 * across multiple subjects and grade levels.
 *
 * 🔧 CORE FUNCTIONALITY:
 * • Personalized AI tutoring conversations
 * • Curriculum-aligned content generation
 * • Adaptive learning based on student performance
 * • Real-time progress tracking and analytics
 * • Multi-subject support with context awareness
 *
 * 🧠 AI CAPABILITIES:
 * • Claude-3-Haiku model for fast, engaging responses
 * • Topic detection and comprehensive introductions
 * • Learning objective creation and assessment
 * • Contextual conversation management
 * • Educational content validation
 *
 * 📊 DATA INTEGRATION:
 * • DynamoDB for student profiles and progress
 * • Session management and conversation history
 * • Learning analytics and performance metrics
 * • Curriculum compliance tracking
 *
 * 🎯 EDUCATIONAL STANDARDS:
 * • CBSE, ICSE, IB, and international curriculum support
 * • Grade-appropriate content and language
 * • Learning pace adaptation (slow/medium/fast)
 * • Country-specific educational context
 *
 * @author Pankaj Negi
 * @version 2.0.0
 * @since 2024
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ────────────────────────────────────────────────────────────────────────────
// 📦 DEPENDENCIES & AWS SDK CLIENTS
// ────────────────────────────────────────────────────────────────────────────

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");
const {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} = require("@aws-sdk/client-bedrock-agent-runtime");
const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const crypto = require("crypto");

// ────────────────────────────────────────────────────────────────────────────
// 🔧 AWS CLIENT INITIALIZATION
// ────────────────────────────────────────────────────────────────────────────

// Bedrock client for AI model interactions
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION,
});

// DynamoDB clients for data persistence
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

// ────────────────────────────────────────────────────────────────────────────
// 🌍 ENVIRONMENT CONFIGURATION
// ────────────────────────────────────────────────────────────────────────────

// Table names from environment variables
const STUDENT_TABLE = process.env.STUDENT_TABLE;
const PROGRESS_TABLE = process.env.PROGRESS_TABLE;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🚀 MAIN LAMBDA HANDLER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Entry point for all AI tutoring requests. Routes requests based on HTTP method
 * and resource path to appropriate handler functions.
 *
 * @param {Object} event - AWS Lambda event object containing request data
 * @returns {Object} HTTP response with status code and body
 *
 * SUPPORTED ROUTES:
 * • POST /agent/chat - Traditional agent-based chat interactions
 * • POST /ai/tutor - Direct AI tutor requests from frontend
 * • POST /* - General agent interactions
 * ═══════════════════════════════════════════════════════════════════════════
 */
exports.handler = async (event) => {
  console.log("Event:", JSON.stringify(event, null, 2));

  try {
    const { httpMethod, body, pathParameters, resource } = event;
    const requestBody = body ? JSON.parse(body) : {};

    switch (httpMethod) {
      case "POST":
        if (resource === "/agent/chat") {
          // Handle structured agent-based chat interactions
          return await handleChatInteraction(requestBody);
        } else if (resource === "/ai/tutor") {
          // Handle direct AI tutor requests (primary frontend route)
          return await handleAiTutorRequest(requestBody);
        } else {
          // Handle legacy agent interactions
          return await handleAgentInteraction(requestBody);
        }
      default:
        return createResponse(405, { error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Error:", error);
    return createResponse(500, {
      error: "Internal server error",
      details: error.message,
    });
  }
};

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💬 CHAT INTERACTION HANDLER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Handles structured chat interactions with session management and context.
 * This function manages the complete conversation flow including student
 * identification, subject context, and session continuity.
 *
 * @param {Object} requestBody - Request payload containing interaction data
 * @param {string} requestBody.studentId - Unique student identifier
 * @param {string} requestBody.message - Student's message/question
 * @param {string} requestBody.subject - Current subject being studied
 * @param {string} requestBody.sessionId - Session identifier for continuity
 * @returns {Object} Response with AI tutor's reply and session data
 * ═══════════════════════════════════════════════════════════════════════════
 */
async function handleChatInteraction(requestBody) {
  const { studentId, message, subject, sessionId } = requestBody;

  // Get student profile for personalized responses
  const student = await getStudent(studentId);
  if (!student) {
    return createResponse(404, { error: "Student not found" });
  }

  // Get recent progress for context
  const recentProgress = await getRecentProgress(studentId, subject);

  // Generate AI response using Bedrock
  const aiResponse = await generateTutorResponse(
    student,
    message,
    subject,
    recentProgress,
  );

  // Log interaction for progress tracking
  await logInteraction(studentId, subject, message, aiResponse, sessionId);

  return createResponse(200, {
    response: aiResponse,
    studentName: student.studentName,
    subject: subject,
    sessionId: sessionId || crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  });
}

async function handleAgentInteraction(requestBody) {
  const { studentId, action, subject, data } = requestBody;

  // Get student profile
  const student = await getStudent(studentId);
  if (!student) {
    return createResponse(404, { error: "Student not found" });
  }

  switch (action) {
    case "start_session":
      return await startLearningSession(student, subject, data);
    case "generate_content":
      return await generateContent(student, subject, data);
    case "assess_knowledge":
      return await assessKnowledge(student, subject, data);
    case "get_recommendations":
      return await getRecommendations(student, subject);
    default:
      return createResponse(400, { error: "Invalid action" });
  }
}

async function handleAiTutorRequest(requestBody) {
  const { message, studentProfile, context } = requestBody;

  // Validate required fields
  if (!message || !studentProfile) {
    return createResponse(400, {
      error: "Missing required fields: message, studentProfile",
    });
  }

  // Simple rate limiting: check if message is the fallback error message
  if (
    message.includes(
      "I apologize, but I am having trouble generating a response right now",
    )
  ) {
    console.log("Detected recursive error message, preventing infinite loop");
    return createResponse(429, {
      error: "Rate limited",
      message:
        "Please wait a moment before making another request. The AI service is currently busy.",
      retryAfter: 5,
    });
  }

  // Create a mock student object from the profile
  const student = {
    studentName: "Student", // Default name since it's not provided
    studentId: "frontend-request", // Mock ID for logging
    grade: studentProfile.grade,
    board: studentProfile.board,
    country: studentProfile.country,
    subjects: studentProfile.subjects,
    learningPace: "medium", // Default value
  };

  // Determine the subject from context or default to first subject
  const subject = context?.subject || studentProfile.subjects[0] || "General";

  // Generate AI response using Bedrock
  const aiResponse = await generateTutorResponse(student, message, subject, []);

  return createResponse(200, {
    response: aiResponse,
    studentName: student.studentName,
    subject: subject,
    sessionId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    source: "ai_tutor",
  });
}

async function startLearningSession(student, subject, data) {
  const sessionId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  // Get curriculum-compliant content prompt
  const contentPrompt = buildContentPrompt(student, subject, data);

  // Generate session content using Bedrock
  const sessionContent = await generateTutorResponse(
    student,
    contentPrompt,
    subject,
    [],
  );

  // Save session start
  await docClient.send(
    new PutCommand({
      TableName: PROGRESS_TABLE,
      Item: {
        studentId: student.studentId,
        timestamp: timestamp,
        sessionId: sessionId,
        subject: subject,
        type: "session_start",
        content: sessionContent,
        subjectDate: `${subject}#${timestamp.split("T")[0]}`,
        ttl: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year TTL
      },
    }),
  );

  return createResponse(200, {
    sessionId: sessionId,
    content: sessionContent,
    subject: subject,
    message: "Learning session started successfully",
  });
}

async function generateContent(student, subject, data) {
  const { contentType, difficulty, topic } = data;

  const prompt = buildContentGenerationPrompt(
    student,
    subject,
    contentType,
    difficulty,
    topic,
  );
  const content = await generateTutorResponse(student, prompt, subject, []);

  return createResponse(200, {
    content: content,
    contentType: contentType,
    subject: subject,
    difficulty: difficulty,
    topic: topic,
  });
}

async function assessKnowledge(student, subject, data) {
  const { answers, questions } = data;

  const assessmentPrompt = buildAssessmentPrompt(
    student,
    subject,
    questions,
    answers,
  );
  const assessment = await generateTutorResponse(
    student,
    assessmentPrompt,
    subject,
    [],
  );

  // Log assessment results
  const timestamp = new Date().toISOString();
  await docClient.send(
    new PutCommand({
      TableName: PROGRESS_TABLE,
      Item: {
        studentId: student.studentId,
        timestamp: timestamp,
        sessionId: crypto.randomUUID(),
        subject: subject,
        type: "assessment",
        questions: questions,
        answers: answers,
        assessment: assessment,
        subjectDate: `${subject}#${timestamp.split("T")[0]}`,
        ttl: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
      },
    }),
  );

  return createResponse(200, {
    assessment: assessment,
    subject: subject,
    timestamp: timestamp,
  });
}

async function getRecommendations(student, subject) {
  const recentProgress = await getRecentProgress(student.studentId, subject);

  const recommendationPrompt = buildRecommendationPrompt(
    student,
    subject,
    recentProgress,
  );
  const recommendations = await generateTutorResponse(
    student,
    recommendationPrompt,
    subject,
    recentProgress,
  );

  return createResponse(200, {
    recommendations: recommendations,
    subject: subject,
    basedOnSessions: recentProgress.length,
  });
}

async function generateTutorResponse(student, prompt, subject, context) {
  const systemPrompt = buildSystemPrompt(student, subject);

  // Check if this is a topic introduction/start pattern
  const isTopicIntroduction = isTopicStartMessage(prompt);

  // Build a more specific user prompt that clearly indicates the subject
  let userPrompt;

  if (isTopicIntroduction) {
    // Extract topic name from the prompt
    const topicName = extractTopicName(prompt, subject);

    userPrompt = `Subject: ${subject}
Grade: ${student.grade}
Board: ${student.board}
Country: ${student.country}

COMPREHENSIVE TOPIC INTRODUCTION REQUEST for: "${topicName}"

The student has just selected or started learning about "${topicName}" in ${subject}. This is their first interaction with this topic. Please provide a complete, engaging, and comprehensive learning experience that includes ALL of the following sections:

🎯 **WELCOME & MOTIVATION**
- Start with an enthusiastic welcome acknowledging their interest in "${topicName}"
- Briefly mention why this topic is exciting and important

📚 **IN-DEPTH TOPIC EXPLANATION**
- Explain "${topicName}" using simple, clear language appropriate for ${student.grade} grade
- Break down complex concepts into easy-to-understand parts
- Use analogies and simple explanations that relate to a student's everyday life
- Cover the fundamental concepts step by step

🌍 **REAL-WORLD EXAMPLES & APPLICATIONS**
- Provide 3-4 concrete, relatable examples of how "${topicName}" is used in real life
- Show practical applications that a ${student.grade} grade student can understand and relate to
- Connect the topic to things they see, use, or experience daily

🧠 **QUICK UNDERSTANDING CHECK**
Please include these specific types of questions:

**True/False Questions** (2-3 questions):
- Simple statements about the topic that test basic understanding
- Format: "True or False: [statement]"

**Fill in the Blank** (2-3 questions):
- Complete sentences with missing key terms
- Format: "Fill in the blank: [sentence with ___]"

**Short Answer Questions** (1-2 questions):
- Questions that encourage critical thinking
- Ask for brief explanations or personal connections

📈 **LEARNING OBJECTIVES & NEXT STEPS**
- Clearly state what they will achieve by mastering this topic
- Suggest what they should focus on first
- End with an encouraging question about what specific aspect they'd like to explore

**FORMATTING REQUIREMENTS:**
- Use clear headers with emojis
- Use bullet points and numbered lists
- Make it visually engaging and easy to read
- Keep the tone encouraging and supportive

IMPORTANT: This should be a complete learning session starter that gives students everything they need to begin their journey with "${topicName}" following ${student.country} ${student.board} curriculum standards for ${subject} Grade ${student.grade}.`;
  } else {
    // Regular conversation prompt
    userPrompt = `Subject: ${subject}
Grade: ${student.grade}
Board: ${student.board}
Country: ${student.country}

Context from recent sessions:
${context.map((c) => `- ${c.type}: ${c.content}`).join("\n")}

Student Query/Task: ${prompt}

Please provide an engaging, educational response for the subject "${subject}" that:
1. Is appropriate for ${student.grade} grade level
2. Follows ${student.country} ${student.board} curriculum standards for ${subject}
3. Maintains an encouraging and interactive tone
4. Includes practical examples relevant to ${subject}
5. Asks follow-up questions to ensure understanding
6. Provides subject-specific content only for ${subject}
7. Acts as a dedicated ${subject} tutor who is committed to enhance student knowledge

IMPORTANT: This is a ${subject} question, so provide ${subject}-specific content only. Do not mix subjects or provide generic responses.`;
  }

  const requestPayload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 1500,
    temperature: 0.7,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
  };

  // Log the complete request
  console.log("========== BEDROCK AI REQUEST ==========");
  console.log(
    "Student:",
    student.studentName,
    "| Grade:",
    student.grade,
    "| Subject:",
    subject,
  );
  console.log("Original Prompt:", prompt);
  console.log("System Prompt:", systemPrompt);
  console.log("User Prompt:", userPrompt);
  console.log("Full Request Payload:", JSON.stringify(requestPayload, null, 2));
  console.log("=========================================");

  // Implement exponential backoff for rate limiting
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount <= maxRetries) {
    try {
      const response = await bedrockClient.send(
        new InvokeModelCommand({
          modelId: "anthropic.claude-3-haiku-20240307-v1:0",
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify(requestPayload),
        }),
      );

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const aiResponse = responseBody.content[0].text;

      // Log the complete response
      console.log("========== BEDROCK AI RESPONSE ==========");
      console.log("Response Status:", response.$metadata?.httpStatusCode);
      console.log("Model Used:", "anthropic.claude-3-haiku-20240307-v1:0");
      console.log("Response Length:", aiResponse.length, "characters");
      console.log("AI Response:", aiResponse);
      console.log("Raw Response Body:", JSON.stringify(responseBody, null, 2));
      console.log("==========================================");

      return aiResponse;
    } catch (error) {
      console.error("========== BEDROCK API ERROR ==========");
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        statusCode: error.$metadata?.httpStatusCode,
        requestId: error.$metadata?.requestId,
        retryCount: retryCount,
        maxRetries: maxRetries,
      });

      // Check if it's a rate limiting error (429)
      if (
        error.$metadata?.httpStatusCode === 429 ||
        error.name === "ThrottlingException"
      ) {
        retryCount++;
        if (retryCount <= maxRetries) {
          // Exponential backoff: wait 2^retryCount seconds
          const waitTime = Math.pow(2, retryCount) * 1000;
          console.log(
            `Rate limited. Waiting ${waitTime}ms before retry ${retryCount}/${maxRetries}...`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        } else {
          console.error("Max retries exceeded for rate limiting");
          return `I'm currently experiencing high demand and need to limit requests. Please wait a moment and try again. This helps ensure fair access for all students.`;
        }
      }

      // For other types of errors, don't retry
      console.error(
        "Request that failed:",
        JSON.stringify(requestPayload, null, 2),
      );
      console.error("======================================");

      // Return a more specific error message based on error type
      if (error.code === "ValidationException") {
        return "There was an issue with the request format. Please try rephrasing your question.";
      } else if (error.code === "ResourceNotFoundException") {
        return "The AI model is temporarily unavailable. Please try again in a few minutes.";
      } else {
        return "I apologize, but I am having trouble generating a response right now. Please try again in a moment.";
      }
    }
  }
}

async function getStudent(studentId) {
  const result = await docClient.send(
    new GetCommand({
      TableName: STUDENT_TABLE,
      Key: { studentId, profileVersion: "v1" },
    }),
  );
  return result.Item;
}

async function getRecentProgress(studentId, subject) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: PROGRESS_TABLE,
      KeyConditionExpression: "studentId = :studentId",
      FilterExpression: "subject = :subject",
      ExpressionAttributeValues: {
        ":studentId": studentId,
        ":subject": subject,
      },
      ScanIndexForward: false,
      Limit: 10,
    }),
  );
  return result.Items || [];
}

async function logInteraction(
  studentId,
  subject,
  message,
  response,
  sessionId,
) {
  const timestamp = new Date().toISOString();
  await docClient.send(
    new PutCommand({
      TableName: PROGRESS_TABLE,
      Item: {
        studentId: studentId,
        timestamp: timestamp,
        sessionId: sessionId || crypto.randomUUID(),
        subject: subject,
        type: "chat_interaction",
        userMessage: message,
        aiResponse: response,
        subjectDate: `${subject}#${timestamp.split("T")[0]}`,
        ttl: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
      },
    }),
  );
}

function buildSystemPrompt(student, subject) {
  return `You are an expert ${subject} tutor for ${student.studentName}, a ${student.grade} grade student from ${student.country} following the ${student.board} curriculum. 

Student Profile:
- Name: ${student.studentName}
- Grade: ${student.grade}
- School Board: ${student.board}
- Country: ${student.country}
- Learning Pace: ${student.learningPace}
- Current Subject: ${subject}

Your specialized role as a ${subject} tutor is to:
1. Provide ${subject}-specific educational content aligned with ${student.grade} grade ${student.board} curriculum standards
2. Use ${subject}-appropriate terminology, concepts, and examples
3. Adapt ${subject} content to the student's learning pace and level
4. Create engaging, interactive ${subject} learning experiences
5. Track understanding of ${subject} concepts and provide appropriate challenges
6. Maintain a supportive and encouraging tone while teaching ${subject}
7. Never redirect to external websites unless specifically asked for references
8. Focus exclusively on ${subject} knowledge and skills development
9. Generate ${subject}-specific assignments and practice problems
10. Provide timely feedback on ${subject} performance to enhance learning outcomes

CRITICAL: You are a ${subject} tutor. All responses must be relevant to ${subject} only. Do not provide content for other subjects. If asked about topics outside ${subject}, politely redirect to ${subject} content.

Always remember to be patient, encouraging, and age-appropriate in your ${subject} responses.`;
}

function buildContentPrompt(student, subject, data) {
  const { topic, learningGoal } = data || {};
  return `Please create an engaging lesson for ${subject} on the topic of "${topic || "today's curriculum"}" for a ${student.grade} grade student. The lesson should include:
1. Clear learning objectives
2. Explain the topic in detail using simple words and realtime examples for student to corelate
3. Interactive explanations with examples
4. Practice questions
5. Real-world applications ${
    learningGoal
      ? `
6. Focus on: ${learningGoal}`
      : ""
  }

Make it curriculum-compliant for ${student.country} ${student.board} standards.`;
}

function buildContentGenerationPrompt(
  student,
  subject,
  contentType,
  difficulty,
  topic,
) {
  return `Generate ${contentType} content for ${subject} on the topic "${topic}" at ${difficulty} difficulty level for a ${student.grade} grade student from ${student.country} following ${student.board} curriculum.

Requirements:
- Age-appropriate language and examples
- Curriculum-compliant content
- Interactive and engaging format
- Include practice exercises
- Provide clear explanations`;
}

function buildAssessmentPrompt(student, subject, questions, answers) {
  return `Please assess the following answers from ${student.studentName} (${student.grade} grade) for ${subject}:

Questions and Answers:
${questions.map((q, i) => `Q${i + 1}: ${q}\nA${i + 1}: ${answers[i]}`).join("\n\n")}

Provide:
1. Correct/incorrect feedback for each answer
2. Explanations for incorrect answers
3. Areas of strength and improvement
4. Recommendations for further study
5. Encouragement and next steps

Be constructive and supportive in your feedback.`;
}

function buildRecommendationPrompt(student, subject, recentProgress) {
  return `Based on ${student.studentName}'s recent learning sessions in ${subject}, provide personalized recommendations for:

1. Topics to review or strengthen
2. New concepts to explore
3. Practice exercises
4. Study strategies
5. Learning pace adjustments

Recent session summary:
${recentProgress
  .slice(0, 5)
  .map(
    (p) =>
      `- ${p.type}: ${p.content ? p.content.substring(0, 100) + "..." : "N/A"}`,
  )
  .join("\n")}

Make recommendations specific to ${student.grade} grade ${student.country} ${student.board} curriculum.`;
}

function isTopicStartMessage(prompt) {
  // Patterns that indicate a new topic is being introduced or selected
  const topicStartPatterns = [
    /let's explore.*together/i,
    /learning.*grade \d+/i,
    /approach this/i,
    /learning objectives/i,
    /study approach/i,
    /specific aspect.*focus on first/i,
    /ready to provide personalized explanations/i,
    /start.*topic/i,
    /begin.*lesson/i,
    /introduce.*concept/i,
    /great to see your enthusiasm/i,
    /what specific aspect.*would you like to focus on first/i,
    /i'm here to guide you through/i,
    /your ai tutor is ready/i,
    /Understanding.*-\s*Grade/i,
    /Start Learning/i,
    /Topic:/i,
    /Chapter:/i,
    // Pattern for when a topic name appears prominently (like "Understanding Quadrilaterals")
    /Understanding\s+[A-Z][a-z]+/i,
    // Pattern for curriculum topics being introduced
    /Learning\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/i,
  ];

  return topicStartPatterns.some((pattern) => pattern.test(prompt));
}

function extractTopicName(prompt, subject) {
  // Try to extract topic name from common patterns
  let topicName = subject; // Default fallback

  // Pattern: "Let's explore [TOPIC] together"
  let match = prompt.match(/let's explore\s+(.*?)\s+together/i);
  if (match) {
    topicName = match[1].trim();
    return topicName;
  }

  // Pattern: "Learning [TOPIC] - Grade X"
  match = prompt.match(/learning\s+(.*?)\s+-\s+grade/i);
  if (match) {
    topicName = match[1].trim();
    return topicName;
  }

  // Pattern: "Understanding [TOPIC]" - most common pattern from your example
  match = prompt.match(
    /understanding\s+(.*?)(?:\s+-|\s+together|\s+grade|\s*$|\.|!)/i,
  );
  if (match) {
    topicName = "Understanding " + match[1].trim();
    return topicName;
  }

  // Pattern: Look for quoted topics
  match = prompt.match(/"([^"]+)"/);
  if (match) {
    topicName = match[1].trim();
    return topicName;
  }

  // Pattern: "Topic: [TOPIC]" or "Chapter: [TOPIC]"
  match = prompt.match(/(?:topic|chapter):\s*(.+?)(?:\n|$)/i);
  if (match) {
    topicName = match[1].trim();
    return topicName;
  }

  // Pattern: Look for title case words that might be topics (but be more specific)
  match = prompt.match(
    /\b(Understanding\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*|[A-Z][a-z]+\s+and\s+[A-Z][a-z]+|[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/,
  );
  if (
    match &&
    match[1].length > 3 &&
    !match[1].includes("Grade") &&
    !match[1].includes("Learning")
  ) {
    topicName = match[1].trim();
    return topicName;
  }

  return topicName;
}

function createResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
    body: JSON.stringify(body),
  };
}
