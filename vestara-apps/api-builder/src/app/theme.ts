import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#8ab4ff' },
    secondary: { main: '#c792ea' },
    background: { default: '#0b0d12', paper: '#14161d' },
    error: { main: '#ff8a8a' },
    success: { main: '#8ae6a0' },
    warning: { main: '#ffd18a' },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    button: { textTransform: 'none' },
  },
  components: {
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiSelect: { defaultProps: { size: 'small' } },
    MuiButton: { defaultProps: { size: 'small' } },
  },
});
