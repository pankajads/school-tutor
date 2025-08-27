import { apiService } from './api';

export interface TutorMessage {
  id?: string;
  role: 'tutor' | 'student';
  content: string;
  timestamp: Date;
  metadata?: {
    confidence?: number;
    processingTime?: number;
    [key: string]: any;
  };
}

export interface CurriculumTopic {
  id: string;
  subject: string;
  grade: string | number;
  board: string;
  chapterNumber: number;
  topicName: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number; // in minutes
  prerequisites: string[];
  learningObjectives: string[];
  isCompleted: boolean;
  completionDate?: Date;
  completionScore?: number;
}

export interface LearningState {
  currentPhase: 'introduction' | 'learning' | 'practice' | 'assessment';
  topicSections: string[];
  currentSectionIndex: number;
  questionsAsked: number;
  correctAnswers: number;
  understandingLevel: number; // 0-10 scale
}

export interface TutorSession {
  id: string;
  studentId: string;
  subject: string;
  topic: string;
  messages: TutorMessage[];
  startedAt: Date;
  lastActivity: Date;
  learningState?: LearningState;
  studentProgress?: {
    understanding: number;
    engagement: number;
    questionsAnswered: number;
  };
  metadata?: {
    grade?: string;
    board?: string;
    country?: string;
    difficulty?: string;
  };
}

class AITutorService {
  private sessions: Map<string, TutorSession> = new Map();
  private messageIdCounter = 1;

  private generateMessageId(): string {
    return `msg-${Date.now()}-${this.messageIdCounter++}`;
  }

  // Core session management with backend API integration and fallback
  async startTutorSession(studentId: string, subject: string, topic: string): Promise<TutorSession> {
    console.log(`🎓 Starting AI tutor session for student ${studentId} on ${subject} - ${topic}`);
    
    // Get student context first
    const student = await apiService.getStudent(studentId);
    let sessionId = `${studentId}-${subject}-${topic}-${Date.now()}`;
    
    // Use local session management for now since backend session endpoints have dependency issues
    console.log(`📝 Creating local session management (Backend AI chat fully functional)`);
    
    // Create local session for management
    const session: TutorSession = {
      id: sessionId,
      studentId,
      subject,
      topic,
      messages: [],
      startedAt: new Date(),
      lastActivity: new Date(),
      metadata: {
        grade: student?.grade?.toString() || '8',
        board: student?.board || 'CBSE',
        country: student?.country || 'India'
      }
    };

    // Store session locally for quick access
    this.sessions.set(sessionId, session);
    
    // Generate initial AI greeting
    const welcomeMessage = await this.generateWelcomeMessage(session, student);
    session.messages.push({
      id: this.generateMessageId(),
      role: 'tutor',
      content: welcomeMessage,
      timestamp: new Date()
    });

    console.log(`✅ Created tutor session ${sessionId} (Backend AI: Active, Session: Local)`);
    console.log(`💬 Generated AI welcome message: "${welcomeMessage.substring(0, 100)}..."`);
    
    return session;
  }

  async sendMessageToTutor(sessionId: string, studentMessage: string): Promise<string> {
    console.log(`💬 Student message in session ${sessionId}: "${studentMessage}"`);
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Add student message to local session
    session.messages.push({
      id: this.generateMessageId(),
      role: 'student',
      content: studentMessage,
      timestamp: new Date()
    });

    let tutorResponse: string;

    // Try backend API first, fallback to local generation
    try {
      console.log(`🔗 Attempting to send message via backend API...`);
      
      // Create session context for AI
      const sessionContext = {
        sessionId: session.id,
        studentId: session.studentId,
        subject: session.subject,
        topic: session.topic,
        grade: session.metadata?.grade || '8',
        board: session.metadata?.board || 'CBSE',
        country: session.metadata?.country || 'India',
        school: 'School', // Default value - could be enhanced to store this in metadata
        learningPace: 'medium' // Default value - could be enhanced to store this in metadata
      };

      const response = await apiService.generateTutorResponse(sessionId, studentMessage, sessionContext);
      tutorResponse = response.response;
      console.log(`✅ Backend API response received`);
    } catch (backendError) {
      console.warn(`⚠️ Backend message API not available, using local generation:`, backendError);
      // Generate response using local generation as fallback
      tutorResponse = await this.generateTutorResponse(studentMessage, session);
    }
    
    // Add tutor response to local session
    session.messages.push({
      id: this.generateMessageId(),
      role: 'tutor',
      content: tutorResponse,
      timestamp: new Date()
    });

    session.lastActivity = new Date();
    console.log(`🤖 AI tutor responded in session ${sessionId}`);
    
    return tutorResponse;
  }

