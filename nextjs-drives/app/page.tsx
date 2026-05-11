import { listDrives } from "@/lib/drives";

export default async function HomePage() {
  const drives = await listDrives();

  return (
    <main style={{ margin: "2rem auto", maxWidth: 900, fontFamily: "sans-serif" }}>
      <h1>Teslamate Drives</h1>
      <p>Next.js rewrite focused on drive listing + notes/tags updates.</p>
      <table width="100%" cellPadding={8} style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th align="left">ID</th>
            <th align="left">From</th>
            <th align="left">To</th>
            <th align="left">Notes</th>
            <th align="left">Tags</th>
          </tr>
        </thead>
        <tbody>
          {drives.map((d) => (
            <tr key={d.id} style={{ borderTop: "1px solid #ddd" }}>
              <td>{d.id}</td>
              <td>{d.startAddress}</td>
              <td>{d.endAddress}</td>
              <td>{d.notes || "—"}</td>
              <td>{d.tags.join(", ") || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: "1rem", color: "#666" }}>
        Update metadata via PATCH /api/drives/:id with JSON {`{"notes":"...","tags":["..."]}`}
      </p>
    </main>
  );
}
