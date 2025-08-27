/**
 * AI Judge Lambda Function
 *
 * Dedicated AI evaluation service using AWS Bedrock Claude-3-Sonnet
 * for objective assessment of AI tutor responses
 */

const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const crypto = require("crypto");

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION,
});
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const EVALUATION_TABLE =
  process.env.EVALUATION_TABLE || "school-tutor-evaluations";
const NOVA_MICRO_INFERENCE_PROFILE =
  process.env.NOVA_MICRO_INFERENCE_PROFILE ||
  "arn:aws:bedrock:ap-southeast-1:291412412747:inference-profile/apac.amazon.nova-micro-v1:0";
const AI_JUDGE_MODEL = process.env.AI_JUDGE_MODEL || "nova-micro";

exports.handler = async (event) => {
  console.log("AI Judge Event:", JSON.stringify(event, null, 2));

  try {
    const { httpMethod, body, pathParameters } = event;
    const requestBody = body ? JSON.parse(body) : {};

    switch (httpMethod) {
      case "POST":
        return await handleEvaluation(requestBody);
      default:
        return createResponse(405, { error: "Method not allowed" });
    }
  } catch (error) {
    console.error("AI Judge Error:", error);
    return createResponse(500, {
      error: "AI Judge evaluation failed",
      details: error.message,
    });
  }
};

async function handleEvaluation(requestBody) {
  const {
    question,
    response,
    studentProfile,
    evaluationType = "comprehensive",
    prompt,
    model,
    temperature,
    maxTokens,
    systemPrompt,
  } = requestBody;

  // Validate required fields
  if (!question && !prompt) {
    return createResponse(400, {
      error: "Missing required field: question or prompt",
    });
  }

  if (!response && !requestBody.data?.aiResponse) {
    return createResponse(400, {
      error: "Missing required field: response or data.aiResponse",
    });
  }

  // Extract evaluation content
  const evaluationQuestion = question || extractQuestionFromPrompt(prompt);
  const aiResponse = response || requestBody.data?.aiResponse;
  const student = studentProfile || extractStudentFromPrompt(prompt);

  console.log("Starting AI Judge evaluation...");
  console.log("Question:", evaluationQuestion?.substring(0, 100));
  console.log("Response length:", aiResponse?.length);
  console.log("Response preview:", aiResponse?.substring(0, 200) + "...");

  try {
    // Generate evaluation using Claude-3-Sonnet (different from AI tutor)
    // Use FULL response for evaluation, not truncated
    const evaluation = await generateAIJudgeEvaluation(
      evaluationQuestion,
      aiResponse, // Full response, not truncated
      student,
      evaluationType,
    );

    // Log evaluation for tracking
    await logEvaluation(evaluationQuestion, aiResponse, evaluation, student);

    return createResponse(200, {
      evaluation: evaluation,
      response: evaluation, // For backward compatibility
      content: evaluation, // Alternative response format
      modelInfo: {
        judgeEvaluationModel:
          "AWS Bedrock - Nova Micro via Inference Profile (AI Judge)",
        dataGenerationModel: "Claude-3-Haiku (AI Tutor)",
        apiEndpoint: "/ai/evaluate",
        evaluationType: evaluationType,
        model: NOVA_MICRO_INFERENCE_PROFILE,
        temperature: 0.1,
        purpose: "objective_evaluation",
      },
      metadata: {
        timestamp: new Date().toISOString(),
        evaluationType: evaluationType,
        judgeModel: "AWS Nova Micro",
        tutorModel: "Claude-3-Haiku",
        version: "1.0",
      },
    });
  } catch (error) {
    console.error("AI Judge evaluation failed:", error);

    // Return fallback evaluation with clear model distinction
    return createResponse(200, {
      evaluation: generateFallbackEvaluation(
        evaluationQuestion,
        aiResponse,
        student,
      ),
      modelInfo: {
        judgeEvaluationModel: "Fallback Evaluator (Local)",
        dataGenerationModel: "Claude-3-Haiku (AI Tutor)",
        apiEndpoint: "/ai/evaluate",
        evaluationType: "fallback",
        status: "fallback_mode",
      },
      error: "AI Judge temporarily unavailable, using fallback evaluation",
    });
  }
}

