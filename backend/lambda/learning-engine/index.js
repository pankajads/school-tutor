/**
 * AI-Powered Learning Engine Lambda Handler
 *
 * This function provides intelligent learning content generation using AWS Bedrock AI
 * with comprehensive educational context awareness and progress tracking integration.
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const crypto = require("crypto");

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "ap-southeast-1",
});

const STUDENT_TABLE = process.env.STUDENT_TABLE;
const PROGRESS_TABLE = process.env.PROGRESS_TABLE;
const CONTENT_BUCKET = process.env.CONTENT_BUCKET;

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log("Learning Engine Event:", JSON.stringify(event, null, 2));

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
    const path = event.path || event.pathParameters?.proxy || "";
    const resource = event.resource || path;

    console.log(
      "Request path:",
      path,
      "Resource:",
      resource,
      "Method:",
      httpMethod,
    );

    switch (httpMethod) {
      case "GET":
        if (resource.includes("/sessions")) {
          if (pathParameters && pathParameters.sessionId) {
            return await getSession(pathParameters.sessionId);
          } else {
            return await getSessions(queryStringParameters);
          }
        } else if (resource.includes("/recommendations")) {
          return await getRecommendations(queryStringParameters);
        }
        break;
      case "POST":
        if (resource.includes("/sessions") && !pathParameters?.sessionId) {
          return await createSession(requestBody);
        } else if (resource.includes("/interact")) {
          return await handleChatInteraction(requestBody);
        } else if (resource === "/learning" || resource.endsWith("/learning")) {
          return await startLearningSession(requestBody);
        }
        break;
      case "PUT":
        if (resource.includes("/sessions") && pathParameters?.sessionId) {
          return await updateSession(pathParameters.sessionId, requestBody);
        }
        break;
      default:
        return createResponse(405, { error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Learning Engine Error:", error);
    return createResponse(500, {
      error: "Internal server error",
      details: error.message,
    });
  }
};

/**
 * Create a new learning session
 */
async function createSession(requestBody) {
  const { studentId, subjects, sessionType, preferences } = requestBody;

  // Get student profile
  const student = await getStudent(studentId);
  if (!student) {
    return createResponse(404, { error: "Student not found" });
  }

  const sessionId = crypto.randomUUID();
  const session = {
    sessionId,
    studentId,
    subjects: subjects || ["Mathematics"],
    sessionType: sessionType || "practice",
    preferences: preferences || {},
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await docClient.send(
      new PutCommand({
        TableName: PROGRESS_TABLE,
        Item: {
          studentId: `session_${sessionId}`,
          progressType: "learning_session",
          ...session,
        },
      }),
    );

    return createResponse(200, session);
  } catch (error) {
    console.error("Error creating session:", error);
    return createResponse(500, { error: "Failed to create session" });
  }
}

/**
 * Get learning sessions
 */
async function getSessions(queryParams) {
  const studentId = queryParams?.studentId;
  if (!studentId) {
    return createResponse(400, { error: "Student ID is required" });
  }

  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: PROGRESS_TABLE,
        IndexName: "progressType-index",
        KeyConditionExpression: "progressType = :progressType",
        FilterExpression: "contains(studentId, :studentId)",
        ExpressionAttributeValues: {
          ":progressType": "learning_session",
          ":studentId": studentId,
        },
      }),
    );

    return createResponse(200, {
      sessions: result.Items || [],
      count: result.Count || 0,
    });
  } catch (error) {
    console.error("Error getting sessions:", error);
    return createResponse(500, { error: "Failed to get sessions" });
  }
}

/**
 * Get a specific session
 */
async function getSession(sessionId) {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: PROGRESS_TABLE,
        Key: {
          studentId: `session_${sessionId}`,
          progressType: "learning_session",
        },
      }),
    );

    if (!result.Item) {
      return createResponse(404, { error: "Session not found" });
    }

    return createResponse(200, result.Item);
  } catch (error) {
    console.error("Error getting session:", error);
    return createResponse(500, { error: "Failed to get session" });
  }
}

/**
 * Update a learning session
 */
