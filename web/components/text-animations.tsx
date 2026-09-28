"use client";

import { motion, useReducedMotion } from "motion/react";
import { useRef, useEffect, useState } from "react";

type MotionEasing =
  | "linear"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | "circIn"
  | "circOut"
  | "circInOut"
  | "backIn"
  | "backOut"
  | "backInOut"
  | "anticipate"
  | readonly [number, number, number, number]
  | ((v: number) => number);

interface SplitTextProps {
  text: string;
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span";
  className?: string;
  splitType?: "chars" | "words" | "lines";
  delay?: number;
  duration?: number;
  ease?: MotionEasing;
  from?: { opacity: number; y: number };
  to?: { opacity: number; y: number };
  threshold?: number;
  rootMargin?: string;
  textAlign?: "left" | "center" | "right";
  onComplete?: () => void;
  id?: string;
}

export function SplitText({
  text,
  as: Tag = "h1",
  className = "",
  splitType = "chars",
  delay = 50,
  duration = 0.8,
  ease = "easeOut",
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  threshold = 0.1,
  rootMargin = "-100px",
  textAlign = "center",
  onComplete,
  id,
}: SplitTextProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion || !ref.current || hasAnimated) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setHasAnimated(true);
            observer.disconnect();
            if (onComplete) onComplete();
          }
        });
      },
      { threshold, rootMargin }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [reduceMotion, threshold, rootMargin, hasAnimated, onComplete]);

  // Split text into segments
  const getSegments = () => {
    if (splitType === "words") return text.split(/\s+/).filter(Boolean);
    if (splitType === "lines") return text.split("\n").filter(Boolean);
    return text.split(""); // chars
  };

  const segments = getSegments();
  const reduced = reduceMotion;

  if (reduced) {
    return (
      <Tag ref={ref} className={className} style={{ textAlign }} id={id}>
        {text}
      </Tag>
    );
  }

  return (
    <Tag ref={ref} className={className} style={{ textAlign, display: "inline-block" }} id={id}>
      {segments.map((segment, index) => (
        <motion.span
          key={`${segment}-${index}`}
          initial={{ opacity: from.opacity, y: from.y }}
          animate={hasAnimated ? { opacity: to.opacity, y: to.y } : { opacity: from.opacity, y: from.y }}
          transition={{ duration, ease: ease as MotionEasing, delay: index * (delay / 1000) }}
          style={{ display: splitType === "chars" ? "inline-block" : "inline" }}
        >
          {segment}{splitType === "words" && index < segments.length - 1 && " "}
        </motion.span>
      ))}
    </Tag>
  );
}

interface FoldTextProps {
  text: string;
  splitBy?: "char" | "word" | "line";
  hinge?: "top" | "bottom" | "left" | "right";
  duration?: number;
  stagger?: number;
  ease?: MotionEasing;
  perspective?: number;
  creaseShading?: number;
  trigger?: "mount" | "hover" | "scroll";
  fontSize?: number | string;
  fontWeight?: number | string;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

export function FoldText({
  text,
  splitBy = "char",
  hinge = "top",
  duration = 0.65,
  stagger = 0.045,
  ease = "easeOut",
  perspective = 700,
  creaseShading = 0.55,
  trigger = "scroll",
  fontSize = 80,
  fontWeight = 800,
  color = "currentColor",
  className = "",
  style = {},
  id,
}: FoldTextProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);
  const reduceMotion = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (reduceMotion || !ref.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setHasAnimated(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1, rootMargin: "-100px" }
    );