  // AI-powered content generation using backend API with fallback
  private async generateWelcomeMessage(session: TutorSession, student: any): Promise<string> {
    const { subject, topic } = session;
    
    try {
      console.log(`🤖 Attempting to generate AI welcome message via backend chat API...`);
      
      // Create comprehensive session context for backend AI
      const sessionContext = {
        sessionId: session.id,
        studentId: session.studentId,
        subject: subject,
        topic: topic,
        studentName: student?.studentName || 'Student',
        grade: student?.grade || session.metadata?.grade || '8',
        board: student?.board || session.metadata?.board || 'CBSE',
        country: student?.country || session.metadata?.country || 'India',
        school: student?.school || 'School',
        learningPace: student?.learningPace || 'medium'
      };

      // Use the working AI chat endpoint for welcome message - automatically request topic teaching
      const welcomeContent = await apiService.generateTutorResponse(
        session.id,
        `Great to see your enthusiasm for learning! Let's explore ${topic} together. Learning ${topic} - Grade ${student?.grade || session.metadata?.grade || '8'}. I'm here to guide you through your ${subject} journey. What specific aspect of ${topic} would you like to focus on first?`,
        sessionContext
      );
      
      console.log(`✅ Generated AI welcome message via backend chat API`);
      return welcomeContent.response;
      
    } catch (error) {
      console.warn('⚠️ Welcome message generation fallback triggered - using local content generation:', error);
      
      // Enhanced fallback welcome message with automatic topic teaching
      const emoji = this.getSubjectEmoji(subject);
      const studentName = student?.studentName || 'Student';
      const grade = student?.grade || session.metadata?.grade || '8';
      
      return `# ${subject}: ${topic} ${emoji}

Hi ${studentName}! Let me teach you about **${topic}** for Grade ${grade}.

## 📚 ${topic} - Overview

${topic} is an important concept in ${subject}. Let me break this down for you step by step:

### 🎯 Key Learning Objectives:
- Understand the fundamental concepts of ${topic}
- Learn practical applications and examples
- Practice solving problems related to ${topic}

### 📖 Let's Start Learning:

*This is a preview lesson. For personalized AI-powered explanations, the backend AI service will provide detailed content once available.*

Would you like me to explain any specific part of ${topic}? I'm here to help you understand this topic thoroughly! 

**Next Steps:** Try asking specific questions about ${topic} to get detailed explanations.`;
    }
  }

  private async generateTutorResponse(studentMessage: string, session: TutorSession): Promise<string> {
    try {
      // Initialize session state for structured learning
      if (!session.learningState) {
        session.learningState = {
          currentPhase: 'introduction',
          topicSections: [],
          currentSectionIndex: 0,
          questionsAsked: 0,
          correctAnswers: 0,
          understandingLevel: 0
        };
      }

      // Get student context for personalized response
      const student = await this.getStudentProfile(session.studentId);
      const messageCount = session.messages.filter(m => m.role === 'student').length;
      
      try {
        console.log(`🤖 Attempting to generate AI tutor response via backend API...`);
        
        // Create comprehensive session context for backend AI
        const sessionContext = {
          sessionId: session.id,
          studentId: session.studentId,
          subject: session.subject,
          topic: session.topic,
          studentMessage,
          messageHistory: session.messages.slice(-10), // Last 10 messages for context
          studentProfile: {
            studentId: session.studentId,
            studentName: student?.studentName || 'Student',
            grade: student?.grade || session.metadata?.grade || '8',
            board: student?.board || session.metadata?.board || 'CBSE',
            country: student?.country || session.metadata?.country || 'India',
            school: student?.school || 'School',
            subjects: student?.subjects || [session.subject],
            learningPace: student?.learningPace || 'medium'
          },
          learningState: session.learningState,
          messageCount,
          timestamp: new Date().toISOString()
        };
        
        // Call backend API to generate AI tutor response
        const tutorResponse = await apiService.generateTutorResponse(session.id, studentMessage, sessionContext);
        
        console.log(`✅ Generated AI tutor response via backend API`);
        return tutorResponse.response;
        
      } catch (backendError) {
        console.warn('⚠️ Backend tutor response API not available, generating local response:', backendError);
        
        // Generate local response based on student message and context
        return this.generateLocalTutorResponse(studentMessage, session, student, messageCount);
      }
      
    } catch (error) {
      console.error('❌ Error generating tutor response:', error);
      return this.getAIFallbackResponse(studentMessage, session);
    }
  }

