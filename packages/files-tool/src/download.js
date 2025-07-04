import streamSaver from 'streamsaver';
import { WritableStream } from 'web-streams-polyfill';
import axios from 'axios';
if (!window?.WritableStream) {
  streamSaver.WritableStream = WritableStream;
}
if (window.location.protocol === 'https:') {
  streamSaver.mitm = '/mitm.html?version=2.0.0'
}

// 添加响应拦截器
axios.interceptors.response.use(
  response => {
    return response;
  },
  err => {
    console.error('axios error', err);
    const errRes = {
      status: err.status ?? err.response?.status ?? err?.request?.status,
      code: err?.code ?? err?.response?.code ?? -1,
      message: err?.message ?? err?.response?.message ?? err?.request?.statusText,
    }

    if (err && err.response) {
      switch (err.response.status) {
        case 400:
          errRes.message = '请求错误'
          break
  
        case 401:
          errRes.message = '未授权，请登录'
          break
  
        case 403:
          errRes.message = '拒绝访问'
          break
  
        case 404:
          errRes.message = `请求地址出错: ${err.response.config.url}`
          break
  
        case 408: 
          errRes.message = '请求超时'
          break
  
        case 500:
          errRes.message = '服务器内部错误'
          break
  
        case 501:
          errRes.message = '服务未实现'
          break
  
        case 502:
          errRes.message = '网关错误'
          break
  
        case 503:
          errRes.message = '服务不可用'
          break
  
        case 504:
          errRes.message = '网关超时'
          break
  
        case 505:
          errRes.message = 'HTTP版本不受支持'
          break
  
        default:
      }
    } else {
      if (err?.stack?.indexOf('Network Error') > -1) {
        errRes.message = '网络异常'
      } else {
        errRes.message = '请求错误'
      }
    }
  
    if (err?.__CANCEL__ || err?.code === 'ERR_CANCELED') {
      errRes.code = -99
      errRes.message = '请求中断'
    }


    return Promise.reject(errRes);
  }
);

class FileDownloader {
  apiConfig = {}
  downloaded = 0
  chunks = []
  isPaused = false
  isStop = false
  isCompleted = false
  cancelTokenSource = null
  initPromise = null
  fileName = null
  writer = null
  stream = null
  db = null
  events = {}
  totalSize = 0
  chunkSize = 0
  maxRetries = 0
  mitmUrl = null

