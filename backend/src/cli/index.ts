#!/usr/bin/env node

/**
 * School Tutor CLI Application - Main Entry Point
 * 
 * This is the Command Line Interface (CLI) for the School Tutor Agent system.
 * A CLI is a text-based interface that allows users to interact with our system
 * by typing commands instead of clicking buttons in a graphical interface.
 * 
 * Think of this file as the "reception desk" of our CLI - it takes user commands
 * and routes them to the appropriate handlers.
 * 
 * Key Concepts for New Developers:
 * 
 * 1. Commander.js: A popular Node.js library for building CLIs
 *    - Handles command parsing (breaking down what user typed)
 *    - Provides help text and error messages
 *    - Manages subcommands and options
 * 
 * 2. Command Structure: We use a hierarchical command structure:
 *    school-tutor <resource> <action> [options]
 *    Examples:
 *    - school-tutor student create --name "John"
 *    - school-tutor learning start --student 123
 *    - school-tutor progress view 123
 * 
 * 3. Async/Await: Most operations are asynchronous (they take time)
 *    - Database calls, API requests, file operations
 *    - We use async/await to handle these operations cleanly
 * 
 * 4. Error Handling: Comprehensive error handling for user-friendly messages
 *    - Catch errors and show helpful messages instead of scary stack traces
 *    - Debug mode for developers to see detailed error information
 * 
 * Architecture:
 * - This file: Main router and configuration
 * - Command classes: Handle specific functionality (students, learning, etc.)
 * - Service classes: Business logic and AWS integration
 * 
 * @author School Tutor Development Team
 * @since 1.0.0
 */

// Import required libraries and modules
import { Command } from 'commander';         // CLI framework for Node.js
import { StudentCommands } from './commands/student-commands';      // Student management commands
import { LearningCommands } from './commands/learning-commands';    // Learning session commands  
import { ProgressCommands } from './commands/progress-commands';    // Progress tracking commands
import { EvaluationCommands } from './commands/evaluation-commands'; // Evaluation framework commands
import { SystemCommands } from './commands/system-commands';        // System management commands

/**
 * Main CLI Program Instance
 * 
 * Commander.js creates a "program" object that represents our entire CLI.
 * Think of this as the "main menu" of our application.
 */
const program = new Command();

// =====================================================
// COMMAND CLASS INITIALIZATION
// =====================================================

/**
 * Initialize Command Handler Classes
 * 
 * Each command class handles a specific area of functionality.
 * This separation follows the "Single Responsibility Principle" -
 * each class has one clear job to do.
 * 
 * Why separate classes?
 * - Organization: Related commands are grouped together
 * - Maintainability: Easy to find and modify specific functionality
 * - Testing: Can test each area independently
 * - Team Work: Different developers can work on different areas
 */
const studentCommands = new StudentCommands();         // Handles: create, list, update, delete students
const learningCommands = new LearningCommands();       // Handles: start sessions, generate content, chat
const progressCommands = new ProgressCommands();       // Handles: view progress, analytics, reports
const evaluationCommands = new EvaluationCommands();   // Handles: run evaluations, view metrics
const systemCommands = new SystemCommands();           // Handles: system status, logs, deployment

// =====================================================
// MAIN PROGRAM CONFIGURATION
// =====================================================

/**
 * Configure the Main CLI Program
 * 
 * This sets up the basic information about our CLI that users will see
 * when they run help commands or use the CLI incorrectly.
 */
program
  .name('school-tutor')                               // The command name users type
  .description('AI-powered school tutor system CLI') // What this CLI does
  .version('1.0.0');                                 // Current version

// =====================================================
// ERROR HANDLING UTILITIES
// =====================================================

/**
 * Async Error Handler Wrapper
 * 
 * This is a "higher-order function" - a function that takes another function
 * as input and returns a new function with added behavior.
 * 
 * Why do we need this?
 * - Async functions can throw errors that crash the entire program
 * - We want to catch these errors and show user-friendly messages
 * - Without this, users would see scary technical error messages
 * 
 * How it works:
 * 1. Takes a function as input
 * 2. Returns a new function that wraps the original in try/catch
 * 3. If error occurs, shows friendly message and exits gracefully
 * 
 * @param fn - The async function to wrap with error handling
 * @returns A new function with error handling built in
 */
const asyncHandler = (fn: Function) => async (...args: any[]) => {
  try {
    // Try to execute the original function
    await fn(...args);
  } catch (error: any) {
    // If something goes wrong, handle it gracefully
    console.error(`❌ Error: ${error.message}`);
    
    // Show detailed error info only in debug mode
    // (Developers set DEBUG=true environment variable)
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    
    // Exit the program with error code (1 = error, 0 = success)
    process.exit(1);
  }
};

