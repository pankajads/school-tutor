'use client';

import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Container,
  IconButton,
  Badge,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Home as HomeIcon,
  Dashboard as DashboardIcon,
  Analytics as AnalyticsIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
  School as SchoolIcon,
  TrendingUp as ProgressIcon,
  AdminPanelSettings as AdminIcon,
  PersonOutline as StudentIcon,
  Login as LoginIcon,
} from '@mui/icons-material';
import { useRouter, usePathname } from 'next/navigation';

export default function Navigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [settingsAnchorEl, setSettingsAnchorEl] = useState<null | HTMLElement>(null);

  const handleSettingsClick = (event: React.MouseEvent<HTMLElement>) => {
    setSettingsAnchorEl(event.currentTarget);
  };

  const handleSettingsClose = () => {
    setSettingsAnchorEl(null);
  };

  const handleAdminMode = () => {
    handleSettingsClose();
    // Already in admin mode, just close menu
  };

  const handleStudentMode = () => {
    handleSettingsClose();
    router.push('/student/login');
  };

  const navigationItems = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'Student Management', href: '/students', icon: PersonIcon },
    { name: 'Learning Sessions', href: '/learning-sessions', icon: SchoolIcon },
    { name: 'Progress Tracking', href: '/progress', icon: ProgressIcon },
    { name: 'LLM Dashboard', href: '/llm-dashboard', icon: DashboardIcon },
    { name: 'Evaluations', href: '/evaluations', icon: AnalyticsIcon },
    { name: 'Settings', href: '/settings', icon: SettingsIcon },
  ];  return (
    <AppBar position="static" elevation={1}>
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          {/* Logo/Title */}
          <Box display="flex" alignItems="center" sx={{ mr: 4 }}>
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
              🎓 School Tutor AI
            </Typography>
          </Box>

          {/* Navigation Links */}
          <Box sx={{ flexGrow: 1, display: 'flex', gap: 1 }}>
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  startIcon={<Icon />}
                  sx={{
                    color: 'white',
                    backgroundColor: pathname === item.href ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    },
                  }}
                >
                  {item.name}
                </Button>
              );
            })}
          </Box>

          {/* Right side actions */}
          <Box display="flex" alignItems="center" gap={1}>
            <Tooltip title="Notifications">
              <IconButton color="inherit">
                <Badge badgeContent={2} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title="Settings">
              <IconButton color="inherit" onClick={handleSettingsClick}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
            
            {/* Settings Menu */}
            <Menu
              anchorEl={settingsAnchorEl}
              open={Boolean(settingsAnchorEl)}
              onClose={handleSettingsClose}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
            >
              <MenuItem onClick={handleAdminMode}>
                <ListItemIcon>
                  <AdminIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Admin Console</ListItemText>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleStudentMode}>
                <ListItemIcon>
                  <StudentIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Student Portal</ListItemText>
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
