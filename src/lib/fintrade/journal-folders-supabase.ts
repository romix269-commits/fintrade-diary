import type { JournalFolder } from "@/lib/fintrade/store";
import { createClient } from "@/lib/supabase/client";

type JournalFolderRow = {
  id: string;
  diary_id: string | null;
  name: string | null;
  color: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function rowToJournalFolder(row: JournalFolderRow): JournalFolder {
  const folder: Record<string, unknown> = {
    id: row.id,
    diaryId: row.diary_id ?? undefined,
    name: row.name ?? "",
    color: row.color ?? "",
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };

  return folder as unknown as JournalFolder;
}

function journalFolderToRow(folder: JournalFolder): JournalFolderRow {
  const anyFolder = folder as unknown as Record<string, unknown>;
  const now = new Date().toISOString();

  const id =
    typeof anyFolder.id === "string"
      ? anyFolder.id
      : crypto.randomUUID();

  const diaryId =
    typeof anyFolder.diaryId === "string"
      ? anyFolder.diaryId
      : typeof anyFolder.diary_id === "string"
        ? (anyFolder.diary_id as string)
        : null;

  const name =
    typeof anyFolder.name === "string" ? anyFolder.name : "";

  const color =
    typeof anyFolder.color === "string" ? anyFolder.color : null;

  const createdAt =
    typeof anyFolder.createdAt === "string"
      ? anyFolder.createdAt
      : typeof anyFolder.created_at === "string"
        ? (anyFolder.created_at as string)
        : now;

  const updatedAt =
    typeof anyFolder.updatedAt === "string"
      ? anyFolder.updatedAt
      : typeof anyFolder.updated_at === "string"
        ? (anyFolder.updated_at as string)
        : now;

  return {
    id,
    diary_id: diaryId,
    name,
    color,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export async function loadJournalFoldersFromSupabase(): Promise<JournalFolder[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("journal_folders")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Ошибка загрузки journal_folders из Supabase:");
    console.error("message:", error.message);
    console.error("details:", error.details);
    console.error("hint:", error.hint);
    console.error("code:", error.code);
    throw error;
  }

  const rows = (data ?? []) as JournalFolderRow[];
  return rows.map(rowToJournalFolder);
}

export async function saveJournalFoldersToSupabase(
  folders: JournalFolder[]
): Promise<void> {
  const supabase = createClient();
  const rows = folders.map((folder) => journalFolderToRow(folder));

  const { error } = await supabase
    .from("journal_folders")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    console.error("Ошибка сохранения journal_folders в Supabase:");
    console.error("message:", error.message);
    console.error("details:", error.details);
    console.error("hint:", error.hint);
    console.error("code:", error.code);
    console.error("row sample:", rows[0]);
    throw error;
  }
}