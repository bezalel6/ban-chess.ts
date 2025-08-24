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
  
  const handlePrevious = () => {
    const newIndex = currentIndex <= 0 ? THEMES.length - 1 : currentIndex - 1;
    onThemeChange(THEMES[newIndex].id);
  };

  const handleNext = () => {
    const newIndex = currentIndex >= THEMES.length - 1 ? 0 : currentIndex + 1;
    onThemeChange(THEMES[newIndex].id);
  };

  return (
    <div className="theme-carousel">
      <button 
        className="carousel-arrow left" 
        onClick={handlePrevious}
        aria-label="Previous theme"
      >
        ◀
      </button>
      <div className="carousel-display">
        <span className="carousel-label">Theme:</span>
        <span className="carousel-value">{THEMES[currentIndex]?.name || 'Classic'}</span>
      </div>
      <button 
        className="carousel-arrow right" 
        onClick={handleNext}
        aria-label="Next theme"
      >
        ▶
      </button>
    </div>
  );
};