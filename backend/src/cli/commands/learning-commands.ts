import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient, PutItemCommand, GetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { v4 as uuidv4 } from 'uuid';

export interface LearningSession {
  sessionId: string;
  studentId: string;
  subjects: string[];
  status: 'active' | 'completed' | 'paused';
  startTime: string;
  endTime?: string;
  plannedDuration: number;
  currentSubject: string;
  progress: {
    completedTopics: string[];
    currentTopic?: string;
    timeSpent: number;
  };
}

export interface ContentRequest {
  studentId: string;
  subject: string;
  topic: string;
  contentType: 'lesson' | 'exercise' | 'quiz' | 'explanation';
  difficulty?: string;
  context?: string;
}

export interface GeneratedContent {
  contentId: string;
  subject: string;
  topic: string;
  contentType: string;
  content: {
    title: string;
    explanation: string;
    examples?: any[];
    exercises?: any[];
    resources?: string[];
  };
  metadata: {
    difficulty: string;
    estimatedTime: number;
    learningObjectives: string[];
  };
  generatedAt: string;
}

export interface ChatMessage {
  studentId: string;
  sessionId?: string;
  message: string;
  context: {
    subject: string;
    topic?: string;
    currentProblem?: string;
    previousMessages?: string[];
  };
}

export interface ChatResponse {
  response: string;
  suggestions: string[];
  hints: string[];
  followUp?: {
    type: string;
    content: string;
  };
  engagement: {
    score: number;
    factors: string[];
  };
}

export class LearningCommands {
  private dynamodb: DynamoDBClient;
  private bedrock: BedrockRuntimeClient;
  private s3: S3Client;
  private sessionsTable: string;
  private progressTable: string;
  private contentBucket: string;

  constructor() {
    const region = process.env.AWS_REGION || 'us-east-1';
    this.dynamodb = new DynamoDBClient({ region });
    this.bedrock = new BedrockRuntimeClient({ region });
    this.s3 = new S3Client({ region });
    
    this.sessionsTable = process.env.SESSIONS_TABLE_NAME || 'school-tutor-sessions';
    this.progressTable = process.env.PROGRESS_TABLE_NAME || 'school-tutor-progress';
    this.contentBucket = process.env.CONTENT_BUCKET_NAME || 'school-tutor-content';
  }

  async startSession(studentId: string, subjects: string[], duration: number = 60): Promise<LearningSession> {
    const sessionId = `session-${uuidv4()}`;
    const now = new Date().toISOString();
    const plannedEndTime = new Date(Date.now() + duration * 60 * 1000).toISOString();

    // Ensure exactly 2 subjects for daily requirement
    if (subjects.length !== 2) {
      throw new Error('Daily learning must cover exactly 2 subjects as per curriculum requirements');
    }

    const session: LearningSession = {
      sessionId,
      studentId,
      subjects,
      status: 'active',
      startTime: now,
      plannedDuration: duration,
      currentSubject: subjects[0], // Start with first subject
      progress: {
        completedTopics: [],
        timeSpent: 0
      }
    };

    const command = new PutItemCommand({
      TableName: this.sessionsTable,
      Item: marshall(session)
    });

    try {
      await this.dynamodb.send(command);
      console.log(`🚀 Learning session started successfully!`);
      console.log(`📚 Session ID: ${sessionId}`);
      console.log(`👤 Student: ${studentId}`);
      console.log(`📖 Subjects: ${subjects.join(', ')}`);
      console.log(`⏱️  Duration: ${duration} minutes`);
      console.log(`🎯 Current Subject: ${session.currentSubject}`);
      
      return session;
    } catch (error) {
      console.error('❌ Failed to start learning session:', error);
      throw error;
    }
  }

  async generateContent(request: ContentRequest): Promise<GeneratedContent> {
    // First, get student profile to personalize content
    const studentProfile = await this.getStudentProfile(request.studentId);
    
    const prompt = this.buildContentPrompt(request, studentProfile);
    
    try {
      const bedrockResponse = await this.callBedrock(prompt);
      const content = this.parseContentResponse(bedrockResponse);
      
      const generatedContent: GeneratedContent = {
        contentId: `content-${uuidv4()}`,
        subject: request.subject,
        topic: request.topic,
        contentType: request.contentType,
        content,
        metadata: {
          difficulty: request.difficulty || studentProfile?.preferences?.difficulty || 'medium',
          estimatedTime: this.estimateTime(request.contentType, content),
          learningObjectives: this.extractLearningObjectives(content)
        },
        generatedAt: new Date().toISOString()
      };

      // Store content in S3 for future reference
      await this.storeContent(generatedContent);
      
      console.log(`✅ Content generated successfully for ${request.subject} - ${request.topic}`);
      return generatedContent;
    } catch (error) {
      console.error('❌ Failed to generate content:', error);
      throw error;
    }
  }

