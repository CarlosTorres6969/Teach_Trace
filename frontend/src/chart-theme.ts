export type ChartThemePalette = {
  surface: string;
  text: string;
  primary: string;
  primaryFill: string;
  secondary: string;
  secondaryFill: string;
  accent: string;
  accentFill: string;
  grid: string;
};

export function chartThemePalette(
  theme: 'light' | 'dark',
  highContrast: boolean,
): ChartThemePalette {
  if (highContrast) {
    return {
      surface: '#000000',
      text: '#ffffff',
      primary: '#9bd8ff',
      primaryFill: 'rgba(155,216,255,0.16)',
      secondary: '#ffffff',
      secondaryFill: 'rgba(255,255,255,0.12)',
      accent: '#ffe66b',
      accentFill: 'rgba(255,230,107,0.12)',
      grid: 'rgba(255,255,255,0.35)',
    };
  }

  if (theme === 'dark') {
    return {
      surface: '#162235',
      text: '#edf3fc',
      primary: '#8fc1ff',
      primaryFill: 'rgba(143,193,255,0.16)',
      secondary: '#b5c1d2',
      secondaryFill: 'rgba(181,193,210,0.12)',
      accent: '#ffc45c',
      accentFill: 'rgba(255,196,92,0.12)',
      grid: 'rgba(237,243,252,0.22)',
    };
  }

  return {
    surface: '#ffffff',
    text: '#5b6b80',
    primary: '#234f8f',
    primaryFill: 'rgba(35,79,143,0.10)',
    secondary: '#647896',
    secondaryFill: 'rgba(100,120,150,0.10)',
    accent: '#8a5c0e',
    accentFill: 'rgba(138,92,14,0.10)',
    grid: 'rgba(12,35,64,0.12)',
  };
}
