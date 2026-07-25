export function overlapSeconds(drive, entry) {
  const driveStart = Date.parse(drive.startDate);
  const driveEnd = Date.parse(drive.endDate);
  const entryStart = Date.parse(entry.start);
  const entryEnd = entry.stop ? Date.parse(entry.stop) : entryStart + Math.max(0, entry.duration) * 1000;

  if (![driveStart, driveEnd, entryStart, entryEnd].every(Number.isFinite)) return 0;
  return Math.max(0, Math.floor((Math.min(driveEnd, entryEnd) - Math.max(driveStart, entryStart)) / 1000));
}

export function matchDrive(drive, entries, minimumOverlapSeconds = 60) {
  const matches = entries
    .map((entry) => ({ entry, overlapSeconds: overlapSeconds(drive, entry) }))
    .filter((match) => match.overlapSeconds >= minimumOverlapSeconds)
    .sort((a, b) => b.overlapSeconds - a.overlapSeconds);

  if (matches.length === 0) return null;

  const tags = unique([
    "toggl",
    ...matches.flatMap(({ entry }) => [entry.project_name, ...(entry.tags ?? [])]),
  ].map(cleanTag).filter(Boolean)).slice(0, 20);

  const noteLines = matches.map(({ entry, overlapSeconds: seconds }) => {
    const description = cleanText(entry.description) || `time entry ${entry.id}`;
    return `Toggl: ${description} (${Math.round(seconds / 60)} min overlap)`;
  });

  return {
    notes: noteLines.join("\n").slice(0, 2000),
    tags,
    togglEntryIds: matches.map(({ entry }) => entry.id),
    overlapSeconds: matches.reduce((total, match) => total + match.overlapSeconds, 0),
    candidateEntries: matches.map(({ entry, overlapSeconds: seconds }) => ({
      id: entry.id,
      start: entry.start,
      stop: entry.stop,
      description: cleanText(entry.description),
      project: cleanText(entry.project_name),
      tags: (entry.tags ?? []).map(cleanTag).filter(Boolean),
      overlapSeconds: seconds,
    })),
  };
}

function cleanText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanTag(value) {
  return cleanText(value).slice(0, 64);
}

function unique(values) {
  return [...new Set(values)];
}
