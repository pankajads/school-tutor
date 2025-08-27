import { NextRequest, NextResponse } from 'next/server';

interface TutorRequest {
  message: string;
  studentProfile: {
    grade: number;
    subjects: string[];
    board: string;
    country: string;
  };
  context: {
    type: string;
    topic?: string;
    subject?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: TutorRequest = await request.json();
    
    // Validate required fields
    if (!body.message || !body.studentProfile) {
      return NextResponse.json(
        { error: 'Missing required fields: message, studentProfile' },
        { status: 400 }
      );
    }

    // Call the AI tutor backend API
    const backendUrl = process.env.NEXT_PUBLIC_API_ENDPOINT || 'https://0mcvthborg.execute-api.ap-southeast-1.amazonaws.com/prod';
    
    console.log('Calling AI tutor:', `${backendUrl}/ai/tutor`);
    
    const response = await fetch(`${backendUrl}/ai/tutor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        message: body.message,
        studentProfile: body.studentProfile,
        context: body.context,
        timestamp: new Date().toISOString()
      }),
    });

    if (!response.ok) {
      console.error('AI Tutor API error:', response.status, response.statusText);
      
      // Generate fallback response
      const fallbackResponse = generateFallbackResponse(body);
      return NextResponse.json({
        response: fallbackResponse,
        source: 'fallback_generator',
        timestamp: new Date().toISOString()
      });
    }

    const data = await response.json();
    console.log('AI Tutor response received');
    
    return NextResponse.json({
      response: data.response || data.message || data,
      source: 'ai_tutor_api',
      timestamp: new Date().toISOString(),
      modelInfo: {
        model: 'Claude-3-Haiku (AWS Bedrock AI Tutor)',
        apiEndpoint: `${backendUrl}/ai/tutor`,
        contextType: body.context?.type || 'general'
      }
    });

  } catch (error) {
    console.error('AI Tutor API error:', error);
    
    // Parse body for fallback
    let message = 'Generate a question';
    let studentProfile = { grade: 10, subjects: ['Mathematics'], board: 'CBSE', country: 'India' };
    try {
      const body = await request.json();
      message = body.message || message;
      studentProfile = body.studentProfile || studentProfile;
    } catch (e) {
      // Use defaults
    }
    
    const fallbackResponse = generateFallbackResponse({ message, studentProfile, context: { type: 'general' } });
    return NextResponse.json({
      response: fallbackResponse,
      source: 'fallback_generator',
      timestamp: new Date().toISOString(),
      modelInfo: {
        model: 'Fallback Generator (Local)',
        apiEndpoint: 'local_fallback',
        contextType: 'fallback'
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function generateFallbackResponse(body: TutorRequest): string {
  const { message, studentProfile, context } = body;
  const { grade, board } = studentProfile;
  const subject = context.subject || studentProfile.subjects[0] || 'Mathematics';
  const topic = context.topic || 'general concepts';

  if (context.type === 'question_generation') {
    return `Here's a Grade ${grade} ${board} question for ${subject}:

What are the fundamental principles of ${topic}? 

Explain with examples how these concepts apply in real-world scenarios. 

Show your understanding by:
1. Defining the key terms
2. Providing practical applications  
3. Solving a related problem

This question tests your understanding of ${topic} at a Grade ${grade} level according to ${board} curriculum standards.`;
  }

  if (context.type === 'answer_generation') {
    return `Great question about ${topic}! Let me explain this concept for Grade ${grade} students.

**Understanding ${topic}:**

The fundamental principles of ${topic} in ${subject} include several key concepts that are essential for Grade ${grade} students following the ${board} curriculum.

**Key Concepts:**
1. **Basic Definition**: ${topic} refers to the core mathematical/scientific principles that form the foundation of understanding in this area.

2. **Practical Applications**: These concepts are used in everyday life, from simple calculations to complex problem-solving scenarios.

3. **Problem-Solving Approach**: 
   - Step 1: Identify the given information
   - Step 2: Apply the relevant formulas or principles
   - Step 3: Calculate and verify the solution

**Example Problem:**
Let's work through a typical Grade ${grade} problem that demonstrates these concepts...

**Real-World Connection:**
This topic is particularly important because it helps students understand how ${subject} applies to real situations they might encounter.

I hope this explanation helps clarify ${topic} for you! Feel free to ask if you need more specific examples or have questions about any particular aspect.`;
  }

  // General response
  return `Thank you for your question about ${subject}. As your AI tutor, I'm here to help Grade ${grade} students with ${board} curriculum.

Your question: "${message}"

This is an excellent question that shows you're thinking deeply about the subject. Let me provide a comprehensive explanation that's appropriate for your Grade ${grade} level.

The concept you're asking about is fundamental to understanding ${subject} and connects to many other topics in your curriculum. Here's a step-by-step explanation:

1. **Foundation**: The basic principles underlying this topic
2. **Application**: How these principles are used in problem-solving
3. **Practice**: Examples and exercises to reinforce learning

Would you like me to elaborate on any specific aspect or provide additional practice problems?`;
}
