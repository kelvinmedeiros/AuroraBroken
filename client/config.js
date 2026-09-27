export const BASE_URL = window.location.origin;
export const SPRITES_BASE_URL = new URL('./sprites/',window.location.href).href.replace(/\/$/,'');
export default { SERVER_ADDRESS:window.location.hostname, PORT:window.location.port };

