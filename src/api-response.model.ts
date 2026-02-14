export class ApiResponse<DataType> {
    public readonly status: string
    public readonly data: DataType | null
    public readonly message: string

    get success(): boolean {
        return this.status === 'ok'
    }

    get errors(): string[] {
        return this.message ? [this.message] : []
    }

    constructor(status: string, data: any = null, message: string = '') {
        this.status = status
        this.data = data || null
        this.message = message
    }

    onOk(callback: (data: DataType) => void): ApiResponse<DataType> {
        if (this.status === 'ok') {
            callback(this.data as DataType)
        }
        return this
    }

    onNotOk(callback: (message: string, data: DataType) => void): ApiResponse<DataType> {
        if (this.status === 'not ok') {
            callback(this.message, this.data as DataType)
        }
        return this
    }

    onError(callback: () => void): ApiResponse<DataType> {
        if (this.status === 'error') {
            callback()
        }
        return this
    }

    isSuccess(): boolean {
        return this.status === 'ok'
    }

    isError(): boolean {
        return this.status === 'error' || this.status === 'not ok'
    }

    getData(): DataType | null {
        return this.data || null
    }

    getError(): string {
        return this.message || 'Unknown error'
    }

    getStatus(): string {
        return this.status
    }

    getMessage(): string {
        return this.message
    }
}
