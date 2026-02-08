/**
 * Result of a file upload operation
 */
export interface FileUploadResult {
    /** Unique file identifier (UUID) */
    id: string;
    /** Original file name */
    name: string;
    /** MIME content type */
    contentType: string;
    /** File size in bytes */
    size: number;
    /** ISO timestamp of upload */
    uploadedAt: string;
    /** Tenant ID (present when tenant-scoped) */
    tenantId?: string;
}

/**
 * File metadata as returned by the list endpoint
 */
export interface FileMetadata {
    /** Unique file identifier (UUID) */
    fileId: string;
    /** Original file name */
    fileName: string;
    /** MIME content type */
    contentType: string;
    /** File size in bytes */
    size: number;
    /** ISO timestamp of upload */
    uploadedAt: string;
}

/**
 * Response from the file list endpoint
 */
export interface FileListResponse {
    success: boolean;
    count: number;
    files: FileMetadata[];
}

/**
 * Response from the file upload endpoint
 */
export interface FileUploadResponse {
    success: boolean;
    file: FileUploadResult;
}

/**
 * Response from the file delete endpoint
 */
export interface FileDeleteResponse {
    success: boolean;
    message: string;
}
