export const theme = {
  colors: {
    primary: '#8e34bb',
    secondary: '#c8c8e4',
    background: '#101010',
    paper: '#17171a',
    text: '#ffffff',
    border: '#333333',
  },
  fonts: {
    body: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    heading: "'Segoe UI', Roboto, sans-serif",
  },
  typography: {
    fontFamily: {
      body: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      heading: "'Trebuchet MS', -apple-system, 'Segoe UI', Roboto, sans-serif",
    },
    spacing: (multiplier: number) => `${multiplier * 0.25}rem`,
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
      '5xl': '3rem',
      '6xl': '3.75rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  sizing: {
    sidebarWidth: '12rem',
  },
  spacing: (multiplier: number) => `${multiplier * 0.25}rem`,
} as const;