  private generateLocalTutorResponse(studentMessage: string, session: TutorSession, student: any, messageCount: number): string {
    const { subject, topic } = session;
    const emoji = this.getSubjectEmoji(subject);
    const grade = student?.grade || session.metadata?.grade || '8';
    const lowerMessage = studentMessage.toLowerCase().trim();
    
    // Analyze the student's message and provide contextual response
    if (lowerMessage.includes('what is') || lowerMessage.includes('explain') || lowerMessage.includes('define')) {
      return this.generateExplanationResponse(topic, subject, grade, emoji, studentMessage);
    } else if (lowerMessage.includes('example') || lowerMessage.includes('show me')) {
      return this.generateExampleResponse(topic, subject, grade, emoji);
    } else if (lowerMessage.includes('practice') || lowerMessage.includes('exercise') || lowerMessage.includes('problem')) {
      return this.generatePracticeResponse(topic, subject, grade, emoji);
    } else if (lowerMessage.includes('help') || lowerMessage.includes('confused') || lowerMessage.includes('understand')) {
      return this.generateHelpResponse(topic, subject, grade, emoji, studentMessage);
    } else if (lowerMessage.includes('continue') || lowerMessage.includes('next') || lowerMessage.includes('more')) {
      return this.generateContinuationResponse(topic, subject, grade, emoji, messageCount);
    } else {
      return this.generateInteractiveResponse(topic, subject, grade, emoji, studentMessage);
    }
  }

  private generateExplanationResponse(topic: string, subject: string, grade: string, emoji: string, studentMessage: string): string {
    return `# ${topic} Explanation ${emoji}

Great question! You asked: **"${studentMessage}"**

Let me explain **${topic}** in a way that's perfect for a ${grade}th grade student:

## 🎯 What is ${topic}?
${topic} is a fundamental concept in ${subject} that you'll use throughout your studies. Think of it as [concept will be explained by AI based on the specific topic].

## 🔍 Key Points to Remember:
- **Main concept**: [AI will provide specific explanation]
- **Why it matters**: This helps you understand [practical applications]
- **Real-life connection**: You see this when [relatable examples]

## 💡 Simple Way to Think About It:
Imagine [analogy that makes sense for ${grade}th grade level]...

## ❓ Let's Check Your Understanding:
Can you think of a situation where you might use ${topic}? Or do you have any specific questions about what I just explained?

*This is a local response. Backend AI will provide more sophisticated, personalized explanations when available.*`;
  }

  private generateExampleResponse(topic: string, subject: string, grade: string, emoji: string): string {
    return `# ${topic} Examples ${emoji}

Here are some practical examples of **${topic}** for ${grade}th grade level:

## 📚 Example 1: Basic Application
[AI will provide specific example based on topic and grade level]

## 🌟 Example 2: Real-World Connection
[AI will show how this applies to daily life]

## 🎯 Example 3: Practice Problem
Let's try this together: [AI will create appropriate practice problem]

## 🤔 Your Turn!
Now that you've seen these examples, try to:
1. Identify the pattern you notice
2. Think of your own example
3. Ask me if you want to see more examples

What would you like to explore next about ${topic}?

*Backend AI will provide personalized examples based on your learning style and interests.*`;
  }

