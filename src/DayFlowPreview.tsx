import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  format,
  addMinutes,
  parseISO,
  setHours,
  setMinutes,
  isValid,
} from "date-fns";
import {
  Download,
  Upload,
  Save,
  Lock,
  Calendar,
  Clock,
  GripVertical,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";

/* ---------- Brand ---------- */
const BRAND = {
  grass: "#27402c",
  midnight: "#000000",
  white: "#FFFFFF",
  peacock: "#01363b",
  sand: "#8F7A4A",
  smoke: "#555555",
};

/* ---------- Types ---------- */
interface Item {
  id: string;
  title: string;
  startMin: number;   // minutes from day start
  durationMin: number;
  color: string;
  notes?: string;
}
interface PresetDef {
  key: string;
  label: string;
  standardMin: number;
  color?: string;
}

/* ---------- Presets ---------- */
const PRESETS: PresetDef[] = [
  { key: "bride-ready", label: "Bride Getting Ready", standardMin: 30, color: "#D5654D" },
  { key: "groom-ready", label: "Groom Getting Ready", standardMin: 30, color: "#8BAB7C" },
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

/* ---------- Favorite Color Palettes (2023–2025) ---------- */
const FAVORITE_PALETTES: { year: string; name: string; chips: string[] }[] = [
  { year: "2025", name: "Coastal Blues + Sand", chips: ["#2D5D7B", "#9DB6C6", "#D5C5A1"] },
  { year: "2025", name: "Olive + Terracotta + Cream", chips: ["#6B7C59", "#C46A4C", "#FBF7F2"] },
  { year: "2025", name: "Green & White Classic", chips: ["#284B36", "#FFFFFF", "#E8EFE9"] },
  { year: "2025", name: "Juicy Red + Soft Pink + Ivory", chips: ["#D5252A", "#F4B8C6", "#FFF9F2"] },
  { year: "2024", name: "Peach Fuzz + Champagne + Cream", chips: ["#FFBE98", "#E6D2B5", "#FFF7E9"] },
  { year: "2024", name: "Marseille Bleu + White + Gold", chips: ["#1F5FFF", "#FFFFFF", "#C7A86E"] },
  { year: "2024", name: "Bold Black + Green Accents", chips: ["#000000", "#2E7459", "#FFFFFF"] },
];

/* ---------- Utils ---------- */
function minutesBetween(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function timeLabelFromOffset(day: string, start: string, offsetMin: number) {
  const [h, m] = start.split(":").map(Number);
  let dt = parseISO(day + "T00:00:00");
  if (!isValid(dt)) dt = new Date();
  dt = setHours(dt, h);
  dt = setMinutes(dt, m + offsetMin);
  return format(dt, "h:mm a");
}
function uuid() {
  return Math.random().toString(36).slice(2);
}
// HH:mm helper for modal start time field
function hhmmFromStartAndOffset(startHHmm: string, offsetMin: number) {
  const [sh, sm] = startHHmm.split(":").map(Number);
  let total = sh * 60 + sm + offsetMin;
  if (total < 0) total = 0;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(hh)}:${pad(mm)}`;
}

/* ---------- Small UI parts ---------- */
function PresetRow({ def }: { def: PresetDef }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 rounded-full" style={{ backgroundColor: def.color || BRAND.sand }} />
        <div>
          <div className="text-sm font-medium text-gray-900">{def.label}</div>
          <div className="text-xs text-gray-500">Standard: {def.standardMin} min</div>
        </div>
      </div>
      <div className="text-[10px] text-gray-400">Drag →</div>
    </div>
  );
}

function TimelineBlock(props: {
  item: Item;
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
  onClick: () => void;
}) {
  const { item, top, height, leftPct, widthPct, onClick } = props;
  return (
    <div
      className="absolute cursor-pointer rounded-xl p-3 shadow-md"
      style={{
        top,
        height,
        left: `calc(${leftPct}% )`,
        width: `calc(${widthPct}% - 8px)`,
        backgroundColor: item.color,
      }}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="font-semibold text-white drop-shadow-sm">{item.title}</div>
        <GripVertical className="h-4 w-4 text-white/90" />
      </div>
      <div className="mt-1 text-xs text-white/90">
        {item.durationMin} min{item.notes ? ` • ${item.notes.slice(0, 80)}` : ""}
      </div>
    </div>
  );
}

/* ---------- Draggable helpers ---------- */
function DraggablePreset({ preset }: { preset: PresetDef }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: preset.key,
    data: { preset },
  });
  const style = { transform: CSS.Translate.toString(transform) } as React.CSSProperties;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={isDragging ? "opacity-60" : "opacity-100"}
      title="Drag onto the timeline →"
    >
      <PresetRow def={preset} />
    </div>
  );
}

function DraggableTimelineItem(props: {
  item: Item;
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
  onClick: () => void;
}) {
  const { item, top, height, leftPct, widthPct, onClick } = props;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: item.id,
    data: { itemId: item.id },
  });
  const style = { transform: CSS.Translate.toString(transform) } as React.CSSProperties;
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={isDragging ? "opacity-70" : "opacity-100"}>
      <TimelineBlock item={item} top={top} height={height} leftPct={leftPct} widthPct={widthPct} onClick={onClick} />
    </div>
  );
}

/* ---------- Main ---------- */
export default function DayFlowPreview() {
  const [timelineTitle, setTimelineTitle] = useState("My Wedding Timeline"); // NEW
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("11:00");
  const [endTime, setEndTime] = useState("20:00");
  const [slotSize, setSlotSize] = useState(15);
  const [snap, setSnap] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Item | null>(null);
  const [demoMode] = useState(true);

  const totalMinutes = useMemo(
    () => clamp(minutesBetween(startTime, endTime), 60, 18 * 60),
    [startTime, endTime]
  );

  // Zoom controls
  const [pxPerMin, setPxPerMin] = useState(2);
  const gridHeight = totalMinutes * pxPerMin;
  function fitToViewport() {
    const h = Math.max(420, Math.floor(window.innerHeight * 0.75));
    const p = Math.max(1, Math.floor(h / Math.max(60, totalMinutes)));
    setPxPerMin(p);
  }
  useEffect(() => {
    fitToViewport();
  }, [totalMinutes]);

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );
  const [draggingPreset, setDraggingPreset] = useState<PresetDef | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  function handleDragStart(ev: any) {
    const preset: PresetDef | undefined = ev?.active?.data?.current?.preset;
    const itemId: string | undefined = ev?.active?.data?.current?.itemId;
    if (preset) setDraggingPreset(preset);
    if (itemId) setDraggingItemId(itemId);
  }

  function handleDragEnd(ev: any) {
    if (!gridRef.current) {
      setDraggingPreset(null);
      setDraggingItemId(null);
      return;
    }
    const rect = gridRef.current.getBoundingClientRect();
    const pointerY =
      (ev?.active?.rect?.current?.translated?.top ?? 0) +
      (ev?.active?.rect?.current?.translated?.height ?? 0) / 2;
    const relY = Math.max(0, Math.min(gridHeight, pointerY - rect.top));
    let offsetMin = Math.round(relY / pxPerMin);
    if (snap) offsetMin = Math.round(offsetMin / slotSize) * slotSize;

    if (draggingPreset) {
      const newItem: Item = {
        id: uuid(),
        title: draggingPreset.label,
        startMin: offsetMin,
        durationMin: draggingPreset.standardMin,
        color: draggingPreset.color || BRAND.sand,
        notes: "",
      };
      setItems((prev) =>
        demoMode && prev.length >= 100 ? prev : [...prev, newItem]
      );
    }
    if (draggingItemId) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === draggingItemId
            ? {
                ...i,
                startMin: clamp(
                  offsetMin,
                  0,
                  Math.max(0, totalMinutes - i.durationMin)
                ),
              }
            : i
        )
      );
    }
    setDraggingPreset(null);
    setDraggingItemId(null);
  }

  // Editor actions
  function upsertItem(u: Item) {
    setItems((prev) => prev.map((i) => (i.id === u.id ? u : i)));
    setSelected(null);
  }
  function deleteItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelected(null);
  }

  // Export (text) — includes title
  function exportText() {
    const lines = items
      .slice()
      .sort((a, b) => a.startMin - b.startMin)
      .map((i) => {
        const base = `${timeLabelFromOffset(
          date,
          startTime,
          i.startMin
        )} — ${i.title} (${i.durationMin} min)`;
        return i.notes ? `${base}\n    Notes: ${i.notes}` : base;
      })
      .join("\n");

    const header = `${timelineTitle || "DayFlow Timeline"}\nDayFlow — ${format(
      parseISO(date + "T00:00:00"),
      "PPP"
    )}\n\n`;

    const blob = new Blob([header + lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DayFlow-${date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Export (ics) — includes title as calendar name
  async function exportICS() {
    const ics = await import("ics");
    const events = items.map((i) => {
      const [sh, sm] = startTime.split(":").map(Number);
      const startDate = parseISO(date + "T00:00:00");
      const start = setHours(setMinutes(startDate, sm + i.startMin), sh);
      const end = addMinutes(start, i.durationMin);
      const s = [
        start.getFullYear(),
        start.getMonth() + 1,
        start.getDate(),
        start.getHours(),
        start.getMinutes(),
      ] as [number, number, number, number, number];
      const e = [
        end.getFullYear(),
        end.getMonth() + 1,
        end.getDate(),
        end.getHours(),
        end.getMinutes(),
      ] as [number, number, number, number, number];
      return {
        title: i.title,
        start: s,
        end: e,
        description: i.notes || "Created with DayFlow by Dostal Digital",
      } as any;
    });
    const { error, value } = ics.createEvents(events, {
      calName: timelineTitle || "DayFlow Timeline",
    } as any);
    if (error) {
      alert(String(error));
      return;
    }
    const blob = new Blob([value || ""], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DayFlow-${date}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* --------- LANE LAYOUT (overlaps side-by-side) --------- */
  type Placed = { id: string; lane: number };
  const laneLayout = useMemo(() => {
    const sorted = [...items].sort(
      (a, b) => a.startMin - b.startMin || b.durationMin - a.durationMin
    );
    const laneEnds: number[] = [];
    const placed: Placed[] = [];
    for (const it of sorted) {
      let lane = laneEnds.findIndex((end) => end <= it.startMin);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(it.startMin + it.durationMin);
      } else {
        laneEnds[lane] = it.startMin + it.durationMin;
      }
      placed.push({ id: it.id, lane });
    }
    const lanesCount = Math.max(1, laneEnds.length);
    const byId = Object.fromEntries(placed.map((p) => [p.id, p.lane]));
    return { lanesCount, byId };
  }, [items]);

  const laneWidthPct = 100 / laneLayout.lanesCount;

  /* --------- Apply palette (recolor all items) --------- */
  function applyPalette(colors: string[]) {
    if (!colors?.length) return;
    setItems((prev) =>
      prev.map((it, idx) => ({ ...it, color: colors[idx % colors.length] }))
    );
  }

  return (
    <div className="min-h-screen w-full bg-white">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg" style={{ backgroundColor: BRAND.peacock }} />
            <div>
              <div className="text-xl font-bold tracking-tight" style={{ color: BRAND.grass }}>
                DayFlow<span className="text-black">™</span> by Dostal Digital
              </div>
              <div className="text-sm text-gray-600">Drag, drop, and design your dream day in minutes.</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="hidden md:inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" onClick={() => alert("Load coming soon")}><Upload className="h-4 w-4" /> Load</button>
            <button className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" onClick={() => (demoMode ? alert("Sign in to save your plan.") : null)}><Save className="h-4 w-4" /> Save</button>
            <button className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" onClick={() => (demoMode ? alert("Subscribe to export.") : exportText())}><Download className="h-4 w-4" /> Text</button>
            <button className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" onClick={() => (demoMode ? alert("Subscribe to export .ics.") : exportICS())}><Calendar className="h-4 w-4" /> .ics</button>
            <button className="inline-flex items-center gap-2 rounded-lg bg-black px-3 py-2 text-sm font-medium text-white"><Lock className="h-4 w-4" /> Preview</button>
          </div>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        collisionDetection={rectIntersection}
      >
        <main className="mx-auto max-w-7xl px-4 py-6">
          {/* Two-column layout: left = 1/3, right = 2/3 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* LEFT COLUMN (1/3): stacked */}
            <div className="lg:col-span-1 flex flex-col gap-6">
              {/* Event Settings */}
              <section>
                <SettingsPanel
                  timelineTitle={timelineTitle}
                  setTimelineTitle={setTimelineTitle}
                  date={date}
                  setDate={setDate}
                  startTime={startTime}
                  setStartTime={setStartTime}
                  endTime={endTime}
                  setEndTime={setEndTime}
                  slotSize={slotSize}
                  setSlotSize={setSlotSize}
                  snap={snap}
                  setSnap={setSnap}
                  pxPerMin={pxPerMin}
                  setPxPerMin={setPxPerMin}
                  fitToViewport={fitToViewport}
                />
              </section>

              {/* Drag & Drop Presets */}
              <section className="flex">
                <div className="flex h-full w-full flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-sm font-semibold tracking-wide text-gray-700">
                    Drag & Drop Presets
                  </h3>
                  <div className="space-y-2">
                    {PRESETS.map((p) => (
                      <DraggablePreset key={p.key} preset={p} />
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-gray-500">
                    Drag a preset onto the timeline. After it’s placed, drag it again to change its time.
                  </p>
                </div>
              </section>
            </div>

            {/* RIGHT COLUMN (2/3): stacked */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* TIMELINE */}
              <section>
                <h2 className="mb-2 text-sm font-semibold tracking-wide text-gray-700">
                  {timelineTitle || "Timeline"}
                </h2>
                <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between border-b bg-white px-4 py-3">
                    <div className="flex items-center gap-3 text-gray-700">
                      <Clock className="h-4 w-4" />
                      <div className="text-sm">
                        {format(parseISO(date + "T00:00:00"), "PPP")} • {startTime}–{endTime} • {slotSize}-min slots
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">Drag presets here</div>
                  </div>

                  {/* Timeline canvas */}
                  <div className="relative bg-white" style={{ height: gridHeight + 40 }} ref={gridRef}>
                    {/* left ruler */}
                    <div className="absolute left-0 top-0 w-28 select-none bg-white">
                      {Array.from({ length: Math.floor(totalMinutes / slotSize) + 1 }).map((_, idx) => {
                        const y = idx * slotSize * pxPerMin;
                        const label =
                          idx % (60 / slotSize) === 0
                            ? timeLabelFromOffset(date, startTime, idx * slotSize)
                            : "";
                        return (
                          <div key={idx} className="relative h-[2px]" style={{ top: y }}>
                            <div className="absolute -translate-y-1/2 text-[10px] text-gray-700">
                              {label}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* grid + items */}
                    <div className="absolute right-0 top-0" style={{ left: "7rem" }}>
                      {Array.from({ length: Math.floor(totalMinutes / slotSize) + 1 }).map((_, idx) => {
                        const y = idx * slotSize * pxPerMin;
                        const isHour = idx % (60 / slotSize) === 0;
                        return (
                          <div
                            key={idx}
                            className="absolute w-full border-t"
                            style={{
                              top: y,
                              borderColor: isHour ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.08)",
                            }}
                          />
                        );
                      })}
                      {items.map((it) => {
                        const top = it.startMin * pxPerMin;
                        const h = it.durationMin * pxPerMin;
                        const lane = laneLayout.byId[it.id] ?? 0;
                        const laneWidth = 100 / laneLayout.lanesCount;
                        return (
                          <DraggableTimelineItem
                            key={it.id}
                            item={it}
                            top={top}
                            height={h}
                            leftPct={lane * laneWidth}
                            widthPct={laneWidth}
                            onClick={() => setSelected(it)}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>

              {/* Palettes */}
              <section className="flex">
                <PalettesPanel
                  className="h-full w-full"
                  onApplyPalette={(colors) => {
                    applyPalette(colors);
                  }}
                />
              </section>
            </div>
          </div>

          {/* Pricing full width */}
          <div className="mt-6">
            <PricingPanel fullWidth />
          </div>
        </main>

        {/* Drag preview */}
        <DragOverlay>
          {draggingPreset ? (
            <div className="rounded-xl border bg-white px-3 py-2 shadow-lg">
              <div className="text-sm font-medium">{draggingPreset.label}</div>
              <div className="text-xs text-gray-500">{draggingPreset.standardMin} min</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Editor Modal */}
      {selected && (
        <EditorModal
          selected={selected}
          setSelected={setSelected}
          totalMinutes={totalMinutes}
          startTime={startTime}
          upsertItem={upsertItem}
          deleteItem={deleteItem}
        />
      )}

      {/* Footer */}
      <Footer />
    </div>
  );
}

/* ---------- Panels & Modal ---------- */

function SettingsPanel(props: {
  timelineTitle: string; setTimelineTitle: (v: string) => void; // NEW
  date: string; setDate: (v: string) => void;
  startTime: string; setStartTime: (v: string) => void;
  endTime: string; setEndTime: (v: string) => void;
  slotSize: number; setSlotSize: (n: number) => void;
  snap: boolean; setSnap: (b: boolean) => void;
  pxPerMin: number; setPxPerMin: (fn: (p: number) => number) => void;
  fitToViewport: () => void;
}) {
  const {
    timelineTitle, setTimelineTitle,
    date, setDate, startTime, setStartTime, endTime, setEndTime,
    slotSize, setSlotSize, snap, setSnap, setPxPerMin, fitToViewport
  } = props;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold tracking-wide text-gray-700">Event Settings</h3>

      {/* Title Field */}
      <label className="block text-xs text-gray-600">
        Timeline Title
        <input
          type="text"
          value={timelineTitle}
          onChange={(e) => setTimelineTitle(e.target.value)}
          placeholder="Johnson Wedding | Sarah & Sam"
          className="mt-1 w-full rounded-lg border px-2 py-1 text-sm"
        />
      </label>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-xs text-gray-600">Date
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 w-full rounded-lg border px-2 py-1 text-sm" />
        </label>
        <label className="text-xs text-gray-600">Start
          <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="mt-1 w-full rounded-lg border px-2 py-1 text-sm" />
        </label>
        <label className="text-xs text-gray-600">End
          <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="mt-1 w-full rounded-lg border px-2 py-1 text-sm" />
        </label>
        <label className="text-xs text-gray-600">Slot Size (min)
          <select value={slotSize} onChange={e => setSlotSize(Number(e.target.value))} className="mt-1 w-full rounded-lg border px-2 py-1 text-sm">
            {[5, 10, 15, 30, 45, 60].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <label className="inline-flex items-center gap-2 text-xs text-gray-700">
          <input type="checkbox" checked={snap} onChange={e => setSnap(e.target.checked)} /> Snap to grid
        </label>
        <div className="flex items-center gap-1">
          <button className="rounded-lg border px-2 py-1 text-xs" onClick={() => setPxPerMin(p => Math.min(6, p + 0.5))} title="Zoom in"><ZoomIn className="h-3 w-3" /></button>
          <button className="rounded-lg border px-2 py-1 text-xs" onClick={() => setPxPerMin(p => Math.max(1, p - 0.5))} title="Zoom out"><ZoomOut className="h-3 w-3" /></button>
          <button className="rounded-lg border px-2 py-1 text-xs" onClick={fitToViewport} title="Fit"><Maximize2 className="h-3 w-3" /></button>
        </div>
      </div>
    </div>
  );
}

function PalettesPanel({
  className = "",
  onApplyPalette,
}: {
  className?: string;
  onApplyPalette: (colors: string[]) => void;
}) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-4 shadow-sm ${className}`}>
      <h3 className="mb-3 text-sm font-semibold tracking-wide text-gray-700">
        Wedding Color Palettes (Favs from the past 2 Years)
      </h3>
      <div className="grid grid-cols-1 gap-3">
        {FAVORITE_PALETTES.map((p, idx) => (
          <button
            key={idx}
            className="rounded-xl border p-3 text-left transition hover:border-black/40"
            onClick={() => onApplyPalette(p.chips)}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">{p.name}</div>
              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs">{p.year}</span>
            </div>
            <div className="mt-2 flex gap-2">
              {p.chips.map((c, i) => (
                <div key={i} className="h-6 w-6 rounded-md border" style={{ backgroundColor: c }} title={c} />
              ))}
            </div>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-500">Click a palette to instantly recolor your entire timeline.</p>
    </div>
  );
}

function PricingPanel({ fullWidth = false }: { fullWidth?: boolean }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold tracking-wide text-gray-700">Pricing</h3>
      <div className={`grid ${fullWidth ? "grid-cols-1 sm:grid-cols-2 gap-4" : "grid-cols-1"}`}>
        <div className="rounded-xl border p-3" style={{ borderColor: BRAND.grass }}>
          <div className="text-sm font-bold" style={{ color: BRAND.grass }}>Couples</div>
          <ul className="mt-1 list-disc pl-5 text-sm text-gray-700">
            <li>One-time $29.99</li>
            <li>Monthly $9.99</li>
          </ul>
        </div>
        <div className="rounded-xl border p-3" style={{ borderColor: BRAND.peacock }}>
          <div className="text-sm font-bold" style={{ color: BRAND.peacock }}>Professionals</div>
          <ul className="mt-1 list-disc pl-5 text-sm text-gray-700">
            <li>Monthly $19.99</li>
            <li>Yearly $199.99</li>
          </ul>
        </div>
      </div>
      <button className="mt-4 w-full rounded-xl bg-black py-2 text-sm font-medium text-white">Sign up to unlock</button>
      <p className="mt-2 text-center text-xs text-gray-500">Preview mode limits saving and exports.</p>
    </div>
  );
}

function EditorModal(props: {
  selected: Item;
  setSelected: (i: Item | null) => void;
  totalMinutes: number;
  startTime: string;
  upsertItem: (u: Item) => void;
  deleteItem: (id: string) => void;
}) {
  const { selected, setSelected, totalMinutes, startTime, upsertItem, deleteItem } = props;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
      <div className="w-full max-w-md rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 text-sm font-semibold">Edit Item</div>
        <label className="block text-xs text-gray-600">Title
          <input className="mt-1 w-full rounded-lg border px-2 py-1 text-sm" value={selected.title} onChange={(e) => setSelected({ ...selected, title: e.target.value })} />
        </label>

        <div className="mt-2 grid grid-cols-2 gap-3">
          <label className="text-xs text-gray-600">Start Time
            <input
              type="time"
              className="mt-1 w-full rounded-lg border px-2 py-1 text-sm"
              value={hhmmFromStartAndOffset(startTime, selected.startMin)}
              onChange={(e) => {
                const [hh, mm] = e.target.value.split(":").map(Number);
                const [sh, sm] = startTime.split(":").map(Number);
                const offsetMin = hh * 60 + mm - (sh * 60 + sm);
                setSelected({
                  ...selected,
                  startMin: clamp(offsetMin, 0, Math.max(0, totalMinutes - selected.durationMin)),
                });
              }}
            />
          </label>

          <label className="text-xs text-gray-600">Duration (min)
            <input
              type="number"
              className="mt-1 w-full rounded-lg border px-2 py-1 text-sm"
              value={selected.durationMin}
              onChange={(e) =>
                setSelected({
                  ...selected,
                  durationMin: clamp(parseInt(e.target.value || "0"), 5, 12 * 60),
                })
              }
            />
          </label>
        </div>

        <label className="mt-2 block text-xs text-gray-600">Color
          <input className="mt-1 w-full rounded-lg border px-2 py-1 text-sm" value={selected.color} onChange={(e) => setSelected({ ...selected, color: e.target.value })} />
        </label>
        <label className="mt-2 block text-xs text-gray-600">Notes
          <textarea className="mt-1 w-full rounded-lg border px-2 py-1 text-sm" value={selected.notes || ""} onChange={(e) => setSelected({ ...selected, notes: e.target.value })} rows={3} placeholder="e.g., Travel to park for portraits" />
        </label>
        <div className="mt-3 flex items-center justify-between">
          <button className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm" onClick={() => deleteItem(selected.id)}>
            <Trash2 className="h-4 w-4" /> Delete
          </button>
          <div className="flex gap-2">
            <button className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => setSelected(null)}>Cancel</button>
            <button className="rounded-lg bg-black px-3 py-1.5 text-sm font-medium text-white" onClick={() => upsertItem(selected)}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-8 border-t border-black/5 bg-white/70">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-center md:flex-row md:text-left">
        <p className="text-xs text-gray-600">
          Thank you for using <span className="font-semibold">DayFlow™</span> by Dostal Digital · Export .ics to add your schedule to Google/Apple Calendar. Save stores your plan in this browser.
        </p>
        <div className="flex items-center gap-4 text-xs text-gray-600">
          <a href="https://dostaldigital.com" target="_blank" className="underline" rel="noreferrer">Photography & Videography</a>
          <div className="flex items-center gap-3">
            <a aria-label="Instagram" href="https://instagram.com/dostaldigital" className="underline">IG</a>
            <a aria-label="TikTok" href="https://tiktok.com/@dostaldigital" className="underline">TT</a>
            <a aria-label="Facebook" href="http://facebook.com/dostaldigital" className="underline">FB</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
