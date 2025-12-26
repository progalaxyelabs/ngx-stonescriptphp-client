import { TestBed } from '@angular/core/testing';

import { SigninStatusService } from './signin-status.service';

describe('SigninStatusService', () => {
  let service: SigninStatusService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SigninStatusService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