async function generateAIJudgeEvaluation(
  question,
  aiResponse,
  student,
  evaluationType,
) {
  const judgePrompt = buildJudgePrompt(
    question,
    aiResponse,
    student,
    evaluationType,
  );

  console.log(
    "Calling AWS Nova Micro via inference profile for AI Judge evaluation...",
  );

  // Use AWS Nova Micro with inference profile for consistent, cost-effective evaluation
  const response = await bedrockClient.send(
    new InvokeModelCommand({
      modelId: NOVA_MICRO_INFERENCE_PROFILE,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: [
              {
                text: `You are an expert educational AI evaluator. Provide objective, detailed evaluations of AI tutor responses. Give critical feedback. Always respond with valid JSON only, no additional text.

${judgePrompt}`,
              },
            ],
          },
        ],
        inferenceConfig: {
          max_new_tokens: 2500, // Nova uses max_new_tokens instead of max_tokens
          temperature: 0.1, // Low temperature for consistent evaluation
        },
      }),
    }),
  );

  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  // Nova models have a different response format than Claude
  const evaluationText =
    responseBody.output?.message?.content?.[0]?.text ||
    responseBody.content?.[0]?.text ||
    responseBody.output?.text ||
    responseBody.text;

  console.log("AI Judge evaluation received from AWS Nova Micro");
  console.log(
    "Response structure:",
    JSON.stringify(responseBody, null, 2).substring(0, 500),
  );

  // Try to parse as JSON
  try {
    const evaluation = JSON.parse(evaluationText);

    console.log(
      "Parsed evaluation scores:",
      JSON.stringify(
        {
          overall_score: evaluation.overall_score,
          criteria_scores: evaluation.criteria_scores,
        },
        null,
        2,
      ),
    );

    // Validate and normalize the evaluation
    return normalizeEvaluation(evaluation);
  } catch (parseError) {
    console.error("Failed to parse AI Judge JSON:", parseError);
    console.log("Raw evaluation text length:", evaluationText?.length);
    console.log("Raw evaluation preview:", evaluationText?.substring(0, 500));

    // Return the raw text with a note about parsing
    return JSON.stringify({
      overall_score: 75,
      criteria_scores: {
        accuracy: 75,
        clarity: 75,
        completeness: 75,
        age_appropriateness: 75,
        engagement: 75,
        structure: 75,
      },
      detailed_feedback: evaluationText,
      strengths: ["Comprehensive response"],
      areas_for_improvement: ["Response format could be improved"],
      confidence_level: 70,
      note: "AI Judge provided text evaluation, scores estimated",
    });
  }
}

function buildJudgePrompt(question, aiResponse, student, evaluationType) {
  const studentInfo = student
    ? `
Student Context:
- Grade: ${student.grade || "Not specified"}
- Subject: ${student.subject || "General"}
- Board: ${student.board || "Not specified"}
- Country: ${student.country || "Not specified"}`
    : "";

  return `You are an expert educational AI evaluator conducting a ${evaluationType} evaluation.

ORIGINAL QUESTION:
"${question}"

AI TUTOR'S RESPONSE TO EVALUATE:
"${aiResponse}"
${studentInfo}

Please evaluate this AI tutor response comprehensively. The response length is ${aiResponse?.length || 0} characters.

Evaluate on a scale of 0-100 for each criterion:

1. ACCURACY: Is the information factually correct and scientifically sound?
2. CLARITY: Is the explanation clear, well-structured, and easy to understand?
3. COMPLETENESS: Does it comprehensively address all parts of the question?
4. AGE_APPROPRIATENESS: Is the language and complexity suitable for the student's grade level?
5. ENGAGEMENT: Is the response engaging, interactive, and likely to promote learning?
6. STRUCTURE: Is the response well-organized with logical flow and good formatting?

Provide your evaluation in the following JSON format (JSON only, no additional text):
{
  "overall_score": [0-100],
  "criteria_scores": {
    "accuracy": [0-100],
    "clarity": [0-100], 
    "completeness": [0-100],
    "age_appropriateness": [0-100],
    "engagement": [0-100],
    "structure": [0-100]
  },
  "detailed_feedback": "Comprehensive explanation of the evaluation with specific examples",
  "strengths": ["list of specific strengths identified"],
  "areas_for_improvement": ["list of specific areas that could be improved"],
  "confidence_level": [0-100],
  "recommendations": ["specific suggestions for improvement"]
}

Be thorough, objective, and constructive. Focus on educational value and learning effectiveness. Consider the full length and context of the response.`;
}

