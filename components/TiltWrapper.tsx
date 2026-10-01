"use client";

import { useState, useRef, ReactNode } from "react";
import { motion } from "framer-motion";

interface TiltWrapperProps {
  children: ReactNode;
  className?: string;
}

export function TiltWrapper({ children, className = "" }: TiltWrapperProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  
  // Spotlight state
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Tilt calculations
    const rX = ((mouseY / height) - 0.5) * -15; 
    const rY = ((mouseX / width) - 0.5) * 15;
    
    setRotateX(rX);
    setRotateY(rY);

    // Spotlight calculations
    setMousePosition({ x: mouseX, y: mouseY });
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    setIsHovering(false);
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      animate={{
        rotateX,
        rotateY,
        transformPerspective: 1000,
      }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      style={{ 
        transformStyle: "preserve-3d", 
        position: "relative",
        overflow: "hidden" 
      }}
    >
      {/* Spotlight effect */}
      <motion.div
        animate={{
          opacity: isHovering ? 1 : 0
        }}
        transition={{ duration: 0.3 }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: "none",
          zIndex: 0,
          background: `radial-gradient(400px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(0, 255, 255, 0.15), transparent 40%)`
        }}
      />
      {children}
    </motion.div>
  );
}
