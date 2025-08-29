import React, { useMemo, useRef, useState, useEffect } from "react";
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, rectIntersection } from "@dnd-kit/core";
import { useSortable, SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, addMinutes, parseISO, setHours, setMinutes, isValid } from "date-fns";
import { Download, Share2, Save, Upload, Lock, Edit2, Trash2, Calendar, Clock, PlusCircle, Settings, GripVertical, Check } from "lucide-react";
// NOTE: This preview uses Tailwind utility classes; brand colors are applied inline with hex values.
// You can paste this component into a Vite + React + Tailwind app and it will run.
// External deps: @dnd-kit/core, @dnd-kit/sortable, date-fns, lucide-react, ics (optional export)

// ---------- Brand Colors ----------
const BRAND = {
  grass: "#27402c",
  midnight: "#000000",
  white: "#FFFFFF",
  peacock: "#01363b",
  sand: "#8F7A4A",
  smoke: "#555555",
};

// ---------- Types ----------
interface Item {
  id: string;
  title: string;
  startMin: number; // minutes from day start
  durationMin: number;
  color: string; // hex or tailwind arbitrary
  notes?: string;
}

interface PresetDef {
  key: string;
  label: string;
  standardMin: number;
  color?: string;
}

// ---------- Presets (from user ask, with a few family dynamics) ----------
const PRESETS: PresetDef[] = [
  { key: "bride-ready", label: "Bride Getting Ready", standardMin: 30, color: "#8F7A4A" },
  { key: "groom-ready", label: "Groom Getting Ready", standardMin: 30, color: "#27402c" },
  { key: "couples-portraits", label: "Couples Portraits", standardMin: 30, color: "#01363b" },
  { key: "party-photos", label: "Wedding Party Photos", standardMin: 30, color: "#555555" },
  { key: "family-formals", label: "Family Formals", standardMin: 30, color: "#8F7A4A" },
  { key: "first-look", label: "First Look", standardMin: 15, color: "#27402c" },
  { key: "ceremony", label: "Ceremony", standardMin: 30, color: "#01363b" },
  { key: "first-dance", label: "First Dance", standardMin: 10, color: "#27402c" },
  { key: "fd-dance", label: "Father/Daughter Dance", standardMin: 5, color: "#8F7A4A" },
  { key: "ms-dance", label: "Mother/Son Dance", standardMin: 5, color: "#01363b" },
  { key: "md-dance", label: "Mother/Daughter Dance", standardMin: 5, color: "#555555" },
  { key: "sfd-dance", label: "Step-Father/Daughter Dance", standardMin: 5, color: "#8F7A4A" },
  { key: "bouquet", label: "Bouquet Toss", standardMin: 5, color: "#27402c" },
  { key: "garter", label: "Garter Toss", standardMin: 30, color: "#01363b" },
  { key: "grand-exit", label: "Grand Exit", standardMin: 10, color: "#555555" },
  { key: "travel", label: "Travel Buffer", standardMin: 20, color: "#8F7A4A" },
  { key: "custom", label: "Custom Item", standardMin: 15, color: "#27402c" },
];

// ---------- Favorite Color Palettes (2023-2025) ----------
const FAVORITE_PALETTES: { year: string; name: string; chips: string[] }[] = [
  { year: "2023", name: "Terracotta + Sage + Ivory", chips: ["#D5654D", "#8BAB7C", "#F5F1E6"] },
  { year: "2023", name: "Dusty Blue + Navy + Silver", chips: ["#A7B8C7", "#0C2D48", "#C0C7D1"] },
  { year: "2024", name: "Peach Fuzz + Champagne + Cream", chips: ["#FFBE98", "#E6D2B5", "#FFF7E9"] },
  { year: "2024", name: "Marseille Bleu + White + Gold", chips: ["#1F5FFF", "#FFFFFF", "#C7A86E"] },
  { year: "2024", name: "Bold Black + Green Accents", chips: ["#000000", "#2E7459", "#FFFFFF"] },
  { year: "2025", name: "Juicy Red + Soft Pink + Ivory", chips: ["#D5252A", "#F4B8C6", "#FFF9F2"] },
  { year: "2025", name: "Coastal Blues + Sand", chips: ["#2D5D7B", "#9DB6C6", "#D5C5A1"] },
  { year: "2025", name: "Olive + Terracotta + Cream", chips: ["#6B7C59", "#C46A4C", "#FBF7F2"] },
  { year: "2025", name: "Green & White Classic", chips: ["#284B36", "#FFFFFF", "#E8EFE9"] },
];

