export const userAgent = window.navigator.userAgent;
export const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

// 获取拓展字段 txt mp4 mp3 之类的
export function getExt(url) {
    return url.trim().toLowerCase().split('.').pop();
}

export function sleep(ms = 0) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// 文件下载
export function download(url, name) {
    const elink = document.createElement('a');
    elink.style.display = 'none';
    elink.href = url;
    elink.download = name;
    document.body.appendChild(elink);
    elink.click();
    document.body.removeChild(elink);
}

export function getKeyCode(event) {
    const tag = document.activeElement.tagName.toUpperCase();
    const editable = document.activeElement.getAttribute('contenteditable');
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && editable !== '' && editable !== 'true') {
        return Number(event.keyCode);
    }
}

// 判断视频是否正在播放
export function isPlaying($video) {
    /**
     * video.readyState
     * 查阅 https://developer.mozilla.org/zh-CN/docs/Web/API/HTMLMediaElement/readyState
     */
    return !!($video.currentTime > 0 && !$video.paused && !$video.ended && $video.readyState > 2);
}