  async chatWithTutor(chatMessage: ChatMessage): Promise<ChatResponse> {
    // Get student profile for personalization
    const studentProfile = await this.getStudentProfile(chatMessage.studentId);
    
    // Get recent conversation history if session provided
    const conversationHistory = chatMessage.sessionId 
      ? await this.getConversationHistory(chatMessage.sessionId) 
      : [];

    const prompt = this.buildChatPrompt(chatMessage, studentProfile, conversationHistory);
    
    try {
      const bedrockResponse = await this.callBedrock(prompt);
      const chatResponse = this.parseChatResponse(bedrockResponse);
      
      // Store interaction for progress tracking
      await this.recordInteraction(chatMessage, chatResponse);
      
      console.log(`💬 Tutor: ${chatResponse.response}`);
      if (chatResponse.suggestions.length > 0) {
        console.log(`💡 Suggestions: ${chatResponse.suggestions.join(', ')}`);
      }
      
      return chatResponse;
    } catch (error) {
      console.error('❌ Failed to process chat message:', error);
      throw error;
    }
  }

  async endSession(sessionId: string): Promise<void> {
    // Get session details
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== 'active') {
      throw new Error(`Session ${sessionId} is not active`);
    }

    // Update session status
    const endTime = new Date().toISOString();
    const actualDuration = Math.round((new Date(endTime).getTime() - new Date(session.startTime).getTime()) / 60000);