// ---------- Utilities ----------
function minutesBetween(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }

function timeLabelFromOffset(day: string, dayStart: string, offsetMin: number) {
  // Return HH:MM string of absolute time = dayStart + offset
  const [h, m] = dayStart.split(":").map(Number);
  let dt = parseISO(day + "T00:00:00");
  if (!isValid(dt)) dt = new Date();
  dt = setHours(dt, h);
  dt = setMinutes(dt, m + offsetMin);
  return format(dt, "h:mm a");
}

function uuid() { return Math.random().toString(36).slice(2); }

// ---------- Sortable Row (Preset) ----------
function PresetRow({ def, onAdd }: { def: PresetDef; onAdd: (d: PresetDef) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white/80 px-3 py-2 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 rounded-full" style={{ backgroundColor: def.color || BRAND.sand }} />
        <div>
          <div className="text-sm font-medium text-gray-900">{def.label}</div>
          <div className="text-xs text-gray-500">Standard: {def.standardMin} min</div>
        </div>
      </div>
      <button
        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
        onClick={() => onAdd(def)}
      >
        <PlusCircle className="h-3 w-3" /> Add
      </button>
    </div>
  );
}

// ---------- Timeline Item Block ----------
function TimelineBlock({ item, top, height, onClick }: { item: Item; top: number; height: number; onClick: () => void }) {
  return (
    <div
      className="absolute left-28 right-2 cursor-pointer rounded-xl p-3 shadow-md"
      style={{ top, height, backgroundColor: item.color }}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="font-semibold text-white drop-shadow-sm">{item.title}</div>
        <GripVertical className="h-4 w-4 text-white/90" />
      </div>
      <div className="mt-1 text-xs text-white/90">
        {item.durationMin} min • {item.notes?.slice(0, 80)}
      </div>
    </div>
  );
}

