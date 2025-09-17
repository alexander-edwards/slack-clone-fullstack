/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slack: {
          purple: '#4A154B',
          purpleHover: '#350d36',
          sidebar: '#3F0E40',
          sidebarHover: '#350d36',
          active: '#1164A3',
          hover: '#350d36',
          text: '#1D1C1D',
          textLight: '#616061',
          border: '#E1E1E1',
          green: '#007A5A',
          greenHover: '#00573E',
          mention: '#ECB22E',
          link: '#1264A3'
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
