import React from 'react';

export interface Theme {
  id: string;
  name: string;
  path: string;
}

export const THEMES: Theme[] = [
  { id: 'classic', name: 'Classic', path: '/themes/classic' },
  { id: 'modern', name: 'Modern', path: '/themes/modern' }
];

interface ThemeSliderProps {
  currentTheme: string;
  onThemeChange: (themeId: string) => void;
}

export const ThemeSlider: React.FC<ThemeSliderProps> = ({ currentTheme, onThemeChange }) => {
  const currentIndex = THEMES.findIndex(t => t.id === currentTheme);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value);
    onThemeChange(THEMES[index].id);
  };

  return (
    <div className="theme-slider">
      <label>
        <span>Theme: {THEMES[currentIndex]?.name || 'Classic'}</span>
        <input
          type="range"
          min="0"
          max={THEMES.length - 1}
          value={currentIndex}
          onChange={handleChange}
          className="slider"
        />
      </label>
    </div>
  );
};