// ---------- Main Component ----------
export default function DayFlowPreview() {
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("11:00");
  const [endTime, setEndTime] = useState("20:00");
  const [slotSize, setSlotSize] = useState(15); // minutes
  const [snap, setSnap] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Item | null>(null);
  const [demoMode] = useState(true); // preview gates Save/Export

  const gridRef = useRef<HTMLDivElement>(null);

  const totalMinutes = useMemo(() => clamp(minutesBetween(startTime, endTime), 60, 18 * 60), [startTime, endTime]);
  const pxPerMin = 2; // vertical scale
  const gridHeight = totalMinutes * pxPerMin;

  // ----- Drag & Drop (from presets into grid) -----
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [draggingPreset, setDraggingPreset] = useState<PresetDef | null>(null);

  function handleDragStart(ev: any) {
    const preset: PresetDef | undefined = ev?.active?.data?.current?.preset;
    if (preset) setDraggingPreset(preset);
  }
  function handleDragEnd(ev: any) {
    if (!gridRef.current || !draggingPreset) { setDraggingPreset(null); return; }
    const rect = gridRef.current.getBoundingClientRect();
    const { x, y } = ev.delta ? { x: ev.delta.x + (ev?.activatorEvent?.clientX || 0), y: ev.delta.y + (ev?.activatorEvent?.clientY || 0) } : { x: ev?.activatorEvent?.clientX, y: ev?.activatorEvent?.clientY };
    // Approx: drop position is pointer end; compute Y relative to grid
    const pointerY = (ev?.over?.rect?.top ?? (ev?.delta?.y || 0)) + (ev?.activatorEvent?.clientY || 0);
    const relY = clamp((pointerY - rect.top), 0, gridHeight);
    let offsetMin = Math.round(relY / pxPerMin);
    if (snap) offsetMin = Math.round(offsetMin / slotSize) * slotSize;
    const newItem: Item = {
      id: uuid(),
      title: draggingPreset.label,
      startMin: offsetMin,
      durationMin: draggingPreset.standardMin,
      color: draggingPreset.color || BRAND.sand,
      notes: "",
    };
    setItems(prev => demoMode && prev.length >= 6 ? prev : [...prev, newItem]);
    setDraggingPreset(null);
  }

  // ----- Editor Save/Delete -----
  function upsertItem(updated: Item) {
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
    setSelected(null);
  }
  function deleteItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
    setSelected(null);
  }

  // ----- Export: clean text -----
  function exportText() {
    const lines = items
      .slice()
      .sort((a, b) => a.startMin - b.startMin)
      .map(i => `${timeLabelFromOffset(date, startTime, i.startMin)} — ${i.title} (${i.durationMin} min)${i.notes ? `\n    Notes: ${i.notes}` : ""}`)
      .join("\n");
    const blob = new Blob([`DayFlow — ${format(parseISO(date + "T00:00:00"), "PPP")}\n\n${lines}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `DayFlow-${date}.txt`; a.click();
    URL.revokeObjectURL(url);
  }

  // ----- Export: ICS -----
  async function exportICS() {
    const ics = await import("ics");
    const events = items.map(i => {
      const [sh, sm] = startTime.split(":").map(Number);
      const startDate = parseISO(date + "T00:00:00");
      const start = setHours(setMinutes(startDate, sm + i.startMin), sh);
      const end = addMinutes(start, i.durationMin);
      const s = [start.getFullYear(), start.getMonth() + 1, start.getDate(), start.getHours(), start.getMinutes()] as [number, number, number, number, number];
      const e = [end.getFullYear(), end.getMonth() + 1, end.getDate(), end.getHours(), end.getMinutes()] as [number, number, number, number, number];
      return {
        title: i.title,
        start: s,
        end: e,
        description: i.notes || "Created with DayFlow by Dostal Digital",
      } as any;
    });
    const { error, value } = ics.createEvents(events);
    if (error) { alert(String(error)); return; }
    const blob = new Blob([value || ""], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `DayFlow-${date}.ics`; a.click();
    URL.revokeObjectURL(url);
  }

  // ----- Save/Load -----
  function savePlan() {
    localStorage.setItem("dayflow.plan", JSON.stringify({ date, startTime, endTime, slotSize, snap, items }));
    alert("Saved in this browser. (Preview)");
  }
  function loadPlan() {
    const raw = localStorage.getItem("dayflow.plan");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setDate(parsed.date); setStartTime(parsed.startTime); setEndTime(parsed.endTime);
      setSlotSize(parsed.slotSize); setSnap(parsed.snap); setItems(parsed.items || []);
    } catch {}
  }

  // ----- Layout -----
  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: BRAND.white }}>
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg" style={{ backgroundColor: BRAND.peacock }} />
            <div>
              <div className="text-xl font-bold tracking-tight" style={{ color: BRAND.grass }}>DayFlow<span className="text-black">™</span> by Dostal Digital</div>
              <div className="text-sm text-gray-600">Drag, drop, and design your dream day in minutes.</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="hidden md:inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" onClick={loadPlan}><Upload className="h-4 w-4"/>Load</button>
            <button className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" onClick={() => demoMode ? alert("Sign in to save your plan.") : savePlan()}><Save className="h-4 w-4"/>Save</button>
            <button className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" onClick={() => demoMode ? alert("Subscribe to export.") : exportText()}><Download className="h-4 w-4"/>Text</button>
            <button className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" onClick={() => demoMode ? alert("Subscribe to export .ics.") : exportICS()}><Calendar className="h-4 w-4"/>.ics</button>
            <button className="inline-flex items-center gap-2 rounded-lg bg-black px-3 py-2 text-sm font-medium text-white"><Lock className="h-4 w-4"/> Preview</button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-3">
        {/* Palette + Settings */}
        <section className="space-y-4 lg:col-span-1">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold tracking-wide text-gray-700">Event Settings</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-gray-600">Date
                <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="mt-1 w-full rounded-lg border px-2 py-1 text-sm" />
              </label>
              <label className="text-xs text-gray-600">Start
                <input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} className="mt-1 w-full rounded-lg border px-2 py-1 text-sm" />
              </label>
              <label className="text-xs text-gray-600">End
                <input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} className="mt-1 w-full rounded-lg border px-2 py-1 text-sm" />
              </label>
              <label className="text-xs text-gray-600">Slot Size (min)
                <select value={slotSize} onChange={e=>setSlotSize(Number(e.target.value))} className="mt-1 w-full rounded-lg border px-2 py-1 text-sm">
                  {[5,10,15,30,45,60].map(s=> <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>
            <label className="mt-3 inline-flex items-center gap-2 text-xs text-gray-700">
              <input type="checkbox" checked={snap} onChange={e=>setSnap(e.target.checked)} /> Snap to grid
            </label>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold tracking-wide text-gray-700">Drag & Drop Presets</h3>
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={rectIntersection}>
              <div className="space-y-2">
                {PRESETS.map(p => (
                  <DraggablePreset key={p.key} preset={p} />
                ))}
              </div>
              <DragOverlay>
                {draggingPreset ? (
                  <div className="rounded-xl border bg-white px-3 py-2 shadow-lg">
                    <div className="text-sm font-medium">{draggingPreset.label}</div>
                    <div className="text-xs text-gray-500">{draggingPreset.standardMin} min</div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
            <p className="mt-3 text-xs text-gray-500">Tip: Drag a preset onto the timeline grid at the right to place it. Click any block to edit title, duration, color, and notes.</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold tracking-wide text-gray-700">Wedding Color Palettes (Favs from Last 3 Years)</h3>
            <div className="grid grid-cols-1 gap-3">
              {FAVORITE_PALETTES.map((p, idx) => (
                <div key={idx} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{p.name}</div>
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs">{p.year}</span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    {p.chips.map((c, i) => (
                      <div key={i} className="h-6 w-6 rounded-md border" style={{ backgroundColor: c }} title={c} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing block */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold tracking-wide text-gray-700">Pricing</h3>
            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-xl border p-3" style={{ borderColor: BRAND.grass }}>
                <div className="text-sm font-bold" style={{ color: BRAND.grass }}>Couples</div>
                <ul className="mt-1 text-sm text-gray-700 list-disc pl-5">
                  <li>One‑time $29.99</li>
                  <li>Monthly $9.99</li>
                </ul>
              </div>
              <div className="rounded-xl border p-3" style={{ borderColor: BRAND.peacock }}>
                <div className="text-sm font-bold" style={{ color: BRAND.peacock }}>Professionals</div>
                <ul className="mt-1 text-sm text-gray-700 list-disc pl-5">
                  <li>Monthly $19.99</li>
                  <li>Yearly $199.99</li>
                </ul>
              </div>
            </div>
            <button className="mt-3 w-full rounded-xl bg-black py-2 text-sm font-medium text-white">Sign up to unlock</button>
            <p className="mt-2 text-center text-xs text-gray-500">Preview mode limits saving and exports.</p>
          </div>
        </section>

        {/* Timeline Grid */}
        <section className="relative lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
            <div
              className="relative"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url('https://images.unsplash.com/photo-1522673607200-164d1b6ce486?q=80&w=1600&auto=format&fit=crop')",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="flex items-center justify-between border-b border-white/10 bg-black/30 px-4 py-3 text-white">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4" />
                  <div className="text-sm">{format(parseISO(date + "T00:00:00"), "PPP")} • {startTime}–{endTime} • {slotSize}‑min slots</div>
                </div>
                <div className="text-xs text-white/80">Drag presets here</div>
              </div>

              <div ref={gridRef} className="relative max-h-[70vh] overflow-auto bg-white/70 p-0" style={{ height: gridHeight + 40 }}>
                {/* Time rulers */}
                <div className="absolute left-0 top-0 w-28 select-none bg-white/60">
                  {Array.from({ length: Math.floor(totalMinutes / slotSize) + 1 }).map((_, idx) => {
                    const y = idx * slotSize * pxPerMin;
                    const label = idx % (60/slotSize) === 0 ? timeLabelFromOffset(date, startTime, idx*slotSize) : '';
                    return (
                      <div key={idx} className="relative h-[2px]" style={{ top: y }}>
                        <div className="absolute -translate-y-1/2 text-[10px] text-gray-700">{label}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Grid lines */}
                <div className="absolute right-0 left-28 top-0">
                  {Array.from({ length: Math.floor(totalMinutes / slotSize) + 1 }).map((_, idx) => {
                    const y = idx * slotSize * pxPerMin;
                    const isHour = idx % (60/slotSize) === 0;
                    return (
                      <div key={idx} className="absolute w-full border-t" style={{ top: y, borderColor: isHour ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.08)" }} />
                    );
                  })}

                  {/* Items */}
                  {items.map(it => {
                    const top = it.startMin * pxPerMin;
                    const height = it.durationMin * pxPerMin;
                    return (
                      <TimelineBlock key={it.id} item={it} top={top} height={height} onClick={() => setSelected(it)} />
                    );
                  })}
                </div>

                {/* Demo gate overlay */}
                {false && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
                    <div className="pointer-events-auto rounded-xl bg-white/90 p-4 text-center shadow">
                      <Lock className="mx-auto mb-2 h-5 w-5" />
                      <div className="text-sm font-medium">Preview Only</div>
                      <div className="mt-1 text-xs text-gray-600">Sign up to place unlimited items and export your schedule.</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Editor Modal */}
      {selected && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={()=>setSelected(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl" onClick={e=>e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold">Edit Item</div>
              <button className="rounded-lg border px-2 py-1 text-xs" onClick={()=>setSelected(null)}>Close</button>
            </div>
            <label className="block text-xs text-gray-600">Title
              <input className="mt-1 w-full rounded-lg border px-2 py-1 text-sm" value={selected.title} onChange={e=>setSelected({...selected, title:e.target.value})} />
            </label>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <label className="text-xs text-gray-600">Start (min from day start)
                <input type="number" className="mt-1 w-full rounded-lg border px-2 py-1 text-sm" value={selected.startMin} onChange={e=>setSelected({...selected, startMin: clamp(parseInt(e.target.value||'0'),0,totalMinutes-selected.durationMin)})} />
              </label>
              <label className="text-xs text-gray-600">Duration (min)
                <input type="number" className="mt-1 w-full rounded-lg border px-2 py-1 text-sm" value={selected.durationMin} onChange={e=>setSelected({...selected, durationMin: clamp(parseInt(e.target.value||'0'),5, 12*60)})} />
              </label>
            </div>
            <label className="mt-2 block text-xs text-gray-600">Color
              <input className="mt-1 w-full rounded-lg border px-2 py-1 text-sm" value={selected.color} onChange={e=>setSelected({...selected, color:e.target.value})} />
            </label>
            <label className="mt-2 block text-xs text-gray-600">Notes
              <textarea className="mt-1 w-full rounded-lg border px-2 py-1 text-sm" value={selected.notes||''} onChange={e=>setSelected({...selected, notes:e.target.value})} rows={3} placeholder="e.g., Travel to dunes for portraits" />
            </label>

            <div className="mt-3 flex items-center justify-between">
              <button className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm" onClick={()=>{ if(selected) deleteItem(selected.id); }}>
                <Trash2 className="h-4 w-4"/> Delete
              </button>
              <div className="flex gap-2">
                <button className="rounded-lg border px-3 py-1.5 text-sm" onClick={()=>setSelected(null)}>Cancel</button>
                <button className="rounded-lg bg-black px-3 py-1.5 text-sm font-medium text-white" onClick={()=> selected && upsertItem(selected)}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-8 border-t border-black/5 bg-white/70">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-center md:flex-row md:text-left">
          <p className="text-xs text-gray-600">Thank you for using <span className="font-semibold">DayFlow™</span> by Dostal Digital · Export .ics to add your schedule to Google/Apple Calendar. Save stores your plan in this browser.</p>
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <a href="https://dostaldigital.com" target="_blank" className="underline">Photography & Videography</a>
            <div className="flex items-center gap-3">
              <a aria-label="Instagram" href="#" className="underline">IG</a>
              <a aria-label="TikTok" href="#" className="underline">TT</a>
              <a aria-label="Facebook" href="#" className="underline">FB</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ----- Draggable Preset helper component -----
function DraggablePreset({ preset }: { preset: PresetDef }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id: preset.key, data: { preset } });
  const style = { transform: CSS.Translate.toString(transform) } as React.CSSProperties;
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={"" + (isDragging ? "opacity-60" : "opacity-100")}>
      <PresetRow def={preset} onAdd={() => { /* no-op in drag list; adding handled by drop */ }} />
    </div>
  );
}
