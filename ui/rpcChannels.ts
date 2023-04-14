export enum RPC_TO_MAIN {
  APPLY_UPDATE = "apply-update",
  INIT_ROLLBAR = "init-rollbar",
  SHOW_NOTIFICATION = "show-notification",
  SHOW_WINDOW = "show-window",
  START_IOT = "start-iot",
  UPDATE_TURNS_AVAILABLE = "update-turns-available",
  LOG_INFO = "log-info",
  LOG_ERROR = "log-error",
  UPDATE_USERS = "update-users",
  OPEN_URL = "open-url",
}

export enum RPC_TO_RENDERER {
  IOT_CONNECT = "iot-connect",
  IOT_ERROR = "iot-error",
  IOT_MESSAGE = "iot-message",
  SHOW_ABOUT_MODAL = "show-about-modal",
  SHOW_SETTINGS_MODAL = "show-settings-modal",
  SHOW_UPDATE_MODAL = "show-update-modal",
  SET_USER = "set-user",
  NEW_USER = "new-user",
}

export enum RPC_INVOKE {
  GET_PATH = "get-path",
  SET_FORCE_QUIT = "set-force-quit",
  SHOW_OPEN_DIALOG = "show-open-dialog",
  STORAGE_GET = "storage-get",
  STORAGE_SET = "storage-set",
}
