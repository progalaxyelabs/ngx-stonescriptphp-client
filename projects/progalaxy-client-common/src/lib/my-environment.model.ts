export class MyEnvironmentModel {
    production: boolean = true
    firebase: {
        projectId: string
        appId: string
        databaseURL: string
        storageBucket: string
        locationId: string
        apiKey: string
        authDomain: string
        messagingSenderId: string
        measurementId: string
    } = {
            projectId: '',
            appId: '',
            databaseURL: '',
            storageBucket: '',
            locationId: '',
            apiKey: '',
            authDomain: '',
            messagingSenderId: '',
            measurementId: ''
        }
    apiServer: {
        host: string
    } = { host: '' }
    chatServer: {
        host: string
    } = { host: '' };
}