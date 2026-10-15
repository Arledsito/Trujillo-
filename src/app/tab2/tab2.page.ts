import { ChangeDetectorRef, Component, inject } from '@angular/core';
import {
  AlertController,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { addIcons } from 'ionicons';
import { cameraOutline, imagesOutline, trashOutline } from 'ionicons/icons';
import {
  PhotoGalleryService,
  StoredGalleryPhoto,
} from '../services/photo-gallery.service';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  imports: [
    DatePipe,
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonTitle,
    IonToolbar,
    RouterLink,
  ],
})
export class Tab2Page {
  private readonly gallery = inject(PhotoGalleryService);
  private readonly toastController = inject(ToastController);
  private readonly alertController = inject(AlertController);
  private readonly changeDetector = inject(ChangeDetectorRef);

  photos: StoredGalleryPhoto[] = [];
  isLoading = false;
  loadError: string | null = null;
  deletingFilepath: string | null = null;

  constructor() {
    addIcons({ cameraOutline, imagesOutline, trashOutline });
  }

  async ionViewWillEnter(): Promise<void> {
    this.isLoading = true;
    this.loadError = null;
    try {
      this.photos = await this.gallery.getPhotos();
    } catch (error) {
      const detail =
        error instanceof Error ? ` ${error.message}` : '';
      this.loadError = `No se pudo cargar la galería.${detail}`;
      await this.showError(this.loadError);
    } finally {
      this.isLoading = false;
      this.changeDetector.detectChanges();
    }
  }

  async confirmDelete(photo: StoredGalleryPhoto): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Eliminar foto',
      message: '¿Quieres eliminar esta foto de tu galería?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            void this.deletePhoto(photo);
          },
        },
      ],
    });
    await alert.present();
  }

  async deletePhoto(photo: StoredGalleryPhoto): Promise<void> {
    if (this.deletingFilepath) {
      return;
    }

    this.deletingFilepath = photo.filepath;
    try {
      await this.gallery.deletePhoto(photo.filepath);
      this.photos = this.photos.filter(
        (item) => item.filepath !== photo.filepath,
      );
      await this.showMessage('Foto eliminada de la galería.', 'success');
    } catch (error) {
      const detail = error instanceof Error ? ` ${error.message}` : '';
      await this.showError(`No se pudo eliminar la foto.${detail}`);
    } finally {
      this.deletingFilepath = null;
      this.changeDetector.detectChanges();
    }
  }

  private async showError(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3500,
      color: 'danger',
      position: 'bottom',
    });
    await toast.present();
  }

  private async showMessage(message: string, color: 'success' | 'danger') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'bottom',
    });
    await toast.present();
  }
}
