import { Brush, Eraser, Layers, Lightbulb, PenTool, Zap } from "lucide-react";

export const examples = [
  { id: 1, title: "House Sketch", thumbnail: "/demoHouse.png" },
  { id: 2, title: "Robot Sketch", thumbnail: "/demoRobot.webp" },
  { id: 3, title: "Car Sketch", thumbnail: "/demoCar.png" },
  { id: 4, title: "IronMan Sketch", thumbnail: "/demoIronMan.jpg" },
];

// Drawing tips for kids and pro modes
export const drawingTips = {
  kids: [
    { tip: "Use bold lines for better results", icon: <PenTool size={14} /> },
    {
      tip: "Draw one thing at a time (like a robot)",
      icon: <Layers size={14} />,
    },
    { tip: "Keep it simple, no tiny details", icon: <Zap size={14} /> },
    { tip: "Erase and restart anytime", icon: <Eraser size={14} /> },
  ],
  pro: [
    {
      tip: "Use strong contours for better AI detection",
      icon: <PenTool size={14} />,
    },
    {
      tip: "Try cross-hatching for detailed shading",
      icon: <Brush size={14} />,
    },
    { tip: "Separate subjects from background", icon: <Layers size={14} /> },
    {
      tip: "Add visual hints for style (geometric/organic)",
      icon: <Zap size={14} />,
    },
    {
      tip: "Include text notes for specific details",
      icon: <Lightbulb size={14} />,
    },
  ],
};
