'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  Avatar,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Alert,
  CircularProgress,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
} from '@mui/material';
import {
  Person as PersonIcon,
  School as SchoolIcon,
  MenuBook as SubjectIcon,
  ExitToApp as LogoutIcon,
  Assignment as AssignmentIcon,
  History as HistoryIcon,
  QuestionAnswer as TutorIcon,
  AutoAwesome as SuggestIcon,
  PlayArrow as StartIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { Student, getApiService } from '../../services/api';
import { aiTutorService, TutorSession, TutorMessage } from '../../services/aiTutorService';

interface LearningSession {
  id: string;
  subject: string;
  topic: string;
  date: string;
  status: 'completed' | 'in_progress' | 'scheduled';
  notes?: string;
  assignments?: string[];
}

interface TutorSuggestion {
  id: string;
  subject: string;
  topic: string;
  difficulty: string;
  description: string;
  estimatedTime: string;
}

interface SubjectTopics {
  subject: string;
  topics: Array<{
    id: string;
    name: string;
    description: string;
    difficulty: string;
    duration: number;
    chapter?: number;
  }>;
}

export default function StudentDashboard() {
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [showSubjectSelector, setShowSubjectSelector] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [showTutor, setShowTutor] = useState(false);
  const [currentTutorSession, setCurrentTutorSession] = useState<TutorSession | null>(null);
  const [studentResponse, setStudentResponse] = useState('');
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sessions, setSessions] = useState<LearningSession[]>([]);
  const [suggestions, setSuggestions] = useState<TutorSuggestion[]>([]);
  const [subjectTopics, setSubjectTopics] = useState<SubjectTopics[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [showTopicSelection, setShowTopicSelection] = useState(false);
  const [studentScore, setStudentScore] = useState<{ totalTopics: number; completedTopics: number; score: number } | null>(null);
  const [loadingScore, setLoadingScore] = useState(false);

  useEffect(() => {
    // Load student data from localStorage
    const storedStudent = localStorage.getItem('currentStudent');
    if (storedStudent) {
      const parsedStudent = JSON.parse(storedStudent);
      setStudent(parsedStudent);
      loadLearningData(parsedStudent);
      // Load student score
      loadStudentScore(parsedStudent.studentId);
    } else {
      router.push('/student/login');
    }
  }, [router]);

  const loadStudentScore = async (studentId: string) => {
    try {
      setLoadingScore(true);
      const scoreData = await aiTutorService.getStudentScore(studentId);
      
      // Map the API response to match our component's expected structure
      const mappedScore = {
        totalTopics: 10, // Default for now
        completedTopics: scoreData.sessionsCompleted || 0,
        score: scoreData.overallScore || 0 // Use overallScore from AI tutor service
      };
      
      setStudentScore(mappedScore);
      console.log('📊 Student score loaded:', mappedScore);
    } catch (error) {
      console.error('❌ Error loading student score:', error);
      // Set default score if error
      setStudentScore({ totalTopics: 0, completedTopics: 0, score: 0 });
    } finally {
      setLoadingScore(false);
    }
  };

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentTutorSession?.messages]);

  const loadLearningData = async (studentData: Student) => {
    // Mock learning sessions data
    setSessions([
      {
        id: '1',
        subject: 'Mathematics',
        topic: 'Algebra Basics',
        date: '2024-01-15',
        status: 'completed',
        notes: 'Completed linear equations chapter',
        assignments: ['Exercise 3.1', 'Exercise 3.2']
      },
      {
        id: '2',
        subject: 'Science',
        topic: 'Photosynthesis',
        date: '2024-01-16',
        status: 'in_progress',
        notes: 'Started chlorophyll function study'
      },
      {
        id: '3',
        subject: 'English',
        topic: 'Essay Writing',
        date: '2024-01-18',
        status: 'scheduled'
      }
    ]);

    // Load real topics from backend
    await loadStudentTopics(studentData);
  };

  const loadStudentTopics = async (studentData: Student) => {
    try {
      setLoadingTopics(true);
      setError(''); // Clear previous errors
      console.log('🔄 Loading topics for student:', {
        studentId: studentData.studentId,
        studentName: studentData.studentName,
        grade: studentData.grade,
        subjects: studentData.subjects,
        board: studentData.board,
        country: studentData.country,
        school: studentData.school
      });
      
      const allSubjectTopics = [];
      const failedSubjects = [];
      
      for (const subject of studentData.subjects) {
        console.log(`📚 Processing subject: ${subject} (${studentData.subjects.indexOf(subject) + 1}/${studentData.subjects.length})`);
        
        try {
          console.log(`🚀 Starting API call for ${subject}...`);
          const apiService = getApiService();
          const topicsResponse = await apiService.getTopicsForSubject(
            subject,
            studentData.grade.toString(),
            studentData.board,
            studentData.country,
            studentData.school
          );
          const topics = topicsResponse.topics;
          console.log(`✅ API call completed for ${subject}:`, {
            topicsReceived: topics?.length || 0,
            topicsArray: Array.isArray(topics),
            firstTopic: topics?.[0],
            topicNames: topics?.slice(0, 3).map(t => t.name) || []
          });
          
          if (topics && topics.length > 0) {
            console.log(`✅ Processing ${topics.length} topics for ${subject}`);
            allSubjectTopics.push({
              subject,
              topics: topics.map((topic: any, index: number) => {
                const processedTopic = {
                  id: topic.id || topic.name || `topic-${Date.now()}-${index}`,
                  name: topic.name || topic.topicName || 'Unknown Topic',
                  description: topic.description || `Learn about ${topic.name || topic.topicName}`,
                  difficulty: topic.difficulty || 'beginner',
                  duration: topic.duration || topic.estimatedDuration || 60,
                  chapter: topic.chapter || topic.chapterNumber
                };
                if (index === 0) {
                  console.log(`📝 Sample processed topic for ${subject}:`, processedTopic);
                }
                return processedTopic;
              })
            });
            console.log(`✅ Successfully added ${topics.length} topics for ${subject}`);
          } else {
            console.warn(`⚠️ No topics returned for subject: ${subject}`, {
              topicsReceived: topics,
              topicsType: typeof topics,
              topicsIsArray: Array.isArray(topics),
              topicsLength: topics?.length
            });
            failedSubjects.push(subject);
          }
        } catch (subjectError) {
          console.error(`❌ Error fetching topics for ${subject}:`, {
            error: subjectError instanceof Error ? subjectError.message : String(subjectError),
            errorName: subjectError instanceof Error ? subjectError.name : 'Unknown',
            errorStack: subjectError instanceof Error ? subjectError.stack : 'No stack',
            subject,
            timestamp: new Date().toISOString()
          });
          failedSubjects.push(subject);
        }
      }
      console.log('✅ All subject topics loaded:', {
        subjects: allSubjectTopics.map(st => ({
          subject: st.subject,
          topicCount: st.topics.length
        })),
        totalTopics: allSubjectTopics.reduce((sum, st) => sum + st.topics.length, 0),
        successfulSubjects: allSubjectTopics.length,
        failedSubjects: failedSubjects.length,
        failed: failedSubjects
      });
      
      // Validate we have at least some topics
      const totalTopicsCount = allSubjectTopics.reduce((sum, st) => sum + st.topics.length, 0);
      if (totalTopicsCount === 0) {
        throw new Error(`No topics found for any subject. Failed subjects: ${failedSubjects.join(', ')}. Student data: Grade ${studentData.grade}, Board: ${studentData.board}, Country: ${studentData.country}`);
      }
      
      // Show warning if some subjects failed but continue with available topics
      if (failedSubjects.length > 0) {
        console.warn(`⚠️ Some subjects failed to load: ${failedSubjects.join(', ')}`);
        setError(`Warning: Could not load topics for: ${failedSubjects.join(', ')}. Showing available topics for other subjects.`);
      }
      
      setSubjectTopics(allSubjectTopics);
      
      // Create suggestions from the topics (first 4 topics)
      const newSuggestions: TutorSuggestion[] = [];
      allSubjectTopics.forEach(subjectData => {
        if (subjectData.topics.length > 0) {
          // Add the first topic from each subject as a suggestion
          const firstTopic = subjectData.topics[0];
          newSuggestions.push({
            id: `suggestion-${subjectData.subject}-${firstTopic.id}`,
            subject: subjectData.subject,
            topic: firstTopic.name,
            difficulty: firstTopic.difficulty,
            description: firstTopic.description,
            estimatedTime: `${firstTopic.duration} minutes`
          });
        }
      });
      console.log('🎯 Generated suggestions:', newSuggestions.length);
      setSuggestions(newSuggestions.slice(0, 4)); // Show max 4 suggestions
      
    } catch (error) {
      console.error('💥 Critical error loading student topics:', error);
      
      // Create detailed error message
      let errorMessage = 'Failed to load learning topics. ';
      let debugInfo = '';
      
      if (error instanceof Error) {
        errorMessage += error.message;
        debugInfo = `
Debug Information:
- Student ID: ${studentData.studentId}
- Student Name: ${studentData.studentName}
- Grade: ${studentData.grade}
- Board: ${studentData.board}
- Country: ${studentData.country}
- School: ${studentData.school}
- Subjects: ${studentData.subjects.join(', ')}
- API Base URL: https://0mcvthborg.execute-api.ap-southeast-1.amazonaws.com/prod
- Error: ${error.message}
- Timestamp: ${new Date().toISOString()}

Note: The curriculum API uses AI to generate topics, which can take 15-30 seconds.
If you see timeout errors, please wait and try again.

Please check:
1. Internet connection
2. Backend API status
3. Student data validity
4. Browser console for detailed logs`;
      } else {
        errorMessage += 'Unknown error occurred.';
        debugInfo = `Unexpected error type: ${typeof error}`;
      }
      
      setError(errorMessage + '\n\n' + debugInfo);
      
      // Still show fallback suggestions
      console.log('🔄 Falling back to mock suggestions...');
      generateFallbackSuggestions(studentData);
    } finally {
      setLoadingTopics(false);
    }
  };

  const generateFallbackSuggestions = (studentData: Student) => {
    // Generate AI suggestions based on student's subjects
    const mockSuggestions: TutorSuggestion[] = studentData.subjects.map((subject, index) => ({
      id: `suggestion-${index}`,
      subject,
      topic: getTopicForSubject(subject, studentData.grade.toString()),
      difficulty: 'intermediate',
      description: `Let's explore ${getTopicForSubject(subject, studentData.grade.toString())} with interactive examples and practice problems.`,
      estimatedTime: '30-45 minutes'
    }));
    setSuggestions(mockSuggestions);
    
    // Also create mock subject topics for testing
    const mockSubjectTopics: SubjectTopics[] = studentData.subjects.map(subject => ({
      subject,
      topics: [
        {
          id: `${subject}-topic-1`,
          name: `Introduction to ${subject}`,
          description: `Learn the basics of ${subject}`,
          difficulty: 'beginner',
          duration: 60,
          chapter: 1
        },
        {
          id: `${subject}-topic-2`, 
          name: `Advanced ${subject} Concepts`,
          description: `Explore advanced topics in ${subject}`,
          difficulty: 'intermediate', 
          duration: 90,
          chapter: 2
        },
        {
          id: `${subject}-topic-3`,
          name: `${subject} Problem Solving`,
          description: `Practice problem-solving in ${subject}`,
          difficulty: 'advanced',
          duration: 120,
          chapter: 3
        }
      ]
    }));
    
    console.log('Setting fallback subject topics:', mockSubjectTopics);
    setSubjectTopics(mockSubjectTopics);
  };

  const getTopicForSubject = (subject: string, grade: string) => {
    const topics: Record<string, string> = {
      'Mathematics': `Grade ${grade} Algebra`,
      'Science': `Grade ${grade} Physics Concepts`,
      'English': 'Reading Comprehension',
      'History': 'Ancient Civilizations',
      'Geography': 'Climate and Weather',
      'Computer Science': 'Programming Basics'
    };
    return topics[subject] || `${subject} Fundamentals`;
  };

  const handleLogout = () => {
    localStorage.removeItem('currentStudent');
    router.push('/student/login');
  };

  const handleSubjectSelection = (subject: string) => {
    console.log('🎯 Subject selected:', subject);
    console.log('📊 Current subjectTopics:', subjectTopics.map(st => `${st.subject}: ${st.topics.length} topics`));
    
    setSelectedSubject(subject);
    setShowSubjectSelector(false);
    
    // Check if topics are loaded for the selected subject
    const selectedSubjectTopics = subjectTopics.find(st => st.subject === subject);
    
    if (student && (!selectedSubjectTopics || selectedSubjectTopics.topics.length === 0)) {
      console.log('🔄 Topics not loaded for', subject, '- loading now...');
      setLoadingTopics(true);
      setShowTopicSelection(true); // Open dialog in loading state
      
      loadStudentTopics(student).finally(() => {
        setLoadingTopics(false);
      });
    } else if (selectedSubjectTopics) {
      console.log('✅ Topics already loaded for', subject, ':', selectedSubjectTopics.topics.length, 'topics');
      setShowTopicSelection(true); // Open dialog with topics ready
    } else {
      // Fallback case
      console.log('⚠️ No student data available');
      setShowTopicSelection(true);
    }
  };

  const generateTutorContent = async (subject: string, specificTopic?: string) => {
    if (!student) return;
    
    setIsGeneratingContent(true);
    setShowTutor(true);
    setStudentResponse('');
    setError('');
    
    try {
      if (!student?.studentId) {
        throw new Error('Student ID not available');
      }
      
      // Start real AI tutor session with specific topic if provided
      const topicToUse = specificTopic || 'General Topic';
      const tutorSession = await aiTutorService.startTutorSession(student.studentId, subject, topicToUse);
      setCurrentTutorSession(tutorSession);
      setIsGeneratingContent(false);
    } catch (error) {
      console.error('Failed to start tutor session:', error);
      setError('Failed to start AI tutor session. Please try again.');
      setIsGeneratingContent(false);
    }
  };

  const handleSuggestionClick = (suggestion: TutorSuggestion) => {
    generateTutorContent(suggestion.subject, suggestion.topic);
  };

  const handleTopicSelection = (subject: string, topic: string) => {
    generateTutorContent(subject, topic);
    setShowTopicSelection(false);
  };

  const handleSendResponse = async () => {
    if (!studentResponse.trim() || !currentTutorSession) return;

    const messageToSend = studentResponse.trim();
    setStudentResponse(''); // Clear immediately after capturing the message
    setIsGeneratingResponse(true);
    setError(''); // Clear any previous errors
    
    try {
      console.log('Sending student message:', messageToSend);
      
      // Send student message and get AI tutor response
      const tutorResponse = await aiTutorService.sendMessage(currentTutorSession.id, messageToSend);
      console.log('Tutor response generated:', tutorResponse);
      
      // Update the session state to get the latest messages
      const updatedSession = aiTutorService.getSession(currentTutorSession.id);
      if (updatedSession) {
        console.log('Updated session with messages:', updatedSession.messages.length);
        setCurrentTutorSession({...updatedSession}); // Force re-render with spread operator
      } else {
        console.error('Failed to get updated session');
        setError('Failed to update conversation. Please refresh and try again.');
      }
      
    } catch (error) {
      console.error('Failed to send message:', error);
      setError(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Restore the message if there was an error
      setStudentResponse(messageToSend);
    } finally {
      setIsGeneratingResponse(false);
    }
  };

  if (!student) {
    return (
      <Container maxWidth="md" sx={{ mt: 8, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading your dashboard...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header with Welcome Message */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>
            <PersonIcon />
          </Avatar>
          <Box>
            <Typography variant="h4" component="h1">
              Welcome back, {student.studentName}! 👋
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Ready to continue your learning journey?
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={handleLogout} color="primary" size="large">
          <LogoutIcon />
        </IconButton>
      </Box>

      {/* Student Info Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <SchoolIcon color="primary" />
                <Typography variant="h6">Class & Subjects</Typography>
              </Box>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Grade {student.grade}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {student.subjects.map((subject) => (
                  <Chip
                    key={subject}
                    label={subject}
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <SubjectIcon color="primary" />
                <Typography variant="h6">Learning Progress</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Learning Pace: {student.learningPace}
              </Typography>
              {loadingScore ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <CircularProgress size={16} />
                  <Typography variant="body2" color="text.secondary">
                    Loading score...
                  </Typography>
                </Box>
              ) : studentScore ? (
                <>
                  <Typography variant="body2" color="text.secondary">
                    Topics Completed: {studentScore.completedTopics}/{studentScore.totalTopics}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Overall Score:
                    </Typography>
                    <Typography variant="h6" color="primary">
                      {studentScore.score}%
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={Math.max(0, Math.min(100, studentScore.score || 0))} 
                    sx={{ mt: 1, borderRadius: 1 }}
                  />
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Score: Not available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Subject Selection */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Choose Your Subject</Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setShowSubjectSelector(true)}
            >
              Select Subject
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Pick a subject to start a personalized learning session with your AI tutor.
          </Typography>
        </CardContent>
      </Card>

      {/* AI Tutor Suggestions */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <SuggestIcon color="primary" />
            <Typography variant="h6">AI Tutor Suggestions</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Based on your grade and subjects, here are some recommended learning sessions:
          </Typography>
          
          {/* Error Display for Suggestions */}
          {error && (
            <Paper sx={{ p: 2, mb: 3, bgcolor: 'error.50', border: 1, borderColor: 'error.main' }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Typography color="error" sx={{ fontSize: '1.2rem' }}>⚠️</Typography>
                <Box>
                  <Typography variant="subtitle1" color="error" sx={{ mb: 1 }}>
                    Unable to Load Personalized Suggestions
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-line', maxHeight: 200, overflow: 'auto' }}>
                    {error}
                  </Typography>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    color="error" 
                    sx={{ mt: 2 }}
                    onClick={() => student && loadStudentTopics(student)}
                  >
                    🔄 Retry Loading Topics
                  </Button>
                </Box>
              </Box>
            </Paper>
          )}
          
          <Grid container spacing={2}>
            {suggestions.length === 0 && !error ? (
              <Grid item xs={12}>
                <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'info.50', border: 1, borderColor: 'info.main' }}>
                  <Typography variant="h6" color="info.dark" sx={{ mb: 1 }}>
                    🤖 Generating Personalized Suggestions...
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {loadingTopics ? 
                      'Loading curriculum topics with AI to create personalized suggestions... This may take 15-30 seconds.' : 
                      'No suggestions available yet. Try selecting a subject above.'}
                  </Typography>
                  {!loadingTopics && student && (
                    <>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                        Debug: {student.subjects.length} subjects available, {subjectTopics.length} loaded
                      </Typography>
                      <Button 
                        variant="outlined" 
                        color="primary"
                        onClick={() => loadStudentTopics(student)}
                      >
                        🔄 Load Suggestions
                      </Button>
                    </>
                  )}
                </Paper>
              </Grid>
            ) : (
              suggestions.map((suggestion) => (
                <Grid item xs={12} md={6} key={suggestion.id}>
                  <Paper 
                    sx={{ 
                      p: 2, 
                      cursor: 'pointer', 
                      border: 1, 
                      borderColor: 'divider',
                      '&:hover': { 
                        borderColor: 'primary.main',
                        transform: 'translateY(-2px)',
                        transition: 'all 0.2s'
                      }
                    }}
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="subtitle1" color="primary">
                        {suggestion.subject}
                      </Typography>
                      <Chip label={suggestion.difficulty} size="small" />
                    </Box>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      {suggestion.topic}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {suggestion.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ⏱️ {suggestion.estimatedTime}
                    </Typography>
                  </Paper>
                </Grid>
              ))
            )}
          </Grid>
          
          {/* Browse All Topics Section */}
          <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Want to explore more topics? Browse by subject:
            </Typography>
            <Grid container spacing={1}>
              {student.subjects.map((subject) => (
                <Grid item key={subject}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<SubjectIcon />}
                    onClick={() => handleSubjectSelection(subject)}
                    sx={{ textTransform: 'none' }}
                  >
                    {subject} Topics
                  </Button>
                </Grid>
              ))}
            </Grid>
          </Box>
        </CardContent>
      </Card>

      {/* Previous Sessions */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <HistoryIcon color="primary" />
                <Typography variant="h6">Recent Sessions</Typography>
              </Box>
              <List>
                {sessions.slice(0, 3).map((session, index) => (
                  <React.Fragment key={session.id}>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon>
                        <SubjectIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={`${session.subject}: ${session.topic}`}
                        secondary={
                          <Box component="span">
                            <Typography variant="caption" display="block" component="span">
                              {session.date}
                            </Typography>
                            <Box component="span" sx={{ mt: 0.5, display: 'inline-block' }}>
                              <Chip 
                                label={session.status} 
                                size="small" 
                                color={
                                  session.status === 'completed' ? 'success' :
                                  session.status === 'in_progress' ? 'warning' : 'default'
                                }
                              />
                            </Box>
                          </Box>
                        }
                        primaryTypographyProps={{ component: 'span' }}
                        secondaryTypographyProps={{ component: 'div' }}
                      />
                    </ListItem>
                    {index < sessions.slice(0, 3).length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <AssignmentIcon color="primary" />
                <Typography variant="h6">Assignments & Notes</Typography>
              </Box>
              <List>
                {sessions
                  .filter(session => session.assignments || session.notes)
                  .slice(0, 3)
                  .map((session, index) => (
                    <React.Fragment key={session.id}>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemText
                          primary={session.subject}
                          secondary={
                            <Box component="span">
                              {session.notes && (
                                <Typography variant="body2" sx={{ mb: 1 }} component="span" display="block">
                                  📝 {session.notes}
                                </Typography>
                              )}
                              {session.assignments && (
                                <Box component="span" sx={{ display: 'inline-block' }}>
                                  {session.assignments.map((assignment) => (
                                    <Chip
                                      key={assignment}
                                      label={assignment}
                                      size="small"
                                      variant="outlined"
                                      sx={{ mr: 0.5, mb: 0.5 }}
                                    />
                                  ))}
                                </Box>
                              )}
                            </Box>
                          }
                          primaryTypographyProps={{ component: 'span' }}
                          secondaryTypographyProps={{ component: 'div' }}
                        />
                      </ListItem>
                      {index < 2 && <Divider />}
                    </React.Fragment>
                  ))
                }
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Subject Selection Dialog */}
      <Dialog open={showSubjectSelector} onClose={() => setShowSubjectSelector(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Choose a Subject</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select a subject to start your learning session with AI tutor.
          </Typography>
          <List>
            {student.subjects.map((subject) => (
              <ListItem
                key={subject}
                button
                onClick={() => handleSubjectSelection(subject)}
                sx={{ border: 1, borderColor: 'divider', borderRadius: 1, mb: 1 }}
              >
                <ListItemIcon>
                  <SubjectIcon />
                </ListItemIcon>
                <ListItemText
                  primary={subject}
                  secondary={`Grade ${student.grade} level`}
                />
                <StartIcon />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSubjectSelector(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Topic Selection Dialog */}
      <Dialog open={showTopicSelection} onClose={() => setShowTopicSelection(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SubjectIcon />
            Select a Topic in {selectedSubject}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose a specific topic to focus your learning session.
          </Typography>
          
          {/* Error Display */}
          {error && (
            <Paper sx={{ p: 2, mb: 2, bgcolor: 'error.50', border: 1, borderColor: 'error.main' }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Typography color="error" sx={{ fontSize: '1.2rem' }}>⚠️</Typography>
                <Box>
                  <Typography variant="h6" color="error" sx={{ mb: 1 }}>
                    Topic Loading Error
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                    {error}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          )}
          
          {loadingTopics ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress />
              <Typography sx={{ mt: 2 }}>
                Loading topics for {selectedSubject}... This may take 15-30 seconds as we generate AI-powered curriculum content.
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Fetching curriculum data from backend API...
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {(() => {
                console.log('🔍 Topic rendering debug:');
                console.log('  - selectedSubject:', selectedSubject);
                console.log('  - subjectTopics.length:', subjectTopics.length);
                console.log('  - subjectTopics subjects:', subjectTopics.map(st => st.subject));
                
                const selectedSubjectTopics = subjectTopics.find(st => st.subject === selectedSubject);
                console.log('  - selectedSubjectTopics found:', !!selectedSubjectTopics);
                console.log('  - topics count:', selectedSubjectTopics?.topics.length || 0);
                
                if (!selectedSubjectTopics) {
                  return (
                    <Grid item xs={12}>
                      <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'warning.50', border: 1, borderColor: 'warning.main' }}>
                        <Typography variant="h6" color="warning.dark" sx={{ mb: 1 }}>
                          📚 No Topics Found for {selectedSubject}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          We couldn't find any topics for this subject.
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'pre-line' }}>
                          Debug Info:
                          {`• Available subjects: ${subjectTopics.map(st => st.subject).join(', ') || 'None'}
• Selected subject: ${selectedSubject || 'None'}
• Total subject topics loaded: ${subjectTopics.length}
• Check browser console for detailed logs`}
                        </Typography>
                        <Button 
                          variant="outlined" 
                          color="primary" 
                          sx={{ mt: 2 }}
                          onClick={() => student && loadStudentTopics(student)}
                        >
                          🔄 Retry Loading Topics
                        </Button>
                      </Paper>
                    </Grid>
                  );
                }
                
                if (selectedSubjectTopics.topics.length === 0) {
                  return (
                    <Grid item xs={12}>
                      <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'warning.50', border: 1, borderColor: 'warning.main' }}>
                        <Typography variant="h6" color="warning.dark" sx={{ mb: 1 }}>
                          📝 Empty Topic List for {selectedSubject}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          The subject exists but has no topics available.
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'pre-line' }}>
                          Debug Info:
                          {`• Subject: ${selectedSubject}
• Topics array length: ${selectedSubjectTopics.topics.length}
• API Response: Check network tab for curriculum/topics API call
• This might indicate a backend data issue`}
                        </Typography>
                        <Button 
                          variant="outlined" 
                          color="primary" 
                          sx={{ mt: 2 }}
                          onClick={() => student && loadStudentTopics(student)}
                        >
                          🔄 Retry Loading Topics
                        </Button>
                      </Paper>
                    </Grid>
                  );
                }
                
                return selectedSubjectTopics.topics.map((topic, index) => (
                  <Grid item xs={12} sm={6} key={topic.id}>
                    <Paper 
                      sx={{ 
                        p: 2, 
                        cursor: 'pointer',
                        border: 1,
                        borderColor: 'divider',
                        '&:hover': { 
                          borderColor: 'primary.main',
                          transform: 'translateY(-2px)',
                          transition: 'all 0.2s'
                        }
                      }}
                      onClick={() => handleTopicSelection(selectedSubject, topic.name)}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography variant="h6" color="primary" sx={{ fontSize: '1rem' }}>
                          {topic.chapter && `Ch ${topic.chapter}: `}{topic.name}
                        </Typography>
                        <Chip 
                          label={topic.difficulty} 
                          size="small" 
                          color={topic.difficulty === 'beginner' ? 'success' : topic.difficulty === 'intermediate' ? 'warning' : 'error'}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {topic.description}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                          ⏱️ {topic.duration} minutes
                        </Typography>
                        <Button size="small" variant="outlined">
                          Start Learning
                        </Button>
                      </Box>
                    </Paper>
                  </Grid>
                ));
              })() || (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                      No topics available for {selectedSubject}. Please try again later.
                    </Typography>
                  </Grid>
                )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTopicSelection(false)}>Cancel</Button>
          <Button 
            onClick={() => {
              setShowTopicSelection(false);
              setShowSubjectSelector(true);
            }}
            variant="outlined"
          >
            Change Subject
          </Button>
        </DialogActions>
      </Dialog>

      {/* AI Tutor Dialog */}
      <Dialog open={showTutor} onClose={() => setShowTutor(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TutorIcon />
            AI Tutor Session: {selectedSubject}
          </Box>
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          {isGeneratingContent ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress />
              <Typography sx={{ mt: 2 }}>
                Preparing your personalized learning content...
              </Typography>
            </Box>
          ) : currentTutorSession ? (
            <Box>
              {/* Conversation History */}
              <Box sx={{ maxHeight: 400, overflowY: 'auto', mb: 2 }}>
                {currentTutorSession.messages.map((message, index) => (
                  <Paper 
                    key={message.id || `message-${index}`}
                    sx={{ 
                      p: 2, 
                      mb: 2, 
                      bgcolor: message.role === 'tutor' ? 'grey.50' : 'primary.50',
                      borderLeft: message.role === 'tutor' ? '4px solid #1976d2' : '4px solid #4caf50'
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                      {message.role === 'tutor' ? '🤖 AI Tutor' : '👤 You'}
                      {message.metadata?.confidence && (
                        <Chip 
                          label={`${(message.metadata.confidence * 100).toFixed(0)}% confidence`} 
                          size="small" 
                          variant="outlined" 
                          sx={{ ml: 1 }} 
                        />
                      )}
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      {message.role === 'tutor' ? (
                        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
                          {message.content}
                        </pre>
                      ) : (
                        <Typography variant="body1">{message.content}</Typography>
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                      {message.metadata?.responseTime && (
                        <span> • Response time: {message.metadata.responseTime}ms</span>
                      )}
                    </Typography>
                  </Paper>
                ))}
                <div ref={messagesEndRef} />
              </Box>

              {/* Loading indicator for AI response */}
              {isGeneratingResponse && (
                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <CircularProgress size={24} />
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    AI Tutor is thinking...
                  </Typography>
                </Box>
              )}

              {/* Student Progress Indicator */}
              {currentTutorSession.studentProgress && (
                <Box sx={{ mb: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>Session Progress</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={4}>
                      <Typography variant="caption">Understanding</Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={Math.max(0, Math.min(100, (currentTutorSession.studentProgress?.understanding || 0) * 100))} 
                        sx={{ mt: 0.5 }}
                      />
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption">Engagement</Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={Math.max(0, Math.min(100, (currentTutorSession.studentProgress?.engagement || 0) * 100))} 
                        sx={{ mt: 0.5 }}
                      />
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption">Questions: {currentTutorSession.studentProgress?.questionsAnswered || 0}</Typography>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* Response Input */}
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="Type your response or ask a question..."
                variant="outlined"
                value={studentResponse}
                onChange={(e) => setStudentResponse(e.target.value)}
                disabled={isGeneratingResponse}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    handleSendResponse();
                  }
                }}
                helperText="Press Ctrl+Enter to send quickly"
              />
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography>No active session found.</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowTutor(false);
            if (currentTutorSession) {
              aiTutorService.endSession(currentTutorSession.id);
              setCurrentTutorSession(null);
            }
          }}>
            {currentTutorSession ? 'End Session' : 'Close'}
          </Button>
          {!isGeneratingContent && !isGeneratingResponse && currentTutorSession && (
            <Button 
              variant="contained" 
              onClick={handleSendResponse}
              disabled={!studentResponse.trim()}
            >
              Send Response
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
}
