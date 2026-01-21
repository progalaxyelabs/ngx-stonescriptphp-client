import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for ngx-stonescriptphp-client Authentication
 *
 * Prerequisites:
 * - Mock server running on http://localhost:8080
 * - Angular test app running on http://localhost:4200
 */

const TEST_CREDENTIALS = {
  email: 'test@example.com',
  password: 'Test@123'
};

test.describe('Email/Password Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('ngx-stonescriptphp-client Test');
  });

  test('should display test page with all test buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Google + Email' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Email Only' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'All Providers' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Register' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'No Providers' })).toBeVisible();
  });

  test('should show test credentials on page', async ({ page }) => {
    await expect(page.locator('text=Email: test@example.com')).toBeVisible();
    await expect(page.locator('text=Password: Test@123')).toBeVisible();
  });

  test('should login successfully with email/password', async ({ page }) => {
    // Click "Email Only" button
    await page.getByRole('button', { name: 'Email Only' }).click();

    // Wait for dialog to open
    await expect(page.locator('.login-dialog')).toBeVisible();
    await expect(page.locator('h2', { hasText: 'Sign In' })).toBeVisible();

    // Fill in credentials
    await page.locator('input[name="email"]').fill(TEST_CREDENTIALS.email);
    await page.locator('input[name="password"]').fill(TEST_CREDENTIALS.password);

    // Click sign in button
    await page.getByRole('button', { name: 'Sign in with Email' }).click();

    // Wait for login to complete (dialog should close)
    await expect(page.locator('.login-dialog')).not.toBeVisible({ timeout: 10000 });

    // Verify user is authenticated
    await expect(page.locator('h3', { hasText: 'Authenticated User' })).toBeVisible();
    await expect(page.locator('text=test@example.com')).toBeVisible();
    await expect(page.locator('text=Test User')).toBeVisible();

    // Verify sign out button appears
    await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Click "Email Only" button
    await page.getByRole('button', { name: 'Email Only' }).click();

    // Wait for dialog
    await expect(page.locator('.login-dialog')).toBeVisible();

    // Enter wrong credentials
    await page.locator('input[name="email"]').fill('wrong@email.com');
    await page.locator('input[name="password"]').fill('wrongpassword');

    // Click sign in
    await page.getByRole('button', { name: 'Sign in with Email' }).click();

    // Wait for error message
    await expect(page.locator('.error-message')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.error-message')).toContainText('Invalid credentials');
  });

  test('should sign out successfully', async ({ page }) => {
    // First login
    await page.getByRole('button', { name: 'Email Only' }).click();
    await page.locator('input[name="email"]').fill(TEST_CREDENTIALS.email);
    await page.locator('input[name="password"]').fill(TEST_CREDENTIALS.password);
    await page.getByRole('button', { name: 'Sign in with Email' }).click();
    await expect(page.locator('.login-dialog')).not.toBeVisible({ timeout: 10000 });

    // Then sign out
    await page.getByRole('button', { name: 'Sign Out' }).click();

    // Verify user info is gone
    await expect(page.locator('h3', { hasText: 'Authenticated User' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign Out' })).not.toBeVisible();
  });
});

test.describe('OAuth Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should open OAuth popup for Google', async ({ page, context }) => {
    // Listen for popup
    const popupPromise = context.waitForEvent('page');

    // Click "Google + Email" button
    await page.getByRole('button', { name: 'Google + Email' }).click();
    await expect(page.locator('.login-dialog')).toBeVisible();

    // Click Google button
    await page.locator('button.btn-google').click();

    // Wait for popup
    const popup = await popupPromise;
    await popup.waitForLoadState();

    // Verify popup shows Google OAuth page
    await expect(popup.locator('h2')).toContainText('google');
    await expect(popup.locator('text=Authenticating...')).toBeVisible();

    // Popup should close automatically after 1 second
    await expect(popup).not.toBeAttached({ timeout: 3000 });

    // Dialog should close
    await expect(page.locator('.login-dialog')).not.toBeVisible({ timeout: 5000 });

    // Verify user is authenticated
    await expect(page.locator('h3', { hasText: 'Authenticated User' })).toBeVisible();
    await expect(page.locator('text=test.google@example.com')).toBeVisible();
  });

  test('should show all OAuth providers in "All Providers" dialog', async ({ page }) => {
    // Click "All Providers" button
    await page.getByRole('button', { name: 'All Providers' }).click();
    await expect(page.locator('.login-dialog')).toBeVisible();

    // Verify email form is present
    await expect(page.locator('input[name="email"]')).toBeVisible();

    // Verify all OAuth buttons are present
    await expect(page.locator('button.btn-google')).toBeVisible();
    await expect(page.locator('button.btn-linkedin')).toBeVisible();
    await expect(page.locator('button.btn-apple')).toBeVisible();
    await expect(page.locator('button.btn-microsoft')).toBeVisible();
    await expect(page.locator('button.btn-github')).toBeVisible();

    // Verify divider between email and OAuth
    await expect(page.locator('.divider')).toBeVisible();
    await expect(page.locator('.divider span', { hasText: 'OR' })).toBeVisible();
  });

  test('should test LinkedIn OAuth flow', async ({ page, context }) => {
    const popupPromise = context.waitForEvent('page');

    await page.getByRole('button', { name: 'All Providers' }).click();
    await page.locator('button.btn-linkedin').click();

    const popup = await popupPromise;
    await popup.waitForLoadState();
    await expect(popup.locator('h2')).toContainText('linkedin');

    // Wait for auto-close
    await expect(popup).not.toBeAttached({ timeout: 3000 });
    await expect(page.locator('.login-dialog')).not.toBeVisible({ timeout: 5000 });

    // Verify LinkedIn user
    await expect(page.locator('text=test.linkedin@example.com')).toBeVisible();
  });
});

