/**
 * Student Profile Lambda Function
 *
 * Comprehensive student profile management with AI-powered curriculum discovery
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");
const crypto = require("crypto");

// Initialize AWS DynamoDB client
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

// Environment variables
const STUDENT_TABLE = process.env.STUDENT_TABLE;
const MAX_STUDENTS = parseInt(process.env.MAX_STUDENTS || "5");
const CURRICULUM_API_URL = process.env.CURRICULUM_API_URL;

/**
 * Main Lambda Handler Function
 */
exports.handler = async (event) => {
  console.log("Event:", JSON.stringify(event, null, 2));

  try {
    const {
      httpMethod,
      pathParameters,
      body,
      queryStringParameters,
      resource,
    } = event;
    const requestBody = body ? JSON.parse(body) : {};

    switch (httpMethod) {
      case "GET":
        if (pathParameters && pathParameters.studentId) {
          const path = event.path || event.resource || "";
          if (path.includes("/topics")) {
            const subject = queryStringParameters?.subject;
            const board = queryStringParameters?.board;
            const grade = queryStringParameters?.grade;
            const studentName = queryStringParameters?.studentName;
            return await getStudentTopics(pathParameters.studentId, {
              subject,
              board,
              grade,
              studentName,
            });
          } else if (path.includes("/score")) {
            return await getStudentScore(pathParameters.studentId);
          } else {
            return await getStudent(pathParameters.studentId);
          }
        } else {
          return await listStudents(queryStringParameters);
        }
      case "POST":
        return await createStudent(requestBody);
      case "PUT":
        if (
          pathParameters &&
          pathParameters.studentId &&
          pathParameters.topicId
        ) {
          const path = event.path || event.resource || "";
          if (path.includes("/complete")) {
            return await markTopicCompleted(
              pathParameters.studentId,
              pathParameters.topicId,
              requestBody,
            );
          }
        }
        return await updateStudent(pathParameters.studentId, requestBody);
      case "DELETE":
        return await deleteStudent(pathParameters.studentId);
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

async function createStudent(studentData) {
  // Check student limit
  const activeStudentsCount = await getActiveStudentsCount();
  if (activeStudentsCount >= MAX_STUDENTS) {
    return createResponse(400, {
      error: "Maximum student limit reached",
      maxStudents: MAX_STUDENTS,
      currentCount: activeStudentsCount,
    });
  }

  // Handle both 'name' and 'studentName' fields from frontend
  const studentName = studentData.studentName || studentData.name;

  if (!studentName) {
    return createResponse(400, {
      error: "Student name is required",
    });
  }

  // Check if student with same name already exists
  const existingStudent = await getStudentByName(studentName);
  if (existingStudent) {
    return createResponse(400, {
      error: "Student with this name already exists",
      existingStudentId: existingStudent.studentId,
    });
  }

  const studentId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const student = {
    studentId,
    profileVersion: "v1",
    studentName: studentName,
    email: studentData.email,
    grade: studentData.grade,
    country: studentData.country,
    board: studentData.board,
    school: studentData.school,
    subjects: studentData.subjects || [],
    learningPace: studentData.learningPace || "medium",
    knowledgeLevel: studentData.knowledgeLevel || {},
    preferences: studentData.preferences || {},
    isActive: "true",
    createdAt: timestamp,
    updatedAt: timestamp,
    lastInteraction: timestamp,
    profileCompleteness: calculateProfileCompleteness(studentData),
  };

  // Store the student first
  await docClient.send(
    new PutCommand({
      TableName: STUDENT_TABLE,
      Item: student,
    }),
  );

  // Discover and store curriculum topics for each subject if requested
  let topicsDiscovered = [];
  if (studentData.discoverTopics || studentData.initializeCurriculum) {
    try {
      topicsDiscovered = await discoverAndStoreCurriculumTopics(student);
      console.log(
        "Topics discovered for student " + studentId + ":",
        topicsDiscovered.length,
      );
    } catch (topicError) {
      console.error("Error discovering topics:", topicError);
    }
  }

  return createResponse(201, {
    message: "Student created successfully",
    student,
    topicsDiscovered: topicsDiscovered.length,
    remainingSlots: MAX_STUDENTS - activeStudentsCount - 1,
  });
}

/**
 * Discover and store curriculum topics for a student
 */
async function discoverAndStoreCurriculumTopics(student) {
  const topics = [];

  // Use the student's originally selected subjects
  const subjectsToProcess = student.subjects || [];
  console.log(
    `Generating topics for student's selected subjects: ${subjectsToProcess.join(", ")}`,
  );

  for (const subject of subjectsToProcess) {
    const subjectTopics = await generateCurriculumTopics(
      subject,
      student.grade,
      student.board,
      student.country,
    );

    // Store each topic with the student's profile
    for (const topic of subjectTopics) {
      const topicItem = {
        studentId: student.studentId,
        topicId:
          "topic_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
        subject: subject,
        topicName: topic.name,
        description: topic.description,
        difficulty: topic.difficulty || "beginner",
        estimatedDuration: topic.duration || 60,
        chapterNumber: topic.chapter || 1,
        prerequisites: topic.prerequisites || [],
        learningObjectives: topic.objectives || [],
        isCompleted: false,
        createdAt: new Date().toISOString(),
        board: student.board,
        grade: student.grade,
        country: student.country,
      };

      // Store in the same student table with a different record type
      await docClient.send(
        new PutCommand({
          TableName: STUDENT_TABLE,
          Item: {
            studentId: student.studentId,
            profileVersion: "topic_" + topicItem.topicId,
            ...topicItem,
          },
        }),
      );

      topics.push(topicItem);
    }
  }

  return topics;
}

/**
 * Generate curriculum topics using AI-powered curriculum service
 */
async function generateCurriculumTopics(subject, grade, board, country) {
  try {
    console.log(
      `Generating AI curriculum topics for: ${subject}, Grade ${grade}, ${board}, ${country}`,
    );

    if (!CURRICULUM_API_URL) {
      console.warn("CURRICULUM_API_URL not configured, using fallback topics");
      return getFallbackTopics(subject, grade);
    }

    const requestBody = {
      subject,
      grade,
      country,
      board,
      school: "Standard School",
    };

    const response = await fetch(`${CURRICULUM_API_URL}/topics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.warn(`Curriculum API error: ${response.status}, using fallback`);
      return getFallbackTopics(subject, grade);
    }

    const data = await response.json();

    if (data.topics && data.topics.length > 0) {
      console.log(
        `Successfully retrieved ${data.topics.length} AI-generated topics`,
      );
      return data.topics;
    } else {
      console.warn("No topics returned from curriculum API, using fallback");
      return getFallbackTopics(subject, grade);
    }
  } catch (error) {
    console.error("Error generating curriculum topics:", error);
    return getFallbackTopics(subject, grade);
  }
}

/**
 * Fallback topics when AI service is unavailable
 */
function getFallbackTopics(subject, grade) {
  return [
    {
      name: `Introduction to ${subject}`,
      description: `Fundamental concepts and principles of ${subject} for grade ${grade} students`,
      chapter: 1,
      difficulty: "beginner",
      duration: 60,
      objectives: [
        `Understand basic concepts of ${subject}`,
        "Build foundational knowledge",
        "Prepare for advanced topics",
      ],
      prerequisites: [],
    },
    {
      name: `Core Concepts in ${subject}`,
      description: `Essential topics and skills required for mastery of ${subject}`,
      chapter: 2,
      difficulty: "intermediate",
      duration: 90,
      objectives: [
        `Apply ${subject} concepts`,
        "Solve practical problems",
        "Connect theory to practice",
      ],
      prerequisites: [`Introduction to ${subject}`],
    },
    {
      name: `Advanced ${subject} Applications`,
      description: `Real-world applications and advanced problem-solving in ${subject}`,
      chapter: 3,
      difficulty: "advanced",
      duration: 120,
      objectives: [
        `Master advanced ${subject} concepts`,
        "Solve complex problems",
        "Apply to real scenarios",
      ],
      prerequisites: [`Core Concepts in ${subject}`],
    },
  ];
}

/**
 * Mark a topic as completed for a student
 */
async function markTopicCompleted(studentId, topicId, requestBody) {
  try {
    const { completed, completionDate, score } = requestBody;

    // Update the topic's completion status
    await docClient.send(
      new UpdateCommand({
        TableName: STUDENT_TABLE,
        Key: {
          studentId: studentId,
          profileVersion: "topic_" + topicId,
        },
        UpdateExpression:
          "SET isCompleted = :completed, completionDate = :completionDate, completionScore = :score, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":completed": completed || true,
          ":completionDate": completionDate || new Date().toISOString(),
          ":score": score || 100,
          ":updatedAt": new Date().toISOString(),
        },
      }),
    );

    console.log(
      `✅ Topic ${topicId} marked as completed for student ${studentId}`,
    );

    return createResponse(200, {
      message: "Topic marked as completed successfully",
      topicId: topicId,
      studentId: studentId,
      score: score || 100,
    });
  } catch (error) {
    console.error("Error marking topic as completed:", error);
    return createResponse(500, {
      error: "Failed to mark topic as completed",
      details: error.message,
    });
  }
}

/**
 * Get student's overall score based on completed topics
 */
async function getStudentScore(studentId) {
  try {
    // Get all topics for the student
    const topicsResult = await docClient.send(
      new QueryCommand({
        TableName: STUDENT_TABLE,
        KeyConditionExpression:
          "studentId = :studentId AND begins_with(profileVersion, :topicPrefix)",
        ExpressionAttributeValues: {
          ":studentId": studentId,
          ":topicPrefix": "topic_",
        },
      }),
    );

    const topics = topicsResult.Items || [];
    const totalTopics = topics.length;
    const completedTopics = topics.filter(
      (topic) => topic.isCompleted === true,
    ).length;

    // Calculate score as percentage of completed topics
    const score =
      totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

    console.log(
      `📊 Student ${studentId} score: ${completedTopics}/${totalTopics} topics completed (${score}%)`,
    );

    return createResponse(200, {
      studentId: studentId,
      totalTopics: totalTopics,
      completedTopics: completedTopics,
      score: score,
      percentage: score,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error calculating student score:", error);
    return createResponse(500, {
      error: "Failed to calculate student score",
      details: error.message,
    });
  }
}

async function getStudent(studentId) {
  const result = await docClient.send(
    new GetCommand({
      TableName: STUDENT_TABLE,
      Key: { studentId, profileVersion: "v1" },
    }),
  );

  if (!result.Item) {
    return createResponse(404, { error: "Student not found" });
  }

  return createResponse(200, { student: result.Item });
}

/**
 * Get curriculum topics for a student with comprehensive filtering
 */
async function getStudentTopics(studentId, filters = {}) {
  try {
    const params = {
      TableName: STUDENT_TABLE,
      KeyConditionExpression:
        "studentId = :studentId AND begins_with(profileVersion, :topicPrefix)",
      ExpressionAttributeValues: {
        ":studentId": studentId,
        ":topicPrefix": "topic_",
      },
    };

    // Build dynamic filter expression
    const filterConditions = [];

    if (filters.subject) {
      filterConditions.push("subject = :subject");
      params.ExpressionAttributeValues[":subject"] = filters.subject;
    }

    if (filters.board) {
      filterConditions.push("board = :board");
      params.ExpressionAttributeValues[":board"] = filters.board;
    }

    if (filters.grade) {
      filterConditions.push("grade = :grade");
      params.ExpressionAttributeValues[":grade"] = parseInt(filters.grade);
    }

    if (filterConditions.length > 0) {
      params.FilterExpression = filterConditions.join(" AND ");
    }

    console.log(
      "Querying topics with params:",
      JSON.stringify(params, null, 2),
    );

    const result = await docClient.send(new QueryCommand(params));

    // Verify student name if provided
    if (filters.studentName) {
      const studentResult = await docClient.send(
        new GetCommand({
          TableName: STUDENT_TABLE,
          Key: { studentId, profileVersion: "v1" },
        }),
      );

      if (
        !studentResult.Item ||
        studentResult.Item.studentName.toLowerCase() !==
          filters.studentName.toLowerCase()
      ) {
        return createResponse(404, {
          error: "Student not found or name does not match",
          requestedName: filters.studentName,
          actualName: studentResult.Item?.studentName,
        });
      }
    }

    const topics = result.Items.map((item) => ({
      topicId: item.topicId,
      subject: item.subject,
      topicName: item.topicName,
      description: item.description,
      difficulty: item.difficulty,
      estimatedDuration: item.estimatedDuration,
      chapterNumber: item.chapterNumber,
      prerequisites: item.prerequisites || [],
      learningObjectives: item.learningObjectives || [],
      isCompleted: item.isCompleted || false,
      completionDate: item.completionDate,
      board: item.board,
      grade: item.grade,
      country: item.country,
      createdAt: item.createdAt,
    }));

    // Sort by chapter and topic name
    topics.sort((a, b) => {
      if (a.chapterNumber !== b.chapterNumber) {
        return a.chapterNumber - b.chapterNumber;
      }
      return a.topicName.localeCompare(b.topicName);
    });

    return createResponse(200, {
      topics,
      count: topics.length,
      filters: {
        subject: filters.subject || "all",
        board: filters.board || "all",
        grade: filters.grade || "all",
        studentName: filters.studentName || "not specified",
      },
      studentId,
    });
  } catch (error) {
    console.error("Error fetching student topics:", error);
    return createResponse(500, {
      error: "Failed to fetch student topics",
      details: error.message,
    });
  }
}

async function listStudents(queryParams) {
  const params = {
    TableName: STUDENT_TABLE,
    FilterExpression: "profileVersion = :version",
    ExpressionAttributeValues: {
      ":version": "v1",
    },
  };

  if (queryParams && queryParams.active === "true") {
    params.FilterExpression += " AND isActive = :active";
    params.ExpressionAttributeValues[":active"] = "true";
  }

  const result = await docClient.send(new ScanCommand(params));

  return createResponse(200, {
    students: result.Items || [],
    count: result.Items ? result.Items.length : 0,
    maxStudents: MAX_STUDENTS,
  });
}

async function updateStudent(studentId, updateData) {
  const timestamp = new Date().toISOString();

  const updateExpression = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};

  Object.keys(updateData).forEach((key) => {
    if (key !== "studentId" && key !== "profileVersion") {
      updateExpression.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = updateData[key];
    }
  });

  updateExpression.push("#updatedAt = :updatedAt");
  expressionAttributeNames["#updatedAt"] = "updatedAt";
  expressionAttributeValues[":updatedAt"] = timestamp;

  if (updateData.name && updateData.name !== "") {
    updateExpression.push("#lastInteraction = :lastInteraction");
    expressionAttributeNames["#lastInteraction"] = "lastInteraction";
    expressionAttributeValues[":lastInteraction"] = timestamp;
  }

  await docClient.send(
    new UpdateCommand({
      TableName: STUDENT_TABLE,
      Key: { studentId, profileVersion: "v1" },
      UpdateExpression: `SET ${updateExpression.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    }),
  );

  return createResponse(200, { message: "Student updated successfully" });
}

async function deleteStudent(studentId) {
  await docClient.send(
    new DeleteCommand({
      TableName: STUDENT_TABLE,
      Key: { studentId, profileVersion: "v1" },
    }),
  );

  return createResponse(200, { message: "Student deleted successfully" });
}

async function getStudentByName(name) {
  const result = await docClient.send(
    new ScanCommand({
      TableName: STUDENT_TABLE,
      FilterExpression: "studentName = :name AND profileVersion = :version",
      ExpressionAttributeValues: {
        ":name": name,
        ":version": "v1",
      },
      Limit: 1,
    }),
  );

  return result.Items && result.Items.length > 0 ? result.Items[0] : null;
}

async function getActiveStudentsCount() {
  const result = await docClient.send(
    new ScanCommand({
      TableName: STUDENT_TABLE,
      FilterExpression: "isActive = :active AND profileVersion = :version",
      ExpressionAttributeValues: {
        ":active": "true",
        ":version": "v1",
      },
      Select: "COUNT",
    }),
  );

  return result.Count || 0;
}

function calculateProfileCompleteness(studentData) {
  const requiredFields = ["grade", "country", "board", "school"];
  // Handle both 'name' and 'studentName' fields
  const studentName = studentData.studentName || studentData.name;
  if (studentName && studentName !== "") {
    requiredFields.push("name");
  }

  const completedFields = requiredFields.filter((field) => {
    if (field === "name") {
      return studentName && studentName !== "";
    }
    return studentData[field] && studentData[field] !== "";
  });

  return (completedFields.length / requiredFields.length) * 100;
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
