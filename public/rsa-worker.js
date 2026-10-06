importScripts('rsa.js');
self.onmessage = (e) => {
  const t = Date.now();
  const keys = RSA.generateKeyPair(e.data.bits || 1024);
  self.postMessage({ keys, ms: Date.now() - t });
};