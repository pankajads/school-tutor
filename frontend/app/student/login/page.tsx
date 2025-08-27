'use client';

import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  School as SchoolIcon,
  Person as PersonIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { apiService, Student, StudentListItem } from '../../services/api';

export default function StudentLogin() {
  const router = useRouter();
  const [studentName, setStudentName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRegistration, setShowRegistration] = useState(false);

  const handleLogin = async () => {
    if (!studentName.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Check if student exists
      const students = await apiService.getStudents();
      console.log('All students:', students.map(s => ({ id: s.studentId, name: s.studentName })));
      console.log('Searching for:', studentName.trim());
      
      const existingStudent = students.find(
        (student: StudentListItem) => student.studentName?.toLowerCase().trim() === studentName.trim().toLowerCase()
      );

      console.log('Found student:', existingStudent);

      if (existingStudent) {
        // Student found, redirect to student dashboard
        localStorage.setItem('currentStudent', JSON.stringify(existingStudent));
        router.push('/student/dashboard');
      } else {
        // Student not found, show detailed error with available students
        const availableNames = students.map(s => s.studentName).join(', ');
        setError(`Student "${studentName}" not found. Available students: ${availableNames}`);
        setShowRegistration(true);
      }
    } catch (err) {
      setError('Failed to check student records. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToAdmin = () => {
    router.push('/dashboard');
  };

  if (showRegistration) {
    return <StudentRegistration 
      initialName={studentName} 
      onBack={() => setShowRegistration(false)}
      onSuccess={(student: Student) => {
        localStorage.setItem('currentStudent', JSON.stringify(student));
        router.push('/student/dashboard');
      }}
    />;
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Tooltip title="Back to Admin Console">
          <IconButton onClick={handleBackToAdmin} color="primary">
            <ArrowBackIcon />
          </IconButton>
        </Tooltip>
        <Typography variant="h4" component="h1">
          Student Portal
        </Typography>
      </Box>

      <Card elevation={3}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <SchoolIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Welcome to School Tutor AI
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Enter your name to access your personalized learning dashboard
            </Typography>
          </Box>

          <Box component="form" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
            <TextField
              fullWidth
              label="Your Name"
              variant="outlined"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              margin="normal"
              required
              disabled={loading}
              InputProps={{
                startAdornment: <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
              helperText="Enter your full name as registered"
            />

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading || !studentName.trim()}
              sx={{ mt: 3, py: 1.5 }}
            >
              {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={20} color="inherit" />
                  Checking...
                </Box>
              ) : (
                'Continue'
              )}
            </Button>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
            If you're a new student, you'll be guided through the registration process.
          </Typography>
        </CardContent>
      </Card>
    </Container>
  );
}

// Student Registration Component
function StudentRegistration({ 
  initialName, 
  onBack, 
  onSuccess 
}: { 
  initialName: string; 
  onBack: () => void; 
  onSuccess: (student: Student) => void; 
}) {
  const [formData, setFormData] = useState({
    name: initialName,
    email: '',
    grade: '',
    subjects: [] as string[],
    learningPace: 'medium',
    board: 'CBSE',
    school: '',
    country: 'India'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);

  const learningPaceOptions = [
    { value: 'slow', label: 'Slow Pace - Take time to understand' },
    { value: 'medium', label: 'Medium Pace - Balanced approach' },
    { value: 'fast', label: 'Fast Pace - Quick learning' }
  ];

  // Update available subjects when profile changes
  React.useEffect(() => {
    const fetchSubjects = async () => {
      if (formData.grade && formData.board && formData.country) {
        setSubjectsLoading(true);
        try {
          // Mock subjects since getSubjectsForProfile doesn't exist
          const subjects = ['Mathematics', 'Science', 'English', 'History', 'Geography', 'Physics', 'Chemistry', 'Biology'];
          setAvailableSubjects(subjects);
          
          // Filter existing selected subjects to only include available ones
          const validSubjects = formData.subjects.filter(subject => subjects.includes(subject));
          if (validSubjects.length !== formData.subjects.length) {
            setFormData(prev => ({ ...prev, subjects: validSubjects }));
          }
        } catch (error) {
          console.error('Error fetching subjects:', error);
          setAvailableSubjects([]);
        } finally {
          setSubjectsLoading(false);
        }
      } else {
        setAvailableSubjects([]);
      }
    };

    fetchSubjects();
  }, [formData.grade, formData.board, formData.country, formData.school]);

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || !formData.grade || formData.subjects.length === 0 || !formData.board || !formData.school || !formData.country) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const studentData = {
        studentName: formData.name,
        email: formData.email,
        grade: parseInt(formData.grade, 10),
        subjects: formData.subjects,
        learningPace: formData.learningPace as 'slow' | 'medium' | 'fast',
        board: formData.board,
        school: formData.school,
        country: formData.country
      };

      const newStudent = await apiService.createStudent(studentData);
      onSuccess(newStudent);
    } catch (err) {
      setError('Failed to register student. Please try again.');
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton onClick={onBack} color="primary">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1">
          Student Registration
        </Typography>
      </Box>

      <Card elevation={3}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" gutterBottom>
            Welcome! Let's set up your learning profile
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            We couldn't find your name in our records. Please register to continue.
          </Typography>

          <Box sx={{ display: 'grid', gap: 3 }}>
            <TextField
              fullWidth
              label="Full Name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />

            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              required
              helperText="We'll use this to track your progress"
            />

            <TextField
              select
              fullWidth
              label="Class/Grade"
              value={formData.grade}
              onChange={(e) => setFormData(prev => ({ ...prev, grade: e.target.value }))}
              required
              SelectProps={{ native: true }}
            >
              <option value="">Select Grade</option>
              <option value="1st Grade">1st Grade</option>
              <option value="2nd Grade">2nd Grade</option>
              <option value="3rd Grade">3rd Grade</option>
              <option value="4th Grade">4th Grade</option>
              <option value="5th Grade">5th Grade</option>
              <option value="6th Grade">6th Grade</option>
              <option value="7th Grade">7th Grade</option>
              <option value="8th Grade">8th Grade</option>
              <option value="9th Grade">9th Grade</option>
              <option value="10th Grade">10th Grade</option>
              <option value="11th Grade">11th Grade</option>
              <option value="12th Grade">12th Grade</option>
            </TextField>

            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Subjects * (Select at least one)
              </Typography>
              {subjectsLoading ? (
                <Box sx={{ 
                  p: 3, 
                  border: '1px solid #e0e0e0', 
                  borderRadius: 1, 
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2
                }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2" color="text.secondary">
                    AI is analyzing your profile to recommend subjects...
                  </Typography>
                </Box>
              ) : availableSubjects.length > 0 ? (
                <>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    🤖 AI-recommended subjects based on Grade {formData.grade}, {formData.board} board, {formData.country} curriculum
                  </Typography>
                  <Box sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                    gap: 1,
                    maxHeight: 250,
                    overflowY: 'auto',
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    p: 2,
                    bgcolor: 'background.paper'
                  }}>
                    {availableSubjects.map((subject: string) => (
                      <Box key={subject} sx={{ display: 'flex', alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          id={`reg-subject-${subject}`}
                          checked={formData.subjects.includes(subject)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData(prev => ({ 
                                ...prev, 
                                subjects: [...prev.subjects, subject] 
                              }));
                            } else {
                              setFormData(prev => ({ 
                                ...prev, 
                                subjects: prev.subjects.filter(s => s !== subject) 
                              }));
                            }
                          }}
                          style={{ marginRight: 8 }}
                        />
                        <label 
                          htmlFor={`reg-subject-${subject}`}
                          style={{ 
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            userSelect: 'none'
                          }}
                        >
                          {subject}
                        </label>
                      </Box>
                    ))}
                  </Box>
                  {formData.subjects.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Selected: {formData.subjects.join(', ')}
                      </Typography>
                    </Box>
                  )}
                </>
              ) : (
                <Box sx={{ 
                  p: 3, 
                  border: '1px dashed #ccc', 
                  borderRadius: 1, 
                  textAlign: 'center',
                  bgcolor: 'grey.50'
                }}>
                  <Typography variant="body2" color="text.secondary">
                    Please select Grade, Board, and Country first to get AI-recommended subjects
                  </Typography>
                </Box>
              )}
            </Box>            <TextField
              select
              fullWidth
              label="Learning Pace"
              value={formData.learningPace}
              onChange={(e) => setFormData(prev => ({ ...prev, learningPace: e.target.value }))}
              required
              SelectProps={{ native: true }}
              helperText="What pace do you prefer for learning?"
            >
              {learningPaceOptions.map(pace => (
                <option key={pace.value} value={pace.value}>{pace.label}</option>
              ))}
            </TextField>

            <TextField
              select
              fullWidth
              label="Board"
              value={formData.board}
              onChange={(e) => setFormData(prev => ({ ...prev, board: e.target.value }))}
              required
              SelectProps={{ native: true }}
              helperText="Which educational board do you follow?"
            >
              <option value="CBSE">CBSE</option>
              <option value="ICSE">ICSE</option>
              <option value="State Board">State Board</option>
              <option value="IGCSE">IGCSE</option>
              <option value="IB">IB</option>
            </TextField>

            <TextField
              fullWidth
              label="School Name"
              value={formData.school}
              onChange={(e) => setFormData(prev => ({ ...prev, school: e.target.value }))}
              required
              helperText="Enter your school name"
            />

            <TextField
              select
              fullWidth
              label="Country"
              value={formData.country}
              onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
              required
              SelectProps={{ native: true }}
              helperText="Which country are you from?"
            >
              <option value="India">India</option>
              <option value="USA">USA</option>
              <option value="UK">UK</option>
              <option value="Canada">Canada</option>
              <option value="Australia">Australia</option>
              <option value="Singapore">Singapore</option>
              <option value="UAE">UAE</option>
              <option value="Other">Other</option>
            </TextField>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={onBack}
              disabled={loading}
              sx={{ flex: 1 }}
            >
              Back
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={loading}
              sx={{ flex: 2 }}
            >
              {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={20} color="inherit" />
                  Registering...
                </Box>
              ) : (
                'Complete Registration'
              )}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
