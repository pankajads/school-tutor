#!/usr/bin/env node

import { Command } from 'commander';
import { StudentCommands } from './commands/student-commands';
import { LearningCommands } from './commands/learning-commands';
import { ProgressCommands } from './commands/progress-commands';
import { EvaluationCommands } from './commands/evaluation-commands';
import { SystemCommands } from './commands/system-commands';

const program = new Command();

// Initialize command classes
const studentCommands = new StudentCommands();
const learningCommands = new LearningCommands();
const progressCommands = new ProgressCommands();
const evaluationCommands = new EvaluationCommands();
const systemCommands = new SystemCommands();

// Configure main program
program
  .name('school-tutor')
  .description('AI-powered school tutor system CLI')
  .version('1.0.0');

// Helper function to handle async errors
const asyncHandler = (fn: Function) => async (...args: any[]) => {
  try {
    await fn(...args);
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
};

// Student management commands
const studentCmd = program.command('student').description('Manage student profiles');

studentCmd
  .command('create')
  .description('Create a new student profile')
  .requiredOption('-n, --name <name>', 'Student name')
  .requiredOption('-g, --grade <grade>', 'Student grade (1-12)', parseInt)
  .requiredOption('-c, --country <country>', 'Student country')
  .requiredOption('-b, --board <board>', 'Educational board/curriculum')
  .option('-s, --subjects <subjects>', 'Comma-separated list of subjects', 'Mathematics,Science')
  .option('--learning-style <style>', 'Learning style preference', 'balanced')
  .option('--difficulty <level>', 'Difficulty preference', 'medium')
  .option('--pace <pace>', 'Learning pace preference', 'moderate')
  .action(asyncHandler(async (options: any) => {
    const subjects = options.subjects.split(',').map((s: string) => s.trim());
    const student = await studentCommands.createStudent({
      name: options.name,
      grade: options.grade,
      country: options.country,
      board: options.board,
      subjects,
      preferences: {
        learningStyle: options.learningStyle,
        difficulty: options.difficulty,
        pace: options.pace
      }
    });
    await studentCommands.displayStudentInfo(student);
  }));

studentCmd
  .command('list')
  .description('List all students')
  .action(asyncHandler(async () => {
    const data = await studentCommands.listStudents();
    await studentCommands.displayStudentsList(data);
  }));

studentCmd
  .command('get <studentId>')
  .description('Get student details by ID')
  .action(asyncHandler(async (studentId: string) => {
    const student = await studentCommands.getStudent(studentId);
    if (!student) {
      console.log(`❌ Student ${studentId} not found`);
      return;
    }
    await studentCommands.displayStudentInfo(student);
  }));

studentCmd
  .command('update <studentId>')
  .description('Update student information')
  .option('-n, --name <name>', 'Student name')
  .option('-g, --grade <grade>', 'Student grade (1-12)', parseInt)
  .option('-s, --subjects <subjects>', 'Comma-separated list of subjects')
  .option('--learning-style <style>', 'Learning style preference')
  .option('--difficulty <level>', 'Difficulty preference')
  .option('--pace <pace>', 'Learning pace preference')
  .action(asyncHandler(async (studentId: string, options: any) => {
    const updates: any = {};
    if (options.name) updates.name = options.name;
    if (options.grade) updates.grade = options.grade;
    if (options.subjects) updates.subjects = options.subjects.split(',').map((s: string) => s.trim());
    
    if (options.learningStyle || options.difficulty || options.pace) {
      updates.preferences = {};
      if (options.learningStyle) updates.preferences.learningStyle = options.learningStyle;
      if (options.difficulty) updates.preferences.difficulty = options.difficulty;
      if (options.pace) updates.preferences.pace = options.pace;
    }

    const updatedStudent = await studentCommands.updateStudent(studentId, updates);
    await studentCommands.displayStudentInfo(updatedStudent);
  }));

studentCmd
  .command('delete <studentId>')
  .description('Delete a student profile')
  .option('-f, --force', 'Force deletion without confirmation')
  .action(asyncHandler(async (studentId: string, options: any) => {
    if (!options.force) {
      console.log('⚠️  Use --force flag to confirm deletion');
      console.log('⚠️  This will permanently delete the student and all associated data');
      return;
    }
    
    await studentCommands.deleteStudent(studentId);
  }));

// Learning session commands
const learningCmd = program.command('learning').description('Manage learning sessions');

learningCmd
  .command('start')
  .description('Start a new learning session')
  .requiredOption('-s, --student <studentId>', 'Student ID')
  .requiredOption('--subjects <subjects>', 'Two subjects for daily learning (comma-separated)')
  .option('-d, --duration <minutes>', 'Session duration in minutes', parseInt, 60)
  .action(asyncHandler(async (options: any) => {
    const subjects = options.subjects.split(',').map((s: string) => s.trim());
    const session = await learningCommands.startSession(options.student, subjects, options.duration);
    await learningCommands.displaySessionInfo(session);
  }));

learningCmd
  .command('generate')
  .description('Generate educational content')
  .requiredOption('-s, --student <studentId>', 'Student ID')
  .requiredOption('--subject <subject>', 'Subject name')
  .requiredOption('--topic <topic>', 'Topic name')
  .option('-t, --type <type>', 'Content type', 'lesson')
  .option('--difficulty <level>', 'Difficulty level')
  .action(asyncHandler(async (options: any) => {
    const content = await learningCommands.generateContent({
      studentId: options.student,
      subject: options.subject,
      topic: options.topic,
      contentType: options.type,
      difficulty: options.difficulty
    });
    await learningCommands.displayContent(content);
  }));

learningCmd
  .command('chat')
  .description('Interactive chat with AI tutor')
  .requiredOption('-s, --student <studentId>', 'Student ID')
  .requiredOption('--subject <subject>', 'Current subject')
  .option('--session <sessionId>', 'Session ID')
  .option('--topic <topic>', 'Current topic')
  .option('-m, --message <message>', 'Message to send to tutor')
  .action(asyncHandler(async (options: any) => {
    console.log('💬 Starting interactive chat with AI tutor...');
    
    const message = options.message || 'Hello, I need help with my studies.';
    console.log(`👤 Student: ${message}`);
    
    const response = await learningCommands.chatWithTutor({
      studentId: options.student,
      sessionId: options.session,
      message: message,
      context: {
        subject: options.subject,
        topic: options.topic
      }
    });
    
    console.log(`🤖 AI Tutor: ${response.response}`);
    if (response.suggestions.length > 0) {
      console.log(`💡 Suggestions: ${response.suggestions.join(', ')}`);
    }
    
    if (!options.message) {
      console.log('\n💬 To continue the conversation, use:');
      console.log(`   school-tutor learning chat -s ${options.student} --subject "${options.subject}" -m "Your message here"`);
    }
  }));

learningCmd
  .command('end <sessionId>')
  .description('End a learning session')
  .action(asyncHandler(async (sessionId: string) => {
    await learningCommands.endSession(sessionId);
  }));

// Progress tracking commands
const progressCmd = program.command('progress').description('Track learning progress');

progressCmd
  .command('view <studentId>')
  .description('View student progress')
  .option('-p, --period <period>', 'Time period (7d, 30d, 90d)', '30d')
  .option('-s, --subjects <subjects>', 'Filter by subjects (comma-separated)')
  .action(asyncHandler(async (studentId: string, options: any) => {
    const subjects = options.subjects ? options.subjects.split(',').map((s: string) => s.trim()) : undefined;
    const progress = await progressCommands.viewProgress(studentId, options.period, subjects);
    await progressCommands.displayProgress(progress);
  }));

progressCmd
  .command('analytics <studentId>')
  .description('Get detailed analytics')
  .option('-p, --period <period>', 'Time period (7d, 30d, 90d)', '30d')
  .action(asyncHandler(async (studentId: string, options: any) => {
    const analytics = await progressCommands.getAnalytics(studentId, options.period);
    await progressCommands.displayAnalytics(analytics);
  }));

progressCmd
  .command('scorecard <studentId>')
  .description('Generate student scorecard')
  .option('-p, --period <period>', 'Time period (7d, 30d, 90d)', '30d')
  .action(asyncHandler(async (studentId: string, options: any) => {
    const scorecard = await progressCommands.generateScorecard(studentId, options.period);
    await progressCommands.displayScorecard(scorecard);
  }));

// Evaluation commands
const evalCmd = program.command('eval').description('Run evaluations using modern LLM frameworks');

evalCmd
  .command('run')
  .description('Run comprehensive evaluation')
  .option('-t, --type <type>', 'Evaluation type', 'comprehensive')
  .option('-s, --students <students>', 'Student IDs (comma-separated)')
  .option('-f, --frameworks <frameworks>', 'Frameworks to use (comma-separated)', 'ragas,deepeval,trulens')
  .option('-m, --metrics <metrics>', 'Metrics to evaluate (comma-separated)', 'relevance,groundedness,context_recall')
  .action(asyncHandler(async (options: any) => {
    const request = {
      type: options.type as any,
      students: options.students ? options.students.split(',').map((s: string) => s.trim()) : undefined,
      frameworks: options.frameworks.split(',').map((f: string) => f.trim()) as any[],
      metrics: options.metrics.split(',').map((m: string) => m.trim())
    };
    
    const result = await evaluationCommands.runEvaluation(request);
    await evaluationCommands.displayEvaluationResult(result);
  }));

evalCmd
  .command('results <evaluationId>')
  .description('Get evaluation results')
  .action(asyncHandler(async (evaluationId: string) => {
    const result = await evaluationCommands.getEvaluationResults(evaluationId);
    if (!result) {
      console.log(`❌ Evaluation ${evaluationId} not found`);
      return;
    }
    await evaluationCommands.displayEvaluationResult(result);
  }));

evalCmd
  .command('metrics')
  .description('View evaluation metrics')
  .action(asyncHandler(async () => {
    const metrics = await evaluationCommands.getEvaluationMetrics();
    await evaluationCommands.displayEvaluationMetrics(metrics);
  }));

evalCmd
  .command('dashboard')
  .description('Launch evaluation dashboard')
  .action(asyncHandler(async () => {
    const dashboardInfo = await evaluationCommands.launchDashboard();
    await evaluationCommands.displayDashboardInfo(dashboardInfo);
  }));

// System management commands
const systemCmd = program.command('system').description('System management and monitoring');

systemCmd
  .command('status')
  .description('Check system health')
  .option('-d, --detailed', 'Show detailed status information')
  .action(asyncHandler(async (options: any) => {
    const status = await systemCommands.getSystemStatus(options.detailed);
    if (!options.detailed) {
      await systemCommands.displaySystemStatus(status);
    }
  }));

systemCmd
  .command('config')
  .description('View system configuration')
  .action(asyncHandler(async () => {
    const config = await systemCommands.getConfiguration();
    await systemCommands.displayConfiguration(config);
  }));

systemCmd
  .command('logs')
  .description('View system logs')
  .option('-s, --service <service>', 'Specific service to view logs for')
  .option('-n, --lines <number>', 'Number of lines to show', parseInt, 50)
  .action(asyncHandler(async (options: any) => {
    await systemCommands.viewLogs(options.service, options.lines);
  }));

systemCmd
  .command('backup')
  .description('Backup system data')
  .action(asyncHandler(async () => {
    await systemCommands.backupData();
  }));

systemCmd
  .command('deploy')
  .description('Deploy system updates')
  .option('-e, --environment <env>', 'Target environment')
  .action(asyncHandler(async (options: any) => {
    await systemCommands.deploy(options.environment);
  }));

// Add help examples
program.addHelpText('after', `

Examples:
  $ school-tutor student create -n "Alice Smith" -g 8 -c "United States" -b "Common Core"
  $ school-tutor student list
  $ school-tutor learning start -s student-123 --subjects "Mathematics,Science"
  $ school-tutor learning generate -s student-123 --subject Mathematics --topic "Linear Equations"
  $ school-tutor learning chat -s student-123 --subject Mathematics -m "Help me solve 2x + 5 = 13"
  $ school-tutor progress view student-123 --period 30d
  $ school-tutor eval run --type comprehensive --frameworks ragas,deepeval
  $ school-tutor system status --detailed

For more help on specific commands:
  $ school-tutor <command> --help
`);

// Parse command line arguments
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

export { program };