    // TODO: Update session with end time and final progress
    console.log(`🏁 Learning session ended successfully!`);
    console.log(`📚 Session ID: ${sessionId}`);
    console.log(`⏱️  Actual Duration: ${actualDuration} minutes`);
    console.log(`✅ Subjects Covered: ${session.subjects.join(', ')}`);
  }

  private async getStudentProfile(studentId: string): Promise<any> {
    // This would typically fetch from the students table
    // For now, return a basic profile
    return {
      studentId,
      grade: 8,
      country: 'United States',
      board: 'Common Core',
      preferences: {
        learningStyle: 'visual',
        difficulty: 'medium',
        pace: 'moderate'
      }
    };
  }

  private async getSession(sessionId: string): Promise<LearningSession | null> {
    const command = new GetItemCommand({
      TableName: this.sessionsTable,
      Key: marshall({ sessionId })
    });

    try {
      const result = await this.dynamodb.send(command);
      return result.Item ? unmarshall(result.Item) as LearningSession : null;
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }

  private buildContentPrompt(request: ContentRequest, studentProfile: any): string {
    return `You are an expert AI tutor. Generate educational content for a ${studentProfile.grade}th grade student studying in ${studentProfile.country} following the ${studentProfile.board} curriculum.

Student Profile:
- Grade: ${studentProfile.grade}
- Country: ${studentProfile.country}
- Educational Board: ${studentProfile.board}
- Learning Style: ${studentProfile.preferences?.learningStyle}
- Preferred Difficulty: ${studentProfile.preferences?.difficulty}

Content Request:
- Subject: ${request.subject}
- Topic: ${request.topic}
- Content Type: ${request.contentType}
- Difficulty: ${request.difficulty || 'medium'}

Requirements:
1. Make content age-appropriate and engaging
2. Follow the educational standards for the specified board
3. Include interactive elements where possible
4. Provide clear explanations with examples
5. Ensure content is culturally sensitive and inclusive

Please generate a comprehensive ${request.contentType} that includes:
- Clear title and introduction
- Step-by-step explanation
- Relevant examples
- Practice exercises (if applicable)
- Summary of key points

Format the response as JSON with the following structure:
{
  "title": "string",
  "explanation": "string",
  "examples": ["array of examples"],
  "exercises": ["array of practice problems"],
  "resources": ["array of additional resources"]
}`;
  }

  private buildChatPrompt(message: ChatMessage, studentProfile: any, history: any[]): string {
    const historyText = history.length > 0 
      ? `\nConversation History:\n${history.map(h => `${h.role}: ${h.message}`).join('\n')}`
      : '';

    return `You are a friendly, patient, and knowledgeable AI tutor helping a ${studentProfile.grade}th grade student. 

Student Profile:
- Grade: ${studentProfile.grade}
- Country: ${studentProfile.country}
- Educational Board: ${studentProfile.board}
- Learning Style: ${studentProfile.preferences?.learningStyle}

Current Context:
- Subject: ${message.context.subject}
- Topic: ${message.context.topic || 'General'}
- Current Problem: ${message.context.currentProblem || 'None'}

${historyText}

Student Message: "${message.message}"

Instructions:
1. Respond in a friendly, encouraging manner
2. Provide clear, age-appropriate explanations
3. Break down complex concepts into simple steps
4. Ask questions to check understanding
5. Offer hints rather than direct answers when appropriate
6. Encourage the student and celebrate progress
7. Suggest next steps or related topics

Your response should be encouraging, educational, and help the student learn effectively. Keep responses concise but thorough.

Format your response as JSON:
{
  "response": "Your main response to the student",
  "suggestions": ["suggestion1", "suggestion2"],
  "hints": ["hint1", "hint2"],
  "followUp": {
    "type": "exercise|question|explanation",
    "content": "follow-up content"
  },
  "engagement": {
    "score": 1-10,
    "factors": ["factor1", "factor2"]
  }
}`;
  }

  private async callBedrock(prompt: string): Promise<string> {
    const modelId = 'anthropic.claude-3-sonnet-20240229-v1:0';
    
    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    };

    const command = new InvokeModelCommand({
      modelId,
      body: JSON.stringify(payload),
      contentType: 'application/json'
    });

    try {
      const response = await this.bedrock.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return responseBody.content[0].text;
    } catch (error) {
      console.error('Bedrock API call failed:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  private parseContentResponse(response: string): any {
    try {
      return JSON.parse(response);
    } catch (error) {
      // If JSON parsing fails, create a structured response from text
      return {
        title: "Generated Content",
        explanation: response,
        examples: [],
        exercises: [],
        resources: []
      };
    }
  }

  private parseChatResponse(response: string): ChatResponse {
    try {
      return JSON.parse(response);
    } catch (error) {
      // If JSON parsing fails, create a basic response
      return {
        response: response,
        suggestions: [],
        hints: [],
        engagement: {
          score: 7,
          factors: ['responded']
        }
      };
    }
  }

  private async storeContent(content: GeneratedContent): Promise<void> {
    const key = `content/${content.contentId}.json`;
    
    const command = new PutObjectCommand({
      Bucket: this.contentBucket,
      Key: key,
      Body: JSON.stringify(content, null, 2),
      ContentType: 'application/json'
    });

    try {
      await this.s3.send(command);
    } catch (error) {
      console.error('Failed to store content in S3:', error);
      // Don't throw error - content generation succeeded even if storage failed
    }
  }

  private async recordInteraction(message: ChatMessage, response: ChatResponse): Promise<void> {
    const interactionId = `interaction-${uuidv4()}`;
    const timestamp = new Date().toISOString();

    const interaction = {
      interactionId,
      studentId: message.studentId,
      sessionId: message.sessionId,
      timestamp,
      subject: message.context.subject,
      topic: message.context.topic,
      studentMessage: message.message,
      tutorResponse: response.response,
      engagementScore: response.engagement.score,
      engagementFactors: response.engagement.factors
    };

    const command = new PutItemCommand({
      TableName: this.progressTable,
      Item: marshall(interaction)
    });

    try {
      await this.dynamodb.send(command);
    } catch (error) {
      console.error('Failed to record interaction:', error);
      // Don't throw error - chat succeeded even if logging failed
    }
  }

  private async getConversationHistory(sessionId: string): Promise<any[]> {
    // This would query recent interactions for the session
    // For now, return empty array
    return [];
  }

  private estimateTime(contentType: string, content: any): number {
    // Estimate reading/completion time based on content type and length
    const baseTime = {
      'lesson': 15,
      'exercise': 10,
      'quiz': 5,
      'explanation': 8
    };

    return baseTime[contentType as keyof typeof baseTime] || 10;
  }

  private extractLearningObjectives(content: any): string[] {
    // Extract or generate learning objectives from content
    // This would be more sophisticated in a real implementation
    return [
      'Understand the core concepts',
      'Apply knowledge to solve problems',
      'Connect to real-world applications'
    ];
  }

  async displaySessionInfo(session: LearningSession): Promise<void> {
    console.log('\n🎯 Learning Session Information:');
    console.log('─'.repeat(50));
    console.log(`📚 Session ID: ${session.sessionId}`);
    console.log(`👤 Student: ${session.studentId}`);
    console.log(`📖 Subjects: ${session.subjects.join(', ')}`);
    console.log(`📊 Status: ${session.status}`);
    console.log(`🕐 Started: ${new Date(session.startTime).toLocaleString()}`);
    console.log(`⏱️  Planned Duration: ${session.plannedDuration} minutes`);
    console.log(`🎯 Current Subject: ${session.currentSubject}`);
    
    if (session.progress.completedTopics.length > 0) {
      console.log(`✅ Completed Topics: ${session.progress.completedTopics.join(', ')}`);
    }
    
    if (session.progress.currentTopic) {
      console.log(`📘 Current Topic: ${session.progress.currentTopic}`);
    }
    
    console.log(`⏰ Time Spent: ${session.progress.timeSpent} minutes`);
    console.log('─'.repeat(50));
  }

  async displayContent(content: GeneratedContent): Promise<void> {
    console.log('\n📚 Generated Content:');
    console.log('─'.repeat(60));
    console.log(`📖 Subject: ${content.subject}`);
    console.log(`📘 Topic: ${content.topic}`);
    console.log(`📋 Type: ${content.contentType}`);
    console.log(`⏱️  Estimated Time: ${content.metadata.estimatedTime} minutes`);
    console.log(`📊 Difficulty: ${content.metadata.difficulty}`);
    console.log('─'.repeat(60));
    
    console.log(`\n📝 ${content.content.title}`);
    console.log('\n' + content.content.explanation);
    
    if (content.content.examples && content.content.examples.length > 0) {
      console.log('\n💡 Examples:');
      content.content.examples.forEach((example, index) => {
        console.log(`${index + 1}. ${example}`);
      });
    }
    
    if (content.content.exercises && content.content.exercises.length > 0) {
      console.log('\n📝 Practice Exercises:');
      content.content.exercises.forEach((exercise, index) => {
        console.log(`${index + 1}. ${exercise}`);
      });
    }
    
    if (content.content.resources && content.content.resources.length > 0) {
      console.log('\n📚 Additional Resources:');
      content.content.resources.forEach((resource, index) => {
        console.log(`${index + 1}. ${resource}`);
      });
    }
    
    console.log('\n🎯 Learning Objectives:');
    content.metadata.learningObjectives.forEach((objective, index) => {
      console.log(`${index + 1}. ${objective}`);
    });
    
    console.log('─'.repeat(60));
  }

  // Static CLI methods
  static async startSession(options: any): Promise<void> {
    const commands = new LearningCommands();
    try {
      const duration = parseInt(options.duration) || 60;
      const subjects = options.subjects ? options.subjects.split(',').map((s: string) => s.trim()) : ['Mathematics'];
      
      const session = await commands.startSession(options.studentId, subjects, duration);
      
      if (options.format === 'json') {
        console.log(JSON.stringify(session, null, 2));
      } else {
        await commands.displaySessionInfo(session);
      }
    } catch (error) {
      console.error('Error starting session:', error);
      process.exit(1);
    }
  }

  static async generateContent(options: any): Promise<void> {
    const commands = new LearningCommands();
    try {
      const contentRequest: ContentRequest = {
        studentId: options.studentId,
        subject: options.subject,
        topic: options.topic,
        contentType: options.type || 'lesson',
        difficulty: options.difficulty,
        context: options.context
      };
      
      const content = await commands.generateContent(contentRequest);
      
      if (options.format === 'json') {
        console.log(JSON.stringify(content, null, 2));
      } else {
        await commands.displayContent(content);
      }
    } catch (error) {
      console.error('Error generating content:', error);
      process.exit(1);
    }
  }

  static async startChat(options: any): Promise<void> {
    console.log('Interactive chat functionality not yet implemented');
    console.log('This feature will provide real-time AI tutoring chat interface');
    console.log(`Would start chat for student: ${options.studentId}`);
    if (options.subject) {
      console.log(`Subject: ${options.subject}`);
    }
    console.log('Use "learning generate" for content generation instead');
  }
}