// =====================================================
// STUDENT MANAGEMENT COMMANDS
// =====================================================

/**
 * Student Management Command Group
 * 
 * All commands related to student management are grouped under 'student'.
 * This creates a command hierarchy like:
 * - school-tutor student create
 * - school-tutor student list
 * - school-tutor student update
 * - etc.
 */
const studentCmd = program.command('student');
studentCmd.description('Manage student profiles and accounts');

/**
 * Create New Student Command
 * 
 * This command allows users to create a new student profile.
 * 
 * Command syntax: school-tutor student create [options]
 * 
 * Options explained:
 * - Short form (-n) and long form (--name) for user convenience
 * - <value> means the option requires a value
 * - Default values provided where appropriate
 * - Required vs optional options handled in the command implementation
 */
studentCmd
  .command('create')
  .description('Create a new student profile')
  .option('-n, --name <name>', 'Student name')                           // Required: student's full name
  .option('-g, --grade <grade>', 'Student grade (4 or 8)')              // Required: 4th or 8th grade
  .option('-c, --country <country>', 'Student country')                  // Required: for curriculum localization
  .option('-b, --board <board>', 'School board/curriculum')             // Required: educational standards
  .option('-s, --school <school>', 'School name')                       // Optional: school information
  .option('--subjects <subjects>', 'Subjects (comma-separated)')         // Optional: specific subjects to focus on
  .option('--pace <pace>', 'Learning pace (slow, medium, fast)', 'medium') // Optional: learning speed preference
  .action(async (options) => {
    await StudentCommands.createStudent(options);
  });

studentCmd
  .command('list')
  .description('List all students')
  .option('--active', 'Show only active students')
  .option('--format <format>', 'Output format (table, json)', 'table')
  .action(async (options) => {
    await StudentCommands.listStudents(options);
  });

studentCmd
  .command('get <studentId>')
  .description('Get student profile details')
  .option('--format <format>', 'Output format (table, json)', 'table')
  .action(async (studentId, options) => {
    await StudentCommands.getStudent(studentId, options);
  });

studentCmd
  .command('update <studentId>')
  .description('Update student profile')
  .option('-n, --name <name>', 'Student name')
  .option('-g, --grade <grade>', 'Student grade')
  .option('-c, --country <country>', 'Student country')
  .option('-b, --board <board>', 'School board/curriculum')
  .option('-s, --school <school>', 'School name')
  .option('--subjects <subjects>', 'Subjects (comma-separated)')
  .option('--pace <pace>', 'Learning pace (slow, medium, fast)')
  .action(async (studentId, options) => {
    await StudentCommands.updateStudent(studentId, options);
  });

studentCmd
  .command('delete <studentId>')
  .description('Delete student profile')
  .option('--confirm', 'Confirm deletion without prompt')
  .action(async (studentId, options) => {
    await StudentCommands.deleteStudent(studentId, options);
  });

// Learning session commands
const learningCmd = program.command('learning');
learningCmd.description('Manage learning sessions and content');

learningCmd
  .command('start')
  .description('Start a new learning session')
  .requiredOption('-s, --student <studentId>', 'Student ID')
  .option('--subjects <subjects>', 'Subjects for the session (comma-separated)')
  .option('--type <type>', 'Session type (regular, assessment, review)', 'regular')
  .option('--duration <minutes>', 'Expected session duration in minutes', '30')
  .action(async (options) => {
    await LearningCommands.startSession(options);
  });

learningCmd
  .command('generate')
  .description('Generate learning content')
  .requiredOption('-s, --student <studentId>', 'Student ID')
  .requiredOption('--subject <subject>', 'Subject')
  .requiredOption('--topic <topic>', 'Topic to generate content for')
  .option('--type <type>', 'Content type (lesson, exercise, assignment, quiz)', 'lesson')
  .option('--difficulty <difficulty>', 'Difficulty level (basic, moderate, challenging)')
  .action(async (options) => {
    await LearningCommands.generateContent(options);
  });

learningCmd
  .command('chat')
  .description('Interactive chat with AI tutor')
  .requiredOption('-s, --student <studentId>', 'Student ID')
  .requiredOption('--subject <subject>', 'Subject context')
  .option('--session <sessionId>', 'Session ID to continue')
  .action(async (options) => {
    await LearningCommands.startChat(options);
  });

// Progress tracking commands
const progressCmd = program.command('progress');
progressCmd.description('Track and analyze student progress');

progressCmd
  .command('view <studentId>')
  .description('View student progress')
  .option('--subject <subject>', 'Filter by subject')
  .option('--days <days>', 'Number of days to look back', '30')
  .option('--format <format>', 'Output format (table, json, chart)', 'table')
  .action(async (studentId, options) => {
    await ProgressCommands.viewProgress(studentId, options);
  });