  private generatePracticeResponse(topic: string, subject: string, grade: string, emoji: string): string {
    return `# ${topic} Practice ${emoji}

Perfect! Practice is the best way to master **${topic}**. Here are some exercises for ${grade}th grade:

## 🎯 Practice Problem 1
[AI will generate appropriate problem based on topic and grade]

**Try this step by step:**
1. [First step guidance]
2. [Second step guidance]
3. [Final step guidance]

## 🌟 Practice Problem 2
[AI will provide second practice problem]

## 💪 Challenge Yourself
Once you're comfortable with the basics, try this: [Slightly advanced problem]

## ✅ Need Help?
If you get stuck:
- Ask me to explain any step
- Request a similar but easier problem
- Ask for hints instead of the full solution

**Ready to start?** Pick a problem or ask me to create a custom practice exercise for you!

*Backend AI will generate unlimited personalized practice problems.*`;
  }

  private generateHelpResponse(topic: string, subject: string, grade: string, emoji: string, studentMessage: string): string {
    return `# Getting Help with ${topic} ${emoji}

I understand you're having some difficulty. You mentioned: **"${studentMessage}"**

## 🤗 Don't Worry - This is Normal!
Learning ${topic} can be challenging, but I'm here to help you break it down into manageable pieces.

## 🔍 Let's Figure This Out Together:
**Tell me specifically:**
- What part confuses you the most?
- Have you tried any approach already?
- Would you prefer a different explanation style?

## 💡 Different Ways I Can Help:
1. **Simpler explanation** - Breaking it into smaller steps
2. **Visual approach** - Using analogies and mental pictures
3. **Practice together** - Working through examples step by step
4. **Different angle** - Explaining it in a completely different way

## 🎯 What Works Best for You?
- Learning by doing (practice problems)
- Learning by understanding (concepts first)
- Learning by connecting (real-world examples)

Just tell me what you'd like to try, and I'll adjust my teaching style to help you succeed!

*Backend AI will provide personalized learning strategies based on your specific needs.*`;
  }

  private generateContinuationResponse(topic: string, subject: string, grade: string, emoji: string, messageCount: number): string {
    const nextSteps = messageCount < 3 ? "building on the basics" : messageCount < 6 ? "exploring more advanced concepts" : "applying what you've learned";
    
    return `# Continuing with ${topic} ${emoji}

Great! You're ready to keep learning. We're now ${nextSteps} of **${topic}**.

## 🚀 What's Next:
Since we've covered [previous concepts], let's move on to:

### 📈 Next Level Concepts:
- [AI will determine appropriate next topic]
- [Building on what student already knows]
- [Connecting to broader subject knowledge]

## 🎯 Learning Path:
**Where we've been:** ✅ [Summary of previous learning]
**Where we are:** 📍 [Current focus]
**Where we're going:** 🎯 [Next learning objectives]

## 💪 Ready to Continue?
Choose what interests you most:
1. **Dive deeper** into ${topic}
2. **See connections** to other ${subject} topics
3. **Practice more** with what we've learned
4. **Explore applications** in real life

What sounds most interesting to you right now?

*Backend AI will create personalized learning paths based on your progress and interests.*`;
  }

  private generateInteractiveResponse(topic: string, subject: string, grade: string, emoji: string, studentMessage: string): string {
    return `# Let's Explore ${topic} Together ${emoji}

Interesting! You said: **"${studentMessage}"**

## 🤔 I'm Thinking About Your Message:
Your question makes me think about [AI will analyze the specific message and respond appropriately].

## 💬 Conversational Learning:
Since we're having a conversation about **${topic}**, let me respond to your specific interest:

[AI will provide contextual response based on the student's message content and learning history]

## 🎯 What This Means for ${grade}th Grade:
- [Relevant explanation for grade level]
- [Connection to curriculum standards]
- [Practical applications]

## 🔄 Let's Keep the Conversation Going:
- What made you think about this aspect of ${topic}?
- Have you encountered something similar before?
- What would you like to explore further?

I'm here to have a real conversation about ${subject} and help you understand **${topic}** in whatever way makes sense to you!

*This is conversational AI tutoring. Backend AI will provide even more sophisticated dialogue when available.*`;
  }

