import { useEffect, useState } from "react";

const KEY = "rasd-privacy";
const EVT = "rasd:privacy-changed";

function read(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "1";
}

function apply(on: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("privacy-on", on);
}

export function usePrivacy(): [boolean, () => void] {
  const [on, setOn] = useState<boolean>(() => read());

  useEffect(() => {
    apply(on);
  }, [on]);

  useEffect(() => {
    const handler = () => setOn(read());
    window.addEventListener(EVT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const toggle = () => {
    const next = !read();
    window.localStorage.setItem(KEY, next ? "1" : "0");
    apply(next);
    setOn(next);
    window.dispatchEvent(new Event(EVT));
  };

  return [on, toggle];
}
