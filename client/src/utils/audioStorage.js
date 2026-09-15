// Sistema de Persistencia en Disco Local (IndexedDB) para grabaciones de ProActur
// Actúa como "Caja Negra": guarda cada segundo de audio para recuperación ante fallos o refrescos.

const CURRENT_DB = 'ProActurRecordingDB';
const LEGACY_DBS = ['ProactorRecordingDB'];
const DB_VERSION = 1;
const STORE_CHUNKS = 'chunks';
const STORE_META = 'metadata';

function openSpecificDB(dbName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, DB_VERSION);

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

function openDB() {
  return openSpecificDB(CURRENT_DB);
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

// Comprueba la base de datos actual y cualquier base de datos previa (Proactor / ProActur)
export async function checkUnfinalizedRecording() {
  const dbsToCheck = [CURRENT_DB, ...LEGACY_DBS];

  for (const dbName of dbsToCheck) {
    try {
      const db = await openSpecificDB(dbName);
      if (!db.objectStoreNames.contains(STORE_CHUNKS) || !db.objectStoreNames.contains(STORE_META)) {
        continue;
      }

      const tx = db.transaction([STORE_CHUNKS, STORE_META], 'readonly');
      const chunksStore = tx.objectStore(STORE_CHUNKS);
      const metaStore = tx.objectStore(STORE_META);

      const metaReq = metaStore.get('activeSession');
      const countReq = chunksStore.count();

      const result = await new Promise((resolve) => {
        tx.oncomplete = () => {
          const count = countReq.result || 0;
          const meta = metaReq.result;
          if (count > 2 && meta) {
            resolve({ hasUnfinalized: true, chunkCount: count, meta, dbSource: dbName });
          } else {
            resolve({ hasUnfinalized: false });
          }
        };
        tx.onerror = () => resolve({ hasUnfinalized: false });
      });

      if (result.hasUnfinalized) {
        return result;
      }
    } catch (_) {}
  }

  return { hasUnfinalized: false };
}

export async function recoverUnfinalizedAudio() {
  const dbsToCheck = [CURRENT_DB, ...LEGACY_DBS];

  for (const dbName of dbsToCheck) {
    try {
      const db = await openSpecificDB(dbName);
      if (!db.objectStoreNames.contains(STORE_CHUNKS) || !db.objectStoreNames.contains(STORE_META)) {
        continue;
      }

      const tx = db.transaction([STORE_CHUNKS, STORE_META], 'readonly');
      const chunksStore = tx.objectStore(STORE_CHUNKS);
      const metaStore = tx.objectStore(STORE_META);

      const getAllChunks = chunksStore.getAll();
      const metaReq = metaStore.get('activeSession');

      const recovery = await new Promise((resolve, reject) => {
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
            title: meta.title || 'Reunión Recuperada de Caja Negra',
            startTime: meta.startTime
          });
        };
        tx.onerror = () => reject(tx.error);
      });

      if (recovery && recovery.blob) {
        return recovery;
      }
    } catch (err) {
      console.warn('[Storage] Error verificando ' + dbName, err);
    }
  }

  return null;
}

export async function clearEmergencyRecording() {
  const dbsToClear = [CURRENT_DB, ...LEGACY_DBS];
  for (const dbName of dbsToClear) {
    try {
      const db = await openSpecificDB(dbName);
      if (db.objectStoreNames.contains(STORE_CHUNKS) && db.objectStoreNames.contains(STORE_META)) {
        const tx = db.transaction([STORE_CHUNKS, STORE_META], 'readwrite');
        tx.objectStore(STORE_CHUNKS).clear();
        tx.objectStore(STORE_META).clear();
      }
    } catch (_) {}
  }
}