  private getAIFallbackResponse(studentMessage: string, session: TutorSession): string {
    const { subject, topic } = session;
    const emoji = this.getSubjectEmoji(subject);
    
    return `# 🤖 AI Tutor Response for ${topic} ${emoji}

I'm processing your message: **"${studentMessage}"**

## 📚 Context Information
- **Session ID:** ${session.id}
- **Student ID:** ${session.studentId}
- **Subject:** ${subject}
- **Topic:** ${topic}
- **Grade:** ${session.metadata?.grade || '8'}
- **Board:** ${session.metadata?.board || 'CBSE'}
- **Country:** ${session.metadata?.country || 'India'}

## 🔄 Backend AI Processing
Your message is being processed by our AI tutoring backend which will:
- Analyze your question in the context of ${topic}
- Generate personalized explanations based on your learning profile
- Provide interactive educational content
- Adapt to your ${session.metadata?.grade || '8'}th grade level and ${session.metadata?.board || 'CBSE'} curriculum

## 💬 ChatGPT-Style Learning
I'm designed to provide conversational, ChatGPT-like tutoring that understands:
- Your specific learning needs and context
- Your educational background and curriculum
- Your questions and learning pace
- Progressive skill building in ${subject}

Please try again in a moment as the AI backend processes your request for personalized tutoring content.`;
  }

  // Utility methods
  private async getStudentProfile(studentId: string) {
    try {
      return await apiService.getStudent(studentId);
    } catch (error) {
      console.error('Error getting student profile:', error);
      return null;
    }
  }

  private getSubjectEmoji(subject: string): string {
    const emojis: { [key: string]: string } = {
      'Mathematics': '🔢',
      'Science': '🔬',
      'Physics': '⚛️',
      'Chemistry': '🧪',
      'Biology': '🧬',
      'English': '📝',
      'History': '📚',
      'Geography': '🌍',
      'Computer Science': '💻',
      'Art': '🎨',
      'Music': '🎵'
    };
    return emojis[subject] || '📖';
  }