async function updateSession(sessionId, requestBody) {
  const updates = requestBody;

  try {
    const updateExpression = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    Object.keys(updates).forEach((key) => {
      if (key !== "sessionId" && key !== "studentId") {
        updateExpression.push(`#${key} = :${key}`);
        expressionAttributeValues[`:${key}`] = updates[key];
        expressionAttributeNames[`#${key}`] = key;
      }
    });

    updateExpression.push("#updatedAt = :updatedAt");
    expressionAttributeValues[":updatedAt"] = new Date().toISOString();
    expressionAttributeNames["#updatedAt"] = "updatedAt";

    await docClient.send(
      new UpdateCommand({
        TableName: PROGRESS_TABLE,
        Key: {
          studentId: `session_${sessionId}`,
          progressType: "learning_session",
        },
        UpdateExpression: `SET ${updateExpression.join(", ")}`,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
      }),
    );

    return createResponse(200, { message: "Session updated successfully" });
  } catch (error) {
    console.error("Error updating session:", error);
    return createResponse(500, { error: "Failed to update session" });
  }
}

/**
 * Start an AI-powered learning session
 */
async function startLearningSession(requestBody) {
  const { studentId, subjects, sessionType, preferences } = requestBody;

  // Get student profile
  const student = await getStudent(studentId);
  if (!student) {
    return createResponse(404, { error: "Student not found" });
  }

  // Get AI-powered subjects if not provided
  const selectedSubjects =
    subjects && subjects.length >= 2
      ? subjects
      : await getAIRecommendedSubjects(student, subjects);

  if (selectedSubjects.length < 2) {
    return createResponse(400, {
      error: "Minimum two subjects required per session",
      suggestion: "Try requesting AI subject recommendations for your profile",
    });
  }

  const sessionId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  // Generate AI-powered session content
  const sessionContent = await generateAISessionContent(
    student,
    selectedSubjects,
    sessionType,
    preferences,
  );

  // Save session with detailed tracking
  await docClient.send(
    new PutCommand({
      TableName: PROGRESS_TABLE,
      Item: {
        studentId: student.studentId,
        timestamp: timestamp,
        sessionId: sessionId,
        type: "learning_session",
        subjects: selectedSubjects,
        sessionType: sessionType || "regular",
        content: sessionContent,
        status: "started",
        subjectDate: `multi#${timestamp.split("T")[0]}`,
        aiGenerated: true,
        generationMethod: "bedrock_ai",
        ttl: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
      },
    }),
  );

  // Update last interaction
  await updateLastInteraction(student.studentId);

  return createResponse(200, {
    sessionId: sessionId,
    subjects: selectedSubjects,
    content: sessionContent,
    studentName: student.studentName,
    estimatedDuration: calculateSessionDuration(sessionContent),
    aiGenerated: true,
    message: "AI-powered learning session started successfully",
  });
}

/**
 * Generate AI-powered educational content
 */
async function generateContent(requestBody) {
  const { studentId, subject, contentType, difficulty, topic, assignment } =
    requestBody;

  // Get student profile
  const student = await getStudent(studentId);
  if (!student) {
    return createResponse(404, { error: "Student not found" });
  }

  // Get learning history for AI adaptation
  const learningHistory = await getLearningHistory(studentId, subject);

  // Generate AI-powered adaptive content
  const adaptiveContent = await generateAIContent(
    student,
    subject,
    contentType,
    difficulty,
    topic,
    learningHistory,
    assignment,
  );

  // Store content in S3
  const contentKey = `ai-content/${studentId}/${subject}/${Date.now()}.json`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: CONTENT_BUCKET,
      Key: contentKey,
      Body: JSON.stringify(adaptiveContent),
      ContentType: "application/json",
      Metadata: {
        studentId: studentId,
        subject: subject,
        contentType: contentType,
        aiGenerated: "true",
        generatedAt: new Date().toISOString(),
      },
    }),
  );

  // Log content generation with AI tracking
  const timestamp = new Date().toISOString();
  await docClient.send(
    new PutCommand({
      TableName: PROGRESS_TABLE,
      Item: {
        studentId: studentId,
        timestamp: timestamp,
        sessionId: crypto.randomUUID(),
        subject: subject,
        type: "ai_content_generated",
        contentType: contentType,
        difficulty: difficulty,
        topic: topic,
        contentKey: contentKey,
        aiGenerated: true,
        generationMethod: "bedrock_ai",
        subjectDate: `${subject}#${timestamp.split("T")[0]}`,
        ttl: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
      },
    }),
  );

  return createResponse(200, {
    content: adaptiveContent,
    subject: subject,
    contentType: contentType,
    difficulty: difficulty,
    topic: topic,
    aiGenerated: true,
    adaptationNotes: generateAdaptationNotes(student, learningHistory),
    contentKey: contentKey,
  });
}

