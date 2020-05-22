var fs = require('fs');
var webpack = require('webpack');

var ENV = process.env.npm_lifecycle_event;
var isProd = ENV === 'build-prod';
var apiUrl = "https://api.playyourdamnturn.com";

if (!isProd) {
    try {
        apiUrl = fs.readFileSync('../api-dev-url.txt', 'utf-8');
        console.log('Using ' + apiUrl + ' for API URL!');
    } catch (Error) {
        console.log('There wasn\'t anything in ../api-dev-url.txt, using prod api url...');
    }
}

var iotCreds = {
    accessKey: process.env.IOT_CLIENT_ACCESS_KEY,
    secretKey: process.env.IOT_CLIENT_SECRET_KEY
};

if (fs.existsSync("iot-client-creds.json")) {
    console.log("Using IoT creds from file...");
    iotCreds = JSON.parse(fs.readFileSync("iot-client-creds.json"));
} else {
    console.log("Using IoT creds from environment...")
}

module.exports = {
    target: 'electron-renderer',
    plugins: [
        new webpack.DefinePlugin({
            // Environment helpers
            'PYDT_CONFIG': {
                PROD: JSON.stringify(isProd),
                API_URL: JSON.stringify(apiUrl),
                IOT_CLIENT_ACCESS_KEY: JSON.stringify(iotCreds.accessKey),
                IOT_CLIENT_SECRET_KEY: JSON.stringify(iotCreds.secretKey),
            }
        })
    ]
};