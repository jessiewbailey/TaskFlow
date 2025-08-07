import React from 'react'
import LogoImage from '../Logo.png'

interface LogoProps {
  className?: string
  alt?: string
}

export const Logo: React.FC<LogoProps> = ({ 
  className, 
  alt = "TaskFlow" 
}) => {
  const defaultClasses = "h-8 w-auto";
  const finalClassName = className ? `${defaultClasses} ${className}` : defaultClasses;
  
  return (
    <img 
      src={LogoImage} 
      alt={alt}
      className={finalClassName}
    />
  )
}

export default Logo