/**
 * Get AI-recommended subjects based on student profile
 */
async function getAIRecommendedSubjects(student, requestedSubjects) {
  try {
    const prompt = `You are an educational advisor. Based on the following student profile, recommend 2-3 core subjects for a learning session.

Student Profile:
- Grade: ${student.grade}
- Country: ${student.country}
- Educational Board: ${student.board}
- School: ${student.school}
- Learning Pace: ${student.learningPace}
- Current Subjects: ${student.subjects ? student.subjects.join(", ") : "Not specified"}
- Requested Subjects: ${requestedSubjects ? requestedSubjects.join(", ") : "None"}

Please recommend 2-3 subjects that are:
1. Age-appropriate for grade ${student.grade}
2. Aligned with ${student.board} curriculum standards
3. Suitable for ${student.country} educational context
4. Balanced between core subjects (Math, Science, English)

Respond with only a JSON array of subject names, for example: ["Mathematics", "Science", "English"]`;

    const modelId = "anthropic.claude-3-haiku-20240307-v1:0";
    const command = new InvokeModelCommand({
      modelId: modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1000,
        temperature: 0.3,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const aiContent = responseBody.content[0].text;

    // Extract JSON array from response
    const jsonMatch = aiContent.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      const subjects = JSON.parse(jsonMatch[0]);
      console.log(`AI recommended subjects: ${subjects.join(", ")}`);
      return subjects;
    }
  } catch (error) {
    console.error("Error getting AI subject recommendations:", error);
  }

  // Fallback to basic subjects
  return ["Mathematics", "Science"];
}

/**
 * Generate AI-powered session content
 */
async function generateAISessionContent(
  student,
  subjects,
  sessionType,
  preferences,
) {
  const sessionContent = {};

  for (const subject of subjects) {
    const subjectHistory = await getLearningHistory(student.studentId, subject);
    const difficulty = calculateDifficulty(student, subjectHistory);

    // Generate AI content for each subject
    sessionContent[subject] = await generateSubjectSessionContent(
      student,
      subject,
      difficulty,
      sessionType,
      preferences,
      subjectHistory,
    );
  }

  return sessionContent;
}

/**
 * Generate AI content for a specific subject in the session
 */
async function generateSubjectSessionContent(
  student,
  subject,
  difficulty,
  sessionType,
  preferences,
  history,
) {
  try {
    const prompt = `You are an expert educational content creator. Generate a comprehensive learning session for:

Student Context:
- Name: ${student.studentName}
- Grade: ${student.grade}
- Country: ${student.country}
- Board: ${student.board}
- Learning Pace: ${student.learningPace}

Subject: ${subject}
Difficulty Level: ${difficulty}
Session Type: ${sessionType || "regular"}
Preferences: ${JSON.stringify(preferences || {})}

Recent Performance: ${history.length > 0 ? "Available" : "New student"}

Generate a structured learning session with:
1. Welcome introduction (personalized)
2. Learning objectives (3-4 clear goals)
3. Main content overview
4. Interactive activities (2-3 activities)
5. Assessment questions (appropriate difficulty)
6. Homework assignment
7. Additional resources

Format as JSON with this structure:
{
  "introduction": "personalized welcome message",
  "objectives": ["objective 1", "objective 2", "objective 3"],
  "mainContent": {
    "overview": "content overview",
    "keyTopics": ["topic 1", "topic 2", "topic 3"],
    "examples": ["example 1", "example 2"]
  },
  "activities": [
    {
      "type": "interactive",
      "title": "activity title",
      "description": "activity description",
      "duration": 10
    }
  ],
  "assessment": {
    "type": "formative",
    "questions": ["question 1", "question 2"],
    "difficulty": "${difficulty}",
    "timeLimit": 15
  },
  "homework": {
    "title": "homework title",
    "tasks": ["task 1", "task 2"],
    "estimatedTime": 20
  },
  "resources": {
    "supplementary": "additional learning materials",
    "practice": "practice exercises"
  },
  "estimatedTime": 30
}

Ensure content is age-appropriate, curriculum-compliant, and engaging.`;

    const modelId = "anthropic.claude-3-haiku-20240307-v1:0";
    const command = new InvokeModelCommand({
      modelId: modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 3000,
        temperature: 0.7,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const aiContent = responseBody.content[0].text;

    // Extract JSON from response
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const content = JSON.parse(jsonMatch[0]);
      console.log(`AI generated session content for ${subject}`);
      return content;
    }
  } catch (error) {
    console.error(`Error generating AI session content for ${subject}:`, error);
  }

  // Fallback content
  return generateFallbackSessionContent(student, subject, difficulty);
}

/**
 * Generate comprehensive AI-powered educational content
 */
async function generateAIContent(
  student,
  subject,
  contentType,
  difficulty,
  topic,
  history,
  assignment,
) {
  try {
    let prompt = `You are an expert educational content creator. Generate ${contentType} content for:

Student Profile:
- Name: ${student.studentName}
- Grade: ${student.grade}
- Country: ${student.country}
- Board: ${student.board}
- Learning Pace: ${student.learningPace}

Content Requirements:
- Subject: ${subject}
- Content Type: ${contentType}
- Topic: ${topic}
- Difficulty: ${difficulty || calculateDifficulty(student, history)}
- Assignment Details: ${assignment ? JSON.stringify(assignment) : "Standard format"}

Learning History: ${history.length} previous sessions available

Please generate comprehensive ${contentType} content that is:
1. Age-appropriate for grade ${student.grade}
2. Aligned with ${student.board} curriculum standards
3. Suitable for ${student.country} educational context
4. Matched to ${difficulty} difficulty level
5. Engaging and interactive`;

    // Customize prompt based on content type
    switch (contentType) {
      case "lesson":
        prompt += `

Format as a structured lesson with:
- Title and introduction
- Learning objectives (3-4 goals)
- Content sections with explanations
- Examples and illustrations
- Practice exercises
- Summary and key takeaways

Response format: JSON with sections for title, introduction, objectives, sections, examples, exercises, summary`;
        break;

      case "quiz":
        prompt += `

Format as an interactive quiz with:
- 5-8 questions of varying difficulty
- Multiple choice, short answer, and problem-solving questions
- Clear instructions
- Answer explanations
- Scoring criteria

Response format: JSON with questions array, instructions, timeLimit, passingScore`;
        break;

      case "assignment":
        prompt += `

Format as a comprehensive assignment with:
- Clear instructions and objectives
- Multiple tasks/questions
- Grading rubric
- Submission guidelines
- Due date suggestions

Response format: JSON with title, instructions, tasks, rubric, guidelines`;
        break;

      default:
        prompt += `

Format as structured educational content appropriate for ${contentType}.
Response format: JSON with relevant sections for this content type.`;
    }

    const modelId = "anthropic.claude-3-haiku-20240307-v1:0";
    const command = new InvokeModelCommand({
      modelId: modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 4000,
        temperature: 0.7,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const aiContent = responseBody.content[0].text;

    // Extract JSON from response
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const content = JSON.parse(jsonMatch[0]);
      console.log(
        `AI generated ${contentType} content for ${subject} - ${topic}`,
      );

      // Add metadata
      return {
        metadata: {
          studentId: student.studentId,
          subject: subject,
          contentType: contentType,
          topic: topic,
          difficulty: difficulty,
          grade: student.grade,
          board: student.board,
          country: student.country,
          aiGenerated: true,
          generatedAt: new Date().toISOString(),
        },
        content: content,
      };
    }
  } catch (error) {
    console.error(`Error generating AI content for ${contentType}:`, error);
  }

  // Fallback to basic content
  return generateFallbackContent(
    student,
    subject,
    contentType,
    topic,
    difficulty,
  );
}

/**
 * Fallback session content when AI fails
 */
function generateFallbackSessionContent(student, subject, difficulty) {
  return {
    introduction: `Welcome back, ${student.studentName}! Today we'll explore ${subject} concepts suitable for your learning pace.`,
    objectives: [
      `Understand core concepts in ${subject}`,
      "Apply knowledge through practice",
      "Build problem-solving skills",
    ],
    mainContent: {
      overview: `Today's ${subject} session focuses on ${difficulty} level concepts for grade ${student.grade}.`,
      keyTopics: [`Key topic 1 in ${subject}`, `Key topic 2 in ${subject}`],
      examples: [`Example 1 for ${subject}`, `Example 2 for ${subject}`],
    },
    activities: [
      {
        type: "interactive",
        title: `${subject} Explorer`,
        description: "Interactive activity to reinforce learning",
        duration: 15,
      },
    ],
    assessment: {
      type: "formative",
      questions: [`Question 1 about ${subject}`, `Question 2 about ${subject}`],
      difficulty: difficulty,
      timeLimit: 10,
    },
    homework: {
      title: `${subject} Practice`,
      tasks: [`Practice task 1`, `Practice task 2`],
      estimatedTime: 20,
    },
    resources: {
      supplementary: `Additional ${subject} materials`,
      practice: "Extra practice exercises",
    },
    estimatedTime: 30,
    aiGenerated: false,
    fallbackReason: "AI service unavailable",
  };
}

/**
 * Fallback content when AI fails
 */
function generateFallbackContent(
  student,
  subject,
  contentType,
  topic,
  difficulty,
) {
  return {
    metadata: {
      studentId: student.studentId,
      subject: subject,
      contentType: contentType,
      topic: topic,
      difficulty: difficulty,
      grade: student.grade,
      aiGenerated: false,
      fallbackUsed: true,
      generatedAt: new Date().toISOString(),
    },
    content: {
      title: `${topic} - ${subject} ${contentType}`,
      description: `${contentType} about ${topic} for grade ${student.grade}`,
      difficulty: difficulty,
      curriculum: `${student.country} ${student.board}`,
      note: "Basic fallback content - AI enhancement in progress",
    },
  };
}

/**
 * Handle AI chat interactions for tutoring
 */
async function handleChatInteraction(requestBody) {
  const { message, sessionContext, type, timestamp } = requestBody;

  if (!message) {
    return createResponse(400, { error: "Message is required" });
  }

  try {
    console.log("Processing AI chat interaction:", {
      message: message.substring(0, 100) + "...",
      sessionId: sessionContext?.sessionId,
      studentId: sessionContext?.studentId,
      subject: sessionContext?.subject,
      topic: sessionContext?.topic,
    });

    // Get student profile for personalized responses
    let student = null;
    if (sessionContext?.studentId) {
      student = await getStudent(sessionContext.studentId);
    }

    // Generate AI-powered response
    const aiResponse = await generateTutorResponse(
      message,
      sessionContext,
      student,
    );

    // Optional: Store the interaction in DynamoDB for learning history
    if (sessionContext?.sessionId && sessionContext?.studentId) {
      const interactionRecord = {
        studentId: sessionContext.studentId,
        timestamp: timestamp || new Date().toISOString(),
        sessionId: sessionContext.sessionId,
        type: "chat_interaction",
        userMessage: message,
        aiResponse: aiResponse,
        subject: sessionContext.subject,
        topic: sessionContext.topic,
        ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days TTL
      };

      try {
        await docClient.send(
          new PutCommand({
            TableName: PROGRESS_TABLE,
            Item: interactionRecord,
          }),
        );
        console.log("Stored chat interaction in learning history");
      } catch (storageError) {
        console.error("Failed to store interaction:", storageError);
        // Continue anyway - don't fail the response due to storage issues
      }
    }

    return createResponse(200, {
      response: aiResponse,
      sessionId: sessionContext?.sessionId,
      timestamp: new Date().toISOString(),
      aiGenerated: true,
    });
  } catch (error) {
    console.error("Error in chat interaction:", error);
    return createResponse(500, {
      error: "Failed to generate AI response",
      details: error.message,
    });
  }
}

/**
 * Generate AI-powered tutor response using AWS Bedrock
 */
async function generateTutorResponse(userMessage, sessionContext, student) {
  try {
    // Build context-aware prompt
    const studentInfo = student
      ? {
          name: student.studentName || "Student",
          grade: student.grade || 8,
          board: student.board || "CBSE",
          country: student.country || "India",
          learningPace: student.learningPace || "medium",
        }
      : {
          name: "Student",
          grade: 8,
          board: "CBSE",
          country: "India",
          learningPace: "medium",
        };

    const subject = sessionContext?.subject || "General Studies";
    const topic = sessionContext?.topic || "Learning";

    const prompt = `You are an expert AI tutor providing personalized education support. You are helping a student learn about ${topic} in ${subject}.

Student Profile:
- Name: ${studentInfo.name}
- Grade: ${studentInfo.grade}
- Educational Board: ${studentInfo.board}
- Country: ${studentInfo.country}
- Learning Pace: ${studentInfo.learningPace}

Current Learning Context:
- Subject: ${subject}
- Topic: ${topic}
- Session ID: ${sessionContext?.sessionId || "General"}

Student's Message: "${userMessage}"

Instructions:
1. Provide a helpful, educational response that addresses the student's question/message
2. Use age-appropriate language for grade ${studentInfo.grade}
3. Relate your answer to the ${studentInfo.board} curriculum standards
4. Be encouraging and supportive
5. If the student asks about the topic, provide clear explanations with examples
6. If the student needs practice, suggest specific exercises
7. Keep responses concise but informative (aim for 2-3 paragraphs)
8. Use markdown formatting for better readability

Respond as a friendly, knowledgeable tutor who wants to help the student succeed.`;

    const modelId = "anthropic.claude-3-haiku-20240307-v1:0";
    const command = new InvokeModelCommand({
      modelId: modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 2000,
        temperature: 0.7,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    console.log("Calling Bedrock AI for tutor response generation...");
    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const aiContent = responseBody.content[0].text;

    console.log("AI response generated successfully");
    return aiContent;
  } catch (error) {
    console.error("Error generating AI tutor response:", error);

    // Fallback response when AI fails
    const fallbackResponse = generateFallbackTutorResponse(
      userMessage,
      sessionContext,
      student,
    );
    console.log("Using fallback tutor response");
    return fallbackResponse;
  }
}

/**
 * Generate fallback tutor response when AI is unavailable
 */
function generateFallbackTutorResponse(userMessage, sessionContext, student) {
  const studentName = student?.studentName || "Student";
  const subject = sessionContext?.subject || "this subject";
  const topic = sessionContext?.topic || "this topic";
  const grade = student?.grade || 8;

  // Simple keyword-based responses
  const message = userMessage.toLowerCase();

  if (message.includes("help") || message.includes("explain")) {
    return `Hi ${studentName}! I'd be happy to help you understand ${topic} in ${subject}. 

For grade ${grade} level, let me break this down step by step:

1. **Core Concept**: ${topic} is an important part of your ${subject} curriculum
2. **Key Points**: Focus on understanding the fundamental principles first
3. **Practice**: Try working through examples to reinforce your learning

Would you like me to explain any specific part of ${topic} in more detail? I'm here to help you succeed! 📚

*Note: Enhanced AI responses will be available soon for even better personalized tutoring.*`;
  }

  if (message.includes("teach") || message.includes("learn")) {
    return `Great to see your enthusiasm for learning, ${studentName}! Let's explore ${topic} together.

## Learning ${topic} - Grade ${grade}

Here's how we can approach this:

**🎯 Learning Objectives:**
- Understand the key concepts of ${topic}
- Apply knowledge through practice problems
- Build confidence in ${subject}

**📖 Study Approach:**
1. Start with the basics and build up gradually
2. Practice regularly with examples
3. Ask questions when you need clarification

I'm here to guide you through your ${subject} journey. What specific aspect of ${topic} would you like to focus on first?

*Your AI tutor is ready to provide personalized explanations and support!*`;
  }

  if (message.includes("question") || message.includes("?")) {
    return `I see you have a question about ${topic}, ${studentName}! Questions are a great way to learn.

While I work on understanding your specific question better, here are some helpful approaches:

**🤔 For ${subject} Questions:**
- Break down complex problems into smaller steps
- Look for patterns and connections to what you already know
- Practice similar problems to build confidence

**💡 Study Tips for Grade ${grade}:**
- Review your class notes regularly
- Work through practice exercises
- Don't hesitate to ask for help when needed

Please feel free to ask me more specific questions about ${topic} - I'm here to help you understand the concepts clearly!

*Your AI tutor is being enhanced to provide even more detailed, personalized responses.*`;
  }

  // General response
  return `Thank you for your message, ${studentName}! I'm your AI tutor and I'm excited to help you with ${subject}.

## About ${topic}

This is an important topic in your grade ${grade} curriculum. I'll help you understand the concepts, work through problems, and build your confidence in ${subject}.

**How I can help you:**
- 📚 Explain concepts step by step
- 🎯 Provide practice problems
- 💡 Share study tips and strategies
- 🤝 Support your learning journey

Feel free to ask me any questions about ${topic} or ${subject} in general. I'm here to make learning engaging and effective for you!

*Your personalized AI tutoring experience is continuously improving to better serve your learning needs.*`;
}

/**
 * Get learning recommendations for students
 */
async function getRecommendations(queryParams) {
  const { studentId, subject, type } = queryParams || {};

  if (!studentId) {
    return createResponse(400, { error: "Student ID is required" });
  }

  try {
    // Get student profile
    const student = await getStudent(studentId);
    if (!student) {
      return createResponse(404, { error: "Student not found" });
    }

    // Get learning history
    const history = subject
      ? await getLearningHistory(studentId, subject)
      : await getAllLearningHistory(studentId);

    // Generate AI-powered recommendations
    const recommendations = await generateAIRecommendations(
      student,
      subject,
      type,
      history,
    );

    return createResponse(200, {
      studentId: studentId,
      student: student.studentName,
      recommendations: recommendations,
      subject: subject || "all",
      type: type || "general",
      aiGenerated: true,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting recommendations:", error);
    return createResponse(500, { error: "Failed to get recommendations" });
  }
}

/**
 * Generate AI-powered learning recommendations
 */
async function generateAIRecommendations(student, subject, type, history) {
  try {
    const prompt = `You are an educational advisor. Generate personalized learning recommendations for this student.

Student Profile:
- Name: ${student.studentName}
- Grade: ${student.grade}
- Country: ${student.country}
- Board: ${student.board}
- Learning Pace: ${student.learningPace}
- Subjects: ${student.subjects ? student.subjects.join(", ") : "Not specified"}

Subject Focus: ${subject || "All subjects"}
Recommendation Type: ${type || "General study recommendations"}
Learning History: ${history.length} recorded sessions

Based on this profile, provide 5-7 specific, actionable learning recommendations. 
Consider the student's grade level, curriculum requirements, and learning pace.

Format as JSON array:
[
  {
    "title": "Recommendation title",
    "description": "Detailed description",
    "priority": "high|medium|low",
    "subject": "subject name",
    "estimatedTime": "time in minutes",
    "difficulty": "easy|medium|hard"
  }
]`;

    const modelId = "anthropic.claude-3-haiku-20240307-v1:0";
    const command = new InvokeModelCommand({
      modelId: modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 2000,
        temperature: 0.6,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const aiContent = responseBody.content[0].text;

    // Extract JSON from response
    const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const recommendations = JSON.parse(jsonMatch[0]);
      console.log(`Generated ${recommendations.length} AI recommendations`);
      return recommendations;
    }
  } catch (error) {
    console.error("Error generating AI recommendations:", error);
  }

  // Fallback recommendations
  return generateFallbackRecommendations(student, subject, type);
}

/**
 * Generate fallback recommendations when AI fails
 */
function generateFallbackRecommendations(student, subject, type) {
  const baseRecommendations = [
    {
      title: `Daily ${subject || "Study"} Practice`,
      description: `Dedicate 30 minutes daily to ${subject || "your core subjects"} for consistent progress`,
      priority: "high",
      subject: subject || "General",
      estimatedTime: "30 minutes",
      difficulty: "medium",
    },
    {
      title: "Review Class Notes",
      description:
        "Review and organize your class notes within 24 hours of each lesson",
      priority: "high",
      subject: subject || "General",
      estimatedTime: "15 minutes",
      difficulty: "easy",
    },
    {
      title: "Practice Problems",
      description: `Work through practice problems to reinforce ${subject || "key"} concepts`,
      priority: "medium",
      subject: subject || "General",
      estimatedTime: "45 minutes",
      difficulty: "medium",
    },
  ];

  // Add grade-specific recommendations
  if (student.grade >= 9) {
    baseRecommendations.push({
      title: "Exam Preparation Strategy",
      description: `Prepare for ${student.board} board exams with structured study plans`,
      priority: "high",
      subject: subject || "General",
      estimatedTime: "60 minutes",
      difficulty: "hard",
    });
  }

  return baseRecommendations;
}

// Helper function to get all learning history
async function getAllLearningHistory(studentId) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: PROGRESS_TABLE,
      KeyConditionExpression: "studentId = :studentId",
      ExpressionAttributeValues: {
        ":studentId": studentId,
      },
      ScanIndexForward: false,
      Limit: 100,
    }),
  );
  return result.Items || [];
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

async function getLearningHistory(studentId, subject) {
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
      Limit: 50,
    }),
  );
  return result.Items || [];
}

async function updateLastInteraction(studentId) {
  const timestamp = new Date().toISOString();
  await docClient.send(
    new UpdateCommand({
      TableName: STUDENT_TABLE,
      Key: { studentId, profileVersion: "v1" },
      UpdateExpression: "SET lastInteraction = :timestamp",
      ExpressionAttributeValues: {
        ":timestamp": timestamp,
      },
    }),
  );
}

function calculateDifficulty(student, history) {
  const recentPerformance = history.slice(0, 10);
  const avgSuccess =
    recentPerformance.length > 0
      ? recentPerformance.filter((h) => h.success === true).length /
        recentPerformance.length
      : 0.5;

  if (avgSuccess > 0.8) return "challenging";
  if (avgSuccess > 0.6) return "moderate";
  return "basic";
}

function calculateSessionDuration(sessionContent) {
  const subjects = Object.keys(sessionContent);
  return subjects.reduce((total, subject) => {
    return total + (sessionContent[subject].estimatedTime || 30);
  }, 0);
}

function generateAdaptationNotes(student, history) {
  return {
    pace: student.learningPace,
    sessionCount: history.length,
    recentPerformance:
      history.slice(0, 5).length > 0 ? "Available" : "No recent data",
    adaptations: [
      "AI-powered content generation based on educational profile",
      "Difficulty adjusted based on learning history",
      "Curriculum compliance maintained for " + student.board + " board",
    ],
  };
}

async function getContent(queryParams) {
  const { studentId, subject, contentType, limit } = queryParams || {};

  if (!studentId) {
    return createResponse(400, { error: "studentId is required" });
  }

  // Build query parameters
  const queryParams_ddb = {
    TableName: PROGRESS_TABLE,
    KeyConditionExpression: "studentId = :studentId",
    ExpressionAttributeValues: {
      ":studentId": studentId,
    },
    ScanIndexForward: false,
    Limit: parseInt(limit) || 20,
  };

  // Add filters
  let filterExpressions = [];
  if (subject) {
    filterExpressions.push("subject = :subject");
    queryParams_ddb.ExpressionAttributeValues[":subject"] = subject;
  }
  if (contentType) {
    filterExpressions.push("contentType = :contentType");
    queryParams_ddb.ExpressionAttributeValues[":contentType"] = contentType;
  }

  if (filterExpressions.length > 0) {
    queryParams_ddb.FilterExpression = filterExpressions.join(" AND ");
  }

  const result = await docClient.send(new QueryCommand(queryParams_ddb));

  // Fetch full content from S3 if available
  const contentWithDetails = await Promise.all(
    (result.Items || []).map(async (item) => {
      if (item.contentKey) {
        try {
          const s3Object = await s3Client.send(
            new GetObjectCommand({
              Bucket: CONTENT_BUCKET,
              Key: item.contentKey,
            }),
          );
          const fullContent = JSON.parse(
            await s3Object.Body.transformToString(),
          );
          return { ...item, fullContent };
        } catch (error) {
          console.error("Error fetching content from S3:", error);
          return item;
        }
      }
      return item;
    }),
  );

  return createResponse(200, {
    content: contentWithDetails,
    count: contentWithDetails.length,
    studentId: studentId,
    aiGenerated: contentWithDetails.filter((c) => c.aiGenerated).length,
    totalSessions: contentWithDetails.length,
  });
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
