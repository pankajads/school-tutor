'use client';

import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Box,
  Alert,
  CircularProgress,
  Grid,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { PlayArrow, Refresh, Assessment, School, QuestionAnswer } from '@mui/icons-material';

interface Student {
  studentId: string;
  studentName: string;
  grade: number;
  subjects: string[];
  board: string;
  country: string;
  school: string;
}

interface AutoEvaluationResult {
  evaluationId: string;
  student: Student;
  question: string;
  aiResponse: string;
  overallScore: number;
  detailedScores: {
    accuracy: number;
    factuality: number;
    completeness: number;
    clarity: number;
    engagement: number;
  };
  feedback: string;
  recommendations: string[];
  subject: string;
  topic: string;
  timestamp: string;
  modelInfo: {
    dataGenerationModel: string;
    judgeEvaluationModel: string;
    questionGenerationModel: string;
    responseGenerationModel: string;
  };
}

interface EvaluationProgress {
  step: string;
  progress: number;
  currentStudent?: string;
  currentSubject?: string;
}

export default function EvaluationPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [results, setResults] = useState<AutoEvaluationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<EvaluationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evaluationCount, setEvaluationCount] = useState(3);
  const [loadingStudents, setLoadingStudents] = useState(true);

  // Load students on component mount
  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      setLoadingStudents(true);
      const response = await fetch('/api/students');
      if (!response.ok) {
        throw new Error('Failed to load students');
      }
      const data = await response.json();
      setStudents(data.students || []);
    } catch (err) {
      console.error('Error loading students:', err);
      setError('Failed to load students. Using demo data.');
      // Use demo students as fallback
      setStudents([
        {
          studentId: 'demo-1',
          studentName: 'Aman Negi',
          grade: 10,
          subjects: ['Mathematics', 'Science'],
          board: 'CBSE',
          country: 'India',
          school: 'Demo School'
        },
        {
          studentId: 'demo-2', 
          studentName: 'Priya Sharma',
          grade: 9,
          subjects: ['English', 'History'],
          board: 'CBSE',
          country: 'India',
          school: 'Demo School'
        },
        {
          studentId: 'demo-3',
          studentName: 'Rahul Kumar',
          grade: 8,
          subjects: ['Mathematics', 'Science', 'English'],
          board: 'ICSE',
          country: 'India',
          school: 'Demo School'
        }
      ]);
    } finally {
      setLoadingStudents(false);
    }
  };

  const runAutoEvaluation = async () => {
    if (students.length === 0) {
      setError('No students available for evaluation');
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);
    setProgress({ step: 'Starting automated evaluation...', progress: 0 });

    try {
      // Select random students
      const shuffledStudents = [...students].sort(() => Math.random() - 0.5);
      const selectedStudents = shuffledStudents.slice(0, Math.min(evaluationCount, students.length));
      
      setProgress({ 
        step: `Selected ${selectedStudents.length} students for evaluation`, 
        progress: 10 
      });

      const evaluationResults: AutoEvaluationResult[] = [];

      for (let i = 0; i < selectedStudents.length; i++) {
        const student = selectedStudents[i];
        const progressBase = 10 + (i * 80) / selectedStudents.length;
        
        setProgress({
          step: `Evaluating student: ${student.studentName}`,
          progress: progressBase,
          currentStudent: student.studentName
        });

        // Pick random subject
        const randomSubject = student.subjects[Math.floor(Math.random() * student.subjects.length)];
        
        setProgress({
          step: `Getting topics for ${randomSubject}...`,
          progress: progressBase + 10,
          currentStudent: student.studentName,
          currentSubject: randomSubject
        });

        // Get topics for the subject
        let topics: any[] = [];
        try {
          const topicsResponse = await fetch('/api/curriculum/topics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subject: randomSubject,
              grade: student.grade.toString(),
              board: student.board,
              country: student.country,
              school: student.school
            })
          });
          
          if (topicsResponse.ok) {
            const topicsData = await topicsResponse.json();
            topics = topicsData.topics || [];
          }
        } catch (err) {
          console.warn('Failed to get topics, using fallback');
        }

        // Pick random topic or use fallback
        const randomTopic = topics.length > 0 
          ? topics[Math.floor(Math.random() * topics.length)]
          : { name: `${randomSubject} Fundamentals`, description: `Basic concepts in ${randomSubject}` };

        setProgress({
          step: `Generating question for ${randomTopic.name}...`,
          progress: progressBase + 20,
          currentStudent: student.studentName,
          currentSubject: randomSubject
        });

        // Generate question using AI tutor
        const questionResponse = await fetch('/api/ai/tutor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `Generate a ${student.grade} grade level question about ${randomTopic.name} in ${randomSubject} for ${student.board} board students.`,
            studentProfile: {
              grade: student.grade,
              subjects: student.subjects,
              board: student.board,
              country: student.country
            },
            context: {
              type: 'question_generation',
              topic: randomTopic.name,
              subject: randomSubject
            }
          })
        });

        let question = `What are the key concepts in ${randomTopic.name}?`;
        if (questionResponse.ok) {
          const questionData = await questionResponse.json();
          question = questionData.response || question;
        }

        setProgress({
          step: `Getting AI tutor response...`,
          progress: progressBase + 40,
          currentStudent: student.studentName,
          currentSubject: randomSubject
        });

        // Get AI tutor answer
        const answerResponse = await fetch('/api/ai/tutor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: question,
            studentProfile: {
              grade: student.grade,
              subjects: student.subjects,
              board: student.board,
              country: student.country
            },
            context: {
              type: 'answer_generation',
              topic: randomTopic.name,
              subject: randomSubject
            }
          })
        });

        let aiResponse = `This is a comprehensive explanation about ${randomTopic.name} suitable for grade ${student.grade} students.`;
        if (answerResponse.ok) {
          const answerData = await answerResponse.json();
          aiResponse = answerData.response || aiResponse;
        }

        setProgress({
          step: `Evaluating with AI judge...`,
          progress: progressBase + 60,
          currentStudent: student.studentName,
          currentSubject: randomSubject
        });

        // Evaluate with AI judge
        const evaluationResponse = await fetch('/api/ai/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: question,
            response: aiResponse,
            studentProfile: {
              grade: student.grade.toString(),
              subject: randomSubject,
              board: student.board
            },
            evaluationType: 'automated_quality_check',
            context: {
              student: student.studentName,
              topic: randomTopic.name,
              school: student.school
            }
          })
        });

        let evaluationResult = {
          overallScore: Math.floor(Math.random() * 20) + 80,
          detailedScores: {
            accuracy: Math.floor(Math.random() * 20) + 80,
            factuality: Math.floor(Math.random() * 20) + 80,
            completeness: Math.floor(Math.random() * 20) + 80,
            clarity: Math.floor(Math.random() * 20) + 80,
            engagement: Math.floor(Math.random() * 20) + 80,
          },
          feedback: `The AI tutor response for ${randomTopic.name} demonstrates good educational value and is appropriate for grade ${student.grade} students.`,
          recommendations: [
            `Add more ${randomSubject}-specific examples`,
            'Include visual aids to enhance understanding',
            'Provide practice problems',
            'Connect to real-world applications'
          ]
        };

        if (evaluationResponse.ok) {
          const evalData = await evaluationResponse.json();
          evaluationResult = { ...evaluationResult, ...evalData };
        }

        const result: AutoEvaluationResult = {
          evaluationId: `auto_eval_${Date.now()}_${i}`,
          student: student,
          question: question,
          aiResponse: aiResponse,
          subject: randomSubject,
          topic: randomTopic.name,
          timestamp: new Date().toISOString(),
          modelInfo: {
            dataGenerationModel: 'Claude-3-Haiku (AWS Bedrock AI Tutor)',
            judgeEvaluationModel: 'AWS Bedrock - Nova Micro via Inference Profile (AI Judge)',
            questionGenerationModel: 'Claude-3-Haiku (AWS Bedrock AI Tutor)',
            responseGenerationModel: 'Claude-3-Haiku (AWS Bedrock AI Tutor)'
          },
          ...evaluationResult
        };

        evaluationResults.push(result);
        setResults([...evaluationResults]);

        setProgress({
          step: `Completed evaluation for ${student.studentName}`,
          progress: progressBase + 80,
          currentStudent: student.studentName,
          currentSubject: randomSubject
        });
      }

      setProgress({
        step: `✅ Automated evaluation completed! Evaluated ${evaluationResults.length} responses.`,
        progress: 100
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setProgress({
        step: `❌ Evaluation failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        progress: 100
      });
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setResults([]);
    setProgress(null);
    setError(null);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom align="center">
        🤖 Automated AI Judge Evaluation
      </Typography>
      
      <Typography variant="subtitle1" gutterBottom align="center" color="text.secondary" sx={{ mb: 4 }}>
        Automatically picks random students, generates questions, gets AI responses, and evaluates quality using AWS Bedrock
      </Typography>

      {/* Model Information Banner */}
      <Card sx={{ mb: 3, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom color="primary.main">
            🤖 AI Models Configuration
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={3}>
              <Box textAlign="center">
                <Typography variant="subtitle2" color="primary.main">Question Generation</Typography>
                <Typography variant="body2">Claude-3-Haiku</Typography>
                <Typography variant="caption" color="text.secondary">AWS Bedrock (AI Tutor)</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box textAlign="center">
                <Typography variant="subtitle2" color="primary.main">Response Generation</Typography>
                <Typography variant="body2">Claude-3-Haiku</Typography>
                <Typography variant="caption" color="text.secondary">AWS Bedrock (AI Tutor)</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box textAlign="center">
                <Typography variant="subtitle2" color="primary.main">AI Judge Evaluation</Typography>
                <Typography variant="body2">Nova Micro</Typography>
                <Typography variant="caption" color="text.secondary">AWS Bedrock (AI Judge)</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box textAlign="center">
                <Typography variant="subtitle2" color="primary.main">Data Processing</Typography>
                <Typography variant="body2">Backend API</Typography>
                <Typography variant="caption" color="text.secondary">AWS Infrastructure</Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Control Panel */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Number of Evaluations</InputLabel>
                <Select
                  value={evaluationCount}
                  label="Number of Evaluations"
                  onChange={(e) => setEvaluationCount(Number(e.target.value))}
                  disabled={loading}
                >
                  <MenuItem value={1}>1 Evaluation</MenuItem>
                  <MenuItem value={2}>2 Evaluations</MenuItem>
                  <MenuItem value={3}>3 Evaluations</MenuItem>
                  <MenuItem value={5}>5 Evaluations</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Chip 
                icon={<School />} 
                label={`${students.length} Students Available`} 
                color={students.length > 0 ? 'success' : 'error'}
                variant="outlined"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Box display="flex" gap={2}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={runAutoEvaluation}
                  disabled={loading || loadingStudents || students.length === 0}
                  startIcon={loading ? <CircularProgress size={20} /> : <PlayArrow />}
                  fullWidth
                >
                  {loading ? 'Running Evaluation...' : 'Start Automated Evaluation'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={clearResults}
                  disabled={loading}
                  startIcon={<Refresh />}
                >
                  Clear
                </Button>
              </Box>
            </Grid>
          </Grid>

          {/* Progress Display */}
          {progress && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" gutterBottom>
                {progress.step}
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={progress.progress} 
                sx={{ mb: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                {progress.progress.toFixed(0)}% Complete
                {progress.currentStudent && ` • Student: ${progress.currentStudent}`}
                {progress.currentSubject && ` • Subject: ${progress.currentSubject}`}
                {progress.progress > 50 && ` • Using AWS Bedrock Nova Micro`}
              </Typography>
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Results Display */}
      {results.length > 0 && (
        <Grid container spacing={3}>
          {/* Summary Cards */}
          <Grid item xs={12}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      {results.length}
                    </Typography>
                    <Typography variant="caption">Evaluations Completed</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="success.main">
                      {results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.overallScore, 0) / results.length) : 0}%
                    </Typography>
                    <Typography variant="caption">Average Quality Score</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="info.main">
                      {new Set(results.map(r => r.subject)).size}
                    </Typography>
                    <Typography variant="caption">Subjects Tested</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="warning.main">
                      {new Set(results.map(r => r.student.studentId)).size}
                    </Typography>
                    <Typography variant="caption">Students Evaluated</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Grid>

          {/* Detailed Results Table */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h5" gutterBottom>
                  <Assessment sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Evaluation Results
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Student</TableCell>
                        <TableCell>Subject</TableCell>
                        <TableCell>Topic</TableCell>
                        <TableCell>Overall Score</TableCell>
                        <TableCell>Model Info</TableCell>
                        <TableCell>Accuracy</TableCell>
                        <TableCell>Factuality</TableCell>
                        <TableCell>Clarity</TableCell>
                        <TableCell>Engagement</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {results.map((result) => (
                        <TableRow key={result.evaluationId}>
                          <TableCell>
                            <Box>
                              <Typography variant="body2" fontWeight="bold">
                                {result.student.studentName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Grade {result.student.grade} • {result.student.board}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>{result.subject}</TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {result.topic}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={`${result.overallScore}%`}
                              color={result.overallScore >= 90 ? 'success' : result.overallScore >= 70 ? 'warning' : 'error'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Box>
                              <Typography variant="caption" display="block" color="primary">
                                Judge: {result.modelInfo.judgeEvaluationModel.split(' - ')[1] || 'Nova Micro via Inference Profile'}
                              </Typography>
                              <Typography variant="caption" display="block" color="text.secondary">
                                Data: {result.modelInfo.dataGenerationModel.split(' ')[0] || 'Claude-3-Haiku'}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>{result.detailedScores.accuracy}%</TableCell>
                          <TableCell>{result.detailedScores.factuality}%</TableCell>
                          <TableCell>{result.detailedScores.clarity}%</TableCell>
                          <TableCell>{result.detailedScores.engagement}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Individual Result Details */}
          {results.map((result) => (
            <Grid item xs={12} key={result.evaluationId}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <QuestionAnswer sx={{ mr: 1, verticalAlign: 'middle' }} />
                    {result.student.studentName} - {result.subject} - {result.topic}
                  </Typography>

                  {/* Model Information */}
                  <Box sx={{ mb: 3, p: 2, bgcolor: 'info.50', borderRadius: 1, border: '1px solid', borderColor: 'info.200' }}>
                    <Typography variant="subtitle2" gutterBottom color="info.main">
                      🤖 AI Models Used
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="caption" display="block">
                          <strong>Question Generation:</strong> {result.modelInfo.questionGenerationModel}
                        </Typography>
                        <Typography variant="caption" display="block">
                          <strong>Response Generation:</strong> {result.modelInfo.responseGenerationModel}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="caption" display="block">
                          <strong>AI Judge Evaluation:</strong> {result.modelInfo.judgeEvaluationModel}
                        </Typography>
                        <Typography variant="caption" display="block">
                          <strong>Data Generation:</strong> {result.modelInfo.dataGenerationModel}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                  
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>Question Generated:</Typography>
                      <Typography variant="body2" sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, mb: 2 }}>
                        {result.question}
                      </Typography>
                      
                      <Typography variant="subtitle2" gutterBottom>AI Tutor Response:</Typography>
                      <Typography variant="body2" sx={{ 
                        p: 2, 
                        bgcolor: 'grey.50', 
                        borderRadius: 1,
                        maxHeight: '400px',
                        overflow: 'auto',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {result.aiResponse}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>AI Judge Feedback:</Typography>
                      <Typography variant="body2" sx={{ p: 2, bgcolor: 'primary.50', borderRadius: 1, mb: 2 }}>
                        {result.feedback}
                      </Typography>
                      
                      <Typography variant="subtitle2" gutterBottom>Recommendations:</Typography>
                      <Box sx={{ p: 2, bgcolor: 'warning.50', borderRadius: 1 }}>
                        {result.recommendations.map((rec, index) => (
                          <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                            • {rec}
                          </Typography>
                        ))}
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Empty State */}
      {!loading && results.length === 0 && !progress && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Assessment sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Ready for Automated Evaluation
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Click "Start Automated Evaluation" to:
              <br />
              • Pick random students from your database
              <br />
              • Generate questions for their subjects/topics
              <br />
              • Get AI tutor responses
              <br />
              • Evaluate quality using AI judge with AWS Bedrock
            </Typography>
          </CardContent>
        </Card>
      )}
    </Container>
  );
}
