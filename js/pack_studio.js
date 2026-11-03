/**
 * CraftIndex - Pack Studio, Native ZIP Import/Export & Persistent Binary Storage Engine
 * Author: Arata Inlooker <aratainlooker@gmail.com>
 * Website: https://craftvault.inlooker.top
 */

(function (window) {
  'use strict';

  // =========================================================================
  // 1. PERSISTENT BINARY STORAGE (IndexedDB: CraftIndexDB, migrated from CraftVaultDB)
  // =========================================================================

  const OLD_DB_NAME = 'CraftVaultDB';
  const DB_NAME = 'CraftIndexDB';
  const DB_VERSION = 1;
  const STORE_BINARIES = 'binaries';
  const STORE_PACK_CONFIG = 'pack_config';

  let dbPromise = null;

  async function checkAndMigrateLegacyDB(newDb) {
    if (!window.indexedDB) return;
    try {
      if (window.localStorage && (window.localStorage.getItem('cv_idb_migrated') === 'true' || window.localStorage.getItem('ci_idb_migrated') === 'true')) {
        return;
      }

      let legacyDbExists = false;
      if (typeof window.indexedDB.databases === 'function') {
        const dbs = await window.indexedDB.databases();
        legacyDbExists = Array.isArray(dbs) && dbs.some(d => d.name === OLD_DB_NAME);
      } else {
        legacyDbExists = true;
      }

      if (!legacyDbExists) {
        if (window.localStorage) {
          window.localStorage.setItem('cv_idb_migrated', 'true');
          window.localStorage.setItem('ci_idb_migrated', 'true');
        }
        return;
      }

      const oldDb = await new Promise((res) => {
        const r = window.indexedDB.open(OLD_DB_NAME);
        r.onsuccess = (e) => res(e.target.result);
        r.onerror = () => res(null);
      });

      if (!oldDb) return;

      if (!oldDb.objectStoreNames.contains(STORE_BINARIES)) {
        oldDb.close();
        if (window.localStorage) window.localStorage.setItem('ci_idb_migrated', 'true');
        return;
      }

      const oldRecords = await new Promise((res) => {
        try {
          const tx = oldDb.transaction(STORE_BINARIES, 'readonly');
          const st = tx.objectStore(STORE_BINARIES);
          const req = st.getAll();
          req.onsuccess = () => res(req.result || []);
          req.onerror = () => res([]);
        } catch (_) {
          res([]);
        }
      });

      let oldConfigs = [];
      if (oldDb.objectStoreNames.contains(STORE_PACK_CONFIG)) {
        oldConfigs = await new Promise((res) => {
          try {
            const tx = oldDb.transaction(STORE_PACK_CONFIG, 'readonly');
            const st = tx.objectStore(STORE_PACK_CONFIG);
            const req = st.getAll();
            req.onsuccess = () => res(req.result || []);
            req.onerror = () => res([]);
          } catch (_) {
            res([]);
          }
        });
      }

      if (oldRecords.length > 0 || oldConfigs.length > 0) {
        console.log(`[CraftIndex] Found ${oldRecords.length} binaries in legacy ${OLD_DB_NAME}. Migrating to ${DB_NAME}...`);
        await new Promise((res) => {
          try {
            const tx = newDb.transaction([STORE_BINARIES, STORE_PACK_CONFIG], 'readwrite');
            const bStore = tx.objectStore(STORE_BINARIES);
            const cStore = tx.objectStore(STORE_PACK_CONFIG);
            for (const rec of oldRecords) {
              bStore.put(rec);
            }
            for (const cfg of oldConfigs) {
              cStore.put(cfg);
            }
            tx.oncomplete = () => res(true);
            tx.onerror = () => res(false);
          } catch (e) {
            console.error('[CraftIndex] Error migrating records to new DB:', e);
            res(false);
          }
        });

        // Full cryptographic verification across all migrated binary Blobs
        const newRecords = await new Promise((res) => {
          try {
            const tx = newDb.transaction(STORE_BINARIES, 'readonly');
            const st = tx.objectStore(STORE_BINARIES);
            const req = st.getAll();
            req.onsuccess = () => res(req.result || []);
            req.onerror = () => res([]);
          } catch (_) {
            res([]);
          }
        });

        let allVerified = newRecords.length === oldRecords.length;
        if (allVerified && oldRecords.length > 0) {
          for (const oldRec of oldRecords) {
            const newRec = newRecords.find(r => r.id === oldRec.id);
            if (!newRec || newRec.size !== oldRec.size || newRec.hash !== oldRec.hash) {
              allVerified = false;
              break;
            }
            if (newRec.blob && typeof newRec.blob.arrayBuffer === 'function') {
              try {
                const buf = await newRec.blob.arrayBuffer();
                const computedHash = await calculateSha256(buf);
                if (computedHash.toLowerCase() !== (oldRec.hash || '').toLowerCase() || buf.byteLength !== oldRec.size) {
                  allVerified = false;
                  break;
                }
              } catch (_) {
                allVerified = false;
                break;
              }
            }
          }
        }

        if (allVerified) {
          console.log(`[CraftIndex] Successfully migrated ${newRecords.length} binaries to ${DB_NAME} with 100% cryptographic SHA-256 and byte length verification.`);
          if (window.localStorage) {
            window.localStorage.setItem('cv_idb_migrated', 'true');
            window.localStorage.setItem('ci_idb_migrated', 'true');
          }
        } else {
          console.warn('[CraftIndex] Migration verification check did not match. Keeping migration open for retry.');
        }
      } else {
        if (window.localStorage) {
          window.localStorage.setItem('cv_idb_migrated', 'true');
          window.localStorage.setItem('ci_idb_migrated', 'true');
        }
      }

      // Old database retained intact for safekeeping
      oldDb.close();
    } catch (err) {
      console.error('[CraftIndex] Legacy DB migration error:', err);
    }
  }

  function getDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('[CraftIndex] IndexedDB is not supported in this environment.');
        return resolve(null);
      }
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_BINARIES)) {
          db.createObjectStore(STORE_BINARIES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_PACK_CONFIG)) {
          db.createObjectStore(STORE_PACK_CONFIG, { keyPath: 'id' });
        }
      };
      req.onsuccess = async (e) => {
        const db = e.target.result;
        await checkAndMigrateLegacyDB(db);
        resolve(db);
      };
      req.onerror = (e) => {
        console.error('[CraftIndex] IndexedDB error:', e.target.error);
        resolve(null);
      };
    });
    return dbPromise;
  }

  async function idbPutBinary(record) {
    const db = await getDB();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_BINARIES, 'readwrite');
        const store = tx.objectStore(STORE_BINARIES);
        store.put(record);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        console.error('[CraftIndex] idbPutBinary error:', e);
        resolve(false);
      }
    });
  }

  async function idbGetBinary(id) {
    const db = await getDB();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_BINARIES, 'readonly');
        const store = tx.objectStore(STORE_BINARIES);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (e) {
        console.error('[CraftIndex] idbGetBinary error:', e);
        resolve(null);
      }
    });
  }

  async function idbDeleteBinary(id) {
    const db = await getDB();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_BINARIES, 'readwrite');
        const store = tx.objectStore(STORE_BINARIES);
        store.delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  async function idbGetAllBinaries() {
    const db = await getDB();
    if (!db) return [];
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_BINARIES, 'readonly');
        const store = tx.objectStore(STORE_BINARIES);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  async function idbClearBinaries() {
    const db = await getDB();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_BINARIES, 'readwrite');
        const store = tx.objectStore(STORE_BINARIES);
        store.clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  // =========================================================================
  // 2. CRYPTOGRAPHIC INTEGRITY & SHA-256 UTILITY
  // =========================================================================

  // Pure JavaScript SHA-256 fallback for environments without crypto.subtle
  function jsSha256(bytes) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    let lengthProperty = 'length';
    let i, j;
    let result = '';

    const words = [];
    const asciiBitLength = bytes.length * 8;
    let hash = [];
    const k = [];
    let primeCounter = 0;

    const isPrime = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isPrime[candidate]) {
        for (i = 0; i < 300; i += candidate) {
          isPrime[i] = candidate;
        }
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }

    hash = hash.slice(0, 8);

    for (i = 0; i < bytes.length; i++) {
      words[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
    }
    words[bytes.length >> 2] |= 0x80 << (24 - (bytes.length % 4) * 8);
    words[(((bytes.length + 8) >> 6) << 4) + 15] = asciiBitLength;

    const w = [];
    for (let chunk = 0; chunk < words.length; chunk += 16) {
      const a = hash[0], b = hash[1], c = hash[2], d = hash[3];
      let e = hash[4], f = hash[5], g = hash[6], h = hash[7];

      for (i = 0; i < 64; i++) {
        if (i < 16) {
          w[i] = words[chunk + i] | 0;
        } else {
          const gamma0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
          const gamma1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
          w[i] = (((w[i - 16] + gamma0) | 0) + ((w[i - 7] + gamma1) | 0)) | 0;
        }

        const ch = (e & f) ^ (~e & g);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const sigma0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
        const sigma1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
        const temp1 = ((((((h + sigma1) | 0) + ch) | 0) + k[i]) | 0 + w[i]) | 0;
        const temp2 = (sigma0 + maj) | 0;

        h = g; g = f; f = e; e = (d + temp1) | 0;
        d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }

      hash[0] = (hash[0] + a) | 0; hash[1] = (hash[1] + b) | 0;
      hash[2] = (hash[2] + c) | 0; hash[3] = (hash[3] + d) | 0;
      hash[4] = (hash[4] + e) | 0; hash[5] = (hash[5] + f) | 0;
      hash[6] = (hash[6] + g) | 0; hash[7] = (hash[7] + h) | 0;
    }

    for (i = 0; i < 8; i++) {
      for (j = 3; j >= 0; j--) {
        const byte = (hash[i] >> (j * 8)) & 255;
        result += (byte < 16 ? '0' : '') + byte.toString(16);
      }
    }
    return result;
  }

  async function calculateSha256(arrayBuffer) {
    if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
      try {
        const hashBuf = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuf));
        return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {
        // Fall back to pure JS
      }
    }
    return jsSha256(new Uint8Array(arrayBuffer));
  }

  // =========================================================================
  // 3. SECURITY VALIDATION & RESOURCE INSPECTION PARSERS
  // =========================================================================

  const MAX_TOTAL_UNCOMPRESSED_BYTES = 600 * 1024 * 1024; // 600 MB aggregate safety limit
  const MAX_ZIP_ENTRIES = 3000;
  const MAX_SINGLE_ENTRY_BYTES = 300 * 1024 * 1024; // 300 MB single file limit
  const MAX_PATH_LENGTH = 255;
  const MAX_COMPRESSION_RATIO = 100; // Zip bomb detection threshold (100:1)

  function validateZipPath(entryPath) {
    if (!entryPath || typeof entryPath !== 'string') return false;
    if (entryPath.length > MAX_PATH_LENGTH) return false;
    if (entryPath.includes('\0')) return false; // Null byte
    if (entryPath.includes('../') || entryPath.includes('..\\') || /(?:^|\/)\.\.(?:\/|$)/.test(entryPath)) return false; // Path traversal
    if (entryPath.startsWith('/') || entryPath.startsWith('\\')) return false; // Absolute path
    if (/^[a-zA-Z]:/.test(entryPath)) return false; // Windows drive letters (C:)
    return true;
  }

  function parseToml(content) {
    const meta = { modId: '', name: '', version: '', authors: '', description: '', loader: 'Forge' };
    const lines = content.split('\n');
    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const eqIdx = line.indexOf('=');
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key === 'modId' && !meta.modId) meta.modId = val;
      if ((key === 'displayName' || key === 'name') && !meta.name) meta.name = val;
      if (key === 'version' && !meta.version && !val.includes('${')) meta.version = val;
      if (key === 'authors' && !meta.authors) meta.authors = val;
      if (key === 'description' && !meta.description) meta.description = val;
    }
    if (!meta.name && meta.modId) meta.name = meta.modId;
    return meta;
  }

  function parsePluginYml(content) {
    const meta = { name: '', version: '', main: '', authors: '', description: '', apiVersion: '' };
    const lines = content.split('\n');
    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('#') || !line.includes(':')) continue;
      const colonIdx = line.indexOf(':');
      const key = line.slice(0, colonIdx).trim();
      let val = line.slice(colonIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key === 'name' && !meta.name) meta.name = val;
      if (key === 'version' && !meta.version) meta.version = val;
      if (key === 'main' && !meta.main) meta.main = val;
      if ((key === 'author' || key === 'authors') && !meta.authors) meta.authors = val;
      if (key === 'description' && !meta.description) meta.description = val;
      if (key === 'api-version' && !meta.apiVersion) meta.apiVersion = val;
    }
    return meta;
  }

  async function inspectJarBinary(jarArrayBuffer, jarName) {
    if (!window.JSZip) {
      throw new Error('JSZip library is required for JAR inspection.');
    }
    const jarZip = await window.JSZip.loadAsync(jarArrayBuffer);
    const files = Object.keys(jarZip.files);

    // 1. Check Fabric (fabric.mod.json)
    if (jarZip.files['fabric.mod.json']) {
      try {
        const text = await jarZip.files['fabric.mod.json'].async('string');
        const json = JSON.parse(text);
        const authors = Array.isArray(json.authors)
          ? json.authors.map((a) => (typeof a === 'string' ? a : a.name || '')).filter(Boolean).join(', ')
          : (typeof json.authors === 'string' ? json.authors : '');
        return {
          type: 'mod',
          loader: 'Fabric',
          id: json.id || jarName,
          name: json.name || json.id || jarName,
          version: json.version || '1.0.0',
          authors: authors || 'Unknown',
          description: json.description || '',
          mcVersion: (json.depends && json.depends.minecraft) || ''
        };
      } catch (e) {}
    }

    // 2. Check Quilt (quilt.mod.json)
    if (jarZip.files['quilt.mod.json']) {
      try {
        const text = await jarZip.files['quilt.mod.json'].async('string');
        const json = JSON.parse(text);
        const ql = json.quilt_loader || {};
        const qm = ql.metadata || {};
        return {
          type: 'mod',
          loader: 'Quilt',
          id: ql.id || json.id || jarName,
          name: qm.name || ql.id || json.id || jarName,
          version: qm.version || json.version || '1.0.0',
          authors: qm.contributors ? Object.keys(qm.contributors).join(', ') : 'Unknown',
          description: qm.description || json.description || '',
          mcVersion: ''
        };
      } catch (e) {}
    }

    // 3. Check NeoForge (META-INF/neoforge.mods.toml)
    if (jarZip.files['META-INF/neoforge.mods.toml']) {
      try {
        const text = await jarZip.files['META-INF/neoforge.mods.toml'].async('string');
        const meta = parseToml(text);
        meta.loader = 'NeoForge';
        meta.type = 'mod';
        return meta;
      } catch (e) {}
    }

    // 4. Check Forge (META-INF/mods.toml)
    if (jarZip.files['META-INF/mods.toml']) {
      try {
        const text = await jarZip.files['META-INF/mods.toml'].async('string');
        const meta = parseToml(text);
        meta.loader = 'Forge';
        meta.type = 'mod';
        return meta;
      } catch (e) {}
    }

    // 5. Check Legacy Forge (mcmod.info)
    if (jarZip.files['mcmod.info']) {
      try {
        const text = await jarZip.files['mcmod.info'].async('string');
        const json = JSON.parse(text);
        const mod = Array.isArray(json) ? json[0] : (json.modList ? json.modList[0] : json);
        if (mod) {
          return {
            type: 'mod',
            loader: 'Forge (Legacy)',
            id: mod.modid || jarName,
            name: mod.name || mod.modid || jarName,
            version: mod.version || '1.0.0',
            authors: Array.isArray(mod.authorList) ? mod.authorList.join(', ') : (mod.authors || 'Unknown'),
            description: mod.description || '',
            mcVersion: mod.mcversion || ''
          };
        }
      } catch (e) {}
    }

    // 6. Check Plugin (plugin.yml, paper-plugin.yml, velocity-plugin.json, bungee.yml)
    const pluginDesc = jarZip.files['plugin.yml'] || jarZip.files['paper-plugin.yml'] || jarZip.files['bungee.yml'];
    if (pluginDesc) {
      try {
        const text = await pluginDesc.async('string');
        const meta = parsePluginYml(text);
        return {
          type: 'plugin',
          loader: 'Spigot/Paper',
          id: meta.name ? meta.name.toLowerCase().replace(/[^a-z0-9_-]/g, '') : jarName,
          name: meta.name || jarName,
          version: meta.version || '1.0.0',
          authors: meta.authors || 'Server Plugin Developer',
          description: meta.description || 'Minecraft server plugin',
          mcVersion: meta.apiVersion || ''
        };
      } catch (e) {}
    }

    if (jarZip.files['velocity-plugin.json']) {
      try {
        const text = await jarZip.files['velocity-plugin.json'].async('string');
        const json = JSON.parse(text);
        return {
          type: 'plugin',
          loader: 'Velocity',
          id: json.id || jarName,
          name: json.name || json.id || jarName,
          version: json.version || '1.0.0',
          authors: Array.isArray(json.authors) ? json.authors.join(', ') : 'Velocity Developer',
          description: json.description || '',
          mcVersion: ''
        };
      } catch (e) {}
    }

    // 7. Unverified Java Archive
    return {
      type: 'unverified',
      loader: 'Unverified',
      id: jarName.replace(/\.jar$/i, ''),
      name: jarName,
      version: '1.0.0',
      authors: 'Unverified Archive',
      description: 'Java archive without recognized mod or plugin descriptor.',
      mcVersion: ''
    };
  }

  // =========================================================================
  // 4. MAIN ZIP ARCHIVE IMPORT WORKFLOW
  // =========================================================================

  async function importZipArchive(file) {
    if (!window.JSZip) {
      throw new Error('JSZip is not available.');
    }

    const summary = {
      totalFiles: 0,
      identifiedMods: 0,
      identifiedPlugins: 0,
      identifiedResourcePacks: 0,
      identifiedShaders: 0,
      identifiedDatapacks: 0,
      unverifiedFiles: 0,
      duplicatesSkipped: 0,
      failedFiles: 0,
      addedItems: [],
      errors: []
    };

    let zip;
    try {
      zip = await window.JSZip.loadAsync(file);
    } catch (e) {
      summary.errors.push('Archive corruption: Unable to parse ZIP file format (' + e.message + ')');
      return summary;
    }

    const entries = Object.keys(zip.files);
    summary.totalFiles = entries.length;

    if (entries.length > MAX_ZIP_ENTRIES) {
      summary.errors.push(`Archive exceeds safe entry limit (${entries.length} > ${MAX_ZIP_ENTRIES} entries). Processing aborted for safety.`);
      return summary;
    }

    // Pre-flight Archive Security & Aggregate Uncompressed Limit Checks
    let estimatedTotalBytes = 0;
    for (const p of entries) {
      if (!validateZipPath(p)) {
        summary.failedFiles++;
        summary.errors.push(`Archive contains unsafe entry path '${p}'. Processing aborted for security.`);
        return summary;
      }
      const entryObj = zip.files[p];
      if (!entryObj.dir && entryObj._data && typeof entryObj._data.uncompressedSize === 'number') {
        const uSize = entryObj._data.uncompressedSize;
        const cSize = entryObj._data.compressedSize || 1;
        if (cSize > 0 && (uSize / cSize > MAX_COMPRESSION_RATIO) && uSize > 10 * 1024 * 1024) {
          summary.errors.push(`Archive entry '${p}' has suspicious compression ratio (${Math.round(uSize / cSize)}:1). Possible zip bomb detected.`);
          return summary;
        }
        estimatedTotalBytes += uSize;
      }
    }

    if (estimatedTotalBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
      summary.errors.push(`Archive aggregate uncompressed size (~${Math.round(estimatedTotalBytes / (1024 * 1024))} MB) exceeds the 600 MB limit. Processing aborted.`);
      return summary;
    }

    let runningDecompressedBytes = 0;

    // Check for Modrinth .mrpack manifest
    if (zip.files['modrinth.index.json']) {
      try {
        const mrpackText = await zip.files['modrinth.index.json'].async('string');
        const mrpack = JSON.parse(mrpackText);
        summary.mrpackManifest = mrpack;
      } catch (e) {}
    }

    // Check for CurseForge manifest.json
    if (zip.files['manifest.json']) {
      try {
        const cfText = await zip.files['manifest.json'].async('string');
        const cf = JSON.parse(cfText);
        summary.curseforgeManifest = cf;
      } catch (e) {}
    }

    // 1. Check for CraftIndex craftindex_manifest.json or legacy craftvault_manifest.json (Collection Archive Re-import)
    const cvManifestFile = zip.files['craftindex_manifest.json'] || zip.files['craftvault_manifest.json'];
    if (cvManifestFile) {
      try {
        const cvText = await cvManifestFile.async('string');
        const cv = JSON.parse(cvText);
        summary.craftindexManifest = cv;
        summary.craftvaultManifest = cv; // Dual-support backwards compat
        const resList = cv.resources || cv.items || [];

        for (const res of resList) {
          const entryPath = res.archive_path || res.path;
          const entry = entryPath ? zip.files[entryPath] : null;
          if (entry && !entry.dir) {
            if (!validateZipPath(entryPath)) {
              summary.failedFiles++;
              summary.errors.push(`Blocked unsafe path in manifest archive: ${entryPath}`);
              continue;
            }

            const buf = await entry.async('arraybuffer');
            runningDecompressedBytes += buf.byteLength;
            if (runningDecompressedBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
              summary.errors.push(`Archive exceeded 600 MB aggregate uncompressed limit during decompression.`);
              return summary;
            }
            if (buf.byteLength > MAX_SINGLE_ENTRY_BYTES) {
              summary.failedFiles++;
              summary.errors.push(`Entry '${entryPath}' exceeds single entry size limit of 300 MB.`);
              continue;
            }

            const sha256 = await calculateSha256(buf);
            const cat = res.category || (entryPath.startsWith('plugins/') ? 'plugins' : (entryPath.startsWith('mods/') ? 'mods' : 'resourcepacks'));
            const fileId = 'cv_' + sha256.slice(0, 16);
            const basename = entryPath.split('/').pop();
            const mime = cat === 'mods' || cat === 'plugins' ? 'application/java-archive' : 'application/zip';
            const blob = new Blob([buf], { type: mime });

            await idbPutBinary({
              id: fileId,
              name: basename,
              category: cat,
              loader: res.loader || 'Imported',
              hash: sha256,
              size: blob.size,
              mime: mime,
              blob: blob,
              timestamp: Date.now(),
              metadata: res
            });

            const cartItem = {
              k: 'local:' + fileId,
              id: fileId,
              title: res.name || basename,
              author: res.author || cv.creator || 'Collection Import',
              desc: res.desc || 'Imported from collection ' + (cv.pack_name || ''),
              tab: cat,
              isLocal: true,
              hash: sha256,
              size: blob.size,
              loader: res.loader || 'Imported',
              ver: res.version || '1.0.0',
              filename: basename
            };

            if (window.cart) {
              window.cart.set(cartItem.k, cartItem);
            }

            if (cat === 'mods') summary.identifiedMods++;
            else if (cat === 'plugins') summary.identifiedPlugins++;
            else if (cat === 'resourcepacks') summary.identifiedResourcePacks++;
            else if (cat === 'shaders') summary.identifiedShaders++;
            else if (cat === 'datapacks') summary.identifiedDatapacks++;
            else summary.unverifiedFiles++;

            summary.addedItems.push(cartItem);
          }
        }

        if (window.sv) window.sv();
        if (window.upd) window.upd();
        if (window.draw) window.draw();

        return summary;
      } catch (e) {
        summary.errors.push('Error importing CraftIndex collection manifest: ' + e.message);
      }
    }

    // 2. Check if the uploaded file itself is a direct Mod or Plugin JAR
    // Strong mod and plugin descriptors (Fabric, Quilt, Forge, NeoForge, Spigot) take STRICT PRECEDENCE over pack.mcmeta
    const hasModSignatures =
      Boolean(zip.files['fabric.mod.json']) ||
      Boolean(zip.files['quilt.mod.json']) ||
      Boolean(zip.files['META-INF/neoforge.mods.toml']) ||
      Boolean(zip.files['META-INF/mods.toml']) ||
      Boolean(zip.files['mcmod.info']) ||
      Boolean(zip.files['plugin.yml']) ||
      Boolean(zip.files['paper-plugin.yml']) ||
      Boolean(zip.files['bungee.yml']) ||
      Boolean(zip.files['velocity-plugin.json']);

    const isDirectJar = (file.name && file.name.toLowerCase().endsWith('.jar')) || hasModSignatures;

    if (isDirectJar) {
      try {
        const fileBuffer = await file.arrayBuffer();
        runningDecompressedBytes += fileBuffer.byteLength;
        if (runningDecompressedBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
          summary.errors.push(`Archive exceeded 600 MB uncompressed limit during inspection.`);
          return summary;
        }

        const sha256 = await calculateSha256(fileBuffer);
        const meta = await inspectJarBinary(fileBuffer, file.name);
        const category = meta.type === 'plugin' ? 'plugins' : (meta.type === 'mod' ? 'mods' : 'unverified');
        const fileId = 'jar_' + sha256.slice(0, 16);

        if (window.cart && window.cart.has('local:' + fileId)) {
          summary.duplicatesSkipped++;
        } else {
          const jarBlob = new Blob([fileBuffer], { type: 'application/java-archive' });
          await idbPutBinary({
            id: fileId,
            name: file.name,
            category: category,
            loader: meta.loader,
            hash: sha256,
            size: jarBlob.size,
            mime: 'application/java-archive',
            blob: jarBlob,
            timestamp: Date.now(),
            metadata: meta
          });

          const cartItem = {
            k: 'local:' + fileId,
            id: fileId,
            title: meta.name || file.name,
            author: meta.authors || 'Local Import',
            desc: meta.description || 'Imported ' + meta.loader + ' resource',
            tab: category,
            isLocal: true,
            hash: sha256,
            size: jarBlob.size,
            loader: meta.loader,
            ver: meta.version || '1.0.0',
            filename: file.name
          };

          if (window.cart) {
            window.cart.set(cartItem.k, cartItem);
          }

          if (meta.type === 'mod') summary.identifiedMods++;
          else if (meta.type === 'plugin') summary.identifiedPlugins++;
          else summary.unverifiedFiles++;

          summary.addedItems.push(cartItem);
        }

        if (window.sv) window.sv();
        if (window.upd) window.upd();
        if (window.draw) window.draw();

        return summary;
      } catch (e) {
        summary.errors.push('Failed to inspect direct JAR: ' + e.message);
      }
    }

    // 3. Check if the entire uploaded archive itself is a Resource Pack, Datapack, or Shader
    // (Only reached if no strong mod or plugin signatures were detected)
    if (zip.files['pack.mcmeta']) {
      try {
        const metaText = await zip.files['pack.mcmeta'].async('string');
        const metaJson = JSON.parse(metaText);
        const isDataPack = entries.some((e) => e.startsWith('data/'));
        const isResourcePack = entries.some((e) => e.startsWith('assets/'));
        const category = isDataPack ? 'datapacks' : (isResourcePack ? 'resourcepacks' : 'resourcepacks');

        const fileBuffer = await file.arrayBuffer();
        runningDecompressedBytes += fileBuffer.byteLength;
        if (runningDecompressedBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
          summary.errors.push(`Archive exceeded 600 MB uncompressed limit during inspection.`);
          return summary;
        }

        const sha256 = await calculateSha256(fileBuffer);
        const fileId = 'pack_' + sha256.slice(0, 16);

        // Check duplicate
        if (window.cart && window.cart.has('local:' + fileId)) {
          summary.duplicatesSkipped++;
        } else {
          const item = {
            k: 'local:' + fileId,
            id: fileId,
            title: file.name.replace(/\.zip$/i, ''),
            author: 'Local Pack Import',
            desc: (metaJson.pack && metaJson.pack.description) || 'Imported Minecraft pack archive',
            tab: category,
            isLocal: true,
            hash: sha256,
            size: file.size,
            loader: 'Native Pack',
            ver: 'Format ' + ((metaJson.pack && metaJson.pack.pack_format) || '1'),
            filename: file.name
          };

          await idbPutBinary({
            id: fileId,
            name: file.name,
            category: category,
            loader: 'Native Pack',
            hash: sha256,
            size: file.size,
            mime: 'application/zip',
            blob: file,
            timestamp: Date.now(),
            metadata: metaJson
          });

          if (window.cart) {
            window.cart.set(item.k, item);
          }
          if (isDataPack) summary.identifiedDatapacks++;
          else summary.identifiedResourcePacks++;
          summary.addedItems.push(item);
        }

        if (window.sv) window.sv();
        if (window.upd) window.upd();
        if (window.draw) window.draw();

        return summary;
      } catch (e) {}
    }

    // Process individual files inside the archive
    for (const entryPath of entries) {
      const entry = zip.files[entryPath];
      if (entry.dir) continue;

      if (!validateZipPath(entryPath)) {
        summary.failedFiles++;
        summary.errors.push(`Blocked unsafe path in archive: ${entryPath}`);
        continue;
      }

      const basename = entryPath.split('/').pop();
      const ext = basename.split('.').pop().toLowerCase();

      // We inspect .jar files (mods and plugins)
      if (ext === 'jar') {
        try {
          const jarBuf = await entry.async('arraybuffer');
          runningDecompressedBytes += jarBuf.byteLength;
          if (runningDecompressedBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
            summary.errors.push(`Archive exceeded 600 MB aggregate uncompressed limit during decompression.`);
            break;
          }
          if (jarBuf.byteLength > MAX_SINGLE_ENTRY_BYTES) {
            summary.failedFiles++;
            summary.errors.push(`Entry '${basename}' exceeds single entry size limit of 300 MB.`);
            continue;
          }
          const sha256 = await calculateSha256(jarBuf);
          const meta = await inspectJarBinary(jarBuf, basename);

          const category = meta.type === 'plugin' ? 'plugins' : (meta.type === 'mod' ? 'mods' : 'unverified');
          const fileId = 'jar_' + sha256.slice(0, 16);

          if (window.cart && window.cart.has('local:' + fileId)) {
            summary.duplicatesSkipped++;
            continue;
          }

          const jarBlob = new Blob([jarBuf], { type: 'application/java-archive' });
          await idbPutBinary({
            id: fileId,
            name: basename,
            category: category,
            loader: meta.loader,
            hash: sha256,
            size: jarBlob.size,
            mime: 'application/java-archive',
            blob: jarBlob,
            timestamp: Date.now(),
            metadata: meta
          });

          const cartItem = {
            k: 'local:' + fileId,
            id: fileId,
            title: meta.name || basename,
            author: meta.authors || 'Local Import',
            desc: meta.description || 'Imported ' + meta.loader + ' resource',
            tab: category,
            isLocal: true,
            hash: sha256,
            size: jarBlob.size,
            loader: meta.loader,
            ver: meta.version || '1.0.0',
            filename: basename
          };

          if (window.cart) {
            window.cart.set(cartItem.k, cartItem);
          }

          if (meta.type === 'mod') summary.identifiedMods++;
          else if (meta.type === 'plugin') summary.identifiedPlugins++;
          else summary.unverifiedFiles++;

          summary.addedItems.push(cartItem);
        } catch (err) {
          summary.failedFiles++;
          summary.errors.push(`Failed to inspect ${basename}: ${err.message}`);
        }
      }

      // We inspect nested zip files (e.g. resourcepacks or shaderpacks inside the zip)
      else if (ext === 'zip' && (entryPath.includes('resourcepacks/') || entryPath.includes('shaderpacks/') || entryPath.includes('datapacks/'))) {
        try {
          const zipBuf = await entry.async('arraybuffer');
          runningDecompressedBytes += zipBuf.byteLength;
          if (runningDecompressedBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
            summary.errors.push(`Archive exceeded 600 MB aggregate uncompressed limit during decompression.`);
            break;
          }
          if (zipBuf.byteLength > MAX_SINGLE_ENTRY_BYTES) {
            summary.failedFiles++;
            summary.errors.push(`Entry '${basename}' exceeds single entry size limit of 300 MB.`);
            continue;
          }
          const sha256 = await calculateSha256(zipBuf);
          let cat = 'resourcepacks';
          if (entryPath.includes('shaderpacks/')) cat = 'shaders';
          if (entryPath.includes('datapacks/')) cat = 'datapacks';

          const fileId = 'pack_' + sha256.slice(0, 16);
          if (window.cart && window.cart.has('local:' + fileId)) {
            summary.duplicatesSkipped++;
            continue;
          }

          const nestedBlob = new Blob([zipBuf], { type: 'application/zip' });
          await idbPutBinary({
            id: fileId,
            name: basename,
            category: cat,
            loader: 'Native Pack',
            hash: sha256,
            size: nestedBlob.size,
            mime: 'application/zip',
            blob: nestedBlob,
            timestamp: Date.now()
          });

          const cartItem = {
            k: 'local:' + fileId,
            id: fileId,
            title: basename.replace(/\.zip$/i, ''),
            author: 'Local Pack Import',
            desc: 'Imported ' + cat + ' package',
            tab: cat,
            isLocal: true,
            hash: sha256,
            size: nestedBlob.size,
            loader: 'Pack',
            ver: '1.0.0',
            filename: basename
          };

          if (window.cart) {
            window.cart.set(cartItem.k, cartItem);
          }

          if (cat === 'shaders') summary.identifiedShaders++;
          else if (cat === 'datapacks') summary.identifiedDatapacks++;
          else summary.identifiedResourcePacks++;

          summary.addedItems.push(cartItem);
        } catch (err) {
          summary.failedFiles++;
        }
      }
    }

    if (window.sv) window.sv();
    if (window.upd) window.upd();
    if (window.draw) window.draw();

    return summary;
  }

  // =========================================================================
  // 5. GENUINE ZIP EXPORT ENGINE WITH MANIFEST GENERATION
  // =========================================================================

  async function exportCollectionZip(customOptions) {
    if (!window.JSZip) {
      throw new Error('JSZip is not available.');
    }

    const options = customOptions || {};
    const packName = options.packName || localStorage.getItem('cv_pack_name') || 'CraftIndex-Collection';
    const packDesc = options.packDesc || localStorage.getItem('cv_pack_desc') || 'CraftIndex Modpack & Multi-Resource Collection';
    const mcVersion = options.mcVersion || (window.cfg && window.cfg.mc) || '1.20.1';
    const modLoader = options.modLoader || (window.cfg && window.cfg.ml) || 'fabric';

    const zip = new window.JSZip();

    // Standardized directory categories
    const folderMods = zip.folder('mods');
    const folderPlugins = zip.folder('plugins');
    const folderResourcePacks = zip.folder('resourcepacks');
    const folderShaders = zip.folder('shaderpacks');
    const folderDatapacks = zip.folder('datapacks');
    const folderUnverified = zip.folder('unverified');

    const manifestResources = [];
    const items = window.cart ? Array.from(window.cart.values()) : [];

    let exportedCount = 0;
    let missingCount = 0;

    for (const item of items) {
      const cat = item.tab || 'mods';
      let targetFolder = folderMods;
      let pathPrefix = 'mods/';

      if (cat === 'plugins') {
        targetFolder = folderPlugins;
        pathPrefix = 'plugins/';
      } else if (cat === 'resourcepacks') {
        targetFolder = folderResourcePacks;
        pathPrefix = 'resourcepacks/';
      } else if (cat === 'shaders') {
        targetFolder = folderShaders;
        pathPrefix = 'shaderpacks/';
      } else if (cat === 'datapacks') {
        targetFolder = folderDatapacks;
        pathPrefix = 'datapacks/';
      } else if (cat === 'unverified') {
        targetFolder = folderUnverified;
        pathPrefix = 'unverified/';
      }

      const fileName = item.filename || (item.title ? item.title.replace(/[^a-zA-Z0-9._-]/g, '_') : 'resource') + (cat === 'mods' || cat === 'plugins' ? '.jar' : '.zip');
      const relativePath = pathPrefix + fileName;

      // 1. If item was imported locally, retrieve binary Blob from IndexedDB
      if (item.isLocal) {
        const record = await idbGetBinary(item.id);
        if (record && record.blob) {
          const buffer = await record.blob.arrayBuffer();
          const sha256 = await calculateSha256(buffer);
          targetFolder.file(fileName, buffer);
          exportedCount++;

          manifestResources.push({
            name: item.title,
            category: cat,
            source: 'local_import',
            provider_id: item.id,
            version: item.ver || '1.0.0',
            loader: item.loader || modLoader,
            archive_path: relativePath,
            file_size: buffer.byteLength,
            sha256: sha256
          });
          continue;
        }
      }

      // 2. If item is remote from Modrinth or CurseForge and has an active download URL
      if (item.url && (item.url.startsWith('http://') || item.url.startsWith('https://'))) {
        try {
          const resp = await fetch(item.url);
          if (resp.ok) {
            const buf = await resp.arrayBuffer();
            const sha256 = await calculateSha256(buf);
            targetFolder.file(fileName, buf);
            exportedCount++;

            manifestResources.push({
              name: item.title,
              category: cat,
              source: item.source || 'remote',
              provider_id: item.id || '',
              version: item.ver || '1.0.0',
              loader: item.loader || modLoader,
              archive_path: relativePath,
              file_size: buf.byteLength,
              sha256: sha256
            });
            continue;
          }
        } catch (e) {
          console.warn('[CraftIndex] Could not fetch remote file for export:', item.title, e);
        }
      }

      // If remote binary could not be fetched in browser environment, note in manifest
      missingCount++;
      manifestResources.push({
        name: item.title,
        category: cat,
        source: item.source || 'remote',
        provider_id: item.id || '',
        version: item.ver || '1.0.0',
        loader: item.loader || modLoader,
        archive_path: relativePath,
        unresolved: true,
        note: 'External dependency'
      });
    }

    // Embed craftindex_manifest.json
    const manifest = {
      schema_version: '1.1.0',
      legacy_note: 'Formerly craftvault_manifest.json; CraftIndex maintains full dual-support for both manifest formats.',
      pack_name: packName,
      pack_description: packDesc,
      created_at: new Date().toISOString(),
      creator: 'CraftIndex / Arata Inlooker',
      minecraft_version: mcVersion,
      mod_loader: modLoader,
      resource_count: manifestResources.length,
      resources: manifestResources
    };

    zip.file('craftindex_manifest.json', JSON.stringify(manifest, null, 2));

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const exportFileName = (packName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'CraftIndex-Collection') + '.zip';

    // Trigger download
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipBlob);
    link.download = exportFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(link.href), 10000);

    return {
      success: true,
      fileName: exportFileName,
      size: zipBlob.size,
      exportedCount,
      missingCount,
      blob: zipBlob,
      manifest
    };
  }

  // =========================================================================
  // 6. PACK STUDIO PRIMARY APPLICATION VIEW
  // =========================================================================

  function renderStudioView(targetContainer) {
    const container = targetContainer || document.getElementById('g');
    if (!container) return;
    container.classList.add('studio-mode');

    const items = window.cart ? Array.from(window.cart.values()) : [];
    const packName = localStorage.getItem('cv_pack_name') || 'My Custom Modpack';
    const packDesc = localStorage.getItem('cv_pack_desc') || 'Crafted with CraftIndex Multi-Resource Studio.';
    const mcVer = (window.cfg && window.cfg.mc) || '1.20.1';
    const modLoader = (window.cfg && window.cfg.ml) || 'fabric';

    const counts = {
      mods: items.filter((i) => i.tab === 'mods').length,
      plugins: items.filter((i) => i.tab === 'plugins').length,
      resourcepacks: items.filter((i) => i.tab === 'resourcepacks').length,
      shaders: items.filter((i) => i.tab === 'shaders').length,
      datapacks: items.filter((i) => i.tab === 'datapacks').length,
      local: items.filter((i) => i.isLocal).length
    };

    container.innerHTML = `
      <div class="studio-container">
        <!-- Hero Header -->
        <div class="studio-header">
          <div class="studio-badge">🛠️ DEDICATED PACK STUDIO</div>
          <h1 class="studio-title">Craft Your Own Modpack or Multi-Resource Pack</h1>
          <p class="studio-subtitle">
            Discover, import, organize, and export standard-compliant Minecraft collections with persistent local binary storage and manifest generation.
          </p>
        </div>

        <!-- 3 Cards in One Line (Workspace Suite) -->
        <div class="studio-cards-row">
          <!-- Card 1: ⚙️ Pack Configuration -->
          <div class="studio-card studio-config-card">
            <div class="studio-card-head">
              <h2 class="studio-section-title">⚙️ Pack Configuration</h2>
              <span class="studio-card-sub">Export metadata & loader settings</span>
            </div>
            <div class="studio-form-grid">
              <div class="studio-form-group">
                <label class="studio-label" for="studioPackName">Pack Name</label>
                <input type="text" class="in studio-input-full" id="studioPackName" value="${E(packName)}" placeholder="e.g. Cosmic Adventure Pack" />
              </div>

              <div class="studio-form-row">
                <div class="studio-form-group">
                  <label class="studio-label" for="studioMcVer">Minecraft Version</label>
                  <select class="in studio-select-full" id="studioMcVer">
                    <option value="1.21.4" ${mcVer === '1.21.4' ? 'selected' : ''}>1.21.4</option>
                    <option value="1.21.1" ${mcVer === '1.21.1' ? 'selected' : ''}>1.21.1</option>
                    <option value="1.20.6" ${mcVer === '1.20.6' ? 'selected' : ''}>1.20.6</option>
                    <option value="1.20.4" ${mcVer === '1.20.4' ? 'selected' : ''}>1.20.4</option>
                    <option value="1.20.1" ${mcVer === '1.20.1' ? 'selected' : ''}>1.20.1</option>
                    <option value="1.19.4" ${mcVer === '1.19.4' ? 'selected' : ''}>1.19.4</option>
                    <option value="1.18.2" ${mcVer === '1.18.2' ? 'selected' : ''}>1.18.2</option>
                    <option value="1.16.5" ${mcVer === '1.16.5' ? 'selected' : ''}>1.16.5</option>
                    <option value="1.12.2" ${mcVer === '1.12.2' ? 'selected' : ''}>1.12.2</option>
                  </select>
                </div>

                <div class="studio-form-group">
                  <label class="studio-label" for="studioLoader">Mod Loader</label>
                  <select class="in studio-select-full" id="studioLoader">
                    <option value="fabric" ${modLoader === 'fabric' ? 'selected' : ''}>Fabric</option>
                    <option value="forge" ${modLoader === 'forge' ? 'selected' : ''}>Forge</option>
                    <option value="neoforge" ${modLoader === 'neoforge' ? 'selected' : ''}>NeoForge</option>
                    <option value="quilt" ${modLoader === 'quilt' ? 'selected' : ''}>Quilt</option>
                  </select>
                </div>
              </div>

              <div class="studio-form-group">
                <label class="studio-label" for="studioPackDesc">Pack Description</label>
                <textarea class="in studio-textarea-full" id="studioPackDesc" rows="3" placeholder="Describe the purpose, mods, and shaders in this collection...">${E(packDesc)}</textarea>
              </div>
            </div>
          </div>

          <!-- Card 2: 📊 Collection Overview -->
          <div class="studio-card studio-stats-card">
            <div class="studio-card-head">
              <h2 class="studio-section-title">📊 Collection Overview</h2>
              <span class="studio-card-sub">Staged resources & storage breakdown</span>
            </div>
            <div class="studio-stats-display">
              <div class="studio-stat-hero">
                <span class="studio-stat-hero-num">${items.length}</span>
                <span class="studio-stat-hero-lbl">Total Staged Resources</span>
              </div>
              <div class="studio-stats-grid">
                <div class="studio-stat-pill">
                  <span class="studio-stat-pill-icon">🧩</span>
                  <div class="studio-stat-pill-info">
                    <span class="studio-stat-pill-num">${counts.mods}</span>
                    <span class="studio-stat-pill-name">Mods</span>
                  </div>
                </div>
                <div class="studio-stat-pill">
                  <span class="studio-stat-pill-icon">🔌</span>
                  <div class="studio-stat-pill-info">
                    <span class="studio-stat-pill-num">${counts.plugins}</span>
                    <span class="studio-stat-pill-name">Plugins</span>
                  </div>
                </div>
                <div class="studio-stat-pill">
                  <span class="studio-stat-pill-icon">🎨</span>
                  <div class="studio-stat-pill-info">
                    <span class="studio-stat-pill-num">${counts.resourcepacks}</span>
                    <span class="studio-stat-pill-name">Packs</span>
                  </div>
                </div>
                <div class="studio-stat-pill">
                  <span class="studio-stat-pill-icon">✨</span>
                  <div class="studio-stat-pill-info">
                    <span class="studio-stat-pill-num">${counts.shaders}</span>
                    <span class="studio-stat-pill-name">Shaders</span>
                  </div>
                </div>
              </div>
              <div class="studio-storage-guarantee">
                <span class="studio-storage-icon">💾</span>
                <div class="studio-storage-text">
                  <span class="studio-storage-title"><b>${counts.local}</b> Persisted Binaries</span>
                  <span class="studio-storage-sub">Permanent IndexedDB storage (CraftIndexDB v1)</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Card 3: 🚀 Actions & Packaging -->
          <div class="studio-card studio-actions-card">
            <div class="studio-card-head">
              <h2 class="studio-section-title">🚀 Actions & Packaging</h2>
              <span class="studio-card-sub">Client-side archive compilation</span>
            </div>
            <div class="studio-actions-list">
              <button type="button" class="btn p studio-action-tool-btn" id="studioImportBtn">
                <span class="studio-action-icon">📁</span>
                <div class="studio-action-text">
                  <span class="studio-action-name">Import ZIP Archive</span>
                  <span class="studio-action-desc">Inspect .zip, .mrpack, or .jar</span>
                </div>
              </button>
              <button type="button" class="btn studio-action-tool-btn" id="studioExportBtn">
                <span class="studio-action-icon">📦</span>
                <div class="studio-action-text">
                  <span class="studio-action-name">Export Collection ZIP</span>
                  <span class="studio-action-desc">Build standard pack + manifest</span>
                </div>
              </button>
              <button type="button" class="btn studio-action-tool-btn" id="studioBrowseBtn">
                <span class="studio-action-icon">🔍</span>
                <div class="studio-action-text">
                  <span class="studio-action-name">Discover Resources</span>
                  <span class="studio-action-desc">Explore mods, plugins & shaders</span>
                </div>
              </button>
              <button type="button" class="btn studio-action-tool-btn danger" id="studioClearBtn">
                <span class="studio-action-icon">🗑️</span>
                <div class="studio-action-text">
                  <span class="studio-action-name">Clear Collection</span>
                  <span class="studio-action-desc">Empty staged cart & binaries</span>
                </div>
              </button>
              <input type="file" id="studioFileInput" aria-label="Choose ZIP or JAR archive to import into Pack Studio" accept=".zip,.mrpack,.jar" style="display:none;" />
            </div>
          </div>
        </div>

        <!-- Full-Width Card: Selected Resources -->
        <div class="studio-card studio-collection-card">
          <div class="studio-collection-head">
            <h2 class="studio-section-title">📦 Selected Resources (${items.length})</h2>
            <span class="studio-indexeddb-badge">⚡ Persistent IndexedDB Storage (CraftIndexDB v1)</span>
          </div>

          ${
            items.length === 0
              ? `
              <div class="studio-empty-state">
                <div class="studio-empty-icon">📦</div>
                <h3 class="studio-empty-title">No Resources Added Yet</h3>
                <p class="studio-empty-desc">
                  Discover and add mods, plugins, shaders, or resource packs from the catalog, or click <b>Import ZIP</b> to bring your own local files.
                </p>
                <div style="display:flex; gap:10px; margin-top:14px; justify-content:center; flex-wrap:wrap;">
                  <button type="button" class="btn p" onclick="if(window.switchToTab) window.switchToTab('mods');">🔍 Discover Mods</button>
                  <button type="button" class="btn" onclick="document.getElementById('studioFileInput').click();">📁 Import ZIP</button>
                </div>
              </div>
            `
              : `
              <div class="studio-items-list">
                ${items
                  .map((it) => {
                    const isLocal = it.isLocal;
                    const sizeFormatted = it.size ? (it.size > 1048576 ? (it.size / 1048576).toFixed(1) + ' MB' : (it.size / 1024).toFixed(0) + ' KB') : '';
                    const hashPreview = it.hash ? it.hash.slice(0, 8) + '...' : '';

                    const catIcons = {
                      mods: '🧩',
                      plugins: '🔌',
                      resourcepacks: '🎨',
                      shaders: '✨',
                      datapacks: '🗺️',
                      worlds: '🌍',
                      servers: '🎮'
                    };
                    const catIcon = catIcons[it.tab] || '📦';

                    const title = it.title || it.name || it.id || 'Untitled Resource';
                    const author = it.author || it.authors || '';
                    const desc = it.desc || it.description || '';
                    const ver = it.ver || it.version || '';
                    const tabKey = it.tab || 'mods';

                    // Collect and deduplicate tags
                    const rawTags = [];
                    if (Array.isArray(it.tags)) rawTags.push(...it.tags);
                    if (Array.isArray(it.categories)) rawTags.push(...it.categories);
                    const tags = [...new Set(rawTags.map((t) => String(t).trim()).filter(Boolean))].slice(0, 5);

                    return `
                    <div class="studio-item-row" data-k="${E(it.k)}">
                      <!-- 1. Resource Logo / Icon -->
                      <div class="studio-item-icon">
                        ${
                          it.icon
                            ? `<img src="${E(it.icon)}" alt="${E(title)}" loading="lazy" onerror="this.outerHTML='<span class=\\'studio-item-fallback-icon\\'>${catIcon}</span>'" />`
                            : `<span class="studio-item-fallback-icon">${catIcon}</span>`
                        }
                      </div>

                      <!-- 2. Resource Details -->
                      <div class="studio-item-details">
                        <div class="studio-item-name-row">
                          <span class="studio-item-type-badge ${E(tabKey)}">${E(tabKey.toUpperCase())}</span>
                          <span class="studio-item-name" title="${E(title)}">${E(title)}</span>
                          ${author ? `<span class="studio-item-author">by <b>${E(author)}</b></span>` : ''}
                          ${ver ? `<span class="studio-item-version">v${E(ver)}</span>` : ''}
                          ${it.loader ? `<span class="studio-item-tag" style="background:rgba(168,85,247,0.18);border-color:rgba(168,85,247,0.35);color:#d8b4fe;">${E(it.loader)}</span>` : ''}
                        </div>

                        ${desc ? `<div class="studio-item-desc" title="${E(desc)}">${E(desc)}</div>` : ''}

                        <div class="studio-item-meta">
                          ${
                            isLocal
                              ? `<span class="studio-binary-badge studio-binary-cached" title="Stored permanently in browser IndexedDB">💾 Local Binary</span>`
                              : `<span class="studio-binary-badge studio-binary-remote">🌐 Remote</span>`
                          }
                          ${sizeFormatted ? `<span>💾 ${sizeFormatted}</span>` : ''}
                          ${hashPreview ? `<span class="studio-item-hash" title="SHA-256: ${E(it.hash)}">SHA: ${hashPreview}</span>` : ''}
                          ${
                            tags.length > 0
                              ? `
                            <div class="studio-item-tags">
                              ${tags.map((tag) => `<span class="studio-item-tag">${E(tag)}</span>`).join('')}
                            </div>
                          `
                              : ''
                          }
                        </div>
                      </div>

                      <!-- 3. Actions -->
                      <div class="studio-item-actions">
                        <button type="button" class="btn studio-remove-btn" onclick="window.CraftIndexStudio.removeResource('${E(it.k)}')">✕ Remove</button>
                      </div>
                    </div>
                  `;
                  })
                  .join('')}
              </div>
            `
          }
        </div>
      </div>
    `;

    // Hook studio inputs
    const nameInput = document.getElementById('studioPackName');
    if (nameInput) {
      nameInput.oninput = () => localStorage.setItem('cv_pack_name', nameInput.value.trim());
    }

    const descInput = document.getElementById('studioPackDesc');
    if (descInput) {
      descInput.oninput = () => localStorage.setItem('cv_pack_desc', descInput.value.trim());
    }

    const mcSelect = document.getElementById('studioMcVer');
    if (mcSelect) {
      mcSelect.onchange = () => {
        if (window.cfg) window.cfg.mc = mcSelect.value;
      };
    }

    const loaderSelect = document.getElementById('studioLoader');
    if (loaderSelect) {
      loaderSelect.onchange = () => {
        if (window.cfg) window.cfg.ml = loaderSelect.value;
      };
    }

    // Hook buttons
    const importBtn = document.getElementById('studioImportBtn');
    const fileInput = document.getElementById('studioFileInput');
    if (importBtn && fileInput) {
      importBtn.onclick = () => fileInput.click();
      fileInput.onchange = async () => {
        if (!fileInput.files || !fileInput.files[0]) return;
        const file = fileInput.files[0];
        fileInput.value = '';

        if (window.toast) window.toast('🔍 Inspecting archive: ' + file.name + '...');
        try {
          const res = await importZipArchive(file);
          showImportSummaryModal(res);
          renderStudioView();
        } catch (err) {
          alert('ZIP Import error: ' + err.message);
        }
      };
    }

    const exportBtn = document.getElementById('studioExportBtn');
    if (exportBtn) {
      exportBtn.onclick = async () => {
        if (!window.cart || window.cart.size === 0) {
          alert('No resources in collection yet! Add mods, plugins, or import a ZIP archive first.');
          return;
        }
        if (window.toast) window.toast('📦 Generating collection archive...');
        try {
          const res = await exportCollectionZip({
            packName: nameInput ? nameInput.value.trim() : 'CraftIndex-Collection',
            packDesc: descInput ? descInput.value.trim() : '',
            mcVersion: mcSelect ? mcSelect.value : '1.20.1',
            modLoader: loaderSelect ? loaderSelect.value : 'fabric'
          });
          if (window.toast) window.toast('✅ Archive exported: ' + res.fileName);
        } catch (e) {
          alert('ZIP Export error: ' + e.message);
        }
      };
    }

    const browseBtn = document.getElementById('studioBrowseBtn');
    if (browseBtn) {
      browseBtn.onclick = () => {
        if (window.switchToTab) window.switchToTab('mods');
      };
    }

    const clearBtn = document.getElementById('studioClearBtn');
    if (clearBtn) {
      clearBtn.onclick = async () => {
        if (!window.cart || window.cart.size === 0) return;
        if (confirm('Clear all ' + window.cart.size + ' resources from collection?')) {
          window.cart.clear();
          await idbClearBinaries();
          if (window.sv) window.sv();
          if (window.upd) window.upd();
          renderStudioView();
        }
      };
    }
  }

  function showImportSummaryModal(res) {
    if (!window.md || !window.mf || !window.$) return;
    window.md(1);
    window.$('mh').textContent = '📁 ZIP Import Summary';
    window.$('mb').innerHTML = `
      <div style="display:flex; flex-direction:column; gap:14px; padding:6px 0;">
        <div style="background:rgba(124,77,255,0.14); border:1px solid rgba(179,136,255,0.35); border-radius:12px; padding:14px; color:#e9d5ff; font-size:13.5px;">
          ✨ Archive inspection completed successfully! Identified binaries have been securely stored in persistent IndexedDB.
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px;">
          <div style="background:rgba(22,17,38,0.7); padding:10px 14px; border-radius:10px; border:1px solid rgba(179,136,255,0.2);">
            📁 Total Archive Entries: <b>${res.totalFiles}</b>
          </div>
          <div style="background:rgba(22,17,38,0.7); padding:10px 14px; border-radius:10px; border:1px solid rgba(179,136,255,0.2);">
            ✅ Total Added to Collection: <b>${res.addedItems.length}</b>
          </div>
          <div style="background:rgba(22,17,38,0.7); padding:10px 14px; border-radius:10px; border:1px solid rgba(179,136,255,0.2);">
            🧩 Identified Mods: <b>${res.identifiedMods}</b>
          </div>
          <div style="background:rgba(22,17,38,0.7); padding:10px 14px; border-radius:10px; border:1px solid rgba(179,136,255,0.2);">
            🔌 Identified Plugins: <b>${res.identifiedPlugins}</b>
          </div>
          <div style="background:rgba(22,17,38,0.7); padding:10px 14px; border-radius:10px; border:1px solid rgba(179,136,255,0.2);">
            🎨 Resource Packs: <b>${res.identifiedResourcePacks}</b>
          </div>
          <div style="background:rgba(22,17,38,0.7); padding:10px 14px; border-radius:10px; border:1px solid rgba(179,136,255,0.2);">
            ✨ Shaders / Datapacks: <b>${res.identifiedShaders + res.identifiedDatapacks}</b>
          </div>
          <div style="background:rgba(22,17,38,0.7); padding:10px 14px; border-radius:10px; border:1px solid rgba(179,136,255,0.2);">
            ⚠️ Unverified JARs: <b>${res.unverifiedFiles}</b>
          </div>
          <div style="background:rgba(22,17,38,0.7); padding:10px 14px; border-radius:10px; border:1px solid rgba(179,136,255,0.2);">
            🔁 Duplicates Skipped: <b>${res.duplicatesSkipped}</b>
          </div>
        </div>

        ${
          res.errors.length > 0
            ? `
          <div style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.35); border-radius:10px; padding:10px 14px; color:#fca5a5; font-size:12.5px;">
            <b>Warnings / Excluded Entries:</b>
            <ul style="margin:4px 0 0 16px; padding:0;">
              ${res.errors.map((e) => `<li>${E(e)}</li>`).join('')}
            </ul>
          </div>
        `
            : ''
        }
      </div>
    `;
    window.mf('<button class="btn p" id="importSummaryCloseBtn">Done</button>');
    const closeBtn = document.getElementById('importSummaryCloseBtn');
    if (closeBtn) closeBtn.onclick = () => window.md(0);
  }

  function removeResource(itemKey) {
    if (!window.cart) return;
    const it = window.cart.get(itemKey);
    if (it && it.isLocal) {
      idbDeleteBinary(it.id);
    }
    window.cart.delete(itemKey);
    if (window.sv) window.sv();
    if (window.upd) window.upd();
    if (window.draw) window.draw();
    renderStudioView();
  }

  // Helper escape
  function E(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Export public namespace
  window.CraftIndexStudio = {
    getDB,
    idbPutBinary,
    idbGetBinary,
    idbDeleteBinary,
    idbGetAllBinaries,
    idbClearBinaries,
    calculateSha256,
    inspectJarBinary,
    importZipArchive,
    exportCollectionZip,
    renderStudioView,
    removeResource
  };

  // Backward compatibility alias for existing callers
  window.CraftVaultStudio = window.CraftIndexStudio;

})(typeof window !== 'undefined' ? window : this);
