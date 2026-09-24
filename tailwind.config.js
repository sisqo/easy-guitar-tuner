/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
      // Theme-aware surfaces: each resolves to a CSS variable in index.css that
      // .dark redefines, so one class covers both themes.
      colors: {
        canvas: 'var(--bg)',
        surface: 'var(--surface)',
        card: 'var(--card)',
        well: 'var(--well)',
        sheet: 'var(--sheet)',
        line: 'var(--line)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        grabber: 'var(--grabber)',
        'tab-on': 'var(--tab-on)',
        brand: '#2aab9e',
      },
    },
  },
  plugins: [],
}
