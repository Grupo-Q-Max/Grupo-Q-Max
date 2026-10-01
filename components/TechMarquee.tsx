"use client";

import React from "react";

export function TechMarquee() {
  const techs = [
    "REACT", "NEXT.JS", "NODE.JS", "TYPESCRIPT", "BITRIX24", 
    "AWS", "FIGMA", "DOCKER", "PRISMA", "TAILWIND CSS", "GSAP"
  ];
  
  return (
    <div className="tech-marquee-container">
      <div className="tech-marquee-content">
        {[...techs, ...techs, ...techs].map((tech, i) => (
          <span key={i} className="tech-marquee-item">
            <span className="tech-marquee-dot">•</span> {tech}
          </span>
        ))}
      </div>
    </div>
  );
}
