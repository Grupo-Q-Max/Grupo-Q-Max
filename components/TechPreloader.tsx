"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function TechPreloader() {
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  
  const fullText = "Q-Max Core Initializing...\nLoading Modules...\nEstablishing Connection...\nBypassing Security Protocol...\nSystem Online.";

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      setText(fullText.substring(0, index));
      index++;
      if (index > fullText.length) {
        clearInterval(interval);
        setTimeout(() => setLoading(false), 800);
      }
    }, 25);
    
    return () => clearInterval(interval);
  }, [fullText]);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          className="tech-preloader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, y: "-100%" }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        >
          <div className="tech-preloader__content">
            <pre>{text}</pre>
            <div className="tech-preloader__cursor" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
