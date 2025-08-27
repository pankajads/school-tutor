import { NextRequest, NextResponse } from 'next/server';

interface TopicsRequest {
  subject: string;
  grade: string;
  board: string;
  country: string;
  school: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: TopicsRequest = await request.json();
    
    // Validate required fields
    if (!body.subject || !body.grade || !body.board || !body.country) {
      return NextResponse.json(
        { error: 'Missing required fields: subject, grade, board, country' },
        { status: 400 }
      );
    }

    // Call the backend API to get topics
    const backendUrl = process.env.NEXT_PUBLIC_API_ENDPOINT || 'https://0mcvthborg.execute-api.ap-southeast-1.amazonaws.com/prod';
    
    console.log('Fetching topics from:', `${backendUrl}/curriculum/topics`);
    console.log('Request body:', body);
    
    const response = await fetch(`${backendUrl}/curriculum/topics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('Backend API error:', response.status, response.statusText);
      
      // Return demo topics as fallback
      const demoTopics = generateDemoTopics(body.subject, body.grade);
      return NextResponse.json({
        topics: demoTopics,
        subject: body.subject,
        grade: body.grade,
        board: body.board,
        country: body.country,
        source: 'demo_fallback',
        timestamp: new Date().toISOString()
      });
    }

    const data = await response.json();
    console.log('Topics loaded successfully:', data.topics?.length || 0);
    
    return NextResponse.json({
      topics: data.topics || [],
      subject: body.subject,
      grade: body.grade,
      board: body.board,
      country: body.country,
      source: 'backend_api',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Topics API error:', error);
    
    // Parse body for fallback
    let subject = 'Mathematics';
    let grade = '10';
    try {
      const body = await request.json();
      subject = body.subject || subject;
      grade = body.grade || grade;
    } catch (e) {
      // Use defaults
    }
    
    const demoTopics = generateDemoTopics(subject, grade);
    return NextResponse.json({
      topics: demoTopics,
      subject: subject,
      grade: grade,
      source: 'demo_fallback',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function generateDemoTopics(subject: string, grade: string): any[] {
  const topicsBySubject: Record<string, string[]> = {
    'Mathematics': [
      'Algebra Fundamentals',
      'Geometry Basics',
      'Number Systems',
      'Trigonometry',
      'Statistics and Probability',
      'Linear Equations',
      'Quadratic Equations',
      'Coordinate Geometry'
    ],
    'Science': [
      'Physics - Motion and Force',
      'Chemistry - Atomic Structure',
      'Biology - Cell Structure',
      'Energy and Work',
      'Chemical Reactions',
      'Human Body Systems',
      'Electricity and Magnetism',
      'Periodic Table'
    ],
    'English': [
      'Grammar and Syntax',
      'Reading Comprehension',
      'Creative Writing',
      'Poetry Analysis',
      'Essay Writing',
      'Literature Studies',
      'Vocabulary Building',
      'Communication Skills'
    ],
    'History': [
      'Ancient Civilizations',
      'Medieval Period',
      'Modern History',
      'Independence Movement',
      'World Wars',
      'Cultural Heritage',
      'Political Systems',
      'Economic History'
    ],
    'Geography': [
      'Physical Geography',
      'Human Geography',
      'Climate and Weather',
      'Natural Resources',
      'Population and Settlement',
      'Agriculture',
      'Transportation',
      'Environmental Issues'
    ]
  };

  const topics = topicsBySubject[subject] || topicsBySubject['Mathematics'];
  
  return topics.map((name, index) => ({
    name,
    description: `${name} concepts for Grade ${grade} students`,
    chapter: `Chapter ${index + 1}`,
    difficulty: index < 3 ? 'Basic' : index < 6 ? 'Intermediate' : 'Advanced',
    estimatedTime: `${Math.floor(Math.random() * 3) + 2} hours`,
    prerequisites: index > 0 ? [topics[index - 1]] : [],
    learningObjectives: [
      `Understand ${name.toLowerCase()} concepts`,
      `Apply ${name.toLowerCase()} in problem solving`,
      `Analyze ${name.toLowerCase()} scenarios`
    ]
  }));
}
