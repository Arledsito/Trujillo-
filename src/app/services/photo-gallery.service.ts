import { Injectable } from '@angular/core';
import type { MediaResult } from '@capacitor/camera';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';

interface GalleryPhotoRecord {
  filepath: string;
  format: string;
  createdAt: number;
}

export interface StoredGalleryPhoto extends GalleryPhotoRecord {
  src: string;
}

@Injectable({ providedIn: 'root' })
export class PhotoGalleryService {
  private readonly storageKey = 'photo-gallery';

  async savePhoto(photo: MediaResult): Promise<void> {
    const base64Data = await this.getPhotoBase64(photo);
    const format = photo.metadata?.format || 'jpeg';
    await this.saveBase64Photo(base64Data, format);
  }

  async saveBrowserPhoto(photo: Blob): Promise<void> {
    await this.savePhotoData(photo, 'jpeg');
  }

  private async saveBase64Photo(
    base64Data: string,
    format: string,
  ): Promise<void> {
    await this.savePhotoData(base64Data, format);
  }

  private async savePhotoData(
    data: string | Blob,
    format: string,
  ): Promise<void> {
    const createdAt = Date.now();
    const filepath = `photos/${createdAt}-${crypto.randomUUID()}.${format}`;
    await Filesystem.writeFile({
      path: filepath,
      data,
      directory: Directory.Data,
    });

    const photos = await this.readPhotoRecords();
    photos.unshift({ filepath, format, createdAt });
    await Preferences.set({
      key: this.storageKey,
      value: JSON.stringify(photos),
    });
  }

  async getPhotos(): Promise<StoredGalleryPhoto[]> {
    const records = await this.readPhotoRecords();
    return Promise.all(
      records.map(async (photo) => ({
        ...photo,
        src: await this.readPhotoData(photo),
      })),
    );
  }

  async deletePhoto(filepath: string): Promise<void> {
    const photos = await this.readPhotoRecords();
    const photoExists = photos.some((photo) => photo.filepath === filepath);
    if (!photoExists) {
      throw new Error('La foto ya no está en la galería.');
    }

    await Filesystem.deleteFile({
      path: filepath,
      directory: Directory.Data,
    });
    await Preferences.set({
      key: this.storageKey,
      value: JSON.stringify(
        photos.filter((photo) => photo.filepath !== filepath),
      ),
    });
  }

  private async readPhotoRecords(): Promise<GalleryPhotoRecord[]> {
    const { value } = await Preferences.get({ key: this.storageKey });
    if (value === null) {
      return [];
    }

    const records: unknown = JSON.parse(value);
    if (!Array.isArray(records) || !records.every(isGalleryPhotoRecord)) {
      throw new Error('El índice de fotos guardado no tiene un formato válido.');
    }
    return records;
  }

  private async readPhotoData(photo: GalleryPhotoRecord): Promise<string> {
    const { data } = await Filesystem.readFile({
      path: photo.filepath,
      directory: Directory.Data,
    });
    if (typeof data === 'string') {
      return `data:${this.getMimeType(photo.format)};base64,${data}`;
    }

    return this.readBlobAsDataUrl(data);
  }

  private async getPhotoBase64(photo: MediaResult): Promise<string> {
    if (photo.uri) {
      const { data } = await Filesystem.readFile({ path: photo.uri });
      if (typeof data === 'string') {
        return data;
      }
      const dataUrl = await this.readBlobAsDataUrl(data);
      return dataUrl.slice(dataUrl.indexOf(',') + 1);
    }
    if (photo.thumbnail) {
      return photo.thumbnail;
    }
    throw new Error('La cámara no devolvió los datos de la foto.');
  }

  private async readBlobAsDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('No se pudo convertir la foto.'));
        }
      };
      reader.onerror = () =>
        reject(reader.error ?? new Error('No se pudo leer la foto.'));
      reader.readAsDataURL(blob);
    });
  }

  private getMimeType(format: string): string {
    return format === 'jpg' || format === 'jpeg'
      ? 'image/jpeg'
      : `image/${format}`;
  }
}

function isGalleryPhotoRecord(value: unknown): value is GalleryPhotoRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record['filepath'] === 'string' &&
    typeof record['format'] === 'string' &&
    typeof record['createdAt'] === 'number'
  );
}
