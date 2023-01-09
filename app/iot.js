const { device } = require("aws-iot-device-sdk");
const { RPC_TO_RENDERER, RPC_TO_MAIN } = require("./rpcChannels");

module.exports = {
  configureIot: (electron, win) => {
    let currentDevice;
    let currentTopic;

    electron.ipcMain.on(RPC_TO_MAIN.START_IOT, (event, data) => {
      if (data.topic !== currentTopic) {
        if (currentDevice) {
          currentDevice.unsubscribe(currentTopic);
          currentDevice.subscribe(data.topic);
        } else {
          currentDevice = device({
            region: "us-east-1",
            protocol: "wss",
            keepalive: 600,
            accessKeyId: data.accessKey,
            secretKey: data.secretKey,
            host: "a21s639tnrshxf-ats.iot.us-east-1.amazonaws.com",
          });

          currentDevice.on("connect", () => {
            win.send(RPC_TO_RENDERER.IOT_CONNECT);
            currentDevice.subscribe(data.topic);
          });

          currentDevice.on("error", err => {
            win.send(RPC_TO_RENDERER.IOT_ERROR, err);
          });

          currentDevice.on("message", (topic, message) => {
            win.send(RPC_TO_RENDERER.IOT_MESSAGE, {
              topic,
              message,
            });
          });
        }

        currentTopic = data.topic;
      }
    });
  },
};
