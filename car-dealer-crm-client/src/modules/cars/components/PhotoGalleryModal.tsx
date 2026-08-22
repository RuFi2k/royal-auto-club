import { useEffect, useRef, useState } from "react";
import { deleteCarFile } from "../services/storage";
import {
  getCarPhotos,
  addCarPhoto,
  updateCarPhoto,
  reorderCarPhotos,
  deleteCarPhoto,
  uploadPhotos,
  describeFailures,
  type UploadProgress,
} from "../services/photos.api";
import type { Car, CarPhoto } from "../types/car.types";

interface Props {
  car: Car;
  onClose: () => void;
}

export function PhotoGalleryModal({ car, onClose }: Props) {
  const [photos, setPhotos] = useState<CarPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getCarPhotos(car.id)
      .then(setPhotos)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [car.id]);

  async function handleUpload() {
    if (!selectedFiles.length) return;
    setUploading(true);
    setError(null);
    try {
      const { uploads, failures } = await uploadPhotos(selectedFiles, {
        onProgress: setUploadProgress,
      });

      // Attach whatever made it, so a partial failure never loses finished work.
      const added: CarPhoto[] = [];
      for (const item of uploads) {
        if (!item) continue;
        const photo = await addCarPhoto(car.id, { url: item.url, alt: item.originalName });
        added.push(photo);
      }
      setPhotos((prev) => [...prev, ...added]);

      if (inputRef.current) inputRef.current.value = "";
      if (failures.length > 0) {
        // Keep only the ones that failed selected, ready for another attempt.
        const failed = new Set(failures.map((f) => f.index));
        setSelectedFiles(selectedFiles.filter((_, i) => failed.has(i)));
        setError(
          describeFailures(failures, selectedFiles.length) +
            " Решту додано. Натисніть «Додати» ще раз, щоб повторити.",
        );
      } else {
        setSelectedFiles([]);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  function selectPhotos(files: FileList | null) {
    const selected = Array.from(files ?? []);
    const jpgFiles = selected.filter((file) => file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name));
    setSelectedFiles(jpgFiles);
    setError(jpgFiles.length === selected.length ? null : "Підтримуються лише фото JPG.");
  }

  async function handleDelete(photo: CarPhoto) {
    if (!window.confirm("Видалити це фото?")) return;
    try {
      try { await deleteCarFile(photo.url); } catch { /* file may already be gone */ }
      await deleteCarPhoto(car.id, photo.id);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function persistOrder(next: CarPhoto[]) {
    setSavingOrder(true);
    setPhotos(next.map((p, i) => ({ ...p, sortOrder: i })));
    try {
      const saved = await reorderCarPhotos(car.id, next.map((p) => p.id));
      setPhotos(saved);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingOrder(false);
    }
  }

  function moveBy(idx: number, delta: number) {
    const target = idx + delta;
    if (target < 0 || target >= photos.length) return;
    const next = [...photos];
    [next[idx], next[target]] = [next[target], next[idx]];
    persistOrder(next);
  }

  function makeCover(idx: number) {
    if (idx === 0) return;
    const next = [photos[idx], ...photos.filter((_, i) => i !== idx)];
    persistOrder(next);
  }

  async function handleAltBlur(photo: CarPhoto, alt: string) {
    if (alt === (photo.alt ?? "")) return;
    try {
      const updated = await updateCarPhoto(car.id, photo.id, { alt: alt || null });
      setPhotos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Галерея — {car.brand} {car.model} #{car.id}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {error && <div className="cars-error" style={{ margin: "0 0 14px" }}>{error}</div>}

          <div className="archives-upload-section">
            <div className="archives-upload-row">
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,image/jpeg"
                className="upload-input"
                onChange={(e) => selectPhotos(e.target.files)}
              />
              <button
                className="btn-search"
                style={{ height: 34, padding: "0 16px", fontSize: 13, flexShrink: 0 }}
                onClick={handleUpload}
                disabled={uploading || !selectedFiles.length}
              >
                {uploading
                  ? uploadProgress
                    ? `${uploadProgress.done}/${uploadProgress.total}…`
                    : "Завантаження…"
                  : `Додати ${selectedFiles.length || ""}`}
              </button>
            </div>
            {uploadProgress && uploadProgress.total > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                  <span>Завантаження фото… {uploadProgress.done} з {uploadProgress.total}</span>
                  {uploadProgress.failed > 0 && (
                    <span style={{ color: "#e5484d" }}>помилок: {uploadProgress.failed}</span>
                  )}
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "#2a2a3a", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.round((uploadProgress.done / uploadProgress.total) * 100)}%`,
                      background: "#3b82f6",
                      transition: "width 160ms linear",
                    }}
                  />
                </div>
              </div>
            )}
            {selectedFiles.length > 0 && (
              <div className="archives-selected">
                {selectedFiles.map((f, i) => (
                  <span key={i} className="archive-selected-file">🖼 {f.name}</span>
                ))}
              </div>
            )}
            <p style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
              Підтримуються лише фото JPG. HEIC можна{" "}
              <a href="https://www.iloveimg.com/ru/convert-to-jpg/heic-to-jpg" target="_blank" rel="noreferrer">
                конвертувати в JPG
              </a>. Перше фото — обкладинка.
            </p>
          </div>

          {loading && <p className="cars-state" style={{ padding: "20px 0" }}>Завантаження…</p>}
          {!loading && photos.length === 0 && (
            <p className="cars-state" style={{ padding: "20px 0" }}>Фото ще немає.</p>
          )}

          {!loading && photos.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 12,
                opacity: savingOrder ? 0.6 : 1,
                transition: "opacity 120ms",
              }}
            >
              {photos.map((photo, idx) => (
                <div
                  key={photo.id}
                  style={{
                    border: "1px solid #2a2a3a",
                    borderRadius: 10,
                    overflow: "hidden",
                    background: "#15151f",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div style={{ position: "relative", aspectRatio: "16/10", background: "#000" }}>
                    <img
                      src={photo.url}
                      alt={photo.alt ?? ""}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    {idx === 0 && (
                      <span
                        style={{
                          position: "absolute",
                          top: 8,
                          left: 8,
                          background: "#facc15",
                          color: "#1a1a2e",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        ОБКЛАДИНКА
                      </span>
                    )}
                    <span
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        background: "rgba(0,0,0,0.6)",
                        color: "#fff",
                        padding: "2px 6px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      #{idx + 1}
                    </span>
                  </div>

                  <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                    <input
                      type="text"
                      defaultValue={photo.alt ?? ""}
                      placeholder="Опис (alt)"
                      onBlur={(e) => handleAltBlur(photo, e.target.value)}
                      style={{
                        width: "100%",
                        background: "#0e0e16",
                        border: "1px solid #2a2a3a",
                        borderRadius: 6,
                        color: "#fff",
                        padding: "5px 8px",
                        fontSize: 12,
                      }}
                    />
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <button
                        className="action-btn action-edit"
                        onClick={() => moveBy(idx, -1)}
                        disabled={idx === 0 || savingOrder}
                        title="Підняти вгору"
                      >
                        ↑
                      </button>
                      <button
                        className="action-btn action-edit"
                        onClick={() => moveBy(idx, 1)}
                        disabled={idx === photos.length - 1 || savingOrder}
                        title="Опустити вниз"
                      >
                        ↓
                      </button>
                      {idx !== 0 && (
                        <button
                          className="action-btn action-archive"
                          onClick={() => makeCover(idx)}
                          disabled={savingOrder}
                        >
                          На обкладинку
                        </button>
                      )}
                      <button
                        className="action-btn action-sold"
                        onClick={() => handleDelete(photo)}
                        style={{ marginLeft: "auto" }}
                      >
                        Видалити
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="filter-reset" onClick={onClose}>Закрити</button>
        </div>
      </div>
    </div>
  );
}
