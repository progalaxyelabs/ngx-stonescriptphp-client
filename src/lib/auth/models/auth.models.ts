export interface Identity {
  id: number;
  email: string;
  email_verified: boolean;
  google_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  id: number;
  identity_id: number;
  tenant_id: number;
  role: string;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  identity: Identity;
  membership?: Membership;
  memberships?: Membership[];
  selection_token?: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  expires_in: number;
}

export interface TenantSelectionRequest {
  selection_token: string;
  tenant_id: number;
}

export interface OAuthState {
  platform_code: string;
  tenant_slug?: string;
  return_url?: string;
}
