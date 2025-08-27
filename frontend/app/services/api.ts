/**
 * Clean API Service for School Tutor Application
 * 
 * This service provides a centralized interface for all backend API communication
 * with proper error handling, logging, and type safety.
 * 
 * Key Features:
 * - Environment-aware logging (verbose in dev, minimal in prod)
 * - Consistent error handling and retry logic
 * - TypeScript interfaces for all API responses
 * - Proper timeout and abort handling
 * - Structured logging for debugging
 */

// Environment configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://0mcvthborg.execute-api.ap-southeast-1.amazonaws.com/prod';

// Logging configuration
type LogLevel = 'none' | 'error' | 'info' | 'debug';
const LOG_LEVEL: LogLevel = process.env.NODE_ENV === 'development' ? 'info' : 'error';

// API Response Types
interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

interface Student {
  studentId: string;
  studentName: string;
  email: string;
  grade: number;
  subjects: string[];
  learningPace: 'slow' | 'medium' | 'fast';
  board: string;
  school: string;
  country: string;
  createdAt: string;
  updatedAt: string;
}

// Legacy interface for backward compatibility
interface StudentListItem {
  studentId: string;
  studentName: string;
  email: string;
  grade: number;
  subjects: string[];
  learningPace: 'slow' | 'medium' | 'fast';
  board: string;
  school: string;
  country: string;
  createdAt: string;
  updatedAt: string;
}

// Form data interface for student creation
interface StudentFormData {
  studentName: string;
  email: string;
  grade: number;
  subjects: string[];
  learningPace: 'slow' | 'medium' | 'fast';
  board: string;
  school: string;
  country: string;
}

interface Topic {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  chapter: string;
  subject: string;
  grade: number;
  completed?: boolean;
}

interface TutorSession {
  sessionId: string;
  studentId: string;
  subject: string;
  topic: string;
  status: 'active' | 'completed' | 'paused';
  messages: TutorMessage[];
  createdAt: string;
  updatedAt: string;
}

interface TutorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface StudentScore {
  studentId: string;
  totalScore: number;
  subjectScores: Record<string, number>;
  completedTopics: number;
  averageScore: number;
  lastUpdated: string;
}

/**
 * Centralized API service class with proper error handling and logging
 */
class ApiService {
  private logLevel: LogLevel = LOG_LEVEL;

  constructor() {
    this.log('info', 'API Service initialized', { baseUrl: API_BASE_URL });
  }

  /**
   * Centralized logging with configurable levels
   */
  private log(level: LogLevel, message: string, data?: any): void {
    const levels = { none: 0, error: 1, info: 2, debug: 3 };
    if (levels[level] <= levels[this.logLevel]) {
      const prefix = `[API-${level.toUpperCase()}]`;
      if (data) {
        console.log(prefix, message, data);
      } else {
        console.log(prefix, message);
      }
    }
  }

  /**
   * Core HTTP request method with comprehensive error handling
   */
  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    // Server-side rendering check
    if (typeof window === 'undefined') {
      this.log('error', 'API request attempted in server environment', { endpoint });
      throw new Error('API requests can only be made in browser environment');
    }

    const fullUrl = `${API_BASE_URL}${endpoint}`;
    const method = options.method || 'GET';
    const startTime = Date.now();
    
