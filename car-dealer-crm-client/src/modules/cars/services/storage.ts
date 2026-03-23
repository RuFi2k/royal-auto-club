import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../../auth/firebase";

export async function deleteCarFile(url: string): Promise<void> {
  const fileRef = ref(storage, url);
  await deleteObject(fileRef);
}

export async function uploadCarFile(file: File, folder: string): Promise<string> {
  const ext = file.name.split(".").pop();
  const path = `cars/${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file, { cacheControl: "public, max-age=31536000" });
  return getDownloadURL(fileRef);
}