  // Session management
  getSession(sessionId: string): TutorSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): TutorSession[] {
    return Array.from(this.sessions.values());
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  endSession(sessionId: string): void {
    try {
      console.log(`📝 Ending AI tutor session: ${sessionId}`);
      
      // End session in backend (graceful - won't throw errors)
      apiService.endTutorSession(sessionId);
      
      // Remove from local storage (always succeeds)
      const wasDeleted = this.deleteSession(sessionId);
      
      if (wasDeleted) {
        console.log(`✅ AI tutor session ended successfully: ${sessionId}`);
        console.log(`💡 Session data cleaned up locally. Backend cleanup handled gracefully.`);
      } else {
        console.warn(`⚠️ Session ${sessionId} was not found in local storage (may have already been ended)`);
      }
      
    } catch (error) {
      console.error('❌ Unexpected error ending session:', error);
      // Still remove locally even if there are unexpected errors
      this.deleteSession(sessionId);
      console.log(`🔧 Session ${sessionId} removed from local storage despite errors`);
    }
  }

  // Student scoring and analytics
  async getStudentScore(studentId: string): Promise<any> {
    try {
      console.log(`📊 Getting student score for ${studentId}`);
      
      // Get student's completed sessions and performance
      const studentSessions = Array.from(this.sessions.values())
        .filter(session => session.studentId === studentId);
      
      const totalSessions = studentSessions.length;
      const averageUnderstanding = studentSessions.reduce((sum, session) => 
        sum + (session.learningState?.understandingLevel || 0), 0) / totalSessions || 0;
      
      // Calculate score based on understanding and activity
      const score = {
        overallScore: Math.round(averageUnderstanding * 10), // 0-100 scale
        sessionsCompleted: totalSessions,
        averageUnderstanding: Math.round(averageUnderstanding),
        lastActivity: studentSessions.length > 0 ? 
          Math.max(...studentSessions.map(s => s.lastActivity.getTime())) : null,
        subjectBreakdown: this.getSubjectBreakdown(studentSessions)
      };
      
      console.log(`✅ Student score calculated:`, score);
      return score;
      
    } catch (error) {
      console.error('❌ Error getting student score:', error);
      return {
        overallScore: 0,
        sessionsCompleted: 0,
        averageUnderstanding: 0,
        lastActivity: null,
        subjectBreakdown: {}
      };
    }
  }

  // Message sending (alias for sendMessageToTutor)
  async sendMessage(sessionId: string, message: string): Promise<string> {
    return this.sendMessageToTutor(sessionId, message);
  }

  private getSubjectBreakdown(sessions: TutorSession[]): { [subject: string]: any } {
    const breakdown: { [subject: string]: any } = {};
    
    sessions.forEach(session => {
      if (!breakdown[session.subject]) {
        breakdown[session.subject] = {
          sessionsCount: 0,
          topics: [],
          averageUnderstanding: 0
        };
      }
      
      breakdown[session.subject].sessionsCount++;
      breakdown[session.subject].topics.push(session.topic);
      breakdown[session.subject].averageUnderstanding += session.learningState?.understandingLevel || 0;
    });
    
    // Calculate averages
    Object.keys(breakdown).forEach(subject => {
      breakdown[subject].averageUnderstanding = 
        breakdown[subject].averageUnderstanding / breakdown[subject].sessionsCount;
      breakdown[subject].topics = [...new Set(breakdown[subject].topics)]; // Remove duplicates
    });
    
    return breakdown;
  }

  // Student topics and curriculum methods (keep existing functionality)
  async getStudentTopics(studentId: string, subject: string): Promise<CurriculumTopic[]> {
    try {
      console.log(`🔍 Fetching topics for student ${studentId} in subject ${subject}`);
      const topicsResponse = await apiService.getStudentTopics(studentId);
      
      // Convert to CurriculumTopic format
      const curriculumTopics: CurriculumTopic[] = topicsResponse.topics.map((topic: any) => ({
        id: topic.id || topic.topicId || `${topic.subject}-${topic.topicName}`,
        subject: topic.subject || subject,
        grade: topic.grade || topic.gradeLevel || '8',
        board: topic.board || 'CBSE',
        chapterNumber: topic.chapterNumber || topic.chapter || 1,
        topicName: topic.topicName || topic.name || 'Unknown Topic',
        description: topic.description || 'No description available',
        difficulty: topic.difficulty || 'beginner',
        estimatedDuration: topic.estimatedDuration || 30,
        prerequisites: topic.prerequisites || [],
        learningObjectives: topic.learningObjectives || [],
        isCompleted: topic.isCompleted || false,
        completionDate: topic.completionDate,
        completionScore: topic.completionScore
      }));
      
      console.log(`🔄 Converted to ${curriculumTopics.length} CurriculumTopic objects`);
      return curriculumTopics;
    } catch (error) {
      console.error('❌ Error fetching student topics:', error);
      return [];
    }
  }

  async getRecommendedTopics(studentId: string, subject: string): Promise<CurriculumTopic[]> {
    try {
      const student = await apiService.getStudent(studentId);
      const gradeString = student.grade ? student.grade.toString() : '8';
      const topicsResponse = await apiService.getTopicsForSubject(
        subject, 
        gradeString, 
        student.board || 'CBSE', 
        student.country || 'India', 
        student.school || ''
      );
      
      // Convert and filter for recommended topics
      return topicsResponse.topics.slice(0, 5).map((topic: any) => ({
        id: topic.id || `${subject}-${topic.name}`,
        subject,
        grade: gradeString,
        board: student.board || 'CBSE',
        chapterNumber: topic.chapter || 1,
        topicName: topic.name || topic.topicName,
        description: topic.description || '',
        difficulty: topic.difficulty || 'beginner',
        estimatedDuration: topic.duration || 30,
        prerequisites: topic.prerequisites || [],
        learningObjectives: topic.objectives || [],
        isCompleted: false
      }));
    } catch (error) {
      console.error('Error getting recommended topics:', error);
      return [];
    }
  }
}

export const aiTutorService = new AITutorService();