test.describe('Provider Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show only email form for "Email Only" option', async ({ page }) => {
    await page.getByRole('button', { name: 'Email Only' }).click();

    // Should show email form
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();

    // Should NOT show OAuth buttons
    await expect(page.locator('.oauth-buttons')).not.toBeVisible();
    await expect(page.locator('.divider')).not.toBeVisible();
  });

  test('should show email + Google for "Google + Email" option', async ({ page }) => {
    await page.getByRole('button', { name: 'Google + Email' }).click();

    // Should show email form
    await expect(page.locator('input[name="email"]')).toBeVisible();

    // Should show divider
    await expect(page.locator('.divider')).toBeVisible();

    // Should show only Google button (not other providers)
    await expect(page.locator('button.btn-google')).toBeVisible();
    await expect(page.locator('button.btn-linkedin')).not.toBeVisible();
    await expect(page.locator('button.btn-apple')).not.toBeVisible();
  });

  test('should throw error for "No Providers" option', async ({ page }) => {
    // Listen for console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Click "No Providers" button
    await page.getByRole('button', { name: 'No Providers' }).click();

    // Wait a bit for error to occur
    await page.waitForTimeout(500);

    // Verify error was logged
    const hasProviderError = consoleErrors.some(err =>
      err.includes('requires providers input') || err.includes('Configuration Error')
    );
    expect(hasProviderError).toBeTruthy();
  });
});

