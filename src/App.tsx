import { useState, useEffect, useMemo } from 'react';
import { createTheme, ThemeProvider, CssBaseline } from '@mui/material';
import {
  Box, AppBar, Toolbar, Typography, Drawer, List, ListItemButton,
  ListItemText, IconButton, Divider, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, Button,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import SettingsIcon from '@mui/icons-material/Settings';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { OcsProvider } from './lib/OcsContext';
import ocsRouteDefs from './lib/routes';

const DRAWER_WIDTH = 240;

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#8d6e63' },
    background: { default: '#121212', paper: '#1e1e1e' },
  },
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

interface AppConfig {
  url: string;
  tenants: string;
}

const NAV_ITEMS = [
  { section: 'Core' },
  { label: 'Accounts', path: '' },
  { label: 'CDRs', path: 'cdrs' },
  { label: 'Exported CDRs', path: 'exported-cdrs' },
  { label: 'Sessions', path: 'sessions' },
  { section: 'Rating' },
  { label: 'Destinations', path: 'destinations' },
  { label: 'Destination Rates', path: 'destination-rates' },
  { label: 'Rating Plans', path: 'rating-plans' },
  { label: 'Rating Profiles', path: 'rating-profiles' },
  { label: 'Timings', path: 'timings' },
  { label: 'Tariff Plans', path: 'tariff-plans' },
  { section: 'Actions' },
  { label: 'Actions', path: 'actions' },
  { label: 'Action Plans', path: 'action-plans' },
  { label: 'Action Triggers', path: 'action-triggers' },
  { label: 'Upcoming Actions', path: 'upcoming-action-plans' },
  { section: 'Profiles' },
  { label: 'Chargers', path: 'chargers' },
  { label: 'Attributes', path: 'attributes' },
  { label: 'Filters', path: 'filters' },
  { label: 'Resources', path: 'resources' },
  { label: 'Stats', path: 'stats' },
  { label: 'Thresholds', path: 'thresholds' },
  { section: 'Routes' },
  { label: 'Route Lookup', path: 'routes' },
  { label: 'Route Profiles', path: 'route-profiles' },
  { section: 'Tools' },
  { label: 'Get Cost', path: 'get-cost' },
  { label: 'Charge Tester', path: 'charge-tester' },
  { label: 'Analyzer', path: 'analyzer' },
  { label: 'Event Reader', path: 'event-reader' },
  { label: 'Execute JSON', path: 'execute-json' },
  { label: 'Config', path: 'config' },
] as const;

function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(true);

  const currentPath = location.pathname.replace(/^\//, '');

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setDrawerOpen(!drawerOpen)} sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>CGrateS UI</Typography>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="persistent"
        open={drawerOpen}
        sx={{
          width: drawerOpen ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List dense>
            {NAV_ITEMS.map((item, i) => {
              if ('section' in item) {
                return (
                  <Box key={i}>
                    {i > 0 && <Divider />}
                    <Typography variant="caption" sx={{ px: 2, pt: 1.5, pb: 0.5, display: 'block', color: 'text.secondary', fontWeight: 600 }}>
                      {item.section}
                    </Typography>
                  </Box>
                );
              }
              return (
                <ListItemButton
                  key={i}
                  selected={currentPath === item.path || (item.path === '' && currentPath === '')}
                  onClick={() => navigate(`/${item.path}`)}
                >
                  <ListItemText primary={item.label} />
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, transition: 'margin 0.2s', ml: drawerOpen ? 0 : `-${DRAWER_WIDTH}px` }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}

function createRouter() {
  return createBrowserRouter([
    {
      element: <Layout />,
      children: ocsRouteDefs,
    },
  ]);
}

function SettingsDialog({ open, onClose, config, onSave }: {
  open: boolean;
  onClose: () => void;
  config: AppConfig;
  onSave: (c: AppConfig) => void;
}) {
  const [url, setUrl] = useState(config.url);
  const [tenants, setTenants] = useState(config.tenants);

  useEffect(() => {
    setUrl(config.url);
    setTenants(config.tenants);
  }, [config, open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Settings</DialogTitle>
      <DialogContent>
        <TextField fullWidth label="CGrateS URL" value={url} onChange={e => setUrl(e.target.value)} sx={{ mt: 1, mb: 2 }}
          helperText="e.g. http://127.0.0.1:2080" />
        <TextField fullWidth label="Tenants (semicolon-separated)" value={tenants} onChange={e => setTenants(e.target.value)}
          helperText="e.g. cgrates.org;test" />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { onSave({ url, tenants }); onClose(); }}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    // Try localStorage first, then config.json
    const stored = localStorage.getItem('cgrates_ui_config');
    if (stored) {
      try {
        setConfig(JSON.parse(stored));
        return;
      } catch { /* fall through */ }
    }
    fetch('/config.json')
      .then(r => r.json())
      .then((data: { url?: string; tenants?: string }) => {
        const c: AppConfig = { url: data.url || 'http://127.0.0.1:2080', tenants: data.tenants || 'cgrates.org' };
        setConfig(c);
      })
      .catch(() => {
        setConfig({ url: 'http://127.0.0.1:2080', tenants: 'cgrates.org' });
      });
  }, []);

  const handleSaveConfig = (c: AppConfig) => {
    localStorage.setItem('cgrates_ui_config', JSON.stringify(c));
    setConfig(c);
  };

  const tenantList = useMemo(() => config?.tenants.split(';').filter(Boolean) || [], [config?.tenants]);
  const defaultTenant = tenantList[0] || '';

  const router = useMemo(() => createRouter(), []);

  if (!config) return null;

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <OcsProvider baseUrl={config.url} tenants={tenantList} defaultTenant={defaultTenant}>
          <RouterProvider router={router} />
          <SettingsDialog
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            config={config}
            onSave={handleSaveConfig}
          />
        </OcsProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
