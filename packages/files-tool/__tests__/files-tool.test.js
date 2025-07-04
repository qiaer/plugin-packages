import { FileUploader, FileDownloader } from '../src/index.js';

let fileUploader = null

let file = null

window.selectFile = (e) => {
  file = e.target?.files?.[0]

  fileUploader = new FileUploader({
    url: 'http://xxx.com/api/upload',
    apiParams: {
      token: '123',
    },
    uploadParams: {
      // browse_button: 'browse_button',
      headers: {
        Authorization: 'Bearer 096c85c5-a1cd-4934-96bc-4f7a5e05f4f0',
      },
      // chunk_size: 5 * 1024 * 1024,
      max_retries: 3,
      filters: {
        mime_types : [ //只允许上传图片和zip文件
          { title : "Image files", extensions : "jpg,jpeg,png,doc,docx,xls,xlsx,ppt,pptx,pdf" }, 
          { title : "Zip files", extensions : "zip" },
          { title : "Video files", extensions : "mp4" },
        ],
        max_file_size : '400mb', //最大只能上传400mb的文件
      },
      // multi_selection: false
    },
    events: {
      success: (uid, data) => console.log('success', uid, data),
      uploading: (uid, data) => console.log('uploading', uid, data),
      error: (uid, data) => console.error('error', uid, data),
    },
    file: file
  });
  console.log('fileUploader', fileUploader)
  fileUploader.start(file)
}

window.stopUpload = () => {
  fileUploader.pause()
}

window.resumeUpload = () => {
  fileUploader.resume()
}

window.destroyUpload = () => {
  fileUploader.stop()
}


let fileDownloader = null

window.downloadFile = () => {
  fileDownloader = new FileDownloader({
    url: '/api/download/downloadBlock?fileId=1940975318542434306',
    fileName: 'test.pptx',
    storeName: 'chunks',
    events: {
      success: () => console.log('events success'),
      uploading: (data) => console.log('events uploading', data),
      error: (err) => console.error('events error', err),
    },
    maxRetries: 3,
    chunkSize: 1024 * 1024 * 5,
    totalSize: 157696994,
    apiConfig: {
      headers: {
        Authorization: 'Bearer 7259a663-0221-4726-8c92-cd93d48b179c',
      },
      responseType: 'blob',
    },
  })

  fileDownloader.start()
}

window.pauseDownload = () => {
  fileDownloader.pause()
}
window.resumeDownload = () => {
  fileDownloader.resume()
}
window.stopDownload = () => {
  fileDownloader.stop()
}