import React from 'react';

interface HoverSlideTextProps {
  children: string;
  className?: string;
}

export const HoverSlideText: React.FC<HoverSlideTextProps> = ({ children, className }) => (
  <span className={`hover-slide-wrap${className ? ` ${className}` : ''}`}>
    <span className="hover-slide-text">{children}</span>
    <span className="hover-slide-text hover-slide-clone">{children}</span>
  </span>
);

export default HoverSlideText;