progressCmd
  .command('analytics <studentId>')
  .description('Get detailed analytics for student')
  .option('--period <period>', 'Time period (7d, 30d, 90d)', '30d')
  .option('--subjects <subjects>', 'Filter by subjects (comma-separated)')
  .option('--export <file>', 'Export to file')
  .action(async (studentId, options) => {
    await ProgressCommands.getAnalytics(studentId, options);
  });

progressCmd
  .command('scorecard <studentId>')
  .description('Generate student scorecard')
  .option('--period <period>', 'Time period (7d, 30d, 90d)', '30d')
  .option('--format <format>', 'Output format (table, json, pdf)', 'table')
  .action(async (studentId, options) => {
    await ProgressCommands.generateScorecard(studentId, options);
  });

progressCmd
  .command('update')
  .description('Update progress for a student')
  .requiredOption('-s, --student <studentId>', 'Student ID')
  .requiredOption('--subject <subject>', 'Subject')
  .option('--session <sessionId>', 'Session ID')
  .option('--activity <activity>', 'Activity description')
  .option('--score <score>', 'Performance score (0-100)')
  .option('--engagement <engagement>', 'Engagement score (0-100)')
  .option('--time <minutes>', 'Time spent in minutes')
  .option('--completed', 'Mark as completed')
  .action(async (options) => {
    await ProgressCommands.updateProgress(options);
  });

// Evaluation commands
const evalCmd = program.command('eval');
evalCmd.description('Run evaluation and quality checks');

evalCmd
  .command('run')
  .description('Run comprehensive evaluation')
  .option('--type <type>', 'Evaluation type (all, hallucination, factuality, quality)', 'all')
  .option('--student <studentId>', 'Specific student to evaluate')
  .option('--session <sessionId>', 'Specific session to evaluate')
  .option('--days <days>', 'Number of days to evaluate', '7')
  .action(async (options) => {
    await EvaluationCommands.runEvaluation(options);
  });

evalCmd
  .command('metrics')
  .description('Show evaluation metrics')
  .option('--type <type>', 'Metric type (quality, performance, business)')
  .option('--period <period>', 'Time period (24h, 7d, 30d)', '24h')
  .option('--format <format>', 'Output format (table, json)', 'table')
  .action(async (options) => {
    await EvaluationCommands.showMetrics(options);
  });

evalCmd
  .command('dashboard')
  .description('Launch evaluation dashboard')
  .option('--type <type>', 'Dashboard type (infrastructure, quality, business, comprehensive)', 'comprehensive')
  .option('--refresh <seconds>', 'Auto-refresh interval in seconds')
  .action(async (options) => {
    await EvaluationCommands.launchDashboard(options);
  });

// System commands
const systemCmd = program.command('system');
systemCmd.description('System administration and maintenance');

systemCmd
  .command('status')
  .description('Check system status and health')
  .option('--detailed', 'Show detailed status information')
  .action(async (options) => {
    await SystemCommands.checkStatus(options);
  });

systemCmd
  .command('deploy')
  .description('Deploy infrastructure changes')
  .option('--stack <stack>', 'Specific stack to deploy (all, main, evaluation, monitoring)', 'all')
  .option('--profile <profile>', 'AWS profile to use')
  .option('--dry-run', 'Show what would be deployed without actually deploying')
  .action(async (options) => {
    await SystemCommands.deploy(options);
  });

systemCmd
  .command('logs')
  .description('View system logs')
  .option('--service <service>', 'Service to view logs for')
  .option('--tail', 'Follow log output')
  .option('--lines <lines>', 'Number of lines to show', '50')
  .action(async (options) => {
    await SystemCommands.viewLogs(options);
  });

systemCmd
  .command('backup')
  .description('Backup student data and progress')
  .option('--output <file>', 'Output file path')
  .option('--format <format>', 'Backup format (json, csv)', 'json')
  .action(async (options) => {
    await SystemCommands.backupData(options);
  });

systemCmd
  .command('restore')
  .description('Restore student data from backup')
  .requiredOption('--file <file>', 'Backup file to restore')
  .option('--dry-run', 'Show what would be restored without actually restoring')
  .action(async (options) => {
    await SystemCommands.restoreData(options);
  });

systemCmd
  .command('config')
  .description('View or update system configuration')
  .option('--set <key=value>', 'Set configuration value')
  .option('--get <key>', 'Get configuration value')
  .option('--list', 'List all configuration')
  .action(async (options) => {
    await SystemCommands.manageConfig(options);
  });

// Global error handling
program.exitOverride();

// Parse command line arguments
if (require.main === module) {
  program.parse(process.argv);
}

export { program };
