/**
 * Curriculum Lambda Handler - AI-Powered Subject & Topic Generation
 *
 * This function provides intelligent subject recommendations and topic generation
 * based on student educational profile with comprehensive fallback logic.
 */

const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");

// Initialize Bedrock client
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "ap-southeast-1",
});

/**
 * Comprehensive subject database organized by educational context
 * Used as fallback when AI service is unavailable
 */
const SUBJECT_DATABASE = {
  // Core subjects available across all educational systems
  core: [
    "Mathematics",
    "English",
    "Science",
    "Social Studies",
    "Computer Science",
    "Physical Education",
    "Art",
    "Music",
  ],

  // Grade-specific subjects
  grades: {
    elementary: [
      "Mathematics",
      "English",
      "Science",
      "Social Studies",
      "Art",
      "Music",
      "Physical Education",
      "Library Skills",
    ],
    middle: [
      "Mathematics",
      "English",
      "Science",
      "Social Studies",
      "History",
      "Geography",
      "Computer Science",
      "Art",
      "Music",
      "Physical Education",
      "Life Skills",
      "Environmental Science",
    ],
    high: [
      "Mathematics",
      "English",
      "Physics",
      "Chemistry",
      "Biology",
      "History",
      "Geography",
      "Computer Science",
      "Economics",
      "Psychology",
      "Art",
      "Music",
      "Physical Education",
      "Philosophy",
      "Statistics",
    ],
  },

  // Country-specific subjects
  countries: {
    India: [
      "Hindi",
      "Sanskrit",
      "Regional Language",
      "Moral Science",
      "EVS",
      "Social Science",
      "Value Education",
    ],
    USA: [
      "American History",
      "Civics",
      "Health Education",
      "Foreign Language",
      "AP Courses",
      "Electives",
    ],
    UK: [
      "English Literature",
      "Modern Foreign Languages",
      "Citizenship",
      "Religious Education",
      "PSHE",
    ],
    Australia: [
      "English Literature",
      "LOTE",
      "Health and Physical Education",
      "Technologies",
      "The Arts",
    ],
    Canada: [
      "French",
      "Canadian History",
      "Health and Career Education",
      "Applied Skills",
      "Fine Arts",
    ],
  },

  // Board-specific subjects
  boards: {
    CBSE: [
      "Hindi",
      "Sanskrit",
      "Environmental Science",
      "Moral Science",
      "Work Education",
      "Health and Physical Education",
    ],
    ICSE: [
      "Hindi",
      "Regional Language",
      "Environmental Science",
      "Computer Applications",
      "Commercial Studies",
      "Economic Applications",
    ],
    IB: [
      "Theory of Knowledge",
      "Extended Essay",
      "Creativity, Activity, Service",
      "World Literature",
      "Global Politics",
    ],
    Cambridge: [
      "English Literature",
      "Global Perspectives",
      "ICT",
      "Business Studies",
      "Environmental Management",
    ],
    "State Board": [
      "Regional Language",
      "Local History",
      "State Culture",
      "Environmental Studies",
    ],
  },
};

/**
 * Generate AI-powered curriculum topics for a subject
 */
async function generateAITopics(subject, grade, board, country, school) {
  try {
    console.log(
      `Generating AI topics for: ${subject}, Grade ${grade}, ${board}, ${country}`,
    );

    const prompt = `You are an expert curriculum designer. Generate a comprehensive list of topics for the following educational context:

Subject: ${subject}
Grade: ${grade}
Educational Board: ${board}
Country: ${country}
School Type: ${school}

Please provide 12-15 curriculum topics that are:
1. Age-appropriate for grade ${grade}
2. Aligned with ${board} curriculum standards
3. Suitable for ${country} educational context
4. Progressive in difficulty from basic to advanced
5. Include practical applications and real-world connections

For each topic, provide:
- Topic name (concise and clear)
- Brief description (2-3 sentences)
- Chapter/unit number
- Difficulty level (beginner/intermediate/advanced)
- Estimated duration in minutes
- Learning objectives (3-4 key objectives)
- Prerequisites (if any)

Format as JSON array with this structure:
[
  {
    "name": "Topic Name",
    "description": "Clear description of what students will learn",
    "chapter": 1,
    "difficulty": "beginner",
    "duration": 90,
    "objectives": ["Objective 1", "Objective 2", "Objective 3"],
    "prerequisites": []
  }
]

Ensure topics follow logical progression and cover the complete curriculum scope for ${subject} in grade ${grade}.`;

    const modelId = "anthropic.claude-3-haiku-20240307-v1:0";

    const request = {
      modelId: modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 4000,
        temperature: 0.7,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    };

    console.log("Invoking Bedrock model for topic generation...");
    const command = new InvokeModelCommand(request);
    const response = await bedrockClient.send(command);

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const aiContent = responseBody.content[0].text;

    console.log("AI Response received, parsing topics...");

    // Extract JSON from AI response
    const jsonMatch = aiContent.match(/\[\s*{[\s\S]*}\s*\]/);
    if (jsonMatch) {
      const topics = JSON.parse(jsonMatch[0]);
      console.log(`Successfully generated ${topics.length} AI topics`);
      return topics;
    } else {
      console.warn("Could not parse JSON from AI response, using fallback");
      return null;
    }
  } catch (error) {
    console.error("Error generating AI topics:", error);
    return null;
  }
}

