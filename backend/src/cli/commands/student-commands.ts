import { DynamoDBClient, PutItemCommand, GetItemCommand, ScanCommand, UpdateItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { v4 as uuidv4 } from 'uuid';

export interface Student {
  studentId: string;
  name: string;
  grade: number;
  country: string;
  board: string;
  subjects?: string[];
  preferences?: {
    learningStyle?: string;
    difficulty?: string;
    pace?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudentParams {
  name: string;
  grade: number;
  country: string;
  board: string;
  subjects?: string[];
  preferences?: {
    learningStyle?: string;
    difficulty?: string;
    pace?: string;
  };
}

export class StudentCommands {
  private dynamodb: DynamoDBClient;
  private tableName: string;
  private maxStudents: number;

  constructor() {
    this.dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.tableName = process.env.STUDENTS_TABLE_NAME || 'school-tutor-students';
    this.maxStudents = parseInt(process.env.MAX_STUDENTS || '5');
  }

  async createStudent(params: CreateStudentParams): Promise<Student> {
    // Check current student count
    const currentCount = await this.getStudentCount();
    if (currentCount >= this.maxStudents) {
      throw new Error(`Maximum number of students (${this.maxStudents}) reached. Please delete a student before adding a new one.`);
    }

    const studentId = `student-${uuidv4()}`;
    const now = new Date().toISOString();

    const student: Student = {
      studentId,
      name: params.name,
      grade: params.grade,
      country: params.country,
      board: params.board,
      subjects: params.subjects || ['Mathematics', 'Science'],
      preferences: params.preferences || {
        learningStyle: 'balanced',
        difficulty: 'medium',
        pace: 'moderate'
      },
      createdAt: now,
      updatedAt: now
    };

    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(student),
      ConditionExpression: 'attribute_not_exists(studentId)'
    });

    try {
      await this.dynamodb.send(command);
      console.log(`✅ Student created successfully: ${student.name} (ID: ${studentId})`);
      return student;
    } catch (error) {
      console.error('❌ Failed to create student:', error);
      throw error;
    }
  }

  async getStudent(studentId: string): Promise<Student | null> {
    const command = new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({ studentId })
    });

    try {
      const result = await this.dynamodb.send(command);
      if (!result.Item) {
        return null;
      }

      const student = unmarshall(result.Item) as Student;
      return student;
    } catch (error) {
      console.error('❌ Failed to get student:', error);
      throw error;
    }
  }

  async listStudents(): Promise<{ students: Student[]; total: number; remaining: number }> {
    const command = new ScanCommand({
      TableName: this.tableName,
      ProjectionExpression: 'studentId, #name, grade, country, board, createdAt',
      ExpressionAttributeNames: {
        '#name': 'name'
      }
    });

    try {
      const result = await this.dynamodb.send(command);
      const students = result.Items?.map(item => unmarshall(item) as Student) || [];
      
      return {
        students,
        total: students.length,
        remaining: this.maxStudents - students.length
      };
    } catch (error) {
      console.error('❌ Failed to list students:', error);
      throw error;
    }
  }

  async updateStudent(studentId: string, updates: Partial<CreateStudentParams>): Promise<Student> {
    // First check if student exists
    const existingStudent = await this.getStudent(studentId);
    if (!existingStudent) {
      throw new Error(`Student with ID ${studentId} not found`);
    }

    const now = new Date().toISOString();
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // Build update expression dynamically
    Object.entries(updates).forEach(([key, value], index) => {
      if (value !== undefined) {
        const attrName = `#attr${index}`;
        const attrValue = `:val${index}`;
        
        updateExpressions.push(`${attrName} = ${attrValue}`);
        expressionAttributeNames[attrName] = key;
        expressionAttributeValues[attrValue] = value;
      }
    });

    // Always update the updatedAt field
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = now;

    const command = new UpdateItemCommand({
      TableName: this.tableName,
      Key: marshall({ studentId }),
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: marshall(expressionAttributeValues),
      ReturnValues: 'ALL_NEW'
    });

    try {
      const result = await this.dynamodb.send(command);
      if (!result.Attributes) {
        throw new Error('Failed to update student');
      }

      const updatedStudent = unmarshall(result.Attributes) as Student;
      console.log(`✅ Student updated successfully: ${updatedStudent.name}`);
      return updatedStudent;
    } catch (error) {
      console.error('❌ Failed to update student:', error);
      throw error;
    }
  }

  async deleteStudent(studentId: string): Promise<void> {
    // First check if student exists
    const existingStudent = await this.getStudent(studentId);
    if (!existingStudent) {
      throw new Error(`Student with ID ${studentId} not found`);
    }

    const command = new DeleteItemCommand({
      TableName: this.tableName,
      Key: marshall({ studentId })
    });

    try {
      await this.dynamodb.send(command);
      console.log(`✅ Student deleted successfully: ${existingStudent.name} (ID: ${studentId})`);
      
      // TODO: Also delete associated progress data and learning sessions
      console.log('⚠️  Note: Associated progress data should be cleaned up separately');
    } catch (error) {
      console.error('❌ Failed to delete student:', error);
      throw error;
    }
  }

  private async getStudentCount(): Promise<number> {
    const command = new ScanCommand({
      TableName: this.tableName,
      Select: 'COUNT'
    });

    try {
      const result = await this.dynamodb.send(command);
      return result.Count || 0;
    } catch (error) {
      console.error('❌ Failed to get student count:', error);
      throw error;
    }
  }

  async displayStudentInfo(student: Student): Promise<void> {
    console.log('\n📚 Student Information:');
    console.log('─'.repeat(50));
    console.log(`👤 Name: ${student.name}`);
    console.log(`🎓 Grade: ${student.grade}`);
    console.log(`🌍 Country: ${student.country}`);
    console.log(`📖 Educational Board: ${student.board}`);
    console.log(`📚 Subjects: ${student.subjects?.join(', ') || 'Not specified'}`);
    
    if (student.preferences) {
      console.log('\n⚙️  Learning Preferences:');
      console.log(`   Learning Style: ${student.preferences.learningStyle}`);
      console.log(`   Difficulty Level: ${student.preferences.difficulty}`);
      console.log(`   Learning Pace: ${student.preferences.pace}`);
    }
    
    console.log(`\n📅 Created: ${new Date(student.createdAt).toLocaleString()}`);
    console.log(`📅 Updated: ${new Date(student.updatedAt).toLocaleString()}`);
    console.log(`🆔 Student ID: ${student.studentId}`);
    console.log('─'.repeat(50));
  }

  async displayStudentsList(data: { students: Student[]; total: number; remaining: number }): Promise<void> {
    console.log('\n📚 Students List:');
    console.log('─'.repeat(80));
    console.log(`Total Students: ${data.total}/${this.maxStudents} (${data.remaining} slots remaining)`);
    console.log('─'.repeat(80));

    if (data.students.length === 0) {
      console.log('No students found. Use "student create" to add your first student.');
      return;
    }

    data.students.forEach((student, index) => {
      console.log(`${index + 1}. ${student.name}`);
      console.log(`   📚 Grade ${student.grade} | 🌍 ${student.country} | 📖 ${student.board}`);
      console.log(`   🆔 ${student.studentId}`);
      console.log(`   📅 Created: ${new Date(student.createdAt).toLocaleDateString()}`);
      console.log('');
    });
  }

  // Static CLI methods
  static async createStudent(options: any): Promise<void> {
    const commands = new StudentCommands();
    try {
      await commands.createStudent({
        name: options.name,
        grade: parseInt(options.grade),
        country: options.country,
        board: options.board,
        subjects: options.subjects ? options.subjects.split(',').map((s: string) => s.trim()) : undefined,
        preferences: {
          learningStyle: options.learningStyle,
          difficulty: options.difficulty,
          pace: options.pace
        }
      });
    } catch (error) {
      console.error('Error creating student:', error);
      process.exit(1);
    }
  }

  static async listStudents(options: any): Promise<void> {
    const commands = new StudentCommands();
    try {
      const data = await commands.listStudents();
      if (options.format === 'json') {
        console.log(JSON.stringify(data, null, 2));
      } else {
        await commands.displayStudentsList(data);
      }
    } catch (error) {
      console.error('Error listing students:', error);
      process.exit(1);
    }
  }

  static async getStudent(studentId: string, options: any): Promise<void> {
    const commands = new StudentCommands();
    try {
      const student = await commands.getStudent(studentId);
      if (!student) {
        console.error(`Student ${studentId} not found`);
        process.exit(1);
      }
      
      if (options.format === 'json') {
        console.log(JSON.stringify(student, null, 2));
      } else {
        await commands.displayStudentInfo(student);
      }
    } catch (error) {
      console.error('Error getting student:', error);
      process.exit(1);
    }
  }

  static async updateStudent(studentId: string, options: any): Promise<void> {
    const commands = new StudentCommands();
    try {
      await commands.updateStudent(studentId, {
        name: options.name,
        grade: options.grade ? parseInt(options.grade) : undefined,
        country: options.country,
        board: options.board,
        subjects: options.subjects ? options.subjects.split(',').map((s: string) => s.trim()) : undefined,
        preferences: {
          learningStyle: options.learningStyle,
          difficulty: options.difficulty,
          pace: options.pace
        }
      });
    } catch (error) {
      console.error('Error updating student:', error);
      process.exit(1);
    }
  }

  static async deleteStudent(studentId: string, options: any): Promise<void> {
    const commands = new StudentCommands();
    try {
      await commands.deleteStudent(studentId);
    } catch (error) {
      console.error('Error deleting student:', error);
      process.exit(1);
    }
  }
}