function normalizeEvaluation(evaluation) {
  // Ensure all required fields exist with proper types
  const normalized = {
    overall_score: Math.max(0, Math.min(100, evaluation.overall_score || 0)),
    criteria_scores: {
      accuracy: Math.max(
        0,
        Math.min(100, evaluation.criteria_scores?.accuracy || 0),
      ),
      clarity: Math.max(
        0,
        Math.min(100, evaluation.criteria_scores?.clarity || 0),
      ),
      completeness: Math.max(
        0,
        Math.min(100, evaluation.criteria_scores?.completeness || 0),
      ),
      age_appropriateness: Math.max(
        0,
        Math.min(100, evaluation.criteria_scores?.age_appropriateness || 0),
      ),
      engagement: Math.max(
        0,
        Math.min(100, evaluation.criteria_scores?.engagement || 0),
      ),
      structure: Math.max(
        0,
        Math.min(100, evaluation.criteria_scores?.structure || 0),
      ),
    },
    detailed_feedback:
      evaluation.detailed_feedback || "Evaluation completed successfully",
    strengths: Array.isArray(evaluation.strengths) ? evaluation.strengths : [],
    areas_for_improvement: Array.isArray(evaluation.areas_for_improvement)
      ? evaluation.areas_for_improvement
      : [],
    confidence_level: Math.max(
      0,
      Math.min(100, evaluation.confidence_level || 85),
    ),
    recommendations: Array.isArray(evaluation.recommendations)
      ? evaluation.recommendations
      : [],
  };

  console.log(
    "Normalized evaluation scores:",
    JSON.stringify(
      {
        overall_score: normalized.overall_score,
        criteria_scores: normalized.criteria_scores,
      },
      null,
      2,
    ),
  );

  return JSON.stringify(normalized);
}

function generateFallbackEvaluation(question, aiResponse, student) {
  const fallbackEvaluation = {
    overall_score: 70,
    criteria_scores: {
      accuracy: 75,
      clarity: 70,
      completeness: 65,
      age_appropriateness: 75,
      engagement: 65,
      structure: 70,
    },
    detailed_feedback: `This is a fallback evaluation. The AI tutor provided a response to the question "${question?.substring(0, 50)}...". The response appears to be educational in nature and attempts to address the student's query. However, detailed evaluation by AI Judge is temporarily unavailable.`,
    strengths: [
      "Response addresses the student's question",
      "Educational content provided",
      "Appropriate length for the question",
    ],
    areas_for_improvement: [
      "Detailed AI evaluation unavailable",
      "Consider retrying evaluation when AI Judge is available",
    ],
    confidence_level: 60,
    recommendations: [
      "Retry evaluation when AI Judge service is restored",
      "Manual review recommended for important responses",
    ],
  };

  return JSON.stringify(fallbackEvaluation);
}

async function logEvaluation(question, response, evaluation, student) {
  try {
    const evaluationRecord = {
      evaluationId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      question: question?.substring(0, 500), // Truncate for storage
      response: response?.substring(0, 1000), // Truncate for storage
      evaluation: evaluation,
      studentProfile: student,
      judgeModel: AI_JUDGE_MODEL,
      tutorModel: "Claude-3-Haiku",
      type: "ai_judge_evaluation",
      ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 90 days TTL
    };

    await docClient.send(
      new PutCommand({
        TableName: EVALUATION_TABLE,
        Item: evaluationRecord,
      }),
    );

    console.log("Evaluation logged successfully");
  } catch (error) {
    console.error("Failed to log evaluation:", error);
    // Don't fail the main request if logging fails
  }
}

function extractQuestionFromPrompt(prompt) {
  if (!prompt) return "No question provided";

  // Try to extract question from various prompt formats
  const questionMatch =
    prompt.match(/QUESTION ASKED:\s*"([^"]+)"/i) ||
    prompt.match(/ORIGINAL QUESTION:\s*"([^"]+)"/i) ||
    prompt.match(/Question:\s*([^\n]+)/i);

  return questionMatch ? questionMatch[1] : prompt.substring(0, 200);
}

function extractStudentFromPrompt(prompt) {
  if (!prompt) return null;

  // Try to extract student info from prompt
  const gradeMatch = prompt.match(/Grade:\s*(\w+)/i);
  const subjectMatch = prompt.match(/Subject:\s*(\w+)/i);
  const boardMatch = prompt.match(/Board:\s*(\w+)/i);

  if (gradeMatch || subjectMatch || boardMatch) {
    return {
      grade: gradeMatch ? gradeMatch[1] : "Unknown",
      subject: subjectMatch ? subjectMatch[1] : "General",
      board: boardMatch ? boardMatch[1] : "Unknown",
    };
  }

  return null;
}

function createResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Requested-With",
    },
    body: JSON.stringify(body),
  };
}
