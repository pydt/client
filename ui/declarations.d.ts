declare module 'electron-json-storage';
declare module 'electron';
declare module 'fs';
declare module 'path';
declare module 'mkdirp';
declare module 'aws-iot-device-sdk';

declare const PYDT_CONFIG: {
    PROD: boolean;
    API_URL: string;
    IOT_CLIENT_ACCESS_KEY: string;
    IOT_CLIENT_SECRET_KEY: string;
};