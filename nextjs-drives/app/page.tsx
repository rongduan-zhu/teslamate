import { DriveTable } from "@/app/drive-table";
import { listDrives, listTags } from "@/lib/drives";

export default async function HomePage() {
  const [drives, tags] = await Promise.all([listDrives(), listTags()]);

  return <DriveTable initialDrives={drives} initialTags={tags} />;
}
