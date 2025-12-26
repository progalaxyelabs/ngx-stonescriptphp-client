export class ApiResponse<DataType> {
    private status: string
    private data: any
    private message: string

    constructor(status: string, data: any = {}, message: string = '') {
        this.status = status
        this.data = data
        this.message = message
    }

    onOk(callback: (data: DataType) => void): ApiResponse<DataType> {
        if (this.status === 'ok') {
            callback(this.data)
        }
        return this
    }

    onNotOk(callback: (message: string, data: DataType) => void): ApiResponse<DataType> {
        if (this.status === 'not ok') {
            callback(this.message, this.data)
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