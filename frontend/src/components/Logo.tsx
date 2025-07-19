import React from 'react'
import LogoImage from '../Logo.png'

interface LogoProps {
  className?: string
  alt?: string
}

export const Logo: React.FC<LogoProps> = ({ 
  className = "h-8 w-auto", 
  alt = "TaskFlow" 
}) => {
  return (
    <img 
      src={LogoImage} 
      alt={alt}
      className={className}
    />
  )
}

export default Logo