'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Collapse,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  Button,
  Alert,
  AlertTitle
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Clear as ClearIcon,
  Download as DownloadIcon,
  BugReport as BugReportIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon
} from '@mui/icons-material';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'error' | 'warning' | 'info' | 'debug';
  message: string;
  details?: any;
  source?: string;
  stack?: string;
}

interface ErrorLoggerProps {
  maxEntries?: number;
  showInProduction?: boolean;
  position?: 'fixed' | 'relative';
}

let loggerInstance: ErrorLogger | null = null;

export class ErrorLogger {
  private logs: LogEntry[] = [];
  private listeners: ((logs: LogEntry[]) => void)[] = [];
  private originalConsole: any = {};

  constructor() {
    if (typeof window !== 'undefined') {
      this.setupConsoleInterception();
      this.setupErrorHandlers();
    }
  }

  static getInstance(): ErrorLogger {
    if (!loggerInstance) {
      loggerInstance = new ErrorLogger();
    }
    return loggerInstance;
  }

  private setupConsoleInterception() {
    // Store original console methods
    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug
    };

    // Intercept console methods
    console.error = (...args) => {
      this.originalConsole.error(...args);
      this.addLog('error', this.formatMessage(args), args.length > 1 ? args : args[0]);
    };

    console.warn = (...args) => {
      this.originalConsole.warn(...args);
      this.addLog('warning', this.formatMessage(args), args.length > 1 ? args : args[0]);
    };

    console.info = (...args) => {
      this.originalConsole.info(...args);
      this.addLog('info', this.formatMessage(args), args.length > 1 ? args : args[0]);
    };

