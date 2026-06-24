import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ style }: { style?: React.CSSProperties }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        width: '44px',
        height: '44px',
        borderRadius: 'var(--radius-full)',
        border: '1px solid var(--border-glass)',
        background: 'var(--bg-surface)',
        color: isDark ? 'var(--primary)' : 'var(--primary)',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'absolute',
        top: '16px',
        right: '16px',
        zIndex: 50,
        boxShadow: 'var(--shadow-sm)',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.08)';
        e.currentTarget.style.boxShadow = 'var(--shadow-card)';
        e.currentTarget.style.borderColor = 'var(--border-glass-active)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        e.currentTarget.style.borderColor = 'var(--border-glass)';
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        transform: isDark ? 'rotate(0deg)' : 'rotate(180deg)',
      }}>
        {isDark ? <Sun size={20} /> : <Moon size={20} />}
      </div>
    </button>
  );
}
