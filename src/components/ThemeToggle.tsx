"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("gravity_theme");
    if (stored === "light") { setDark(false); document.documentElement.classList.remove("dark"); }
    else if (stored === "dark") { setDark(true); document.documentElement.classList.add("dark"); }
    else { const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches; setDark(prefers); if (prefers) document.documentElement.classList.add("dark"); else document.documentElement.classList.remove("dark"); }
  }, []);

  const toggle = () => {
    const next = !dark; setDark(next);
    localStorage.setItem("gravity_theme", next ? "dark" : "light");
    if (next) document.documentElement.classList.add("dark"); else document.documentElement.classList.remove("dark");
  };

  return (
    <button onClick={toggle} className="p-1.5 rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" title={dark ? "Switch to light mode" : "Switch to dark mode"}>
      {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
    </button>
  );
}
