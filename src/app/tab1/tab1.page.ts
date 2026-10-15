import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  ViewChild,
} from '@angular/core';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { Camera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { addIcons } from 'ionicons';
import { cameraOutline, imagesOutline } from 'ionicons/icons';
import { PhotoGalleryService } from '../services/photo-gallery.service';

if (typeof window !== 'undefined' && 'WebGLRenderingContext' in window) {
  void import('@google/model-viewer');
}

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  imports: [IonButton, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Tab1Page {
  @ViewChild('cameraPreview', { static: true })
  private cameraPreview!: ElementRef<HTMLVideoElement>;

  private readonly gallery = inject(PhotoGalleryService);
  private readonly toastController = inject(ToastController);
  private readonly changeDetector = inject(ChangeDetectorRef);
  isCapturing = false;
  isBrowserCameraOpen = false;
  private cameraStream?: MediaStream;

  constructor() {
    addIcons({ cameraOutline, imagesOutline });
  }

  async takePhoto(): Promise<void> {
    if (this.isCapturing) {
      return;
    }

    this.isCapturing = true;
    try {
      if (!Capacitor.isNativePlatform()) {
        await this.startBrowserCamera();
        return;
      }

      const photo = await Camera.takePhoto({
        quality: 90,
        editable: 'no',
        saveToGallery: true,
        includeMetadata: true,
      });
      await this.gallery.savePhoto(photo);
      await this.showMessage('Foto guardada en tu galería.', 'success');
    } catch (error) {
      const detail =
        error instanceof Error ? ` ${error.message}` : '';
      await this.showMessage(
        `No se pudo tomar o guardar la foto.${detail}`,
        'danger',
      );
    } finally {
      this.isCapturing = false;
      this.changeDetector.detectChanges();
    }
  }

  async ionViewWillLeave(): Promise<void> {
    this.stopBrowserCamera();
  }

  async captureBrowserPhoto(): Promise<void> {
    if (this.isCapturing) {
      return;
    }

    if (!this.cameraStream) {
      await this.showMessage(
        'La cámara se desconectó. Vuelve a abrirla para tomar una foto.',
        'danger',
      );
      return;
    }

    this.isCapturing = true;
    this.changeDetector.detectChanges();
    try {
      const video = this.cameraPreview.nativeElement;
      if (!video.videoWidth || !video.videoHeight) {
        await this.playCameraPreview(video);
      }
      if (!video.videoWidth || !video.videoHeight) {
        throw new Error('La cámara todavía no está lista. Inténtalo de nuevo.');
      }

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('No se pudo preparar la foto.');
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) =>
            blob
              ? resolve(blob)
              : reject(new Error('No se pudo crear la foto.')),
          'image/jpeg',
          0.9,
        );
      });

      await this.gallery.saveBrowserPhoto(image);
      this.stopBrowserCamera();
      await this.showMessage('Foto guardada en tu galería.', 'success');
    } catch (error) {
      const detail =
        error instanceof Error ? ` ${error.message}` : '';
      await this.showMessage(
        `No se pudo tomar o guardar la foto.${detail}`,
        'danger',
      );
    } finally {
      this.isCapturing = false;
      this.changeDetector.detectChanges();
    }
  }

  cancelBrowserCamera(): void {
    this.stopBrowserCamera();
  }

  closeCameraForAR(): void {
    if (this.isBrowserCameraOpen) {
      this.stopBrowserCamera();
    }
  }

  private async startBrowserCamera(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        'El navegador no permite acceder a la cámara. Usa HTTPS o localhost.',
      );
    }

    this.stopBrowserCamera();
    this.cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' } },
    });
    this.isBrowserCameraOpen = true;
    this.changeDetector.detectChanges();

    const video = this.cameraPreview.nativeElement;
    video.srcObject = this.cameraStream;
    try {
      await this.playCameraPreview(video);
    } catch (error) {
      this.stopBrowserCamera();
      throw error;
    }
  }

  private async playCameraPreview(video: HTMLVideoElement): Promise<void> {
    if (video.videoWidth && video.videoHeight) {
      await video.play();
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        finish(
          new Error('La cámara se activó, pero no se pudo mostrar la imagen.'),
        );
      }, 10000);
      const cleanup = () => {
        window.clearTimeout(timeout);
        video.removeEventListener('loadeddata', onLoadedData);
        video.removeEventListener('error', onError);
      };
      const finish = (error?: Error) => {
        cleanup();
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      };
      const onLoadedData = () => finish();
      const onError = () =>
        finish(
          new Error('El navegador no pudo mostrar la imagen de cámara.'),
        );

      video.addEventListener('loadeddata', onLoadedData, { once: true });
      video.addEventListener('error', onError, { once: true });
      video.play().catch((error: unknown) => {
        finish(
          error instanceof Error
            ? error
            : new Error('No se pudo iniciar la vista previa de la cámara.'),
        );
      });
    });
  }

  private stopBrowserCamera(): void {
    this.cameraStream?.getTracks().forEach((track) => track.stop());
    this.cameraStream = undefined;
    this.isBrowserCameraOpen = false;
    if (this.cameraPreview) {
      this.cameraPreview.nativeElement.srcObject = null;
    }
    this.changeDetector.detectChanges();
  }

  private async showMessage(
    message: string,
    color: 'success' | 'danger',
  ): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'bottom',
    });
    await toast.present();
  }
}
