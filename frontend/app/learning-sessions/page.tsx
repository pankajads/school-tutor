'use client';

import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Alert,
  LinearProgress,
  Avatar,
  Fab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Pause as PauseIcon,
  School as SchoolIcon,
  Timer as TimerIcon,
  Analytics as AnalyticsIcon,
  Star as StarIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Book as BookIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { apiService } from '../services/api';

interface LearningSession {
  id: string;
  studentId: string;
  studentName: string;
  subject: string;
  topic: string;
  startTime: string;
  endTime?: string;
  duration: number; // in minutes
  status: 'active' | 'completed' | 'paused';
  progress: number;
  questionsAsked: number;
  questionsAnswered: number;
  correctAnswers: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  learningObjectives: string[];
  notes: string;
}

interface SessionActivity {
  id: string;
  sessionId: string;
  timestamp: string;
  type: 'question' | 'answer' | 'explanation' | 'hint';
  content: string;
  isCorrect?: boolean;
}

export default function LearningSessionsPage() {
  const [sessions, setSessions] = useState<LearningSession[]>([]);
  const [activities, setActivities] = useState<SessionActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<LearningSession | null>(null);
  const [newSessionForm, setNewSessionForm] = useState({
    studentId: '',
    subject: '',
    topic: '',
    difficulty: 'intermediate',
    learningObjectives: [],
  });

  // Mock students for dropdown
  const mockStudents = [
    { id: '1', name: 'Alice Johnson' },
    { id: '2', name: 'Bob Smith' },
    { id: '3', name: 'Carol Davis' },
  ];

  // Mock data for demonstration
  useEffect(() => {
    const mockSessions: LearningSession[] = [
      {
        id: '1',
        studentId: '1',
        studentName: 'Alice Johnson',
        subject: 'Mathematics',
        topic: 'Quadratic Equations',
        startTime: '2025-08-23T10:00:00Z',
        endTime: '2025-08-23T10:45:00Z',
        duration: 45,
        status: 'completed',
        progress: 100,
        questionsAsked: 12,
        questionsAnswered: 11,
        correctAnswers: 9,
        difficulty: 'intermediate',
        learningObjectives: ['Solve quadratic equations', 'Understand discriminant', 'Graph parabolas'],
        notes: 'Student showed excellent understanding of the discriminant concept.',
      },
      {
        id: '2',
        studentId: '2',
        studentName: 'Bob Smith',
        subject: 'Science',
        topic: 'Photosynthesis',
        startTime: '2025-08-23T14:00:00Z',
        duration: 20,
        status: 'active',
        progress: 65,
        questionsAsked: 8,
        questionsAnswered: 6,
        correctAnswers: 5,
        difficulty: 'beginner',
        learningObjectives: ['Understand photosynthesis process', 'Identify key components', 'Explain light reactions'],
        notes: 'Currently working on light-dependent reactions.',
      },
      {
        id: '3',
        studentId: '3',
        studentName: 'Carol Davis',
        subject: 'English',
        topic: 'Essay Writing',
        startTime: '2025-08-23T09:00:00Z',
        endTime: '2025-08-23T10:30:00Z',
        duration: 90,
        status: 'completed',
        progress: 100,
        questionsAsked: 15,
        questionsAnswered: 15,
        correctAnswers: 13,
        difficulty: 'advanced',
        learningObjectives: ['Structure arguments', 'Use evidence effectively', 'Improve writing style'],
        notes: 'Excellent progress on argumentative essay structure.',
      },
    ];

    const mockActivities: SessionActivity[] = [
      {
        id: '1',
        sessionId: '1',
        timestamp: '2025-08-23T10:15:00Z',
        type: 'question',
        content: 'What is the discriminant of the equation x² + 5x + 6 = 0?',
      },
      {
        id: '2',
        sessionId: '1',
        timestamp: '2025-08-23T10:16:00Z',
        type: 'answer',
        content: 'The discriminant is 1',
        isCorrect: true,
      },
      {
        id: '3',
        sessionId: '1',
        timestamp: '2025-08-23T10:17:00Z',
        type: 'explanation',
        content: 'Correct! The discriminant formula is b² - 4ac. Here: 5² - 4(1)(6) = 25 - 24 = 1',
      },
    ];

    setTimeout(() => {
      setSessions(mockSessions);
      setActivities(mockActivities);
      setLoading(false);
    }, 1000);
  }, []);

  const handleStartSession = () => {
    const newSession: LearningSession = {
      id: Date.now().toString(),
      studentId: newSessionForm.studentId,
      studentName: mockStudents.find(s => s.id === newSessionForm.studentId)?.name || '',
      subject: newSessionForm.subject,
      topic: newSessionForm.topic,
      startTime: new Date().toISOString(),
      duration: 0,
      status: 'active',
      progress: 0,
      questionsAsked: 0,
      questionsAnswered: 0,
      correctAnswers: 0,
      difficulty: newSessionForm.difficulty as any,
      learningObjectives: newSessionForm.learningObjectives,
      notes: '',
    };

    setSessions([newSession, ...sessions]);
    setDialogOpen(false);
    setNewSessionForm({
      studentId: '',
      subject: '',
      topic: '',
      difficulty: 'intermediate',
      learningObjectives: [],
    });
  };

  const handleSessionAction = (sessionId: string, action: 'pause' | 'resume' | 'end') => {
    setSessions(sessions.map(session => {
      if (session.id === sessionId) {
        switch (action) {
          case 'pause':
            return { ...session, status: 'paused' };
          case 'resume':
            return { ...session, status: 'active' };
          case 'end':
            return {
              ...session,
              status: 'completed',
              endTime: new Date().toISOString(),
              progress: 100,
            };
          default:
            return session;
        }
      }
      return session;
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'info';
      case 'paused': return 'warning';
      default: return 'default';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'success';
      case 'intermediate': return 'warning';
      case 'advanced': return 'error';
      default: return 'default';
    }
  };

  const getAccuracyPercentage = (session: LearningSession) => {
    return session.questionsAnswered > 0 
      ? Math.round((session.correctAnswers / session.questionsAnswered) * 100)
      : 0;
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>Loading Learning Sessions...</Typography>
        <LinearProgress variant="indeterminate" />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          📚 Learning Sessions
        </Typography>
        <Button
          variant="contained"
          startIcon={<PlayIcon />}
          onClick={() => setDialogOpen(true)}
          size="large"
        >
          Start New Session
        </Button>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <PlayIcon color="success" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography variant="h4" color="success.main">
                    {sessions.filter(s => s.status === 'active').length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Sessions
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <CheckCircleIcon color="info" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography variant="h4" color="info.main">
                    {sessions.filter(s => s.status === 'completed').length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Completed Today
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <TimerIcon color="warning" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography variant="h4" color="warning.main">
                    {Math.round(sessions.reduce((sum, s) => sum + s.duration, 0) / 60)}h
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Learning Time
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <StarIcon color="primary" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography variant="h4" color="primary">
                    {Math.round(
                      sessions.reduce((sum, s) => sum + getAccuracyPercentage(s), 0) / sessions.length
                    )}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Avg Accuracy
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Active Sessions Alert */}
      {sessions.filter(s => s.status === 'active').length > 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="subtitle1">
            {sessions.filter(s => s.status === 'active').length} active learning session(s) in progress
          </Typography>
        </Alert>
      )}

      {/* Sessions List */}
      <Grid container spacing={3}>
        {sessions.map((session) => (
          <Grid item xs={12} key={session.id}>
            <Card elevation={session.status === 'active' ? 4 : 1}>
              <CardContent>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={8}>
                    <Box display="flex" alignItems="center" mb={2}>
                      <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                        {session.studentName.charAt(0)}
                      </Avatar>
                      <Box flex={1}>
                        <Typography variant="h6">{session.topic}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {session.studentName} • {session.subject}
                        </Typography>
                      </Box>
                      <Box textAlign="right">
                        <Chip
                          label={session.status.toUpperCase()}
                          color={getStatusColor(session.status)}
                          size="small"
                          sx={{ mb: 1 }}
                        />
                        <br />
                        <Chip
                          label={session.difficulty.toUpperCase()}
                          color={getDifficultyColor(session.difficulty)}
                          size="small"
                        />
                      </Box>
                    </Box>

                    <Grid container spacing={2}>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">
                          Duration
                        </Typography>
                        <Typography variant="body2">
                          {session.duration}min
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">
                          Questions
                        </Typography>
                        <Typography variant="body2">
                          {session.questionsAnswered}/{session.questionsAsked}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">
                          Accuracy
                        </Typography>
                        <Typography variant="body2">
                          {getAccuracyPercentage(session)}%
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">
                          Progress
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={session.progress}
                          sx={{ mt: 0.5 }}
                        />
                      </Grid>
                    </Grid>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Box display="flex" gap={1} justifyContent="flex-end" flexWrap="wrap">
                      {session.status === 'active' && (
                        <>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<PauseIcon />}
                            onClick={() => handleSessionAction(session.id, 'pause')}
                          >
                            Pause
                          </Button>
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<StopIcon />}
                            onClick={() => handleSessionAction(session.id, 'end')}
                          >
                            End Session
                          </Button>
                        </>
                      )}
                      {session.status === 'paused' && (
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<PlayIcon />}
                          onClick={() => handleSessionAction(session.id, 'resume')}
                        >
                          Resume
                        </Button>
                      )}
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setSelectedSession(session)}
                      >
                        View Details
                      </Button>
                    </Box>
                  </Grid>
                </Grid>

                {/* Learning Objectives */}
                {session.learningObjectives.length > 0 && (
                  <Accordion sx={{ mt: 2 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle2">Learning Objectives</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <List dense>
                        {session.learningObjectives.map((objective, index) => (
                          <ListItem key={index}>
                            <ListItemIcon>
                              <BookIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary={objective} />
                          </ListItem>
                        ))}
                      </List>
                    </AccordionDetails>
                  </Accordion>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Start New Session Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Start New Learning Session</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Select Student</InputLabel>
                <Select
                  value={newSessionForm.studentId}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, studentId: e.target.value })}
                >
                  {mockStudents.map((student) => (
                    <MenuItem key={student.id} value={student.id}>
                      {student.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Subject"
                value={newSessionForm.subject}
                onChange={(e) => setNewSessionForm({ ...newSessionForm, subject: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Topic"
                value={newSessionForm.topic}
                onChange={(e) => setNewSessionForm({ ...newSessionForm, topic: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Difficulty Level</InputLabel>
                <Select
                  value={newSessionForm.difficulty}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, difficulty: e.target.value })}
                >
                  <MenuItem value="beginner">Beginner</MenuItem>
                  <MenuItem value="intermediate">Intermediate</MenuItem>
                  <MenuItem value="advanced">Advanced</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleStartSession}
            variant="contained"
            disabled={!newSessionForm.studentId || !newSessionForm.subject || !newSessionForm.topic}
          >
            Start Session
          </Button>
        </DialogActions>
      </Dialog>

      {/* Session Details Dialog */}
      <Dialog
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        maxWidth="lg"
        fullWidth
      >
        {selectedSession && (
          <>
            <DialogTitle>
              Session Details: {selectedSession.topic}
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>Session Information</Typography>
                  <List>
                    <ListItem>
                      <ListItemText
                        primary="Student"
                        secondary={selectedSession.studentName}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Subject & Topic"
                        secondary={`${selectedSession.subject} - ${selectedSession.topic}`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Duration"
                        secondary={`${selectedSession.duration} minutes`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Start Time"
                        secondary={new Date(selectedSession.startTime).toLocaleString()}
                      />
                    </ListItem>
                  </List>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>Performance Metrics</Typography>
                  <List>
                    <ListItem>
                      <ListItemText
                        primary="Questions Asked"
                        secondary={selectedSession.questionsAsked}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Questions Answered"
                        secondary={selectedSession.questionsAnswered}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Correct Answers"
                        secondary={`${selectedSession.correctAnswers} (${getAccuracyPercentage(selectedSession)}%)`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Progress"
                        secondary={`${selectedSession.progress}%`}
                      />
                    </ListItem>
                  </List>
                </Grid>
                {selectedSession.notes && (
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom>Session Notes</Typography>
                    <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                      <Typography variant="body2">
                        {selectedSession.notes}
                      </Typography>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedSession(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
}
