# ngx-stonescriptphp-client

> Official Angular client library for StoneScriptPHP backend framework

[![npm version](https://badge.fury.io/js/%40progalaxyelabs%2Fngx-stonescriptphp-client.svg)](https://www.npmjs.com/package/@progalaxyelabs/ngx-stonescriptphp-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Note:** While published as `@progalaxyelabs/ngx-stonescriptphp-client`, this is the official client for [StoneScriptPHP](https://stonescriptphp.org). Future versions will migrate to the `@stonescriptphp` namespace.

---

## What is this?

The Angular HTTP client library for **StoneScriptPHP** - a modern PHP backend framework that auto-generates TypeScript clients from your backend DTOs and contracts.

When you build APIs with StoneScriptPHP, you define:
- Request DTOs (TypeScript interfaces)
- Response DTOs (TypeScript interfaces)
- Route contracts (interfaces)

This library provides the HTTP client that consumes those contracts, giving you **100% type-safe** API calls with zero manual typing.

## Features

- ✅ **Type-safe HTTP calls** - Full TypeScript support from backend DTOs
- ✅ **Auto-generated clients** - StoneScriptPHP generates TypeScript from PHP
- ✅ **RxJS observables** - Native Angular integration
- ✅ **Error handling** - Consistent error responses
- ✅ **Interceptors ready** - Add auth, logging, retry logic
- ✅ **Angular 19+** - Modern Angular standalone components

## Installation

```bash
npm install @progalaxyelabs/ngx-stonescriptphp-client
```

## Quick Start

### 1. Generate TypeScript Client from Backend

In your StoneScriptPHP project:

```bash
php stone generate typescript-client
```

This generates TypeScript interfaces from your PHP DTOs.

### 2. Use in Angular

```typescript
import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Auto-generated from StoneScriptPHP backend
interface ProductRequest {
  name: string;
  price: number;
}

interface ProductResponse {
  productId: number;
  status: string;
}

@Component({
  selector: 'app-products',
  standalone: true,
  template: `<button (click)="createProduct()">Create Product</button>`
})
export class ProductsComponent {
  constructor(private http: HttpClient) {}

  createProduct(): void {
    const request: ProductRequest = {
      name: 'Widget',
      price: 99.99
    };

    this.http.post<ProductResponse>('http://localhost:9100/products', request)
      .subscribe(response => {
        console.log('Product created:', response.productId);
      });
  }
}
```

## How it Works

StoneScriptPHP follows a **contract-first** approach:

```
PHP Backend (StoneScriptPHP)          Angular Frontend
┌─────────────────────────┐          ┌──────────────────────┐
│ ProductRequest DTO      │  ──────> │ ProductRequest.ts    │
│ ProductResponse DTO     │  ──────> │ ProductResponse.ts   │
│ IProductRoute contract  │  ──────> │ Type-safe HTTP calls │
└─────────────────────────┘          └──────────────────────┘
```

1. Define DTOs in PHP
2. Run `php stone generate typescript-client`
3. Import generated TypeScript interfaces in Angular
4. Make type-safe HTTP calls

## Advanced Usage

### With Interceptors

```typescript
import { HttpInterceptor, HttpRequest, HttpHandler } from '@angular/common/http';

export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler) {
    const authReq = req.clone({
      headers: req.headers.set('Authorization', 'Bearer ' + getToken())
    });
    return next.handle(authReq);
  }
}
```

### With Error Handling

```typescript
this.http.post<ProductResponse>('/products', request)
  .pipe(
    catchError(error => {
      console.error('API Error:', error);
      return throwError(() => error);
    })
  )
  .subscribe(response => {
    // Handle success
  });
```

## API Response Format

StoneScriptPHP responses follow this structure:

```typescript
{
  "status": "ok" | "error",
  "message": "Success message",
  "data": { /* Your DTO */ }
}
```

## Requirements

- Angular >= 19.0.0
- RxJS >= 7.8.0
- TypeScript >= 5.8.0

## Documentation

- **Framework Docs:** [stonescriptphp.org](https://stonescriptphp.org)
- **Getting Started:** [stonescriptphp.org/docs/getting-started](https://stonescriptphp.org/docs/getting-started)
- **TypeScript Client Guide:** [stonescriptphp.org/docs/typescript-client](https://stonescriptphp.org/docs/typescript-client)

## Example Projects

Check out the [StoneScriptPHP examples repository](https://github.com/progalaxyelabs/StoneScriptPHP/tree/main/examples) for full-stack example apps.

## Contributing

This is part of the StoneScriptPHP ecosystem. Contributions welcome!

- Report issues: [GitHub Issues](https://github.com/progalaxyelabs/ngx-stonescriptphp-client/issues)
- Framework repo: [StoneScriptPHP](https://github.com/progalaxyelabs/StoneScriptPHP)

## License

MIT

## Related Projects

- [StoneScriptPHP](https://github.com/progalaxyelabs/StoneScriptPHP) - The PHP backend framework
- [sunbird-garden](https://github.com/progalaxyelabs/sunbird-garden) - Reference implementation

---

**Made with ❤️ by the StoneScriptPHP team**
