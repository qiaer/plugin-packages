
# files-tool

文件工具: 切片上传、切片下载、断点续传

## 安装

```javascript
npm i files-tool
```

## 上传

### 引入

#### npm

```javascript
import { FileUploader } from 'files-tool'
```

##### 创建实例

```javascript
const fileUploader = new FileUploader({
  url: 'http://xxxxxx/api/upload',
  apiParams: {
    token: 'xxxxxx',
  },
  uploadParams: {
    headers: {
      Authorization: 'xxxxxxx',
    },
    chunk_size: 5 * 1024 * 1024,
    max_retries: 3,
    filters: {
      mime_types : [
        { title : "Image files", extensions : "jpg,jpeg,png,doc,docx,xls,xlsx,ppt,pptx,pdf" }, 
        { title : "Zip files", extensions : "zip" }
      ],
      max_file_size : '400mb', //最大只能上传400mb的文件
    },
  },
  events: {
    success: (uid, data) => console.log('success', uid, data),
    uploading: (uid, data) => console.log('uploading', uid, data),
    error: (uid, data) => console.error('error', uid, data),
  },
});

// 开始上传
fileUploader.start(file)
// 暂停上传
fileUploader.pause()
// 继续上传
fileUploader.resume()
// 终止上传
fileUploader.stop()

```

#### 实例参数

| 参数       | 类型   | 是否必填 | 默认值              | 描述 |
| :--------- | :----- | :------- | :------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| url        | String | 是       | ''                  | 存储服务地址 |
| apiParams     | Object |          |                     | 接口额外参数 |
| events     | Object |          |                     | 回调事件对象:{ success, uploading, error } <br>success:(uid: 实例 id, data：接口返回结果)<br>uploading:(uid: 实例 id, { percent })<br>error:(uid: 实例 id, error：错误信息{code:错误编码(37926：文件过大),msg:错误信息} ) |
| uploadParams | Object |          | {}                  | plupload初始化参数 |

#### uploadParams (plupload初始化参数)

| 参数       | 类型   | 是否必填 | 默认值              | 描述 |
| :--------- | :----- | :------- | :------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| chunk_size  | Number |          | 0 | 分片大小 |
| max_retries  | Number |          | 0 | 当发生plupload.HTTP_ERROR错误时的重试次数，为0时表示不重试 |
| headers  | Object |          |  | HTTP Headers |
| filters  | Object |          |  | 文件过滤 |
| runtimes  | String |          | html5 | 上传方式 html5,flash,silverlight,html4 |
| unique_names  | Boolean |     | false | 生成一个唯一的文件名 |

[配置详情](https://chaping.github.io/plupload/doc/)

#### 实例属性

| 属性      | 类型    | 默认值                    | 描述 |
| :-------- | :------ | :------------------------ | :-------------------------------------------------------------------------------------------------------------------------- |
| settings  | Object  |                           | 配置参数 |
| uid       | String  |                           | 实例 id |
| events    | Object  |                           | 回调事件对象 |
| status    | String  | ''                        | 实例状态 ''\|'success'\|'uploading'\|'error'\| 'done' <br>'': 未开始（默认状态）<br>success: 上传成功<br>uploading: 上传中<br>error: 上传失败<br> done: 上传完成 |
| files     | Array   |                           | 上传队列 |
| total     | Object  |                           | { size,loaded,uploaded,failed,queued,percent,bytesPerSec } |

#### 实例函数

| 函数        | 参数 | 返回值    | 描述                                        |
| :--------- | :--- | :------- | :----------------------------------------- |
| start      | file |          | 开始上传                                 |
| pause      |      |          | 暂停上传                                    |
| resume     |      |          | 继续上传（断点续传）                          |
| stop       |      |          | 终止并销毁上传任务                            |


## 下载

### 引入

#### npm

```javascript
import { FileDownloader } from 'files-tool'
```

```javascript
// vite.config.js
import streamSaverPlugin from 'files-tool/vite-plugin-stream-saver'

plugins: [
  streamSaverPlugin()
]
```

##### 创建实例

```javascript
const fileDownloader = new FileDownloader({
  url: 'http://xxxxxx/api/download/123',
  fileName: 'name.pdf',
  events: {
    success: () => console.log('events success'),
    uploading: (data) => console.log('events uploading', data),
    error: (err) => console.error('events error', err),
  },
  chunkSize: 1024 * 1024 * 10,
  totalSize: 689208406,
  apiConfig: {
    headers: {
      Authorization: 'xxxxxx',
    },
    responseType: 'blob',
  },
})

// 开始下载 
fileDownloader.start()
// 暂停下载 
fileDownloader.pause()
// 继续下载
fileDownloader.resume()
// 终止下载
fileDownloader.stop()

```

#### 实例参数

| 参数       | 类型   | 是否必填 | 默认值              | 描述 |
| :--------- | :----- | :------- | :------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| url        | String | 是       | ''                  | 下载地址 |
| fileName   | String | 是       | ''                  | 文件名 |
| totalSize  | String | 是       | 0                   | 文件大小 |
| chunkSize  | Number |          | 0                   | 切片大小，默认0不切片 |
| mitmUrl    | String |          | ''                  | mitm.html地址，http默认`https://jimmywarting.github.io/StreamSaver.js/mitm.html`，https默认`/mitm.html` |
| maxRetries | Number |          | 0                   | 重试次数，默认0不重试 |
| apiConfig  | Object |          |                     | [接口配置](https://www.runoob.com/ajax/fetch-api.html) |
| events     | Object |          |                     | 回调事件对象:{ success, uploading, error } <br>success:()<br>uploading:({ percent, status: uploading上传中 retry重试中 })<br>error:(error：错误信息) |

#### 实例属性

| 属性      | 类型    | 默认值                    | 描述 |
| :-------- | :------ | :------------------------ | :-------------------------------------------------------------------------------------------------------------------------- |
| apiConfig   | Object   | {}                    | 接口配置 |
| isPaused    | Boolean  | false                 | 是否暂停 |
| isCancelled | Boolean  | false                 | 是否终止 |
| downloaded  | Number   | 0                     | 下载完成大小 |
| chunks      | Array    | []                    | 分片列表 |
| fileName    | String   |                       | 文件名 |
| chunkSize   | Number   | 0                     | 切片大小 |
| maxRetries  | Number   | 0                     | 重试次数 |

#### 实例函数

| 函数        | 参数 | 返回值    | 描述                                        |
| :--------- | :--- | :------- | :----------------------------------------- |
| start      |      |          | 开始下载                                 |
| pause      |      |          | 暂停下载                                    |
| resume     |      |          | 继续下载（断点续传）                          |
| stop       |      |          | 终止并销毁下载任务                            |

## 获取远程文件大小

### 引入

#### npm

```javascript
import { getFileSize } from 'files-tool'
```

##### 使用

```javascript
const { size } = await getFileSize('http://xxxxxx/api/download/123')
```

## 致谢

特别感谢 [plupload](https://www.plupload.com/) 和 [StreamSaver.js](https://github.com/jimmywarting/StreamSaver.js) 