/**
 * Generate fallback subjects based on profile analysis
 */
function generateFallbackSubjects(profile) {
  console.log("Generating fallback subjects for:", profile);
  const subjects = new Set();

  // Add core subjects based on grade level
  const gradeLevel = getGradeLevel(profile.grade);
  console.log("Grade level determined as:", gradeLevel);

  const gradeSubjects = SUBJECT_DATABASE.grades[gradeLevel] || [];
  gradeSubjects.forEach((subject) => subjects.add(subject));

  // Add country-specific subjects
  const countrySubjects = SUBJECT_DATABASE.countries[profile.country] || [];
  countrySubjects.forEach((subject) => subjects.add(subject));

  // Add board-specific subjects
  const boardSubjects = SUBJECT_DATABASE.boards[profile.board] || [];
  boardSubjects.forEach((subject) => subjects.add(subject));

  // Ensure minimum core subjects
  SUBJECT_DATABASE.core.forEach((subject) => subjects.add(subject));

  // Apply grade-specific filtering
  const filteredSubjects = Array.from(subjects).filter((subject) =>
    isSubjectAppropriate(subject, profile.grade),
  );
  console.log("Generated subjects:", filteredSubjects);
  return filteredSubjects;
}

/**
 * Generate fallback topics when AI is unavailable
 */
function generateFallbackTopics(subject, grade, board, country) {
  console.log(`Generating fallback topics for ${subject}, Grade ${grade}`);

  // Basic fallback topics based on subject and grade
  const topics = [
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

  return topics;
}

/**
 * Determine grade level category
 */
function getGradeLevel(grade) {
  const gradeNum = parseInt(grade);
  if (gradeNum <= 5) return "elementary";
  if (gradeNum <= 8) return "middle";
  return "high";
}

/**
 * Check if subject is appropriate for grade level
 */
function isSubjectAppropriate(subject, grade) {
  const gradeNum = parseInt(grade);

  // Advanced subjects for higher grades only
  const advancedSubjects = [
    "Physics",
    "Chemistry",
    "Biology",
    "Economics",
    "Psychology",
    "Philosophy",
    "Statistics",
  ];
  if (advancedSubjects.includes(subject) && gradeNum < 9) return false;

  // Elementary subjects for lower grades
  const elementarySubjects = ["Library Skills", "Basic Science"];
  if (elementarySubjects.includes(subject) && gradeNum > 5) return false;

  return true;
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log("Curriculum request received:", JSON.stringify(event, null, 2));

  try {
    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
      console.log("Handling CORS preflight request");
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, X-Api-Key",
        },
        body: "",
      };
    }

    // Parse request
    let requestBody = {};
    try {
      requestBody = event.body ? JSON.parse(event.body) : {};
      console.log("Parsed request body:", requestBody);
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: "Invalid JSON in request body",
        }),
      };
    }

    // Handle different endpoints
    const path = event.path || event.pathParameters?.proxy || "";
    const resource = event.resource || path;
    console.log("Request path:", path, "Resource:", resource);

    if (resource.includes("/topics")) {
      // Generate topics for a specific subject
      const { subject, grade, country, board, school } = requestBody;

      if (!subject || !grade || !country || !board) {
        return {
          statusCode: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            error:
              "Missing required parameters: subject, grade, country, and board are required",
          }),
        };
      }

      console.log(
        `Generating topics for: ${subject}, Grade ${grade}, ${board}, ${country}`,
      );

      // Try AI generation first
      let topics = await generateAITopics(
        subject,
        grade,
        board,
        country,
        school || "Standard School",
      );
      let source = "ai";

      // Fallback to basic topics if AI fails
      if (!topics || topics.length === 0) {
        console.log("AI topic generation failed, using fallback");
        topics = generateFallbackTopics(subject, grade, board, country);
        source = "fallback";
      }

      const response = {
        topics,
        subject,
        grade,
        board,
        country,
        school: school || "Standard School",
        source,
        timestamp: new Date().toISOString(),
        count: topics.length,
      };

      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(response),
      };
    } else if (resource.includes("/subjects") || path.includes("/subjects")) {
      // Generate subjects (existing functionality)
      const { grade, country, board, school } = requestBody;

      if (!grade || !country || !board) {
        console.error("Missing required parameters:", {
          grade,
          country,
          board,
        });
        return {
          statusCode: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            error:
              "Missing required parameters: grade, country, and board are required",
          }),
        };
      }

      const profile = {
        grade,
        country,
        board,
        school: school || "Standard School",
      };
      console.log("Processing profile:", profile);

      // Use fallback logic for subjects (AI can be added later for subjects too)
      const subjects = generateFallbackSubjects(profile);
      let source = "fallback";

      // Ensure we have subjects
      if (!subjects || subjects.length === 0) {
        console.warn("No subjects generated, using core subjects");
        subjects = SUBJECT_DATABASE.core;
        source = "core";
      }

      // Sort subjects alphabetically for consistent presentation
      const sortedSubjects = subjects.sort();

      const response = {
        subjects: sortedSubjects,
        profile,
        source,
        timestamp: new Date().toISOString(),
        count: sortedSubjects.length,
      };

      console.log("Successful response:", response);

      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(response),
      };
    }
  } catch (error) {
    console.error("Curriculum handler error:", error);
    console.error("Error stack:", error.stack);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: "Internal server error",
        message: "Failed to generate curriculum recommendations",
      }),
    };
  }
};
