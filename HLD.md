# ngx-stonescriptphp-client - High Level Design

## Overview
Official Angular HTTP client library for StoneScriptPHP backend framework.

## Purpose
Provides type-safe HTTP calls to StoneScriptPHP APIs using auto-generated TypeScript interfaces.

## Architecture

### Components
- **ApiConnectionService** - HTTP client wrapper with error handling
- **AuthService** - JWT token management
- **DbService** - IndexedDB offline storage integration
- **TokenService** - Token storage and refresh logic
- **SigninStatusService** - Authentication state management

### Flow
1. StoneScriptPHP generates TypeScript DTOs from PHP
2. Angular imports generated interfaces
3. HTTP calls use interfaces for type safety
4. Responses validated against DTOs

## Tech Stack
- Angular >= 19.0
- RxJS >= 7.8
- TypeScript >= 5.8

## Distribution
- Published to npm as @progalaxyelabs/ngx-stonescriptphp-client
- Future migration to @stonescriptphp namespace planned
