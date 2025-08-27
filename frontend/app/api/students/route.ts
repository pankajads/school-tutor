import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Call the backend API to get students
    const backendUrl = process.env.NEXT_PUBLIC_API_ENDPOINT || 'https://0mcvthborg.execute-api.ap-southeast-1.amazonaws.com/prod';
    
    console.log('Fetching students from:', `${backendUrl}/students`);
    
    const response = await fetch(`${backendUrl}/students`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Backend API error:', response.status, response.statusText);
      
      // Return demo data as fallback
      return NextResponse.json([
        {
          studentId: 'demo-1',
          studentName: 'Aman Negi',
          grade: 10,
          subjects: ['Mathematics', 'Science'],
          board: 'CBSE',
          country: 'India',
          school: 'Demo School'
        },
        {
          studentId: 'demo-2',
          studentName: 'Priya Sharma', 
          grade: 9,
          subjects: ['English', 'History'],
          board: 'CBSE',
          country: 'India',
          school: 'Demo School'
        },
        {
          studentId: 'demo-3',
          studentName: 'Rahul Kumar',
          grade: 8,
          subjects: ['Mathematics', 'Science', 'English'],
          board: 'ICSE',
          country: 'India',
          school: 'Demo School'
        }
      ]);
    }

    const data = await response.json();
    console.log('Students loaded successfully:', data.students?.length || 0);
    
    // Return the students array directly, not wrapped in another object
    return NextResponse.json(data.students || data || []);

  } catch (error) {
    console.error('Students API error:', error);
    
    // Return demo data as fallback
    return NextResponse.json([
      {
        studentId: 'demo-1',
        studentName: 'Aman Negi',
        grade: 10,
        subjects: ['Mathematics', 'Science'],
        board: 'CBSE',
        country: 'India',
        school: 'Demo School'
      },
      {
        studentId: 'demo-2',
        studentName: 'Priya Sharma',
        grade: 9,
        subjects: ['English', 'History'],
        board: 'CBSE',
        country: 'India',
        school: 'Demo School'
      },
      {
        studentId: 'demo-3',
        studentName: 'Rahul Kumar',
        grade: 8,
        subjects: ['Mathematics', 'Science', 'English'],
        board: 'ICSE',
        country: 'India',
        school: 'Demo School'
      }
    ]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const backendUrl = process.env.NEXT_PUBLIC_API_ENDPOINT || 'https://0mcvthborg.execute-api.ap-southeast-1.amazonaws.com/prod';
    
    console.log('Creating student:', body);
    
    const response = await fetch(`${backendUrl}/students`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('Backend API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Create error details:', errorText);
      return NextResponse.json(
        { error: 'Failed to create student', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Student created successfully:', data);
    
    return NextResponse.json(data);

  } catch (error) {
    console.error('Create student API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
