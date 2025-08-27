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
  Paper,
  CircularProgress
} from '@mui/material';
import { 
  School as SchoolIcon,
  Analytics as AnalyticsIcon,
  Person as PersonIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';

interface DashboardStats {
  activeStudents: number;
  sessionsCompleted: number;
  learningHours: number;
  evaluationsRun: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    activeStudents: 0,
    sessionsCompleted: 0,
    learningHours: 0,
    evaluationsRun: 0,
  });
  const [loading, setLoading] = useState(true);

  // Simulate loading real data
  useEffect(() => {
    const timer = setTimeout(() => {
      setStats({
        activeStudents: 3,
        sessionsCompleted: 42,
        learningHours: 32.7,
        evaluationsRun: 15,
      });
      setLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom align="center">
        🎓 School Tutor Agent
      </Typography>
      
      <Typography variant="h6" color="text.secondary" align="center" sx={{ mb: 4 }}>
        AI-powered personalized learning assistant for students
      </Typography>

      <Grid container spacing={4}>
        {/* Welcome Card */}
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ p: 3, backgroundColor: '#f5f5f5' }}>
            <Typography variant="h5" gutterBottom>
              Welcome to Your Learning Dashboard! 📚
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Get started by managing students, tracking progress, or running evaluations.
            </Typography>
          </Paper>
        </Grid>

        {/* Student Management Card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', cursor: 'pointer' }} onClick={() => handleNavigation('/students')}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <PersonIcon color="primary" sx={{ mr: 1, fontSize: 32 }} />
                <Typography variant="h6">Student Management</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" paragraph>
                Create, update, and manage student profiles with personalized learning preferences.
              </Typography>
              <Button 
                variant="contained" 
                color="primary" 
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNavigation('/students');
                }}
              >
                Manage Students
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Progress Tracking Card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', cursor: 'pointer' }} onClick={() => handleNavigation('/progress')}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <AnalyticsIcon color="success" sx={{ mr: 1, fontSize: 32 }} />
                <Typography variant="h6">Progress Tracking</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" paragraph>
                Monitor learning progress, view analytics, and generate detailed scorecards.
              </Typography>
              <Button 
                variant="contained" 
                color="success" 
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNavigation('/progress');
                }}
              >
                View Progress
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Learning Sessions Card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', cursor: 'pointer' }} onClick={() => handleNavigation('/learning-sessions')}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <SchoolIcon color="info" sx={{ mr: 1, fontSize: 32 }} />
                <Typography variant="h6">Learning Sessions</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" paragraph>
                Start interactive learning sessions, generate content, and engage with AI tutoring.
              </Typography>
              <Button 
                variant="contained" 
                color="info" 
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNavigation('/learning-sessions');
                }}
              >
                Start Learning
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Evaluation Center Card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', cursor: 'pointer' }} onClick={() => handleNavigation('/llm-dashboard')}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <AssessmentIcon color="warning" sx={{ mr: 1, fontSize: 32 }} />
                <Typography variant="h6">Evaluation Center</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" paragraph>
                Run comprehensive evaluations, view metrics, and access the evaluation dashboard.
              </Typography>
              <Box display="flex" gap={1}>
                <Button 
                  variant="contained" 
                  color="warning" 
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNavigation('/llm-dashboard');
                  }}
                >
                  Dashboard
                </Button>
                <Button 
                  variant="outlined" 
                  color="warning" 
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNavigation('/evaluation');
                  }}
                >
                  AI Judge
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Stats */}
        <Grid item xs={12}>
          <Paper elevation={1} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Quick Stats
            </Typography>
            {loading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            ) : (
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="primary">{stats.activeStudents}</Typography>
                    <Typography variant="caption">Active Students</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="success.main">{stats.sessionsCompleted}</Typography>
                    <Typography variant="caption">Sessions Completed</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="info.main">{stats.learningHours}h</Typography>
                    <Typography variant="caption">Learning Hours</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="warning.main">{stats.evaluationsRun}</Typography>
                    <Typography variant="caption">Evaluations Run</Typography>
                  </Box>
                </Grid>
              </Grid>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