test.describe('Registration Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should open registration dialog', async ({ page }) => {
    await page.getByRole('button', { name: 'Register' }).click();

    // Verify registration form
    await expect(page.locator('.register-dialog')).toBeVisible();
    await expect(page.locator('h2', { hasText: 'Create Account' })).toBeVisible();

    // Verify form fields
    await expect(page.locator('input[name="displayName"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
  });

  test('should show error for existing email', async ({ page }) => {
    await page.getByRole('button', { name: 'Register' }).click();

    // Fill form with existing user email
    await page.locator('input[name="displayName"]').fill('Test User');
    await page.locator('input[name="email"]').fill(TEST_CREDENTIALS.email);
    await page.locator('input[name="password"]').fill('NewPassword123');
    await page.locator('input[name="confirmPassword"]').fill('NewPassword123');

    // Submit
    await page.getByRole('button', { name: 'Sign Up' }).click();

    // Verify error
    await expect(page.locator('.error-message')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.error-message')).toContainText('already registered');
  });

  test('should show error for password mismatch', async ({ page }) => {
    await page.getByRole('button', { name: 'Register' }).click();

    // Fill form with mismatched passwords
    await page.locator('input[name="displayName"]').fill('New User');
    await page.locator('input[name="email"]').fill('new@example.com');
    await page.locator('input[name="password"]').fill('Password123');
    await page.locator('input[name="confirmPassword"]').fill('DifferentPassword');

    // Submit
    await page.getByRole('button', { name: 'Sign Up' }).click();

    // Verify error
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toContainText('Passwords do not match');
  });

  test('should register successfully with new email', async ({ page }) => {
    await page.getByRole('button', { name: 'Register' }).click();

    // Fill form with new user data
    const timestamp = Date.now();
    await page.locator('input[name="displayName"]').fill('New User');
    await page.locator('input[name="email"]').fill(`newuser${timestamp}@example.com`);
    await page.locator('input[name="password"]').fill('NewPassword123');
    await page.locator('input[name="confirmPassword"]').fill('NewPassword123');

    // Submit
    await page.getByRole('button', { name: 'Sign Up' }).click();

    // Verify success
    await expect(page.locator('.success-message')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.success-message')).toContainText('Registration successful');
  });
});

test.describe('Session Persistence', () => {
  test('should persist session after page reload', async ({ page }) => {
    // Login
    await page.goto('/');
    await page.getByRole('button', { name: 'Email Only' }).click();
    await page.locator('input[name="email"]').fill(TEST_CREDENTIALS.email);
    await page.locator('input[name="password"]').fill(TEST_CREDENTIALS.password);
    await page.getByRole('button', { name: 'Sign in with Email' }).click();
    await expect(page.locator('.login-dialog')).not.toBeVisible({ timeout: 10000 });

    // Verify logged in
    await expect(page.locator('h3', { hasText: 'Authenticated User' })).toBeVisible();

    // Reload page
    await page.reload();

    // Verify still logged in
    await expect(page.locator('h3', { hasText: 'Authenticated User' })).toBeVisible();
    await expect(page.locator('text=test@example.com')).toBeVisible();
  });

  test('should clear session after logout', async ({ page }) => {
    // Login
    await page.goto('/');
    await page.getByRole('button', { name: 'Email Only' }).click();
    await page.locator('input[name="email"]').fill(TEST_CREDENTIALS.email);
    await page.locator('input[name="password"]').fill(TEST_CREDENTIALS.password);
    await page.getByRole('button', { name: 'Sign in with Email' }).click();
    await expect(page.locator('.login-dialog')).not.toBeVisible({ timeout: 10000 });

    // Logout
    await page.getByRole('button', { name: 'Sign Out' }).click();

    // Reload page
    await page.reload();

    // Verify logged out
    await expect(page.locator('h3', { hasText: 'Authenticated User' })).not.toBeVisible();
  });
});

test.describe('UI/UX Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show loading state during login', async ({ page }) => {
    await page.getByRole('button', { name: 'Email Only' }).click();
    await page.locator('input[name="email"]').fill(TEST_CREDENTIALS.email);
    await page.locator('input[name="password"]').fill(TEST_CREDENTIALS.password);

    // Click and immediately check for loading state
    const submitButton = page.getByRole('button', { name: 'Sign in with Email' });
    await submitButton.click();

    // Loading overlay should appear
    await expect(page.locator('.loading-overlay')).toBeVisible({ timeout: 1000 });
  });

  test('should have proper dialog width', async ({ page }) => {
    await page.getByRole('button', { name: 'Email Only' }).click();

    const dialog = page.locator('.cdk-overlay-pane, [role="dialog"]').first();
    await expect(dialog).toBeVisible();

    // Check width (Material Dialog sets width on overlay pane)
    const width = await dialog.evaluate(el => window.getComputedStyle(el).width);
    expect(width).toBe('400px');
  });

  test('should show "Sign up" link in login dialog', async ({ page }) => {
    await page.getByRole('button', { name: 'Email Only' }).click();

    await expect(page.locator('.register-link')).toBeVisible();
    await expect(page.locator('text=Don\'t have an account?')).toBeVisible();
    await expect(page.locator('.register-link a', { hasText: 'Sign up' })).toBeVisible();
  });

  test('should show "Sign in" link in register dialog', async ({ page }) => {
    await page.getByRole('button', { name: 'Register' }).click();

    await expect(page.locator('.login-link')).toBeVisible();
    await expect(page.locator('text=Already have an account?')).toBeVisible();
    await expect(page.locator('.login-link a', { hasText: 'Sign in' })).toBeVisible();
  });
});