    console.log = (...args) => {
      this.originalConsole.log(...args);
      // Only log errors and important messages to avoid spam
      const message = this.formatMessage(args);
      if (message.includes('❌') || message.includes('⚠️') || message.includes('💥') || message.includes('🚨')) {
        this.addLog('info', message, args.length > 1 ? args : args[0]);
      }
    };
  }

  private setupErrorHandlers() {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.addLog('error', `Global Error: ${event.message}`, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      }, event.error?.stack);
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.addLog('error', `Unhandled Promise Rejection: ${event.reason}`, {
        reason: event.reason,
        promise: event.promise
      });
    });
  }

  private formatMessage(args: any[]): string {
    return args.map(arg => {
      if (typeof arg === 'string') return arg;
      if (typeof arg === 'object') return JSON.stringify(arg, null, 2);
      return String(arg);
    }).join(' ');
  }

  addLog(level: LogEntry['level'], message: string, details?: any, stack?: string, source?: string) {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      message,
      details,
      stack,
      source
    };

    this.logs.unshift(entry); // Add to beginning
    
    // Keep only latest entries
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(0, 1000);
    }

    this.notifyListeners();
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
    this.notifyListeners();
  }

  subscribe(listener: (logs: LogEntry[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener([...this.logs]));
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

const ErrorLoggerComponent: React.FC<ErrorLoggerProps> = ({
  maxEntries = 100,
  showInProduction = false,
  position = 'fixed'
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const loggerRef = useRef<ErrorLogger>();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Don't show in production unless explicitly enabled
    if (process.env.NODE_ENV === 'production' && !showInProduction) {
      return;
    }

    loggerRef.current = ErrorLogger.getInstance();
    
    const unsubscribe = loggerRef.current.subscribe((newLogs) => {
      // Use a timeout to avoid setState during render
      setTimeout(() => {
        setLogs(newLogs.slice(0, maxEntries));
        
        // Auto-show if there are new errors
        const hasNewErrors = newLogs.some(log => 
          log.level === 'error' && 
          Date.now() - log.timestamp.getTime() < 5000 // Last 5 seconds
        );
        
        if (hasNewErrors) {
          setIsVisible(true);
        }
      }, 0);
    });

    // Initial load with timeout to avoid setState during render
    setTimeout(() => {
      if (loggerRef.current) {
        setLogs(loggerRef.current.getLogs().slice(0, maxEntries));
        // Only show initially if there are errors
        const initialLogs = loggerRef.current.getLogs();
        const hasErrors = initialLogs.some(log => log.level === 'error');
        if (hasErrors) {
          setIsVisible(true);
        }
      }
    }, 0);

    return unsubscribe;
  }, [maxEntries, showInProduction]);

  const handleClear = () => {
    loggerRef.current?.clearLogs();
  };

  const handleExport = () => {
    if (!loggerRef.current) return;
    
    const data = loggerRef.current.exportLogs();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-logs-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return <ErrorIcon color="error" />;
      case 'warning': return <WarningIcon color="warning" />;
      case 'info': return <InfoIcon color="info" />;
      case 'debug': return <BugReportIcon color="action" />;
      default: return <InfoIcon />;
    }
  };

  const getSeverityColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      case 'debug': return 'default';
      default: return 'default';
    }
  };

  if (!isVisible || logs.length === 0) {
    return null;
  }

  const errorCount = logs.filter(log => log.level === 'error').length;
  const warningCount = logs.filter(log => log.level === 'warning').length;

  return (
    <Paper 
      elevation={3}
      sx={{
        position,
        bottom: position === 'fixed' ? 16 : undefined,
        right: position === 'fixed' ? 16 : undefined,
        width: position === 'fixed' ? 400 : '100%',
        maxHeight: position === 'fixed' ? '60vh' : '400px',
        zIndex: 1300,
        border: '1px solid',
        borderColor: errorCount > 0 ? 'error.main' : warningCount > 0 ? 'warning.main' : 'grey.300'
      }}
    >
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          p: 1, 
          bgcolor: errorCount > 0 ? 'error.light' : warningCount > 0 ? 'warning.light' : 'grey.100',
          cursor: 'pointer'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <BugReportIcon sx={{ mr: 1 }} />
        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
          Error Logger ({logs.length} entries)
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 0.5, mr: 1 }}>
          {errorCount > 0 && (
            <Chip 
              label={`${errorCount} errors`} 
              size="small" 
              color="error" 
              variant="outlined"
            />
          )}
          {warningCount > 0 && (
            <Chip 
              label={`${warningCount} warnings`} 
              size="small" 
              color="warning" 
              variant="outlined"
            />
          )}
        </Box>

        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setIsVisible(false); }}>
          <ClearIcon fontSize="small" />
        </IconButton>
        
        <IconButton size="small">
          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={isExpanded}>
        <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
          {logs.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography color="text.secondary">No logs yet</Typography>
            </Box>
          ) : (
            <List dense>
              {logs.map((log, index) => (
                <React.Fragment key={log.id}>
                  <ListItem alignItems="flex-start">
                    <Box sx={{ display: 'flex', width: '100%', flexDirection: 'column' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        {getIcon(log.level)}
                        <Chip 
                          label={log.level.toUpperCase()} 
                          size="small" 
                          color={getSeverityColor(log.level) as any}
                          sx={{ ml: 1, mr: 1 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {log.timestamp.toLocaleTimeString()}
                        </Typography>
                      </Box>
                      
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          wordBreak: 'break-word',
                          fontFamily: 'monospace',
                          fontSize: '0.75rem'
                        }}
                      >
                        {log.message}
                      </Typography>
                      
                      {log.details && (
                        <Box 
                          sx={{ 
                            mt: 0.5, 
                            p: 1, 
                            bgcolor: 'grey.50', 
                            borderRadius: 1,
                            fontSize: '0.7rem',
                            fontFamily: 'monospace',
                            maxHeight: 100,
                            overflow: 'auto'
                          }}
                        >
                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                            {typeof log.details === 'string' 
                              ? log.details 
                              : JSON.stringify(log.details, null, 2)}
                          </pre>
                        </Box>
                      )}
                      
                      {log.stack && (
                        <Box 
                          sx={{ 
                            mt: 0.5, 
                            p: 1, 
                            bgcolor: 'error.light', 
                            borderRadius: 1,
                            fontSize: '0.6rem',
                            fontFamily: 'monospace',
                            maxHeight: 80,
                            overflow: 'auto'
                          }}
                        >
                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                            {log.stack}
                          </pre>
                        </Box>
                      )}
                    </Box>
                  </ListItem>
                  {index < logs.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>
        
        <Box sx={{ p: 1, display: 'flex', gap: 1, borderTop: 1, borderColor: 'divider' }}>
          <Button 
            size="small" 
            variant="outlined" 
            onClick={handleClear}
            disabled={logs.length === 0}
          >
            Clear
          </Button>
          <Button 
            size="small" 
            variant="outlined" 
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            disabled={logs.length === 0}
          >
            Export
          </Button>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default ErrorLoggerComponent;
