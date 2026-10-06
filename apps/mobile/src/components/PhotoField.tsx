import { useState } from "react";
import { Camera as CameraIcon, Image as ImageIcon, Loader2, Upload, X } from "lucide-react";
import { Camera } from "@capacitor/camera";
import { getCameraStatus, openAppSettings, requestCameraPermission } from "../lib/permissions";

interface PhotoFieldProps {
  previewUrl: string | null;
  uploading: boolean;
  label?: string;
  onPhotoSelected: (file: File) => void;
}

/** Converts a Capacitor MediaResult's webPath (a blob: URL) into a real File — lets the exact same upload functions this app already has (uploadMortalityPhoto, uploadAvatar) keep working unchanged; this component's only job is getting a File from the user. */
async function toFile(webPath: string, name: string): Promise<File> {
  const response = await fetch(webPath);
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}

/**
 * Replaces a plain `<input type="file">` with real native capture — "Take
 * Photo" (device camera, requests CAMERA permission itself, only on tap)
 * or "Choose from Gallery" (Android's system Photo Picker, no permission
 * needed). getPhoto()'s old combined camera-or-gallery prompt is deprecated
 * in this Capacitor version; takePhoto()/chooseFromGallery() are the
 * current API, so this renders its own small two-option menu instead.
 */
export default function PhotoField({ previewUrl, uploading, label = "Upload", onPhotoSelected }: PhotoFieldProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleTakePhoto = async () => {
    setMenuOpen(false);
    setPermissionError(null);
    const current = await getCameraStatus();
    const status = current === "granted" ? current : await requestCameraPermission();
    if (status !== "granted") {
      setPermissionError("Camera access is off for PoultryHub.");
      return;
    }
    setBusy(true);
    try {
      const result = await Camera.takePhoto({ quality: 80, correctOrientation: true });
      if (result.webPath) onPhotoSelected(await toFile(result.webPath, `photo-${Date.now()}.jpg`));
    } catch (err) {
      // The user backing out of the camera UI also lands here — not a real error, just no photo taken.
      console.error("[PhotoField] takePhoto failed or was cancelled:", err);
    } finally {
      setBusy(false);
    }
  };

  const handleChooseFromGallery = async () => {
    setMenuOpen(false);
    setPermissionError(null);
    setBusy(true);
    try {
      const result = await Camera.chooseFromGallery({ quality: 80, correctOrientation: true });
      const first = result.results[0];
      if (first?.webPath) onPhotoSelected(await toFile(first.webPath, `photo-${Date.now()}.jpg`));
    } catch (err) {
      console.error("[PhotoField] chooseFromGallery failed or was cancelled:", err);
    } finally {
      setBusy(false);
    }
  };

  const isBusy = uploading || busy;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {previewUrl && <img src={previewUrl} alt="Photo preview" className="h-16 w-16 rounded-lg object-cover" />}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            disabled={isBusy}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)] disabled:opacity-60"
          >
            {isBusy ? <Loader2 size={14} className="spinner" /> : <Upload size={14} />}
            {previewUrl ? "Replace" : label} (optional)
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden="true" />
              <div className="absolute left-0 top-full z-20 mt-2 w-48 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-1.5 shadow-lg">
                <button
                  type="button"
                  onClick={() => void handleTakePhoto()}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
                >
                  <CameraIcon size={16} /> Take Photo
                </button>
                <button
                  type="button"
                  onClick={() => void handleChooseFromGallery()}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-muted-bg)]"
                >
                  <ImageIcon size={16} /> Choose from Gallery
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {permissionError && (
        <div className="flex items-start gap-2 rounded-lg bg-[var(--color-warning)]/10 px-3 py-2 text-xs text-[var(--color-warning)]">
          <X size={14} className="mt-0.5 shrink-0" />
          <div>
            <p>{permissionError}</p>
            <button
              type="button"
              onClick={() => void openAppSettings()}
              className="mt-1 font-semibold underline underline-offset-2"
            >
              Open Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
