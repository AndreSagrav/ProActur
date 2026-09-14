// Sistema de Persistencia en Disco Local (IndexedDB) para grabaciones de Proactor
// Actua como "Caja Negra": guarda cada segundo de audio para recuperacion ante fallos o refrescos.

const DB_NAME = 'ProactorRecordingDB';
const DB_VERSION = 1;
const STORE_CHUNKS = 'chunks';
const STORE_META = 'metadata';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
        db.createObjectStore(STORE_CHUNKS, { autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function initEmergencyRecording(title = '') {
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_CHUNKS, STORE_META], 'readwrite');
    tx.objectStore(STORE_CHUNKS).clear();
    tx.objectStore(STORE_META).put({
      startTime: Date.now(),
      title,
      recovered: false
    }, 'activeSession');
    return true;
  } catch (err) {
    console.warn('[Storage] Error iniciando caja negra:', err);
    return false;
  }
}

export async function appendAudioChunk(chunkBlob) {
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_CHUNKS, STORE_META], 'readwrite');
    tx.objectStore(STORE_CHUNKS).add(chunkBlob);
    tx.objectStore(STORE_META).put({ lastUpdated: Date.now() }, 'lastPing');
  } catch (err) {
    console.warn('[Storage] Error guardando fragmento:', err);
  }
}

export async function checkUnfinalizedRecording() {
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_CHUNKS, STORE_META], 'readonly');
    const chunksStore = tx.objectStore(STORE_CHUNKS);
    const metaStore = tx.objectStore(STORE_META);

    const metaReq = metaStore.get('activeSession');
    const countReq = chunksStore.count();

    return new Promise((resolve) => {
      tx.oncomplete = () => {
        const count = countReq.result || 0;
        const meta = metaReq.result;
        if (count > 2 && meta) {
          resolve({ hasUnfinalized: true, chunkCount: count, meta });
        } else {
          resolve({ hasUnfinalized: false });
        }
      };
      tx.onerror = () => resolve({ hasUnfinalized: false });
    });
  } catch (err) {
    return { hasUnfinalized: false };
  }
}

export async function recoverUnfinalizedAudio() {
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_CHUNKS, STORE_META], 'readonly');
    const chunksStore = tx.objectStore(STORE_CHUNKS);
    const metaStore = tx.objectStore(STORE_META);

    const getAllChunks = chunksStore.getAll();
    const metaReq = metaStore.get('activeSession');

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        const chunks = getAllChunks.result || [];
        const meta = metaReq.result || {};
        if (chunks.length === 0) {
          resolve(null);
          return;
        }
        const combinedBlob = new Blob(chunks, { type: 'audio/webm' });
        resolve({
          blob: combinedBlob,
          title: meta.title || 'Reunion Recuperada',
          startTime: meta.startTime
        });
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('[Storage] Error recuperando audio:', err);
    return null;
  }
}

export async function clearEmergencyRecording() {
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_CHUNKS, STORE_META], 'readwrite');
    tx.objectStore(STORE_CHUNKS).clear();
    tx.objectStore(STORE_META).clear();
  } catch (err) {
    console.warn('[Storage] Error limpiando caja negra:', err);
  }
}