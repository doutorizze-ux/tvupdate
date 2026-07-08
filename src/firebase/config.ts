export const firebaseConfig = {
  "projectId": "tiksnap-pro",
  "appId": "1:699445712040:web:e93285c39a32fe23be9e9d",
  "apiKey": "AIzaSyA6EQT4evSU3v39eiHNoavpcG-otm975fs",
  "authDomain": "tiksnap-pro.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "699445712040"
};

export function isFirebaseConfigValid(config: any): boolean {
  if (!config) return false;
  return (
    typeof config.apiKey === 'string' &&
    config.apiKey &&
    typeof config.authDomain === 'string' &&
    config.authDomain &&
    typeof config.projectId === 'string' &&
    config.projectId
  );
}
