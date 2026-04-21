"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { JournalFolder, JournalNote } from "@/lib/fintrade/store";
import { createId, formatDateTime } from "@/lib/fintrade/store";

type Props = {
  journal: JournalNote[];
  allJournal: JournalNote[];
  activeDiaryId: string | null;
  updateJournal: (journal: JournalNote[]) => void;
  folders: JournalFolder[];
  updateFolders: (folders: JournalFolder[]) => void;
};

const MAX_IMAGE_WIDTH = 1600;
const JPEG_QUALITY = 0.82;

export default function JournalView({
  journal,
  allJournal,
  activeDiaryId,
  updateJournal,
  folders,
  updateFolders,
}: Props) {
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string>("all");

  const [notice, setNotice] = useState<string | null>(null);

  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const [folderToDeleteId, setFolderToDeleteId] = useState<string | null>(null);
  const [noteToDeleteId, setNoteToDeleteId] = useState<string | null>(null);

  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  useEffect(() => {
    if (activeFolderId !== "all" && !folders.some((folder) => folder.id === activeFolderId)) {
      setActiveFolderId("all");
    }
  }, [activeFolderId, folders]);

  useEffect(() => {
    if (!fullscreenImage) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFullscreenImage(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fullscreenImage]);

  const filteredJournal = useMemo(() => {
    if (activeFolderId === "all") return journal;
    return journal.filter((note) => note.journalId === activeFolderId);
  }, [journal, activeFolderId]);

  const previewNote = useMemo(() => {
    const note = journal.find((item) => item.id === previewId) ?? null;
    if (!note) return null;
    if (activeFolderId === "all") return note;
    return note.journalId === activeFolderId ? note : null;
  }, [journal, previewId, activeFolderId]);

  const activeFolderTitle =
    activeFolderId === "all"
      ? "Все заметки"
      : folders.find((folder) => folder.id === activeFolderId)?.name || "Журнал";

  const folderToDelete = useMemo(
    () => folders.find((folder) => folder.id === folderToDeleteId) ?? null,
    [folders, folderToDeleteId]
  );

  const folderDeleteNotesCount = useMemo(() => {
    if (!folderToDeleteId) return 0;
    return allJournal.filter(
      (note) => note.journalId === folderToDeleteId && note.diaryId === activeDiaryId
    ).length;
  }, [allJournal, folderToDeleteId, activeDiaryId]);

  const noteToDelete = useMemo(
    () => allJournal.find((note) => note.id === noteToDeleteId) ?? null,
    [allJournal, noteToDeleteId]
  );

  const resetForm = () => {
    setEditId(null);
    setTitle("");
    setText("");
    setImages([]);
  };

  const showNotice = (text: string) => {
    setNotice(text);
  };

  const openCreateFolderModal = () => {
    setNewFolderName("");
    setIsCreateFolderModalOpen(true);
  };

  const openFullscreenImage = (src: string) => {
    setFullscreenImage(src);
  };

  const closeFullscreenImage = () => {
    setFullscreenImage(null);
  };

  const handleConfirmCreateFolder = () => {
    const trimmedName = newFolderName.trim();

    if (!trimmedName) {
      showNotice("Введите название нового журнала.");
      return;
    }

    if (folders.some((folder) => folder.name.toLowerCase() === trimmedName.toLowerCase())) {
      showNotice("Журнал с таким названием уже существует.");
      return;
    }

    const newFolder: JournalFolder = {
      id: createId(),
      name: trimmedName,
    };

    updateFolders([...folders, newFolder]);
    setActiveFolderId(newFolder.id);
    setPreviewId(null);
    resetForm();
    setIsCreateFolderModalOpen(false);
    setNewFolderName("");
  };

  const openDeleteFolderModal = (folderId: string) => {
    const folder = folders.find((item) => item.id === folderId);
    if (!folder) return;

    if (folder.system) {
      showNotice("Системный журнал удалить нельзя.");
      return;
    }

    setFolderToDeleteId(folderId);
  };

  const handleConfirmDeleteFolder = () => {
    if (!folderToDeleteId) return;

    updateFolders(folders.filter((item) => item.id !== folderToDeleteId));
    updateJournal(allJournal.filter((note) => note.journalId !== folderToDeleteId));

    if (activeFolderId === folderToDeleteId) {
      setActiveFolderId("all");
    }

    if (previewId) {
      const currentPreview = journal.find((note) => note.id === previewId);
      if (currentPreview?.journalId === folderToDeleteId) {
        setPreviewId(null);
      }
    }

    if (editId) {
      const editingNote = journal.find((note) => note.id === editId);
      if (editingNote?.journalId === folderToDeleteId) {
        resetForm();
      }
    }

    setFolderToDeleteId(null);
  };

  const loadImageElement = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image load failed"));
      img.src = src;
    });

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(file);
    });

  const compressImage = async (file: File): Promise<string> => {
    const originalDataUrl = await fileToDataUrl(file);
    const img = await loadImageElement(originalDataUrl);

    let width = img.width;
    let height = img.height;

    if (width > MAX_IMAGE_WIDTH) {
      const ratio = MAX_IMAGE_WIDTH / width;
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return originalDataUrl;

    ctx.drawImage(img, 0, 0, width, height);

    try {
      return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    } catch {
      return originalDataUrl;
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    try {
      const uploaded = await Promise.all(files.map((file) => compressImage(file)));
      setImages((prev) => [...prev, ...uploaded.filter(Boolean)]);
      showNotice("Изображения загружены и сжаты для локального хранения.");
    } catch {
      showNotice("Не удалось загрузить изображения.");
    }

    e.target.value = "";
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!activeDiaryId) {
      showNotice("Сначала выберите активный торговый дневник.");
      return;
    }

    if (!title.trim() || !text.trim()) {
      showNotice("Заполните заголовок и текст заметки.");
      return;
    }

    if (activeFolderId === "all") {
      showNotice("Сначала выберите журнал слева, чтобы сохранить заметку.");
      return;
    }

    try {
      if (editId) {
        const updated = allJournal.map((note) =>
          note.id === editId
            ? {
                ...note,
                title: title.trim(),
                text: text.trim(),
                journalId: activeFolderId,
                images,
                diaryId: note.diaryId ?? activeDiaryId,
              }
            : note
        );

        updateJournal(updated);
        setPreviewId(editId);
      } else {
        const newNote: JournalNote = {
          id: createId(),
          journalId: activeFolderId,
          title: title.trim(),
          text: text.trim(),
          createdAt: new Date().toISOString(),
          images,
          diaryId: activeDiaryId,
        };

        updateJournal([newNote, ...allJournal]);
        setPreviewId(newNote.id);
      }

      resetForm();
    } catch {
      showNotice(
        "Не удалось сохранить заметку. Локальное хранилище переполнено. Попробуйте удалить часть изображений или старые записи."
      );
    }
  };

  const handleEdit = (id: string) => {
    const note = allJournal.find((item) => item.id === id);
    if (!note) return;

    setEditId(id);
    setTitle(note.title);
    setText(note.text);
    setImages(note.images || []);
    setPreviewId(id);
    setActiveFolderId(note.journalId);
  };

  const openDeleteNoteModal = (id: string) => {
    setNoteToDeleteId(id);
  };

  const handleConfirmDeleteNote = () => {
    if (!noteToDeleteId) return;

    updateJournal(allJournal.filter((note) => note.id !== noteToDeleteId));

    if (editId === noteToDeleteId) resetForm();
    if (previewId === noteToDeleteId) setPreviewId(null);

    setNoteToDeleteId(null);
  };

  return (
    <>
      {notice && (
        <div className="mb-4 rounded-[20px] border border-[rgba(56,189,248,.16)] bg-[rgba(56,189,248,.08)] px-5 py-4 text-[15px] text-[#7dd3fc]">
          <div className="flex items-start justify-between gap-3">
            <div>{notice}</div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="shrink-0 text-xs opacity-80 transition hover:opacity-100"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      <section
        className="overflow-hidden rounded-[28px] border border-[rgba(56,189,248,.10)] bg-[linear-gradient(180deg,rgba(13,25,43,.96),rgba(7,13,26,.98))]"
        style={{ boxShadow: "0 18px 50px rgba(0,0,0,.28)" }}
      >
        <div className="grid min-h-[720px] grid-cols-[250px_360px_minmax(0,1fr)]">
          <div className="border-r border-[rgba(56,189,248,.08)] p-4">
            <div className="mb-4 flex items-center justify-between">
              <strong className="text-[18px] font-bold text-white">Журналы</strong>
              <button
                type="button"
                className="mini-btn"
                onClick={openCreateFolderModal}
                title="Создать журнал"
              >
                +
              </button>
            </div>

            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => setActiveFolderId("all")}
                className={`item text-left transition ${
                  activeFolderId === "all"
                    ? "border-[rgba(56,189,248,.22)] bg-[rgba(19,36,63,.72)]"
                    : ""
                }`}
              >
                Все заметки
                <span className="float-right text-[#8aa6c7]">{journal.length}</span>
              </button>

              {folders.map((folder) => {
                const folderCount = journal.filter((note) => note.journalId === folder.id).length;

                return (
                  <div
                    key={folder.id}
                    className={`item transition ${
                      activeFolderId === folder.id
                        ? "border-[rgba(56,189,248,.22)] bg-[rgba(19,36,63,.72)]"
                        : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveFolderId(folder.id)}
                      className="w-full text-left text-white"
                    >
                      {folder.name}
                      <span className="float-right text-[#8aa6c7]">{folderCount}</span>
                    </button>

                    {!folder.system && (
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          className="mini-btn mini-btn-del"
                          onClick={() => openDeleteFolderModal(folder.id)}
                        >
                          Удалить журнал
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-r border-[rgba(56,189,248,.08)] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="m-0 text-[18px] font-bold text-white">{activeFolderTitle}</h3>

              <div className="flex gap-2">
                <button type="button" className="btn btn-secondary" onClick={handleSave}>
                  {editId ? "Обновить" : "Создать"}
                </button>

                {editId && (
                  <button type="button" className="btn btn-secondary" onClick={resetForm}>
                    Отмена
                  </button>
                )}
              </div>
            </div>

            {activeFolderId === "all" ? (
              <div className="item mb-4 text-[#8aa6c7]">
                Для создания заметки выберите конкретный журнал слева.
              </div>
            ) : (
              <div className="grid gap-3">
                <div>
                  <label className="mb-[8px] block text-sm font-bold text-[#8aa6c7]">
                    Заголовок
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-[8px] block text-sm font-bold text-[#8aa6c7]">
                    Текст заметки
                  </label>
                  <textarea
                    className="min-h-[110px]"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-[8px] block text-sm font-bold text-[#8aa6c7]">
                    Картинки
                  </label>

                  <label className="btn btn-secondary inline-flex cursor-pointer">
                    Загрузить картинки
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      onChange={handleImageUpload}
                    />
                  </label>

                  <div className="mt-2 text-xs text-[#7fa6c7]">
                    Изображения автоматически мягко сжимаются для экономии места в localStorage.
                  </div>

                  {images.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {images.map((src, index) => (
                        <div
                          key={index}
                          className="relative overflow-hidden rounded-xl border border-[rgba(56,189,248,.14)]"
                        >
                          <img
                            src={src}
                            alt={`journal-img-${index}`}
                            className="h-[74px] w-[74px] cursor-zoom-in object-cover"
                            onClick={() => openFullscreenImage(src)}
                          />
                          <button
                            type="button"
                            className="absolute right-1 top-1 rounded-md bg-[rgba(7,13,26,.85)] px-2 py-1 text-xs text-white"
                            onClick={() => handleRemoveImage(index)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-5 grid gap-4">
              {filteredJournal.length ? (
                filteredJournal.map((note) => {
                  const folderName =
                    folders.find((folder) => folder.id === note.journalId)?.name || "Без журнала";

                  return (
                    <div key={note.id} className="item cursor-pointer rounded-[18px] p-4">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <strong
                          className="text-[16px] font-bold text-white"
                          onClick={() => setPreviewId(note.id)}
                        >
                          {note.title}
                        </strong>

                        <span className="shrink-0 text-sm text-[#8aa6c7]">
                          {formatDateTime(note.createdAt)}
                        </span>
                      </div>

                      <div className="mb-2 text-xs text-[#7fa6c7]">{folderName}</div>

                      <div
                        className="line-clamp-4 text-[15px] leading-[1.55] text-[#b9d5ee]"
                        onClick={() => setPreviewId(note.id)}
                      >
                        {note.text}
                      </div>

                      {note.images?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {note.images.slice(0, 4).map((src, index) => (
                            <img
                              key={index}
                              src={src}
                              alt={`note-preview-${index}`}
                              className="h-[56px] w-[56px] cursor-zoom-in rounded-lg border border-[rgba(56,189,248,.14)] object-cover"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewId(note.id);
                                openFullscreenImage(src);
                              }}
                            />
                          ))}
                        </div>
                      )}

                      <div className="mt-4 flex gap-2">
                        <button type="button" className="mini-btn" onClick={() => handleEdit(note.id)}>
                          Ред.
                        </button>
                        <button
                          type="button"
                          className="mini-btn mini-btn-del"
                          onClick={() => openDeleteNoteModal(note.id)}
                        >
                          Удал.
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="item text-[#8aa6c7]">Заметок в этом разделе пока нет</div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center p-10">
            {previewNote ? (
              <div className="w-full max-w-[760px]">
                <h2 className="mb-4 mt-0 text-[30px] font-semibold tracking-tight text-[#dcecff]">
                  {previewNote.title}
                </h2>

                <div className="mb-3 text-[15px] text-[#8aa6c7]">
                  {formatDateTime(previewNote.createdAt)}
                </div>

                <div className="mb-5 text-sm text-[#7fa6c7]">
                  Журнал:{" "}
                  {folders.find((folder) => folder.id === previewNote.journalId)?.name || "Без журнала"}
                </div>

                <div className="whitespace-pre-wrap text-[18px] leading-[1.8] text-[#d8ebff]">
                  {previewNote.text}
                </div>

                {previewNote.images?.length > 0 && (
                  <div className="mt-6 flex flex-wrap gap-3">
                    {previewNote.images.map((src, index) => (
                      <img
                        key={index}
                        src={src}
                        alt={`preview-image-${index}`}
                        className="max-h-[220px] cursor-zoom-in rounded-xl border border-[rgba(56,189,248,.14)]"
                        onClick={() => openFullscreenImage(src)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-[26px] font-medium tracking-tight text-[#89a8ca]">
                Выберите заметку или создайте новую
              </div>
            )}
          </div>
        </div>
      </section>

      {isCreateFolderModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => {
            setIsCreateFolderModalOpen(false);
            setNewFolderName("");
          }}
        >
          <div className="modal-card max-w-[520px]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-[14px] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="m-0 text-xl font-bold">Создать журнал</h2>
                <div className="mt-1 text-sm text-[#8aa6c7]">
                  Введите название нового журнала
                </div>
              </div>

              <button
                className="btn btn-secondary"
                onClick={() => {
                  setIsCreateFolderModalOpen(false);
                  setNewFolderName("");
                }}
              >
                Закрыть
              </button>
            </div>

            <div className="grid gap-3">
              <div className="item">
                <label className="mb-2 block text-sm text-[#8aa6c7]">Название журнала</label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Например: Разбор недели"
                  className="w-full"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleConfirmCreateFolder();
                    }
                  }}
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsCreateFolderModalOpen(false);
                    setNewFolderName("");
                  }}
                >
                  Отмена
                </button>
                <button className="btn" onClick={handleConfirmCreateFolder}>
                  Создать
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {folderToDelete && (
        <div className="modal-overlay" onClick={() => setFolderToDeleteId(null)}>
          <div className="modal-card max-w-[560px]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-[14px] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="m-0 text-xl font-bold text-[#ffb4bf]">Удалить журнал</h2>
                <div className="mt-1 text-sm text-[#8aa6c7]">Это действие нельзя отменить</div>
              </div>

              <button className="btn btn-secondary" onClick={() => setFolderToDeleteId(null)}>
                Закрыть
              </button>
            </div>

            <div className="grid gap-3">
              <div className="item">
                <div className="text-sm text-[#8aa6c7]">Вы действительно хотите удалить журнал:</div>
                <div className="mt-2 text-lg font-extrabold text-white">{folderToDelete.name}</div>
              </div>

              <div className="item border-[rgba(239,68,68,.18)] bg-[rgba(239,68,68,.06)]">
                <div className="text-sm text-[#ffb4bf]">
                  Вместе с журналом будут удалены заметки: {folderDeleteNotesCount}
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <button className="btn btn-secondary" onClick={() => setFolderToDeleteId(null)}>
                  Отмена
                </button>
                <button className="btn btn-danger" onClick={handleConfirmDeleteFolder}>
                  Удалить журнал
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {noteToDelete && noteToDeleteId && (
        <div className="modal-overlay" onClick={() => setNoteToDeleteId(null)}>
          <div className="modal-card max-w-[520px]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-[14px] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="m-0 text-xl font-bold text-[#ffb4bf]">Удалить заметку</h2>
                <div className="mt-1 text-sm text-[#8aa6c7]">Это действие нельзя отменить</div>
              </div>

              <button className="btn btn-secondary" onClick={() => setNoteToDeleteId(null)}>
                Закрыть
              </button>
            </div>

            <div className="grid gap-3">
              <div className="item">
                <div className="text-sm text-[#8aa6c7]">Вы действительно хотите удалить заметку:</div>
                <div className="mt-2 text-lg font-extrabold text-white">{noteToDelete.title}</div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <button className="btn btn-secondary" onClick={() => setNoteToDeleteId(null)}>
                  Отмена
                </button>
                <button className="btn btn-danger" onClick={handleConfirmDeleteNote}>
                  Удалить заметку
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {fullscreenImage && (
        <div className="modal-overlay z-[120]" onClick={closeFullscreenImage}>
          <div
            className="relative flex max-h-[92vh] w-[min(96vw,1400px)] items-center justify-center rounded-[24px] border border-[rgba(56,189,248,.14)] bg-[rgba(7,13,26,.96)] p-3 shadow-[0_30px_120px_rgba(0,0,0,.55)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-3 top-3 z-10 rounded-xl border border-[rgba(56,189,248,.16)] bg-[rgba(10,18,32,.88)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[rgba(16,28,48,.96)]"
              onClick={closeFullscreenImage}
            >
              ✕
            </button>

            <img
              src={fullscreenImage}
              alt="fullscreen-preview"
              className="max-h-[86vh] w-auto max-w-full rounded-[18px] object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}