  constructor(options = {}) {
    this.url = options?.url;
    this.fileName = options?.fileName ?? 'downloaded_file';
    this.totalSize = Number(options?.totalSize ?? this.totalSize);

    this.chunkSize = Number(options?.chunkSize ?? this.chunkSize);
    this.maxRetries = Number(options?.maxRetries ?? this.maxRetries);

    if(this.totalSize <= 0 && this.chunkSize !== 0) {
      throw new Error('totalSize必须为正整数');
    }
    
    this.dbName = `fileToolsDownloadDB_${hashCode(this.url ?? String(Date.now()))}`;
    this.storeName = options?.storeName ?? 'chunks';
    this.initPromise = this.initDB();
    this.events = options?.events ?? {};
    this.apiConfig = options?.apiConfig ?? {};

    this.mitmUrl = options?.mitmUrl ?? null;
    if(this.mitmUrl) {
      streamSaver.mitm = this.mitmUrl;
    }

  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'index' });
        }
      };
      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  async start() {
    try {
      this.isCompleted = false;
      await this.initPromise;
      this.isPaused = false;
      this.isStop = false;
      await this.loadChunksFromIndexedDB();
      await this.downloadChunks();
    } catch (err) {
      this.isPaused = true;
      this.isCompleted = false;
      this.events?.error && this.events.error(err);
    }
  }

  pause() {
    this.isPaused = true;
    if (this.cancelTokenSource) this.cancelTokenSource.cancel('下载已暂停');
  }

  resume() {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.isCompleted = false;
    // resume 时只触发一次 uploading 事件用于刷新 UI
    this.events?.uploading && this.events.uploading(this.getProgress());
    try {
      this.downloadChunks();
    } catch (error) {
      this.isPaused = true
      this.events?.error && this.events.error(error);
    }
  }

  stop() {
    this.isStop = true;
    this.isCompleted = false;
    if (this.cancelTokenSource) this.cancelTokenSource.cancel('下载已取消');
    // 主动关闭下载流
    if (this.writer) {
      try {
        if (typeof this.writer.abort === 'function') {
          this.writer?.abort();
        } else if (typeof this.writer.close === 'function') {
          this.writer?.close();
        }
      } catch (e) {
        // 忽略关闭流时的异常
      }
      this.writer = null;
      this.stream = null;
    }
    this.clearChunksFromIndexedDB();
  }

  getProgress() {
    return {
      status: 'uploading',
      downloaded: this.downloaded,
      total: this.totalSize,
      percent: Math.round(this.totalSize ? (this.downloaded / this.totalSize) * 100 : 0),
    };
  }

  async downloadChunks() {
    if (!this.writer) {
      this.stream = streamSaver.createWriteStream(this.fileName, { size: this.totalSize });
      this.writer = this.stream?.getWriter();
    }
    
    // 当chunkSize为0时，不进行切片下载，直接整个文件下载
    if (this.chunkSize === 0) {
      try {
        this.cancelTokenSource = axios.CancelToken.source();
        
        // 添加重试逻辑
        let retryCount = 0;
        let success = false;
        let lastError = null;
        
        while (retryCount <= this.maxRetries && !success) {
          try {
            const response = await axios(deepMergeObject({
              url: this.url,
              method: 'GET',
              responseType: 'blob',
              cancelToken: this.cancelTokenSource.token,
              ...this.apiConfig,
              onDownloadProgress: (progressEvent) => {
                // 确保在暂停或取消状态下不更新进度
                if (this.isPaused || this.isStop) return;
                
                const receivedLength = progressEvent.loaded;
                this.downloaded = receivedLength;
                this.events?.uploading && this.events.uploading(this.getProgress());
              }
            }, this.apiConfig));
            
            // 将blob转换为arrayBuffer后写入流
            const blob = response.data;
            const arrayBuffer = await blob.arrayBuffer();
            await this.writer.write(new Uint8Array(arrayBuffer));
            
            success = true;
          } catch (err) {
            lastError = err;
            
            if (axios.isCancel(err)) {
              // 用户主动中断，不算错误，直接退出循环
              throw err;
            }
            
            retryCount++;
            if (retryCount <= this.maxRetries) {
              this.events?.uploading && this.events.uploading({
                status: 'retry',
                message: `文件下载失败，正在进行第 ${retryCount} 次重试`,
              });
              // 等待一段时间后重试，使用指数退避策略
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
          }
        }
        
        if (!success) {
          throw lastError || new Error(`文件下载失败，已重试 ${this.maxRetries} 次`);
        }
      } catch (err) {
        if (axios.isCancel(err)) {
          // 用户主动中断，不算错误
          return;
        }
        throw err;
      }
      
      if (!this.isPaused && !this.isStop) {
        await this.mergeChunks();
        this.events?.success && this.events.success();
      }
      return;
    }
    
    // 以下是切片下载逻辑
    const chunkCount = Math.ceil(this.totalSize / this.chunkSize);

    for (let i = 0; i < chunkCount; i++) {
      if (this.isPaused || this.isStop) break;
      try {
        if (this.chunks[i]) {
          // 已下载分片，直接写入
          const arrayBuffer = await this.chunks[i].arrayBuffer();
          await this.writer?.write(new Uint8Array(arrayBuffer));
          // resume 时不再重复触发 uploading 事件
          continue;
        }
        const start = i * this.chunkSize;
        const end = Math.min(this.totalSize - 1, (i + 1) * this.chunkSize - 1);
        this.cancelTokenSource = axios.CancelToken.source();
        
        // 添加重试逻辑
        let retryCount = 0;
        let success = false;
        let lastError = null;
        
        while (retryCount <= this.maxRetries && !success) {
          try {
            const response = await axios(deepMergeObject({
              url: this.url,
              method: 'GET',
              responseType: 'blob',
              cancelToken: this.cancelTokenSource.token,
              headers: { 
                range: `bytes=${start}-${end}` 
              },
              onDownloadProgress: (progressEvent) => {
                // 确保在暂停或取消状态下不更新进度
                if (this.isPaused || this.isStop) return;
                
                // 计算当前分片的下载进度
                const chunkLoaded = progressEvent.loaded;
                // 更新总进度 = 已下载的数据量 + 当前分片已下载的数据量
                const totalLoaded = this.downloaded - (this.chunks[i]?.size || 0) + chunkLoaded;
                const progress = {
                  status: 'uploading',
                  downloaded: totalLoaded,
                  total: this.totalSize,
                  percent: Math.round(this.totalSize ? (totalLoaded / this.totalSize) * 100 : 0)
                };
                this.events?.uploading && this.events.uploading(progress);
              }
            }, this.apiConfig));
            
            const blob = response.data;
            await this.saveChunkToIndexedDB(i, blob);
            this.chunks[i] = blob;
            this.downloaded += blob.size;
            
            // 写入streamSaver
            const arrayBuffer = await blob.arrayBuffer();
            await this.writer?.write(new Uint8Array(arrayBuffer));
            this.events?.uploading && this.events.uploading(this.getProgress());
            
            success = true;
          } catch (err) {
            success = false;
            
            lastError = err;

            if (axios.isCancel(err)) {
              // 用户主动中断，不算错误，直接退出循环
              throw err;
            }

            retryCount++;
            if (retryCount <= this.maxRetries) {
              this.events?.uploading && this.events.uploading({
                status: 'retry',
                message: `分片 ${i} 下载失败，正在进行第 ${retryCount} 次重试`,
              });
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
          }
        }
        
        if (!success) {
          throw lastError || new Error(`分片 ${i} 下载失败，已重试 ${this.maxRetries} 次`);
        }
      } catch (err) {
        if (axios.isCancel(err)) {
          // 用户主动中断，不算错误
          return;
        }
        throw err;
      }
    }
    if (!this.isPaused && !this.isStop) {
      await this.mergeChunks();
      this.events?.success && this.events.success();
    }
  }

  async saveChunkToIndexedDB(index, blob) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.put({ index, blob });
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async loadChunksFromIndexedDB() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.getAll();
      req.onsuccess = (e) => {
        const result = e.target.result;
        this.chunks = [];
        this.downloaded = 0;
        for (const { index, blob } of result) {
          this.chunks[index] = blob;
          this.downloaded += blob.size;
        }
        resolve();
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async clearChunksFromIndexedDB() {
    return new Promise((resolve, reject) => {
      if(this.db) {
        const tx = this.db.transaction([this.storeName], 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e.target.error);
      } else {
        resolve();
      }
    });
  }

  async mergeChunks() {
    // 关闭streamSaver流
    if (this.writer) {
      await this.writer.close();
      this.writer = null;
      this.stream = null;
    }
    await this.clearChunksFromIndexedDB();
    // 关闭数据库连接
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    // 删除整个数据库
    await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(this.dbName);
      req.onsuccess = () => {
        resolve();
      };
      req.onerror = (e) => reject(e.target.error);
      req.onblocked = () => {
        console.error('删除数据库被阻塞');
        // reject(new Error('删除数据库被阻塞'))
      };
    });
    this.isCompleted = true;
  }
}

export default FileDownloader;

/**
 * 深度合并两个对象
 * @param {Object} obj1 - 第一个对象
 * @param {Object} obj2 - 第二个对象
 * @returns {Object} - 合并后的对象
 */
function deepMergeObject(obj1, obj2) {
  const result = { ...obj1 };
  
  for (const key in obj2) {
    if (Object.prototype.hasOwnProperty.call(obj2, key)) {
      if (obj2[key] !== null && typeof obj2[key] === 'object' && !Array.isArray(obj2[key]) && 
          obj1[key] !== null && typeof obj1[key] === 'object' && !Array.isArray(obj1[key])) {
        result[key] = deepMergeObject(obj1[key], obj2[key]);
      } else {
        result[key] = obj2[key];
      }
    }
  }
  
  return result;
}

function hashCode(str) {
  let hash = 0, i, chr;
  if (str.length === 0) return hash;
  for (i = 0; i < str.length; i++) {
    chr   = str.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}