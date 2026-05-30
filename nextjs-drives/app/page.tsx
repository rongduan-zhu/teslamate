import { DriveTable } from "@/app/drive-table";
import { listDrives, listTags } from "@/lib/drives";

export default async function HomePage() {
  const [drivesPage, tags] = await Promise.all([listDrives({ page: 1, perPage: 25 }), listTags()]);

  return <DriveTable initialDrivesPage={drivesPage} initialTags={tags} />;
}
