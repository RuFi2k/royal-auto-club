import { useEffect, useRef, useState } from "react";
import { uploadCarFile, deleteCarFile } from "../services/storage";
import { getCarArchives, addCarArchive, deleteCarArchive } from "../services/archives.api";
import type { Car, CarPhotoArchive } from "../types/car.types";

interface Props {
  car: Car;
  onClose: () => void;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("uk-UA", { day: "2-digit", month: "short", year: "numeric" });
}

export function PhotoArchivesModal({ car, onClose }: Props) {
  const [archives, setArchives] = useState<CarPhotoArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getCarArchives(car.id)
      .then(setArchives)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [car.id]);

  async function handleUpload() {
    if (!selectedFiles.length) return;
    setUploading(true);
    setError(null);
    try {
      const added: CarPhotoArchive[] = [];
      for (const file of selectedFiles) {
        const url = await uploadCarFile(file, "photo-archives");
        const archive = await addCarArchive(car.id, { url, filename: file.name });
        added.push(archive);
      }
      setArchives((prev) => [...added.reverse(), ...prev]);
      setSelectedFiles([]);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(archive: CarPhotoArchive) {
    try {
      await deleteCarFile(archive.url);
      await deleteCarArchive(car.id, archive.id);
      setArchives((prev) => prev.filter((a) => a.id !== archive.id));
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Архіви фотосесій — {car.brand} {car.model} #{car.id}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {error && <div className="cars-error" style={{ margin: "0 0 14px" }}>{error}</div>}

          {/* Upload section */}
          <div className="archives-upload-section">
            <div className="archives-upload-row">
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".zip,.rar,.7z,.tar,.gz,.tar.gz"
                className="upload-input"
                onChange={(e) => setSelectedFiles(Array.from(e.target.files ?? []))}
              />
              <button
                className="btn-search"
                style={{ height: 34, padding: "0 16px", fontSize: 13, flexShrink: 0 }}
                onClick={handleUpload}
                disabled={uploading || !selectedFiles.length}
              >
                {uploading ? "Завантаження…" : "Завантажити"}
              </button>
            </div>
            {selectedFiles.length > 0 && (
              <div className="archives-selected">
                {selectedFiles.map((f, i) => (
                  <span key={i} className="archive-selected-file">🗜 {f.name}</span>
                ))}
              </div>
            )}
          </div>

          {/* Archive list */}
          <div className="archives-list">
            {loading && <p className="cars-state" style={{ padding: "20px 0" }}>Завантаження…</p>}
            {!loading && archives.length === 0 && (
              <p className="cars-state" style={{ padding: "20px 0" }}>Архівів ще немає.</p>
            )}
            {archives.map((archive) => (
              <div key={archive.id} className="archive-row">
                <div className="archive-info">
                  <span className="archive-filename">🗜 {archive.filename}</span>
                  <span className="archive-date">{fmtDate(archive.createdAt)}</span>
                </div>
                <div className="archive-actions">
                  <a
                    href={archive.url}
                    target="_blank"
                    rel="noreferrer"
                    className="action-btn action-edit"
                    style={{ textDecoration: "none" }}
                  >
                    Завантажити
                  </a>
                  <button
                    className="action-btn action-sold"
                    onClick={() => handleDelete(archive)}
                  >
                    Видалити
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="filter-reset" onClick={onClose}>Закрити</button>
        </div>
      </div>
    </div>
  );
}