    if (ref.current && trigger === "scroll") observer.observe(ref.current);
    return () => observer.disconnect();
  }, [reduceMotion, trigger]);

  const getSegments = () => {
    if (splitBy === "word") return text.split(/\s+/).filter(Boolean);
    if (splitBy === "line") return text.split("\n").filter(Boolean);
    return text.split("").filter((c) => c !== " "); // chars, skip spaces
  };

  const segments = getSegments();
  const reduced = reduceMotion;

  if (reduced) {
    return (
      <div ref={ref} className={className} style={{ ...style, color, fontSize, fontWeight, textAlign: "center" }} id={id}>
        {text}
      </div>
    );
  }

  const rotationAxis = hinge === "top" || hinge === "bottom" ? "X" : "Y";
  const rotationDirection = hinge === "bottom" || hinge === "right" ? 1 : -1;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        display: "inline-flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: splitBy === "word" ? "0.25em" : 0,
        perspective: `${perspective}px`,
        ...(trigger === "hover" && { cursor: "pointer" }),
      }}
      onMouseEnter={() => trigger === "hover" && setIsHovered(true)}
      onMouseLeave={() => trigger === "hover" && setIsHovered(false)}
      id={id}
    >
      {segments.map((segment, index) => (
        <motion.span
          key={`${segment}-${index}`}
          style={{
            display: "inline-block",
            color,
            fontSize,
            fontWeight,
            transformStyle: "preserve-3d",
            transformOrigin:
              hinge === "top"
                ? "center bottom"
                : hinge === "bottom"
                ? "center top"
                : hinge === "left"
                ? "right center"
                : "left center",
          }}
          initial={hasAnimated || trigger === "hover" ? { rotateX: 0, rotateY: 0, opacity: 1 } : { rotateX: rotationDirection * 90, rotateY: rotationDirection * 90, opacity: 0 }}
          animate={
            trigger === "hover"
              ? isHovered
                ? { rotateX: 0, rotateY: 0, opacity: 1 }
                : { rotateX: rotationDirection * 90, rotateY: rotationDirection * 90, opacity: 0 }
              : hasAnimated
              ? { rotateX: 0, rotateY: 0, opacity: 1 }
              : { rotateX: rotationDirection * 90, rotateY: rotationDirection * 90, opacity: 0 }
          }
          transition={{
            duration,
            ease: ease as MotionEasing,
            delay: index * stagger,
          }}
        >
          <div
            style={{
              position: "relative",
              transformStyle: "preserve-3d",
            }}
          >
            <span style={{ display: "block", backfaceVisibility: "hidden" }}>{segment}</span>
            {/* Crease shading */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(90deg, transparent, rgba(0,0,0,${creaseShading}), transparent)`,
                opacity: 0,
                transform: `rotate${rotationAxis}(0deg)`,
                pointerEvents: "none",
              }}
            />
          </div>
        </motion.span>
      ))}
    </div>
  );
}

interface TypeTextProps {
  text: string | string[];
  typingSpeed?: number;
  pauseDuration?: number;
  deletingSpeed?: number;
  loop?: boolean;
  className?: string;
  showCursor?: boolean;
  cursorCharacter?: string | React.ReactNode;
  cursorBlinkDuration?: number;
  variableSpeed?: { min: number; max: number };
  onSentenceComplete?: (sentence: string, index: number) => void;
  id?: string;
}

export function TypeText({
  text,
  typingSpeed = 50,
  pauseDuration = 2000,
  deletingSpeed = 30,
  loop = true,
  className = "",
  showCursor = true,
  cursorCharacter = "_",
  cursorBlinkDuration = 0.5,
  variableSpeed,
  onSentenceComplete,
  id,
}: TypeTextProps) {
  const [displayText, setDisplayText] = useState("");
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLHeadingElement>(null);

  const sentences = Array.isArray(text) ? text : [text];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, cursorBlinkDuration * 1000);

    return () => clearInterval(blinkInterval);
  }, [cursorBlinkDuration]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const currentSentence = sentences[sentenceIndex];
    const targetLength = isDeleting ? 0 : currentSentence.length;
    const currentLength = displayText.length;

    if (currentLength === targetLength) {
      if (!isDeleting) {
        // Finished typing
        setIsDeleting(true);
        if (onSentenceComplete) onSentenceComplete(currentSentence, sentenceIndex);
        setTimeout(() => tick(), pauseDuration);
      } else {
        // Finished deleting
        setIsDeleting(false);
        setSentenceIndex((prev) => (prev + 1) % sentences.length);
        if (loop || sentenceIndex < sentences.length - 1) {
          setTimeout(() => tick(), typingSpeed);
        }
      }
      return;
    }

    const speed = variableSpeed
      ? Math.random() * (variableSpeed.max - variableSpeed.min) + variableSpeed.min
      : isDeleting
      ? deletingSpeed
      : typingSpeed;

    setTimeout(() => tick(), speed);

    function tick() {
      const currentSentence = sentences[sentenceIndex];
      if (isDeleting) {
        setDisplayText(currentSentence.slice(0, displayText.length - 1));
      } else {
        setDisplayText(currentSentence.slice(0, displayText.length + 1));
      }
    }
  }, [displayText, isDeleting, sentenceIndex, typingSpeed, deletingSpeed, pauseDuration, sentences, onSentenceComplete]);

  const cursor = (
    <motion.span
      className="inline-block ml-1"
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: cursorBlinkDuration, repeat: Infinity, ease: "easeInOut" }}
    >
      {cursorCharacter}
    </motion.span>
  );

  return (
    <h2 ref={ref} className={className} id={id}>
      <span style={{ display: "inline-flex", alignItems: "baseline" }}>
        {displayText}
        {cursor}
      </span>
    </h2>
  );
}