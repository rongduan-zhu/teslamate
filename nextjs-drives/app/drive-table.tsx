"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Drive } from "@/lib/drives";

export function DriveTable({
  initialDrives,
  initialTags,
}: {
  initialDrives: Drive[];
  initialTags: string[];
}) {
  const [drives, setDrives] = useState(initialDrives);
  const [tags, setTags] = useState(initialTags);
  const [carFilter, setCarFilter] = useState("");

  const cars = useMemo(() => {
    return Array.from(new Set(drives.map((drive) => drive.car).filter(Boolean))).sort();
  }, [drives]);

  const filteredDrives = useMemo(() => {
    if (!carFilter) return drives;
    return drives.filter((drive) => drive.car === carFilter);
  }, [carFilter, drives]);

  function updateDrive(drive: Drive) {
    setDrives((current) => current.map((item) => (item.id === drive.id ? drive : item)));
    setTags((current) => Array.from(new Set([...current, ...drive.tags])).sort());
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">TeslaMate</p>
          <h1>Drives</h1>
        </div>
        <div className="summary">
          <strong>{filteredDrives.length}</strong>
          <span>of {drives.length} drives</span>
        </div>
      </header>

      <section className="filters" aria-label="Drive filters">
        <label className="filterControl">
          <span>Car</span>
          <div className="selectWrap">
            <select value={carFilter} onChange={(event) => setCarFilter(event.target.value)}>
              <option value="">All cars</option>
              {cars.map((car) => (
                <option key={car} value={car}>
                  {car}
                </option>
              ))}
            </select>
          </div>
        </label>
      </section>

      <section className="driveList" aria-label="Drives">
        <div className="desktopGrid headerRow">
          <span>ID</span>
          <span>Car</span>
          <span>Start</span>
          <span>End</span>
          <span>From</span>
          <span>To</span>
          <span>Distance</span>
          <span>Notes & tags</span>
        </div>
        {filteredDrives.map((drive) => (
          <DriveRow
            key={drive.id}
            allTags={tags}
            drive={drive}
            onUpdate={updateDrive}
          />
        ))}
        {filteredDrives.length === 0 ? <p className="empty">No drives match this car.</p> : null}
      </section>
    </main>
  );
}

function DriveRow({
  allTags,
  drive,
  onUpdate,
}: {
  allTags: string[];
  drive: Drive;
  onUpdate: (drive: Drive) => void;
}) {
  const [notes, setNotes] = useState(drive.notes);
  const [selectedTags, setSelectedTags] = useState(drive.tags);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [expanded, setExpanded] = useState(false);

  async function save() {
    setStatus("saving");
    const response = await fetch(`/api/drives/${drive.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ notes, tags: selectedTags }),
    });

    if (!response.ok) {
      setStatus("error");
      return;
    }

    const body = (await response.json()) as { drive: Drive };
    onUpdate(body.drive);
    setNotes(body.drive.notes);
    setSelectedTags(body.drive.tags);
    setStatus("saved");
  }

  const summary = (
    <div className="mobileSummary">
      <LazyMiniRouteMap drive={drive} />
      <div className="mobileSummaryMain">
        <strong>#{drive.id}</strong>
        <span>{drive.car || "Unknown car"}</span>
        <span>{formatShortDateTime(drive.startDate)}</span>
        <span>{drive.distanceKm.toFixed(1)} km</span>
        {drive.tags.length > 0 ? (
          <span className="mobileSummaryTags">
            {drive.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </span>
        ) : null}
      </div>
    </div>
  );

  return (
    <article className={`driveRow ${expanded ? "expanded" : ""}`}>
      <button
        className="mobileSummaryButton"
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        {summary}
      </button>
      <div className="desktopGrid driveGrid">
        <Cell label="ID">{drive.id}</Cell>
        <Cell label="Car">{drive.car || "-"}</Cell>
        <Cell label="Start">{formatDateTime(drive.startDate)}</Cell>
        <Cell label="End">{formatDateTime(drive.endDate)}</Cell>
        <Cell label="From">{drive.startAddress || "-"}</Cell>
        <Cell label="To">{drive.endAddress || "-"}</Cell>
        <Cell label="Distance">{drive.distanceKm.toFixed(1)} km</Cell>
        <DriveEditor
          allTags={allTags}
          driveId={drive.id}
          notes={notes}
          selectedTags={selectedTags}
          status={status}
          onNotesChange={(value) => {
            setNotes(value);
            setStatus("idle");
          }}
          onTagsChange={(value) => {
            setSelectedTags(value);
            setStatus("idle");
          }}
          onSave={save}
        />
      </div>
    </article>
  );
}

function DriveEditor({
  allTags,
  driveId,
  notes,
  selectedTags,
  status,
  onNotesChange,
  onTagsChange,
  onSave,
}: {
  allTags: string[];
  driveId: number;
  notes: string;
  selectedTags: string[];
  status: "idle" | "saving" | "saved" | "error";
  onNotesChange: (value: string) => void;
  onTagsChange: (value: string[]) => void;
  onSave: () => void;
}) {
  return (
    <div className="editor">
      <textarea
        aria-label={`Notes for drive ${driveId}`}
        value={notes}
        onChange={(event) => onNotesChange(event.target.value)}
        rows={3}
      />
      <select
        aria-label={`Tags for drive ${driveId}`}
        className="nativeMulti"
        multiple
        value={selectedTags}
        onChange={(event) =>
          onTagsChange(Array.from(event.currentTarget.selectedOptions, (option) => option.value))
        }
      >
        {allTags.map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </select>
      <div className="tagChoices" aria-hidden="true">
        {allTags.map((tag) => {
          const selected = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              className={`tagChip ${selected ? "selected" : ""}`}
              type="button"
              onClick={() =>
                onTagsChange(
                  selected ? selectedTags.filter((item) => item !== tag) : [...selectedTags, tag]
                )
              }
            >
              {tag}
            </button>
          );
        })}
      </div>
      <div className="actions">
        <button type="button" onClick={onSave} disabled={status === "saving"}>
          {status === "saving" ? "Saving" : "Save"}
        </button>
        <span className={`status ${status}`}>{statusLabel(status)}</span>
      </div>
    </div>
  );
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="cell">
      <span className="mobileLabel">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function LazyMiniRouteMap({ drive }: { drive: Drive }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;
    const reveal = () => setVisible(true);
    const revealIfNearViewport = () => {
      if (isNearViewport(node, 220)) {
        reveal();
      }
    };

    revealIfNearViewport();
    const animationFrame = window.requestAnimationFrame(revealIfNearViewport);
    let observer: IntersectionObserver | null = null;

    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            reveal();
            observer?.disconnect();
          }
        },
        { rootMargin: "220px" }
      );

      observer.observe(node);
    }

    window.addEventListener("scroll", revealIfNearViewport, { passive: true });
    window.addEventListener("resize", revealIfNearViewport);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer?.disconnect();
      window.removeEventListener("scroll", revealIfNearViewport);
      window.removeEventListener("resize", revealIfNearViewport);
    };
  }, [visible]);

  return (
    <span ref={ref} className="miniMapShell">
      {visible ? <MiniRouteMap drive={drive} /> : <span className="miniMap loadingMap" aria-hidden="true" />}
    </span>
  );
}

function MiniRouteMap({ drive }: { drive: Drive }) {
  const map = buildMiniMap(drive);

  if (!map) {
    return (
      <span className="miniMap emptyMap" aria-hidden="true">
        <span />
      </span>
    );
  }

  return (
    <span className="miniMap tileMap" role="img" aria-label="Start and end map preview">
      {map.tiles.map((tile) => (
        <img
          key={`${tile.x}-${tile.y}`}
          alt=""
          aria-hidden="true"
          decoding="async"
          loading="lazy"
          referrerPolicy="no-referrer"
          src={`https://tile.openstreetmap.org/${map.zoom}/${tile.x}/${tile.y}.png`}
          style={{ left: tile.left, top: tile.top }}
        />
      ))}
      <svg viewBox={`0 0 ${map.width} ${map.height}`} aria-hidden="true">
        <line x1={map.start.x} y1={map.start.y} x2={map.end.x} y2={map.end.y} />
        <circle className="startDot" cx={map.start.x} cy={map.start.y} r="3" />
        <circle className="endDot" cx={map.end.x} cy={map.end.y} r="3" />
      </svg>
    </span>
  );
}

