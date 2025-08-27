import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_ENDPOINT || 'https://0mcvthborg.execute-api.ap-southeast-1.amazonaws.com/prod';

export async function GET(
  request: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const { studentId } = params;
    
    console.log('Fetching student:', studentId);
    
    const response = await fetch(`${BACKEND_URL}/students/${studentId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Backend API error:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch student' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Student fetched successfully:', data);
    
    return NextResponse.json(data);

  } catch (error) {
    console.error('Get student API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const { studentId } = params;
    const body = await request.json();
    
    console.log('Updating student:', studentId, body);
    
    const response = await fetch(`${BACKEND_URL}/students/${studentId}`, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('Backend API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return NextResponse.json(
        { error: 'Failed to update student', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Student updated successfully:', data);
    
    return NextResponse.json(data);

  } catch (error) {
    console.error('Update student API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const { studentId } = params;
    
    console.log('Deleting student:', studentId);
    
    const response = await fetch(`${BACKEND_URL}/students/${studentId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Backend API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Delete error details:', errorText);
      return NextResponse.json(
        { error: 'Failed to delete student', details: errorText },
        { status: response.status }
      );
    }

    // Check if response has content
    const contentType = response.headers.get('content-type');
    let data = {};
    
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (parseError) {
        console.log('No JSON response body (this is normal for DELETE)');
      }
    }
    
    console.log('Student deleted successfully:', studentId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Student deleted successfully',
      studentId,
      ...data 
    });

  } catch (error) {
    console.error('Delete student API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
