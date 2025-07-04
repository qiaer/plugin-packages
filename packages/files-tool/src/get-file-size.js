/**
 * 从URL获取文件大小
 * @param {string} url - 文件URL
 * @returns {Promise<{size: number, formattedSize: string}>} 返回文件大小对象
 */
export const getFileSize = async (url) => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const contentLength = response.headers.get('content-length');
    
    if (!contentLength) {
      throw new Error('无法获取文件大小：服务器头部未返回 Content-Length ');
    }
    
    const size = parseInt(contentLength, 10);
    return {
      size,
    };
  } catch (error) {
    throw new Error(`获取失败: ${error.message}`);
  }
};