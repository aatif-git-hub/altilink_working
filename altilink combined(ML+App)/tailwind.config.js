/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#f8fafc',
        surface: '#ffffff',
        'surface-subtle': '#f1f5f9',
        border: '#e2e8f0',
        'border-strong': '#cbd5e1',
        text: {
          primary: '#0f172a',
          secondary: '#475569',
          muted: '#64748b',
        },
        safe: {
          DEFAULT: '#16a34a',
          bg: '#f0fdf4',
          border: '#bbf7d0',
          text: '#15803d',
        },
        warning: {
          DEFAULT: '#d97706',
          bg: '#fffbeb',
          border: '#fde68a',
          text: '#b45309',
        },
        emergency: {
          DEFAULT: '#dc2626',
          bg: '#fef2f2',
          border: '#fecaca',
          text: '#b91c1c',
        },
        trail: {
          DEFAULT: '#2563eb',
          bg: '#eff6ff',
          border: '#bfdbfe',
          text: '#1d4ed8',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      }
    },
  },
  plugins: [],
}
