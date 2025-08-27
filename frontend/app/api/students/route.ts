import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Call the backend API to get students
    const backendUrl = process.env.NEXT_PUBLIC_API_ENDPOINT || 'https://g05lylqe93.execute-api.ap-southeast-1.amazonaws.com/v1';
    
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
      return NextResponse.json({
        students: [
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
        ],
        source: 'demo_fallback',
        timestamp: new Date().toISOString()
      });
    }

    const data = await response.json();
    console.log('Students loaded successfully:', data.students?.length || 0);
    
    return NextResponse.json({
      students: data.students || data || [],
      source: 'backend_api',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Students API error:', error);
    
    // Return demo data as fallback
    return NextResponse.json({
      students: [
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
      ],
      source: 'demo_fallback',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
