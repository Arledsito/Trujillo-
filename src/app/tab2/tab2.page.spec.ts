import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import {
  PhotoGalleryService,
  StoredGalleryPhoto,
} from '../services/photo-gallery.service';

import { Tab2Page } from './tab2.page';

describe('Tab2Page', () => {
  let component: Tab2Page;
  let fixture: ComponentFixture<Tab2Page>;
  let gallery: {
    getPhotos: ReturnType<typeof vi.fn>;
    deletePhoto: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    gallery = {
      getPhotos: vi.fn().mockResolvedValue([]),
      deletePhoto: vi.fn().mockResolvedValue(undefined),
    };
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PhotoGalleryService, useValue: gallery },
        {
          provide: ToastController,
          useValue: {
            create: vi.fn().mockResolvedValue({ present: vi.fn() }),
          },
        },
        {
          provide: AlertController,
          useValue: {
            create: vi.fn().mockResolvedValue({ present: vi.fn() }),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Tab2Page);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows loaded photos and clears the loading state', async () => {
    const photos: StoredGalleryPhoto[] = [
      {
        filepath: 'photos/test.jpeg',
        format: 'jpeg',
        createdAt: 1,
        src: 'data:image/jpeg;base64,test',
      },
    ];
    gallery.getPhotos.mockResolvedValue(photos);

    await component.ionViewWillEnter();

    expect(component.photos).toEqual(photos);
    expect(component.isLoading).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Mi galería');
  });

  it('removes a deleted photo from the visible gallery', async () => {
    const photo: StoredGalleryPhoto = {
      filepath: 'photos/test.jpeg',
      format: 'jpeg',
      createdAt: 1,
      src: 'data:image/jpeg;base64,test',
    };
    component.photos = [photo];

    await component.deletePhoto(photo);

    expect(gallery.deletePhoto).toHaveBeenCalledWith(photo.filepath);
    expect(component.photos).toEqual([]);
  });

  it('asks for confirmation before deleting a photo', async () => {
    const photo: StoredGalleryPhoto = {
      filepath: 'photos/test.jpeg',
      format: 'jpeg',
      createdAt: 1,
      src: 'data:image/jpeg;base64,test',
    };

    await component.confirmDelete(photo);

    expect(TestBed.inject(AlertController).create).toHaveBeenCalledWith(
      expect.objectContaining({
        header: 'Eliminar foto',
        buttons: expect.arrayContaining([
          expect.objectContaining({ text: 'Eliminar', role: 'destructive' }),
        ]),
      }),
    );
  });
});
