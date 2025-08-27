'use client';

import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Container,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  School as SchoolIcon,
  ExitToApp as LogoutIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';

export default function StudentNavigation() {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('currentStudent');
    router.push('/student/login');
  };

  return (
    <AppBar position="static" elevation={1}>
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          {/* Logo/Title */}
          <Box display="flex" alignItems="center" sx={{ flexGrow: 1 }}>
            <SchoolIcon sx={{ mr: 2 }} />
            <Typography
              variant="h6"
              noWrap
              component="div"
              sx={{
                fontWeight: 700,
                letterSpacing: '.1rem',
                color: 'inherit',
                textDecoration: 'none',
              }}
            >
              🎓 Student Portal
            </Typography>
          </Box>

          {/* Right side actions */}
          <Box display="flex" alignItems="center" gap={1}>
            <Tooltip title="Logout">
              <IconButton color="inherit" onClick={handleLogout}>
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
