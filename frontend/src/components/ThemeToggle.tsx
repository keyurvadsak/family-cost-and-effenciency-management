import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ style }: { style?: React.CSSProperties }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        border: '1px solid var(--border-glass)',
        background: 'var(--bg-glass-card)',
        color: 'var(--text-main)',
        cursor: 'pointer',
        transition: 'var(--transition-bounce)',
        position: 'absolute',
        top: '20px',
        right: '20px',
        zIndex: 50,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        ...style
      }}
      title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.1)';
        e.currentTarget.style.background = 'var(--bg-glass-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.background = 'var(--bg-glass-card)';
      }}
    >
      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
