import type { JournalNote } from "@/lib/fintrade/store";
import { createClient } from "@/lib/supabase/client";

type JournalNoteRow = {
  id: string;
  diary_id: string | null;
  title: string | null;
  content: string | null;
  folder_id: string | null;
  tags: unknown;
  mood: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function rowToJournalNote(row: JournalNoteRow): JournalNote {
  const note: Record<string, unknown> = {
    id: row.id,
    diaryId: row.diary_id ?? undefined,
    title: row.title ?? "",
    createdAt: row.created_at ?? new Date().toISOString(),

    content: row.content ?? "",
    text: row.content ?? "",
    body: row.content ?? "",

    folderId: row.folder_id ?? undefined,
    folder_id: row.folder_id ?? undefined,
    folder: row.folder_id ?? undefined,

    tags: normalizeTags(row.tags),
    mood: row.mood ?? "",
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };

  return note as unknown as JournalNote;
}

function journalNoteToRow(note: JournalNote): JournalNoteRow {
  const anyNote = note as unknown as Record<string, unknown>;
  const now = new Date().toISOString();

  const createdAt =
    typeof anyNote.createdAt === "string"
      ? anyNote.createdAt
      : typeof anyNote.created_at === "string"
        ? (anyNote.created_at as string)
        : now;

  const updatedAt =
    typeof anyNote.updatedAt === "string"
      ? anyNote.updatedAt
      : typeof anyNote.updated_at === "string"
        ? (anyNote.updated_at as string)
        : now;

  const content =
    typeof anyNote.content === "string"
      ? anyNote.content
      : typeof anyNote.text === "string"
        ? (anyNote.text as string)
        : typeof anyNote.body === "string"
          ? (anyNote.body as string)
          : "";

  const folderId =
    typeof anyNote.folderId === "string"
      ? anyNote.folderId
      : typeof anyNote.folder_id === "string"
        ? (anyNote.folder_id as string)
        : typeof anyNote.folder === "string"
          ? (anyNote.folder as string)
          : null;

  const tags = Array.isArray(anyNote.tags)
    ? anyNote.tags.map((item) => String(item))
    : [];

  const mood = typeof anyNote.mood === "string" ? anyNote.mood : null;

  const diaryId =
    typeof anyNote.diaryId === "string"
      ? anyNote.diaryId
      : typeof anyNote.diary_id === "string"
        ? (anyNote.diary_id as string)
        : null;

  const title = typeof anyNote.title === "string" ? anyNote.title : "";

  const id =
    typeof anyNote.id === "string"
      ? anyNote.id
      : crypto.randomUUID();

  return {
    id,
    diary_id: diaryId,
    title,
    content,
    folder_id: folderId,
    tags,
    mood,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export async function loadJournalFromSupabase(): Promise<JournalNote[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("journal_notes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Ошибка загрузки journal_notes из Supabase:");
    console.error("message:", error.message);
    console.error("details:", error.details);
    console.error("hint:", error.hint);
    console.error("code:", error.code);
    throw error;
  }

  const rows = (data ?? []) as JournalNoteRow[];
  return rows.map(rowToJournalNote);
}

export async function saveJournalToSupabase(notes: JournalNote[]): Promise<void> {
  const supabase = createClient();
  const rows = notes.map((note) => journalNoteToRow(note));

  const { error } = await supabase
    .from("journal_notes")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    console.error("Ошибка сохранения journal_notes в Supabase:");
    console.error("message:", error.message);
    console.error("details:", error.details);
    console.error("hint:", error.hint);
    console.error("code:", error.code);
    console.error("row sample:", rows[0]);
    throw error;
  }
}