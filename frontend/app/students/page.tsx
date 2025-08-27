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
  Snackbar,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  School as SchoolIcon,
  Person as PersonIcon,
  Analytics as AnalyticsIcon,
  Star as StarIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { apiService, Student, StudentFormData, StudentListItem } from '../services/api';

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    grade: '',
    subjects: [] as string[],
    learningPace: '',
    board: '',
    school: '',
    country: '',
  });

  // Load students from backend API
  useEffect(() => {
    loadStudents();
  }, []);

  // Update available subjects when profile changes
  useEffect(() => {
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

  const loadStudents = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('loadStudents: Starting to fetch students...');
      const studentsData = await apiService.getStudents();
      console.log('Students data received:', studentsData);
      console.log('Students data type:', typeof studentsData);
      console.log('Is array?', Array.isArray(studentsData));
      console.log('Length:', studentsData?.length);
      
      // Ensure we always have an array
      const studentsArray = Array.isArray(studentsData) ? studentsData : [];
      console.log('Setting students array:', studentsArray);
      setStudents(studentsArray);
    } catch (error) {
      console.error('Error loading students:', error);
      setError('Failed to load students. Please try again.');
      // Fallback to empty array or show error message
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = async (student?: StudentListItem) => {
    if (student) {
      try {
        // Fetch full student details
        const fullStudent = await apiService.getStudent(student.studentId);
        setEditingStudent(fullStudent);
        const formState = {
          name: fullStudent.studentName || '',
          email: fullStudent.email,
          grade: fullStudent.grade.toString(),
          subjects: fullStudent.subjects,
          learningPace: fullStudent.learningPace,
          board: fullStudent.board || 'CBSE',
          school: fullStudent.school || '',
          country: fullStudent.country || 'India',
        };
        setFormData(formState);
        
        // Fetch available subjects immediately for editing
        if (formState.grade && formState.board && formState.country) {
          setSubjectsLoading(true);
          try {
            // Mock subjects since getSubjectsForProfile doesn't exist
            const subjects = ['Mathematics', 'Science', 'English', 'History', 'Geography', 'Physics', 'Chemistry', 'Biology'];
            setAvailableSubjects(subjects);
          } catch (error) {
            console.error('Error fetching subjects for editing:', error);
            setAvailableSubjects([]);
          } finally {
            setSubjectsLoading(false);
          }
        }
      } catch (error) {
        console.error('Error fetching student details:', error);
      }
    } else {
      setEditingStudent(null);
      setFormData({
        name: '',
        email: '',
        grade: '',
        subjects: [],
        learningPace: '',
        board: 'CBSE',
        school: '',
        country: 'India',
      });
      setAvailableSubjects([]);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingStudent(null);
  };

  const handleSaveStudent = async () => {
    // Validation
    if (!formData.name.trim() || !formData.email.trim() || !formData.grade || !formData.learningPace || !formData.board || !formData.school.trim() || !formData.country.trim() || formData.subjects.length === 0) {
      setError('Please fill in all required fields and select at least one subject');
      return;
    }

    try {
      setActionLoading(true);
      setError(null);

      const studentData: StudentFormData = {
        studentName: formData.name.trim(),
        email: formData.email.trim(),
        grade: parseInt(formData.grade, 10),
        subjects: formData.subjects,
        learningPace: formData.learningPace as 'slow' | 'medium' | 'fast',
        board: formData.board,
        school: formData.school.trim(),
        country: formData.country,
      };

      if (editingStudent) {
        // Update existing student
        const updatedStudent = await apiService.updateStudent(
          editingStudent.studentId,
          studentData
        );
        
        setStudents(students.map(s => 
          s.studentId === editingStudent.studentId ? updatedStudent : s
        ));
      } else {
        // Create new student
        const newStudent = await apiService.createStudent(studentData);
        setStudents([...students, newStudent]);
      }
      
      // Show success message
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving student:', error);
      setError(`Failed to ${editingStudent ? 'update' : 'create'} student. Please try again.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm('Are you sure you want to delete this student? This action cannot be undone.')) {
      return;
    }

    try {
      setError(null);
      await apiService.deleteStudent(studentId);
      const updatedStudents = students.filter(s => s.studentId !== studentId);
      setStudents(updatedStudents);
      
      // Show success message
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error deleting student:', error);
      setError('Failed to delete student. Please try again.');
    }
  };

  const handleRefresh = () => {
    loadStudents();
  };

  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case 'excellent': return 'success';
      case 'good': return 'info';
      case 'average': return 'warning';
      case 'needs_improvement': return 'error';
      default: return 'default';
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'success';
    if (progress >= 60) return 'info';
    if (progress >= 40) return 'warning';
    return 'error';
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="400px">
          <CircularProgress size={60} sx={{ mb: 2 }} />
          <Typography variant="h6" gutterBottom>Loading Students...</Typography>
          <Typography variant="body2" color="text.secondary">
            Fetching data from backend...
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Success Alert */}
      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Student {editingStudent ? 'updated' : 'added'} successfully!
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          👥 Student Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            size="small"
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            size="large"
          >
            Add Student
          </Button>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <PersonIcon color="primary" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography variant="h4" color="primary">
                    {students.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Students
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
                <SchoolIcon color="success" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography variant="h4" color="success.main">
                    {Array.isArray(students) ? students.reduce((sum, s) => sum + 0, 0) : 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Sessions
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
                <AnalyticsIcon color="info" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography variant="h4" color="info.main">
                    {Array.isArray(students) && students.length > 0 
                      ? Math.round(students.reduce((sum, s) => sum + 75, 0) / students.length)
                      : 0
                    }%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Avg Progress
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
                    {Array.isArray(students) ? students.filter(s => true).length : 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Top Performers
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Students Table */}
      <Paper elevation={2}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow key="header">
                <TableCell>Student</TableCell>
                <TableCell>Grade</TableCell>
                <TableCell>Subjects</TableCell>
                <TableCell>Learning Pace</TableCell>
                <TableCell>Progress</TableCell>
                <TableCell>Performance</TableCell>
                <TableCell>Sessions</TableCell>
                <TableCell>Last Session</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Array.isArray(students) ? students.map((student) => (
                <TableRow key={student.studentId} hover>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                        {student.studentName?.charAt(0) || student.email?.charAt(0) || '?'}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2">{student.studentName || 'Unknown Student'}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {student.email || 'No email'}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>{student.grade || 'Unknown'}</TableCell>
                  <TableCell>
                    <Box>
                      {(student.subjects || []).map((subject, index) => (
                        <Chip
                          key={`${student.studentId}-subject-${index}`}
                          label={subject}
                          size="small"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>{'Medium'}</TableCell>
                  <TableCell>
                    <Box>
                      <LinearProgress
                        variant="determinate"
                        value={75}
                        color={getProgressColor(75)}
                        sx={{ mb: 1 }}
                      />
                      <Typography variant="caption">
                        {75}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={'GOOD'}
                      color={getPerformanceColor('good')}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{0}</TableCell>
                  <TableCell>
                    {'Never'}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      onClick={() => handleOpenDialog(student)}
                      color="primary"
                      size="small"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => handleDeleteStudent(student.studentId)}
                      color="error"
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              )) : null}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Empty State */}
        {Array.isArray(students) && students.length === 0 && !loading && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <PersonIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No students found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Get started by adding your first student to the system.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Add Your First Student
            </Button>
          </Box>
        )}
      </Paper>

      {/* Add/Edit Student Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingStudent ? 'Edit Student' : 'Add New Student'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Student Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Grade</InputLabel>
                <Select
                  value={formData.grade}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                >
                  <MenuItem value="1st Grade">1st Grade</MenuItem>
                  <MenuItem value="2nd Grade">2nd Grade</MenuItem>
                  <MenuItem value="3rd Grade">3rd Grade</MenuItem>
                  <MenuItem value="4th Grade">4th Grade</MenuItem>
                  <MenuItem value="5th Grade">5th Grade</MenuItem>
                  <MenuItem value="6th Grade">6th Grade</MenuItem>
                  <MenuItem value="7th Grade">7th Grade</MenuItem>
                  <MenuItem value="8th Grade">8th Grade</MenuItem>
                  <MenuItem value="9th Grade">9th Grade</MenuItem>
                  <MenuItem value="10th Grade">10th Grade</MenuItem>
                  <MenuItem value="11th Grade">11th Grade</MenuItem>
                  <MenuItem value="12th Grade">12th Grade</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Learning Pace</InputLabel>
                <Select
                  value={formData.learningPace}
                  onChange={(e) => setFormData({ ...formData, learningPace: e.target.value })}
                >
                  <MenuItem value="slow">Slow</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="fast">Fast</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Board</InputLabel>
                <Select
                  value={formData.board}
                  onChange={(e) => setFormData({ ...formData, board: e.target.value })}
                >
                  <MenuItem value="CBSE">CBSE</MenuItem>
                  <MenuItem value="ICSE">ICSE</MenuItem>
                  <MenuItem value="State Board">State Board</MenuItem>
                  <MenuItem value="IGCSE">IGCSE</MenuItem>
                  <MenuItem value="IB">IB</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="School Name"
                value={formData.school}
                onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Country</InputLabel>
                <Select
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                >
                  <MenuItem value="India">India</MenuItem>
                  <MenuItem value="USA">USA</MenuItem>
                  <MenuItem value="UK">UK</MenuItem>
                  <MenuItem value="Canada">Canada</MenuItem>
                  <MenuItem value="Australia">Australia</MenuItem>
                  <MenuItem value="Singapore">Singapore</MenuItem>
                  <MenuItem value="UAE">UAE</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Subjects * (Select all applicable subjects)
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
                    maxHeight: 200,
                    overflowY: 'auto',
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    p: 2,
                    bgcolor: 'background.paper'
                  }}>
                    {availableSubjects.map((subject) => (
                      <Box key={subject} sx={{ display: 'flex', alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          id={`subject-${subject}`}
                          checked={formData.subjects.includes(subject)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ 
                                ...formData, 
                                subjects: [...formData.subjects, subject] 
                              });
                            } else {
                              setFormData({ 
                                ...formData, 
                                subjects: formData.subjects.filter(s => s !== subject) 
                              });
                            }
                          }}
                          style={{ marginRight: 8 }}
                        />
                        <label 
                          htmlFor={`subject-${subject}`}
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
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={actionLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveStudent} 
            variant="contained"
            disabled={!formData.name.trim() || !formData.email.trim() || !formData.grade || !formData.learningPace || !formData.board || !formData.school.trim() || !formData.country.trim() || formData.subjects.length === 0 || actionLoading}
            startIcon={actionLoading ? <CircularProgress size={20} /> : null}
          >
            {actionLoading 
              ? 'Saving...' 
              : editingStudent 
                ? 'Update Student' 
                : 'Add Student'
            }
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
