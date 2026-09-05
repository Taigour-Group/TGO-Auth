/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f6f7f9',
        surface: { DEFAULT: '#ffffff', 2: '#fbfbfc' },
        ink: { DEFAULT: '#17181c', muted: '#62676e', subtle: '#9aa0a6' },
        line: { DEFAULT: '#e6e8eb', strong: '#d5d8dc' },
        accent: { DEFAULT: '#2563eb', hover: '#1d4ed8' },
        danger: { DEFAULT: '#d92d20', bg: '#fef3f2' },
        success: { DEFAULT: '#067647', bg: '#ecfdf3' },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 10px 30px -12px rgba(16, 24, 40, 0.18)',
        soft: '0 1px 2px rgba(16, 24, 40, 0.05)',
      },
      borderRadius: {
        xl2: '14px',
      },
      maxWidth: {
        card: '26rem',
      },
    },
  },
  plugins: [],
};