    // Set up abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      this.log('debug', `${method} ${endpoint}`, { 
        url: fullUrl,
        headers: options.headers,
        hasBody: !!options.body 
      });

      const response = await fetch(fullUrl, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
        ...options,
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        this.log('error', `API request failed`, {
          url: fullUrl,
          method,
          status: response.status,
          statusText: response.statusText,
          duration,
          error: errorText
        });
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.log('debug', `API request successful`, {
        method,
        endpoint,
        duration,
        dataSize: JSON.stringify(data).length
      });

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        this.log('error', 'API request timeout', { endpoint, duration: Date.now() - startTime });
        throw new Error('Request timeout');
      }
      
      this.log('error', 'API request error', { endpoint, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  // Student Management APIs
  async createStudent(studentData: Omit<Student, 'studentId' | 'createdAt' | 'updatedAt'>): Promise<Student> {
    return this.makeRequest<Student>('/students', {
      method: 'POST',
      body: JSON.stringify(studentData),
    });
  }

  async getStudents(): Promise<Student[]> {
    return this.makeRequest<Student[]>('/students');
  }

  async getStudent(studentId: string): Promise<Student> {
    return this.makeRequest<Student>(`/students/${studentId}`);
  }

  async updateStudent(studentId: string, updates: Partial<Student>): Promise<Student> {
    return this.makeRequest<Student>(`/students/${studentId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteStudent(studentId: string): Promise<void> {
    return this.makeRequest<void>(`/students/${studentId}`, {
      method: 'DELETE',
    });
  }

  // Topic Management APIs
  async getTopicsForSubject(
    subject: string,
    grade: string,
    board: string,
    country: string,
    school?: string
  ): Promise<{ topics: Topic[]; subject: string; grade: string; board: string; country: string }> {
    const params = new URLSearchParams({
      subject,
      grade,
      board,
      country,
      ...(school && { school })
    });

    this.log('debug', `Fetching topics for ${subject}`, { grade, board, country, school });
    
    const response = await this.makeRequest<any>(`/curriculum/topics?${params}`);
    
    this.log('info', `Retrieved ${response.topics?.length || 0} topics for ${subject}`);
    
    return response;
  }

  async getStudentTopics(studentId: string): Promise<{ topics: Topic[] }> {
    return this.makeRequest<{ topics: Topic[] }>(`/students/${studentId}/topics`);
  }

  async markTopicCompleted(studentId: string, topicId: string): Promise<void> {
    await this.makeRequest<void>(`/students/${studentId}/topics/${topicId}/complete`, {
      method: 'POST',
    });
    this.log('info', `Marked topic ${topicId} as completed for student ${studentId}`);
  }

  async getStudentScore(studentId: string): Promise<StudentScore> {
    const response = await this.makeRequest<StudentScore>(`/students/${studentId}/score`);
    this.log('info', `Retrieved score for student ${studentId}`, { score: response.totalScore });
    return response;
  }

  // AI Tutor APIs
  async startTutorSession(
    studentId: string,
    subject: string,
    topic: string
  ): Promise<TutorSession> {
    const response = await this.makeRequest<TutorSession>('/ai/tutor/session', {
      method: 'POST',
      body: JSON.stringify({
        studentId,
        subject,
        topic,
      }),
    });
    
    this.log('info', `Started AI tutor session`, { 
      sessionId: response.sessionId, 
      studentId, 
      subject, 
      topic 
    });
    
    return response;
  }

  async getTutorSession(sessionId: string): Promise<TutorSession> {
    return this.makeRequest<TutorSession>(`/ai/tutor/session/${sessionId}`);
  }

  async generateTutorResponse(
    sessionId: string,
    message: string,
    sessionContext?: { subject: string; topic: string; studentId: string }
  ): Promise<{ response: string; sessionId: string }> {
    const payload: any = {
      sessionId,
      message,
    };

    if (sessionContext) {
      payload.sessionContext = sessionContext;
      this.log('debug', `Including session context`, sessionContext);
    }

    return this.makeRequest<{ response: string; sessionId: string }>('/ai/tutor', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async endTutorSession(sessionId: string): Promise<void> {
    try {
      await this.makeRequest<void>(`/ai/tutor/session/${sessionId}`, {
        method: 'DELETE',
      });
      this.log('info', `Ended tutor session ${sessionId}`);
    } catch (error) {
      this.log('error', `Failed to end tutor session ${sessionId}`, error);
      // Continue with local cleanup regardless of backend response
    }
  }

  // Utility Methods
  async testConnection(): Promise<boolean> {
    if (typeof window === 'undefined') {
      this.log('error', 'testConnection called in server environment');
      return false;
    }
    
    try {
      this.log('info', 'Testing API connection...');
      const response = await fetch(`${API_BASE_URL}/curriculum/topics`, {
        method: 'OPTIONS',
        headers: { 'Accept': 'application/json' }
      });
      
      const isConnected = response.ok || response.status === 405;
      this.log('info', `Connection test ${isConnected ? 'successful' : 'failed'}`, { status: response.status });
      return isConnected;
    } catch (error) {
      this.log('error', 'Connection test failed', error);
      return false;
    }
  }

  /**
   * Batch load all topics for a student across all their subjects
   */
  async getAllTopicsForStudent(student: Student): Promise<{
    allTopics: Record<string, Topic[]>;
    summary: {
      totalTopics: number;
      successfulSubjects: string[];
      failedSubjects: string[];
    };
  }> {
    this.log('info', `Loading all topics for student: ${student.studentName}`, {
      grade: student.grade,
      subjects: student.subjects
    });

    const results = await Promise.allSettled(
      student.subjects.map(async (subject) => {
        const topics = await this.getTopicsForSubject(
          subject,
          student.grade.toString(),
          student.board,
          student.country,
          student.school
        );
        return { subject, topics: topics.topics };
      })
    );

    const allTopics: Record<string, Topic[]> = {};
    const successfulSubjects: string[] = [];
    const failedSubjects: string[] = [];
    let totalTopics = 0;

    results.forEach((result, index) => {
      const subject = student.subjects[index];
      if (result.status === 'fulfilled') {
        allTopics[subject] = result.value.topics;
        successfulSubjects.push(subject);
        totalTopics += result.value.topics.length;
        this.log('debug', `${subject}: ${result.value.topics.length} topics loaded`);
      } else {
        allTopics[subject] = [];
        failedSubjects.push(subject);
        this.log('error', `Failed to load topics for ${subject}`, result.reason);
      }
    });

    const summary = {
      totalTopics,
      successfulSubjects,
      failedSubjects,
    };

    this.log('info', 'Topic loading completed', summary);

    return { allTopics, summary };
  }
}

// Export singleton instance
export const apiService = new ApiService();

// Legacy function for backward compatibility
export function getApiService() {
  return apiService;
}

export default apiService;

// Export types for use in components
export type {
  Student,
  StudentListItem,
  StudentFormData,
  Topic,
  TutorSession,
  TutorMessage,
  StudentScore,
  ApiResponse,
};
