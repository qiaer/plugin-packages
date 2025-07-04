import plupload from 'plupload'

const STORE_NAME = 'uploadState'

function dbPut(db, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.put(value)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

function dbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function deleteDB(dbName) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(dbName)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => {
      reject(new Error('数据库删除被阻塞，请关闭所有使用该数据库的页面后重试'))
    }
  })
}

export default class FileUploader {
  file = null
  dbName = ''
  url = ''
  CHUNK_SIZE = 0 // 切片大小，默认0不切片
  MAX_RETRIES = 0
  events = {}
  uploadState = new Map()
  db = null
  browseButton = null
  file = null

  constructor(options = {}) {
    const { url = '', file, events = {}, uploadParams = {}, apiParams = {}, dbName } = options
    this.dbName = dbName || `fileToolsUploadDB_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    this.url = url
    this.events = events

    const { success: successEvent, uploading: uploadingEvent, error: errorEvent } = events

    const browseButton = document.createElement('button')
    browseButton.style.display = 'none'
    document.body.appendChild(browseButton)
    this.browseButton = browseButton

    this.file = file

    this.uploader = new plupload.Uploader({
      url,
      browse_button: browseButton,
      runtimes: 'html5',
      max_retries: this.MAX_RETRIES,
      chunk_size: this.CHUNK_SIZE,
      multipart_params: {
        ...apiParams,
      },
      ...uploadParams,
      multi_selection : true,
      multiple_queues : true,
      // max_file_count: 0,
      init: {
        UploadFile: (up, file) => {
          console.log('UploadFile');
          this.file = file
        },
        UploadProgress: (up, file) => {
          uploadingEvent && uploadingEvent(up?.uid, file)
        },
        ChunkUploaded: async (up, file, res) => {
          const response = res?.response ? JSON.parse(res.response) : {}
          if (response?.code === 0) {
            const fileInfo = up.getFile(file.id)
            
            const state = {
              uploadedChunks: file.loaded,
              totalChunks: fileInfo?.size,
              fileId: file.id
            }
            this.uploadState.set(file.id, state)
            if (this.db) await dbPut(this.db, state)
          } else {
            up?.stop()
            errorEvent && errorEvent(up?.uid, response)
          }
        },
        FileUploaded: async (up, file, res) => {
          console.log('FileUploaded', file, res);
          
          const response = res?.response ? JSON.parse(res.response) : {}
          if (response?.code === 0) {
            successEvent && successEvent(up?.uid, response)
          } else {
            errorEvent && errorEvent(up?.uid, response)
          }

          // 上传完成后清除状态
          this.uploadState.delete(file.id)
          if (this.dbName) await deleteDB(this.dbName)
        },
        UploadComplete: () => {
          console.log('UploadComplete');
          this.browseButton?.remove()
        },
        Error: async (up, error) => {
          console.error('Error', error);
          // console.log(error)
          errorEvent && errorEvent(up?.uid, error)
          if (this.dbName) await deleteDB(this.dbName)
          this.browseButton?.remove()
        },
        BeforeUpload: (up, file, args) => {
          console.log('BeforeUpload up', up)
          console.log('BeforeUpload file', file)
          console.log('BeforeUpload args', args)
        },
      }
    })

    this.uploader.init()

  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'fileId' });
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

  setOption(options) {
    this.uploader?.setOption(options)
  }

  async start(file) {
    if (!this.db) {
      await this.initDB()
    }

    // 避免示例未初始化，马上start
    await sleep(100)

    try {
      this.uploader.addFile(file, file?.name)

      this.uploader?.start(file)
    } catch (error) {
      console.error('上传失败', error)
    } finally {
      console.log('start end');
    }
  }

  async resume() {
    if (this.file?.id) {
      const savedState = await dbGet(this.db, this.file.id)
      if (savedState) {
        this.file.loaded = savedState.uploadedChunks
        const existFile = this.uploader?.getFile(this.file?.id)
        if (existFile) {
          existFile.loaded = savedState.uploadedChunks
        }
      }

      this.uploader?.start()
    }
  }

  pause() {
    this.uploader?.stop()
  }

  async stop() {
    this.uploader?.destroy()
    this.file = null
    if (this.db) {
      this.db?.close();
      this.db = null;
    }
    if (this.dbName) {
      try {
        await deleteDB(this.dbName)
      } catch (e) {
        console.error('删除数据库失败', e)
      }
    }
    this.browseButton?.remove()
  }

}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}