function buildMiniMap(drive: Drive) {
  const width = 58;
  const height = 38;
  const start = drive.startLocation;
  const end = drive.endLocation;
  if (!start || !end) return null;

  const zoom = chooseZoom(start, end, width, height);
  const startWorld = toWorldPixel(start.latitude, start.longitude, zoom);
  const endWorld = toWorldPixel(end.latitude, end.longitude, zoom);
  const center = {
    x: (startWorld.x + endWorld.x) / 2,
    y: (startWorld.y + endWorld.y) / 2,
  };
  const left = center.x - width / 2;
  const top = center.y - height / 2;
  const firstTileX = Math.floor(left / 256);
  const lastTileX = Math.floor((left + width) / 256);
  const firstTileY = Math.floor(top / 256);
  const lastTileY = Math.floor((top + height) / 256);
  const tileMax = 2 ** zoom;
  const tiles = [];

  for (let x = firstTileX; x <= lastTileX; x += 1) {
    for (let y = firstTileY; y <= lastTileY; y += 1) {
      const wrappedX = ((x % tileMax) + tileMax) % tileMax;
      const clampedY = Math.max(0, Math.min(tileMax - 1, y));
      tiles.push({
        x: wrappedX,
        y: clampedY,
        left: x * 256 - left,
        top: y * 256 - top,
      });
    }
  }

  return {
    width,
    height,
    zoom,
    tiles,
    start: { x: startWorld.x - left, y: startWorld.y - top },
    end: { x: endWorld.x - left, y: endWorld.y - top },
  };
}

function isNearViewport(node: HTMLElement, margin: number) {
  const rect = node.getBoundingClientRect();

  return (
    rect.bottom >= -margin &&
    rect.right >= -margin &&
    rect.top <= window.innerHeight + margin &&
    rect.left <= window.innerWidth + margin
  );
}

function chooseZoom(
  start: NonNullable<Drive["startLocation"]>,
  end: NonNullable<Drive["endLocation"]>,
  width: number,
  height: number
) {
  for (let zoom = 16; zoom >= 3; zoom -= 1) {
    const startWorld = toWorldPixel(start.latitude, start.longitude, zoom);
    const endWorld = toWorldPixel(end.latitude, end.longitude, zoom);
    if (Math.abs(startWorld.x - endWorld.x) <= width - 24 && Math.abs(startWorld.y - endWorld.y) <= height - 20) {
      return zoom;
    }
  }

  return 3;
}

function toWorldPixel(latitude: number, longitude: number, zoom: number) {
  const sinLatitude = Math.sin((Math.max(-85.05112878, Math.min(85.05112878, latitude)) * Math.PI) / 180);
  const scale = 256 * 2 ** zoom;

  return {
    x: ((longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * scale,
  };
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "America/Los_Angeles",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatShortDateTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  }).format(new Date(value));
}

function statusLabel(status: "idle" | "saving" | "saved" | "error") {
  if (status === "saved") return "Saved";
  if (status === "error") return "Could not save";
  return "";
}
