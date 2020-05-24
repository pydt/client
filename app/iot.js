const awsIot = require('aws-iot-device-sdk');

module.exports.configureIot = (electron, win) => {
  let currentDevice;
  let currentTopic;
  
  electron.ipcMain.on('start-iot', (event, data) => {
    if (data.topic !== currentTopic) {
      if (currentDevice) {
        currentDevice.unsubscribe(currentTopic);
        currentDevice.subscribe(data.topic);
      } else {
        currentDevice = awsIot.device({
          region: 'us-east-1',
          protocol: 'wss',
          keepalive: 600,
          accessKeyId: data.accessKey,
          secretKey: data.secretKey,
          host: 'a21s639tnrshxf.iot.us-east-1.amazonaws.com'
        });
      
        currentDevice.on('connect', () => {
          win.send('iot-connect');
          currentDevice.subscribe(data.topic);
        });
      
        currentDevice.on('error', err => {
          win.send('iot-error', err);
        });
      
        currentDevice.on('message', (topic, message) => {
          win.send('iot-message', {
            topic,
            message
          });
        });
      }
      
      currentTopic = data.topic;
    }
  });
}