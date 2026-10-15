import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Tab1Page } from './tab1.page';

describe('Tab1Page', () => {
  let component: Tab1Page;
  let fixture: ComponentFixture<Tab1Page>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Tab1Page);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps the sofa viewer visible while the camera is open', () => {
    component.isBrowserCameraOpen = true;
    fixture.detectChanges();

    const viewer = fixture.nativeElement.querySelector('model-viewer');

    expect(viewer).toBeTruthy();
  });
});
