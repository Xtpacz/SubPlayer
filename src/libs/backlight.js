import { isPlaying } from '../utils';

function matrixCallback(callback) {
    const result = [];
    const x = 10;
    const y = 5;
    for (let xIndex = 0; xIndex < x; xIndex += 1) {
        for (let yIndex = 0; yIndex < y; yIndex += 1) {
            if (xIndex === 0 || xIndex === x - 1 || yIndex === 0 || yIndex === y - 1) {
                result.push(callback(xIndex, yIndex, x, y));
            }
        }
    }
    return result;
}

// 获取画面颜色
function getColors($canvas, $video, width, height) {
    // 获取canvas上下文
    const ctx = $canvas.getContext('2d');
    // canvas画布的宽度高度
    $canvas.width = width;
    $canvas.height = height;
    // 将视频元素画上去
    ctx.drawImage($video, 0, 0);
    return matrixCallback((xIndex, yIndex, x, y) => {
        const itemW = width / x;
        const itemH = height / y;
        const itemX = xIndex * itemW;
        const itemY = yIndex * itemH;
        if (itemW < 1 || itemH < 1) return { r: 0, g: 0, b: 0 };
        const { data } = ctx.getImageData(itemX, itemY, itemW, itemH);
        let r = 0;
        let g = 0;
        let b = 0;
        for (let i = 0, l = data.length; i < l; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
        }
        r = Math.floor(r / (data.length / 4));
        g = Math.floor(g / (data.length / 4));
        b = Math.floor(b / (data.length / 4));
        return { r, g, b };
    });
}

// 创建一个由div元素组成的矩阵
function creatMatrix(parent) {
    return matrixCallback((xIndex, yIndex, x, y) => {
        const $box = document.createElement('div');
        $box.style.position = 'absolute';
        $box.style.left = `${(xIndex * 100) / x}%`;
        $box.style.top = `${(yIndex * 100) / y}%`;
        $box.style.width = `${100 / x}%`;
        $box.style.height = `${100 / y}%`;
        $box.style.borderRadius = '50%';
        $box.style.transition = 'all .2s ease';
        parent.appendChild($box);
        return {
            $box,
            left: xIndex === 0,
            right: xIndex === x - 1,
            top: yIndex === 0,
            bottom: yIndex === y - 1,
        };
    });
}

function setStyle(element, key, value) {
    element.style[key] = value;
    return element;
}

function setStyles(element, styles) {
    Object.keys(styles).forEach((key) => {
        setStyle(element, key, styles[key]);
    });
    return element;
}

// 创建一个背光效果，播放视频的时候，视频背后周围的阴影部分，可有可无~
export default function backlight($player, $video) {
    // 创建一个div
    const $backlight = document.createElement('div');
    $backlight.classList.add('backlight');
    setStyles($backlight, {
        position: 'absolute',
        zIndex: 9,
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        // width: '100%',
        // height: '100%',
        width: '0%',
        height: '0%',
    });

    const matrix = creatMatrix($backlight);
    // 创建一个新的canvas元素
    const $canvas = document.createElement('canvas');
    // 将这个背光元素放到视频上面
    $player.insertBefore($backlight, $video);

    function run() {
        const { clientWidth, clientHeight } = $video;
        const colors = getColors($canvas, $video, clientWidth, clientHeight);
        colors.forEach(({ r, g, b }, index) => {
            const { $box, left, right, top, bottom } = matrix[index];
            const x = left ? '-64px' : right ? '64px' : '0';
            const y = top ? '-64px' : bottom ? '64px' : '0';
            $box.style.boxShadow = `rgb(${r}, ${g}, ${b}) ${x} ${y} 128px`;
        });
    }


    // 当时视频播放位置发生变化，调用run函数
    $video.addEventListener('seeked', run);
    // 视频元数据（时长、尺寸等...）加载完成之后延迟调用（确保元数据加载完成之后有足够时间进行初始化操作）
    $video.addEventListener('loadedmetadata', () => setTimeout(run, 1000));

    (function loop() { // 立即执行
        window.requestAnimationFrame(() => { // 
            if (isPlaying($video)) {
                run();
            }
            loop();
        });
    })();
}
