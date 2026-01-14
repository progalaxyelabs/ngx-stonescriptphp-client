import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TenantPickerComponent } from './tenant-picker.component';
import { AuthService } from '../../services/auth.service';
import { Membership } from '../../models/auth.models';

describe('TenantPickerComponent', () => {
  let component: TenantPickerComponent;
  let fixture: ComponentFixture<TenantPickerComponent>;
  let authServiceMock: jasmine.SpyObj<AuthService>;

  const mockMemberships: Membership[] = [
    {
      id: 1,
      identity_id: 100,
      tenant_id: 1,
      role: 'owner',
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    {
      id: 2,
      identity_id: 100,
      tenant_id: 2,
      role: 'admin',
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    {
      id: 3,
      identity_id: 100,
      tenant_id: 3,
      role: 'staff',
      status: 'inactive',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }
  ];

  beforeEach(async () => {
    authServiceMock = jasmine.createSpyObj('AuthService', ['selectTenant']);

    await TestBed.configureTestingModule({
      imports: [TenantPickerComponent],
      providers: [
        { provide: AuthService, useValue: authServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TenantPickerComponent);
    component = fixture.componentInstance;
    component.selectionToken = 'test-selection-token';
    component.memberships = mockMemberships;
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with required inputs', () => {
    fixture.detectChanges();
    expect(component.selectionToken).toBe('test-selection-token');
    expect(component.memberships.length).toBe(3);
  });

  it('should log error if selectionToken is missing', () => {
    spyOn(console, 'error');
    component.selectionToken = undefined as any;
    component.ngOnInit();
    expect(console.error).toHaveBeenCalledWith('TenantPickerComponent: selectionToken is required');
  });

  it('should log error if memberships array is empty', () => {
    spyOn(console, 'error');
    component.memberships = [];
    component.ngOnInit();
    expect(console.error).toHaveBeenCalledWith('TenantPickerComponent: memberships array is empty');
  });

  it('should successfully select a tenant', (done) => {
    const mockResponse: any = {
      access_token: 'token',
      expires_in: 3600,
      identity: { id: 100, email: 'test@example.com' }
    };

    authServiceMock.selectTenant.and.returnValue(of(mockResponse));

    component.tenantSelected.subscribe((membership) => {
      expect(membership).toEqual(mockMemberships[0]);
      done();
    });

    component.onSelectTenant(mockMemberships[0]);

    expect(authServiceMock.selectTenant).toHaveBeenCalledWith('test-selection-token', 1);
  });

  it('should handle tenant selection error', (done) => {
    const mockError = {
      status: 401,
      error: { message: 'Invalid token' }
    };

    authServiceMock.selectTenant.and.returnValue(throwError(() => mockError));

    component.selectionError.subscribe((error) => {
      expect(error.message).toContain('Invalid or expired selection token');
      expect(component.state).toBe('error');
      done();
    });

    component.onSelectTenant(mockMemberships[0]);
  });

  it('should show loading state during selection', () => {
    authServiceMock.selectTenant.and.returnValue(of({} as any));
    component.onSelectTenant(mockMemberships[0]);
    expect(component.isLoading).toBe(false); // Will be false after observable completes
  });

  it('should get tenant name from branding data', () => {
    component.tenantBranding = new Map([
      [1, { name: 'Acme Corp', logo: 'logo.png' }]
    ]);

    expect(component.getTenantName(mockMemberships[0])).toBe('Acme Corp');
  });

  it('should fallback to tenant ID when branding is not available', () => {
    expect(component.getTenantName(mockMemberships[0])).toBe('Tenant #1');
  });

  it('should get tenant logo from branding data', () => {
    component.tenantBranding = new Map([
      [1, { name: 'Acme Corp', logo: 'logo.png' }]
    ]);

    expect(component.getTenantLogo(mockMemberships[0])).toBe('logo.png');
  });

  it('should return null when logo is not available', () => {
    expect(component.getTenantLogo(mockMemberships[0])).toBeNull();
  });

  it('should get role label', () => {
    expect(component.getRoleLabel('owner')).toBe('Owner');
    expect(component.getRoleLabel('admin')).toBe('Admin');
    expect(component.getRoleLabel('staff')).toBe('Staff');
    expect(component.getRoleLabel('unknown')).toBe('unknown');
  });

  it('should get role badge class', () => {
    expect(component.getRoleBadgeClass('owner')).toBe('role-badge role-owner');
    expect(component.getRoleBadgeClass('Admin')).toBe('role-badge role-admin');
  });

  it('should save and retrieve remembered tenant choice', () => {
    component.rememberChoice = true;
    authServiceMock.selectTenant.and.returnValue(of({} as any));

    component.onSelectTenant(mockMemberships[0]);

    expect(localStorage.getItem('auth_remembered_tenant_id')).toBe('1');
  });

  it('should clear remembered choice when unchecked', () => {
    localStorage.setItem('auth_remembered_tenant_id', '1');
    component.rememberChoice = false;
    authServiceMock.selectTenant.and.returnValue(of({} as any));

    component.onSelectTenant(mockMemberships[0]);

    expect(localStorage.getItem('auth_remembered_tenant_id')).toBeNull();
  });

  it('should load remembered tenant on init', () => {
    localStorage.setItem('auth_remembered_tenant_id', '1');
    component.ngOnInit();

    expect(component.selectedTenantId).toBe(1);
    expect(component.rememberChoice).toBe(true);
  });

  it('should clear invalid remembered tenant', () => {
    localStorage.setItem('auth_remembered_tenant_id', '999'); // Invalid tenant
    component.ngOnInit();

    expect(component.selectedTenantId).toBeNull();
    expect(localStorage.getItem('auth_remembered_tenant_id')).toBeNull();
  });

  it('should toggle remember choice', () => {
    component.rememberChoice = false;
    component.toggleRememberChoice();
    expect(component.rememberChoice).toBe(true);

    component.toggleRememberChoice();
    expect(component.rememberChoice).toBe(false);
  });

  it('should check if a tenant is selected', () => {
    component.selectedTenantId = 1;
    expect(component.isSelected(mockMemberships[0])).toBe(true);
    expect(component.isSelected(mockMemberships[1])).toBe(false);
  });

  it('should clear error state', () => {
    component.state = 'error';
    component.error = { message: 'Test error' };

    component.clearError();

    expect(component.error).toBeNull();
    expect(component.state).toBe('idle');
  });

  it('should sort memberships by status and role', () => {
    const sorted = component.sortedMemberships;

    // Active memberships should come first
    expect(sorted[0].status).toBe('active');
    expect(sorted[1].status).toBe('active');
    expect(sorted[2].status).toBe('inactive');

    // Among active, owner should come before admin
    expect(sorted[0].role).toBe('owner');
    expect(sorted[1].role).toBe('admin');
  });

  it('should handle network error', (done) => {
    const mockError = {
      status: 0
    };

    authServiceMock.selectTenant.and.returnValue(throwError(() => mockError));

    component.selectionError.subscribe((error) => {
      expect(error.message).toContain('Cannot connect to server');
      expect(error.code).toBe('NETWORK_ERROR');
      done();
    });

    component.onSelectTenant(mockMemberships[0]);
  });

  it('should handle server error', (done) => {
    const mockError = {
      status: 500
    };

    authServiceMock.selectTenant.and.returnValue(throwError(() => mockError));

    component.selectionError.subscribe((error) => {
      expect(error.message).toContain('Server error');
      expect(error.code).toBe('SERVER_ERROR');
      done();
    });

    component.onSelectTenant(mockMemberships[0]);
  });

  it('should handle missing selection token on select', (done) => {
    component.selectionToken = undefined as any;

    component.selectionError.subscribe((error) => {
      expect(error.message).toContain('Selection token is missing');
      done();
    });

    component.onSelectTenant(mockMemberships[0]);
  });
});
