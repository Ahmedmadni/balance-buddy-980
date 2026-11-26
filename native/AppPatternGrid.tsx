import React, { useRef } from "react";
import { appendPatternNode } from "../src/lib/offline/app-lock";

type Props = { value: string; onChange: (value: string) => void; disabled?: boolean; label: string };
const position = (node: number) => ({
  x: 50 + ((node - 1) % 3) * 100,
  y: 50 + Math.floor((node - 1) / 3) * 100,
});

/** Controlled grid; never stores the secret outside its owning form.
 * Touch users may draw a continuous pattern; keyboard users select points.
 * The caller must clear the controlled value on lock and form dismissal. */
export function AppPatternGrid({ value, onChange, disabled, label }: Props) {
  const drawing = useRef<{ pointer: number; pattern: string } | null>(null);
  const hit = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return 0;
    const x = (event.clientX - rect.left) * 300 / rect.width;
    const y = (event.clientY - rect.top) * 300 / rect.height;
    for (let n = 1; n <= 9; n++) {
      const p = position(n);
      if (Math.hypot(p.x-x,p.y-y) <= 32) return n;
    }
    return 0;
  };
  const move = (event: React.PointerEvent<SVGSVGElement>) => {
    if (disabled || !drawing.current || drawing.current.pointer !== event.pointerId) return;
    const n = hit(event);
    if (!n) return;
    const next = appendPatternNode(drawing.current.pattern,n);
    drawing.current.pattern = next;
    onChange(next);
  };
  const points = value.split("").map(n => position(Number(n)));
  return <div className="app-pattern" dir="ltr">
    <svg viewBox="0 0 300 300" role="group" aria-label={label}
      style={{display:"block",width:"100%",maxWidth:270,margin:"0 auto",touchAction:"none",userSelect:"none"}}
      onPointerDown={event => {
        if (disabled || !event.isPrimary || event.button !== 0 || drawing.current) return;
        const n = hit(event);
        if (!n) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drawing.current = { pointer:event.pointerId, pattern:String(n) };
        onChange(String(n));
      }}
      onPointerMove={move}
      onPointerUp={event => {
        if (drawing.current?.pointer === event.pointerId) { move(event); drawing.current = null; }
      }}
      onPointerCancel={event => {
        if (drawing.current?.pointer === event.pointerId) { drawing.current = null; onChange(""); }
      }}
      onLostPointerCapture={event => {
        if (drawing.current?.pointer === event.pointerId) { drawing.current = null; onChange(""); }
      }}>
      {points.length > 1 && <polyline points={points.map(p=>p.x+","+p.y).join(" ")} fill="none" stroke="#0a928c" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none"/>}
      {Array.from({length:9},(_,i)=>i+1).map(n=>{
        const p=position(n), selected=value.includes(String(n));
        return <g key={n} role="button" tabIndex={disabled?-1:0} aria-label={"نقطة "+n} aria-pressed={selected}
          aria-disabled={disabled} onKeyDown={event=>{
            if (!disabled && (event.key==="Enter" || event.key===" ")) {
              event.preventDefault(); onChange(appendPatternNode(value,n));
            }
          }}>
          <circle cx={p.x} cy={p.y} r="28" fill={selected?"#d6f4ee":"#f2f6f6"} stroke={selected?"#0a928c":"#bfcdd1"} strokeWidth="2"/>
          <circle cx={p.x} cy={p.y} r="8" fill={selected?"#0a928c":"#627580"} />
        </g>;
      })}
    </svg>
    <button type="button" className="secondary full" disabled={disabled || !value} onClick={()=>onChange("")}>مسح النمط</button>
  </div>;
}
