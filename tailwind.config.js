export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: '#6d4aff', soft: '#efeaff', strong: '#5634e6' },
        ink: { DEFAULT: '#1d1a26', soft: '#5b5768', faint: '#9a96a8' },
        line: '#e4e1ec',
        panel: '#ffffff',
        canvas: '#f3f1f8'
      },
      fontFamily: { ui: ['"Heebo Variable"', 'system-ui', 'sans-serif'], mono: ['ui-monospace', 'monospace'] }
    }
  },
  plugins: []
};
