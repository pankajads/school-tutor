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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Chip,
  LinearProgress,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Analytics as AnalyticsIcon,
  Star as StarIcon,
  Assignment as AssignmentIcon,
  Timer as TimerIcon,
  School as SchoolIcon,
  EmojiEvents as TrophyIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface StudentProgress {
  id: string;
  name: string;
  totalSessions: number;
  totalHours: number;
  averageScore: number;
  currentStreak: number;
  strongSubjects: string[];
  improvementAreas: string[];
  recentSessions: SessionSummary[];
  monthlyProgress: MonthlyData[];
  subjectProgress: SubjectProgress[];
}

interface SessionSummary {
  date: string;
  subject: string;
  topic: string;
  score: number;
  duration: number;
}

interface MonthlyData {
  month: string;
  sessions: number;
  avgScore: number;
  hoursLearned: number;
}

interface SubjectProgress {
  subject: string;
  sessions: number;
  avgScore: number;
  progress: number;
  trend: 'up' | 'down' | 'stable';
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function ProgressPage() {
  const [selectedStudent, setSelectedStudent] = useState('all');
  const [timeRange, setTimeRange] = useState('3months');
  const [progressData, setProgressData] = useState<StudentProgress[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock students for dropdown
  const students = [
    { id: 'all', name: 'All Students' },
    { id: '1', name: 'Alice Johnson' },
    { id: '2', name: 'Bob Smith' },
    { id: '3', name: 'Carol Davis' },
  ];

  // Mock data for demonstration
  useEffect(() => {
    const mockProgressData: StudentProgress[] = [
      {
        id: '1',
        name: 'Alice Johnson',
        totalSessions: 24,
        totalHours: 18.5,
        averageScore: 87.3,
        currentStreak: 7,
        strongSubjects: ['Mathematics', 'Science'],
        improvementAreas: ['English Writing', 'History'],
        recentSessions: [
          { date: '2025-08-23', subject: 'Mathematics', topic: 'Quadratic Equations', score: 89, duration: 45 },
          { date: '2025-08-22', subject: 'Science', topic: 'Photosynthesis', score: 92, duration: 35 },
          { date: '2025-08-21', subject: 'English', topic: 'Essay Writing', score: 78, duration: 60 },
        ],
        monthlyProgress: [
          { month: 'Jun', sessions: 8, avgScore: 82.5, hoursLearned: 6.2 },
          { month: 'Jul', sessions: 12, avgScore: 85.1, hoursLearned: 9.8 },
          { month: 'Aug', sessions: 15, avgScore: 87.3, hoursLearned: 11.5 },
        ],
        subjectProgress: [
          { subject: 'Mathematics', sessions: 8, avgScore: 91.2, progress: 85, trend: 'up' },
          { subject: 'Science', sessions: 6, avgScore: 89.8, progress: 78, trend: 'up' },
          { subject: 'English', sessions: 7, avgScore: 81.5, progress: 65, trend: 'stable' },
          { subject: 'History', sessions: 3, avgScore: 76.3, progress: 45, trend: 'down' },
        ],
      },
      {
        id: '2',
        name: 'Bob Smith',
        totalSessions: 18,
        totalHours: 14.2,
        averageScore: 76.8,
        currentStreak: 3,
        strongSubjects: ['History', 'English'],
        improvementAreas: ['Mathematics', 'Science'],
        recentSessions: [
          { date: '2025-08-23', subject: 'History', topic: 'World War II', score: 84, duration: 40 },
          { date: '2025-08-22', subject: 'Mathematics', topic: 'Algebra', score: 68, duration: 50 },
          { date: '2025-08-21', subject: 'English', topic: 'Reading Comprehension', score: 82, duration: 35 },
        ],
        monthlyProgress: [
          { month: 'Jun', sessions: 6, avgScore: 73.2, hoursLearned: 4.8 },
          { month: 'Jul', sessions: 8, avgScore: 75.6, hoursLearned: 6.4 },
          { month: 'Aug', sessions: 10, avgScore: 76.8, hoursLearned: 8.2 },
        ],
        subjectProgress: [
          { subject: 'History', sessions: 6, avgScore: 84.5, progress: 88, trend: 'up' },
          { subject: 'English', sessions: 5, avgScore: 80.2, progress: 75, trend: 'stable' },
          { subject: 'Mathematics', sessions: 4, avgScore: 68.8, progress: 42, trend: 'down' },
          { subject: 'Science', sessions: 3, avgScore: 71.3, progress: 48, trend: 'stable' },
        ],
      },
    ];

    setTimeout(() => {
      setProgressData(mockProgressData);
      setLoading(false);
    }, 1000);
  }, []);

  const getOverallStats = () => {
    if (selectedStudent === 'all') {
      return {
        totalSessions: progressData.reduce((sum, p) => sum + p.totalSessions, 0),
        totalHours: progressData.reduce((sum, p) => sum + p.totalHours, 0),
        averageScore: progressData.reduce((sum, p) => sum + p.averageScore, 0) / progressData.length,
        activeStudents: progressData.length,
      };
    } else {
      const student = progressData.find(p => p.id === selectedStudent);
      return student ? {
        totalSessions: student.totalSessions,
        totalHours: student.totalHours,
        averageScore: student.averageScore,
        currentStreak: student.currentStreak,
      } : null;
    }
  };

  const getChartData = () => {
    if (selectedStudent === 'all') {
      // Aggregate data for all students
      const monthlyData = progressData[0]?.monthlyProgress.map(month => ({
        month: month.month,
        sessions: progressData.reduce((sum, p) => {
          const monthData = p.monthlyProgress.find(m => m.month === month.month);
          return sum + (monthData?.sessions || 0);
        }, 0),
        avgScore: progressData.reduce((sum, p) => {
          const monthData = p.monthlyProgress.find(m => m.month === month.month);
          return sum + (monthData?.avgScore || 0);
        }, 0) / progressData.length,
      })) || [];
      return monthlyData;
    } else {
      const student = progressData.find(p => p.id === selectedStudent);
      return student?.monthlyProgress || [];
    }
  };

  const getSubjectData = () => {
    if (selectedStudent === 'all') {
      // Aggregate subject data
      const subjects = ['Mathematics', 'Science', 'English', 'History'];
      return subjects.map(subject => {
        const studentsWithSubject = progressData.filter(p => 
          p.subjectProgress.some(sp => sp.subject === subject)
        );
        const avgScore = studentsWithSubject.reduce((sum, p) => {
          const subjectData = p.subjectProgress.find(sp => sp.subject === subject);
          return sum + (subjectData?.avgScore || 0);
        }, 0) / studentsWithSubject.length;
        
        return {
          subject,
          avgScore: avgScore || 0,
          students: studentsWithSubject.length,
        };
      });
    } else {
      const student = progressData.find(p => p.id === selectedStudent);
      return student?.subjectProgress || [];
    }
  };

  const stats = getOverallStats();

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>Loading Progress Data...</Typography>
        <LinearProgress variant="indeterminate" />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          📊 Progress Tracking
        </Typography>
        <Box display="flex" gap={2}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Student</InputLabel>
            <Select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
            >
              {students.map((student) => (
                <MenuItem key={student.id} value={student.id}>
                  {student.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <MenuItem value="1month">1 Month</MenuItem>
              <MenuItem value="3months">3 Months</MenuItem>
              <MenuItem value="6months">6 Months</MenuItem>
              <MenuItem value="1year">1 Year</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* Statistics Cards */}
      {stats && (
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <AssignmentIcon color="primary" sx={{ mr: 2, fontSize: 40 }} />
                  <Box>
                    <Typography variant="h4" color="primary">
                      {selectedStudent === 'all' ? stats.totalSessions : stats.totalSessions}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedStudent === 'all' ? 'Total Sessions' : 'Sessions Completed'}
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
                  <TimerIcon color="success" sx={{ mr: 2, fontSize: 40 }} />
                  <Box>
                    <Typography variant="h4" color="success.main">
                      {Math.round(stats.totalHours * 10) / 10}h
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Learning Hours
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
                  <StarIcon color="warning" sx={{ mr: 2, fontSize: 40 }} />
                  <Box>
                    <Typography variant="h4" color="warning.main">
                      {Math.round(stats.averageScore * 10) / 10}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Average Score
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
                  <TrophyIcon color="info" sx={{ mr: 2, fontSize: 40 }} />
                  <Box>
                    <Typography variant="h4" color="info.main">
                      {selectedStudent === 'all' ? stats.activeStudents : (stats as any).currentStreak}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedStudent === 'all' ? 'Active Students' : 'Day Streak'}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Grid container spacing={3}>
        {/* Progress Chart */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Learning Progress Over Time
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={getChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="sessions" fill="#8884d8" name="Sessions" />
                <Line yAxisId="right" type="monotone" dataKey="avgScore" stroke="#82ca9d" strokeWidth={3} name="Avg Score" />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Subject Performance */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Subject Performance
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={getSubjectData()}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="avgScore"
                  nameKey="subject"
                  label={({ subject, avgScore }) => `${subject}: ${Math.round(avgScore)}%`}
                >
                  {getSubjectData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Recent Sessions */}
        {selectedStudent !== 'all' && (
          <Grid item xs={12} lg={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Recent Sessions
              </Typography>
              <List>
                {progressData
                  .find(p => p.id === selectedStudent)
                  ?.recentSessions.map((session, index) => (
                    <React.Fragment key={index}>
                      <ListItem>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: session.score >= 80 ? 'success.main' : 'warning.main' }}>
                            {session.score}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={`${session.subject} - ${session.topic}`}
                          secondary={`${session.date} • ${session.duration}min • ${session.score}%`}
                        />
                      </ListItem>
                      {index < progressData.find(p => p.id === selectedStudent)!.recentSessions.length - 1 && (
                        <Divider variant="inset" component="li" />
                      )}
                    </React.Fragment>
                  ))}
              </List>
            </Paper>
          </Grid>
        )}

        {/* Subject Details */}
        {selectedStudent !== 'all' && (
          <Grid item xs={12} lg={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Subject Breakdown
              </Typography>
              <List>
                {progressData
                  .find(p => p.id === selectedStudent)
                  ?.subjectProgress.map((subject, index) => (
                    <React.Fragment key={subject.subject}>
                      <ListItem>
                        <ListItemText
                          primary={
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                              <Typography variant="subtitle1">{subject.subject}</Typography>
                              <Box display="flex" alignItems="center" gap={1}>
                                <Chip label={`${subject.sessions} sessions`} size="small" />
                                {subject.trend === 'up' && <TrendingUpIcon color="success" fontSize="small" />}
                                {subject.trend === 'down' && <TrendingDownIcon color="error" fontSize="small" />}
                              </Box>
                            </Box>
                          }
                          secondary={
                            <Box sx={{ mt: 1 }}>
                              <Box display="flex" justifyContent="space-between" mb={1}>
                                <Typography variant="caption">
                                  Avg Score: {Math.round(subject.avgScore * 10) / 10}%
                                </Typography>
                                <Typography variant="caption">
                                  Progress: {subject.progress}%
                                </Typography>
                              </Box>
                              <LinearProgress
                                variant="determinate"
                                value={subject.progress}
                                color={subject.progress >= 70 ? 'success' : subject.progress >= 50 ? 'warning' : 'error'}
                              />
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < progressData.find(p => p.id === selectedStudent)!.subjectProgress.length - 1 && (
                        <Divider />
                      )}
                    </React.Fragment>
                  ))}
              </List>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Container>
  );
}
