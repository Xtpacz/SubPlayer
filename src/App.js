import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import NotificationSystem from 'react-notification-system';
import DT from 'duration-time-conversion';
import isEqual from 'lodash/isEqual';
import styled from 'styled-components';
import Tool from './components/Tool';
import Subtitles from './components/Subtitles';
import Player from './components/Player';
import Footer from './components/Footer';
import Loading from './components/Loading';
import ProgressBar from './components/ProgressBar';
import { getKeyCode } from './utils';
import Sub from './libs/Sub';

const Style = styled.div`
    height: 100%;
    width: 100%;

    .main {
        display: flex;
        height: calc(100% - 200px);

        .player {
            flex: 1;
        }

        .subtitles {
            width: 250px;
        }

        .tool {
            width: 300px;
        }
    }

    .footer {
        height: 200px;
    }
`;

export default function App({ defaultLang }) {
    const subtitleHistory = useRef([]);
    const notificationSystem = useRef(null);
    const [player, setPlayer] = useState(null);
    const [loading, setLoading] = useState('');
    const [processing, setProcessing] = useState(0);
    const [language, setLanguage] = useState(defaultLang);
    const [subtitle, setSubtitleOriginal] = useState([]);
    const [waveform, setWaveform] = useState(null);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [currentIndex, setCurrentIndex] = useState(-1);

    const newSub = useCallback((item) => new Sub(item), []);
    const hasSub = useCallback((sub) => subtitle.indexOf(sub), [subtitle]);

    const formatSub = useCallback(
        (sub) => {
            if (Array.isArray(sub)) {
                return sub.map((item) => newSub(item));
            }
            return newSub(sub);
        },
        [newSub],
    );
    
    // useCallback的作用是返回一个记忆化的回调函数，只有在其依赖项发生变化时才会重新创建这个函数。
    // 可以避免不必要的重新计算和组件重新渲染
    const copySubs = useCallback(() => formatSub(subtitle), [subtitle, formatSub]);

    const setSubtitle = useCallback(
        (newSubtitle, saveToHistory = true) => {
            if (!isEqual(newSubtitle, subtitle)) {
                if (saveToHistory) {
                    if (subtitleHistory.current.length >= 1000) {
                        subtitleHistory.current.shift();
                    }
                    subtitleHistory.current.push(formatSub(subtitle));
                }
                window.localStorage.setItem('subtitle', JSON.stringify(newSubtitle));
                setSubtitleOriginal(newSubtitle);
            }
        },
        [subtitle, setSubtitleOriginal, formatSub],
    );

    // 撤销操作
    const undoSubs = useCallback(() => {
        const subs = subtitleHistory.current.pop();
        if (subs) {
            setSubtitle(subs, false);
        }
    }, [setSubtitle, subtitleHistory]);

    const clearSubs = useCallback(() => {
        setSubtitle([]);
        subtitleHistory.current.length = 0;
    }, [setSubtitle, subtitleHistory]);

    const checkSub = useCallback(
        (sub) => {
            const index = hasSub(sub);
            if (index < 0) return;
            const previous = subtitle[index - 1];
            return (previous && sub.startTime < previous.endTime) || !sub.check || sub.duration < 0.2;
        },
        [subtitle, hasSub],
    );

    const notify = useCallback(
        (obj) => {
            // https://github.com/igorprado/react-notification-system
            const notification = notificationSystem.current;
            notification.clearNotifications();
            notification.addNotification({
                position: 'tc',
                dismissible: 'none',
                autoDismiss: 2,
                message: obj.message,
                level: obj.level,
            });
        },
        [notificationSystem],
    );

    const removeSub = useCallback(
        (sub) => {
            const index = hasSub(sub);
            if (index < 0) return;
            const subs = copySubs();
            subs.splice(index, 1);
            setSubtitle(subs);
        },
        [hasSub, copySubs, setSubtitle],
    );

    const addSub = useCallback(
        (index, sub) => {
            const subs = copySubs();
            subs.splice(index, 0, formatSub(sub));
            setSubtitle(subs);
        },
        [copySubs, setSubtitle, formatSub],
    );

    const updateSub = useCallback(
        (sub, obj) => {
            const index = hasSub(sub);
            if (index < 0) return;
            const subs = copySubs();
            const subClone = formatSub(sub);
            Object.assign(subClone, obj);
            if (subClone.check) {
                subs[index] = subClone;
                setSubtitle(subs);
            }
        },
        [hasSub, copySubs, setSubtitle, formatSub],
    );

    // 合并两个字幕块
    const mergeSub = useCallback(
        (sub) => {
            const index = hasSub(sub);
            if (index < 0) return;
            const subs = copySubs();
            const next = subs[index + 1];
            if (!next) return;
            // todo 之后合并了，样式怎么选择？前后字幕的样式，取决于谁
            const merge = newSub({
                start: sub.start,
                end: next.end,
                text: sub.text.trim() + '\n' + next.text.trim(),
            });
            subs[index] = merge;
            // 删除索引为index+1的元素
            subs.splice(index + 1, 1);
            // 将合并后的字幕数组更新到字幕状态管理中
            setSubtitle(subs);
        },
        [hasSub, copySubs, setSubtitle, newSub],
    );

    // 一个字幕块被分割成两个
    const splitSub = useCallback(
        (sub, start) => {
            const index = hasSub(sub);
            // 判空处理
            if (index < 0 || !sub.text || !start) return;
            const subs = copySubs();
            const text1 = sub.text.slice(0, start).trim();
            const text2 = sub.text.slice(start).trim();
            // 分割后某一块为空，同样进行直接返回，不分割
            if (!text1 || !text2) return;
            // 分割后持续时间小于0.2秒，直接返回，不分割
            const splitDuration = (sub.duration * (start / sub.text.length)).toFixed(3);
            if (splitDuration < 0.2 || sub.duration - splitDuration < 0.2) return;
            // 删除原来的
            subs.splice(index, 1);
            // 转换成类似于00:00:05.123的形式
            const middleTime = DT.d2t(sub.startTime + parseFloat(splitDuration));
            // 将分开的两个新的字幕块加入
            subs.splice(
                index,
                0,
                newSub({
                    start: sub.start,
                    end: middleTime,
                    text: text1,
                }),
            );
            subs.splice(
                index + 1,
                0,
                newSub({
                    start: middleTime,
                    end: sub.end,
                    text: text2,
                }),
            );
            // 设置整体字幕变量为新的subs
            setSubtitle(subs);
        },
        [hasSub, copySubs, setSubtitle, newSub],
    );

    // 按键对应事件：空格暂停播放，Ctrl+Z 撤回操作
    const onKeyDown = useCallback(
        (event) => {
            const keyCode = getKeyCode(event);
            switch (keyCode) {
                // 空格键，暂停操作
                case 32:
                    event.preventDefault();
                    if (player) {
                        if (playing) {
                            player.pause();
                        } else {
                            player.play();
                        }
                    }
                    break;
                // Ctrl+Z 撤回操作
                case 90:
                    event.preventDefault();
                    if (event.metaKey) {
                        undoSubs();
                    }
                    break;
                default:
                    break;
            }
        },
        [player, playing, undoSubs],
    );

    // 监听按键
    useEffect(() => {
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onKeyDown]);

    // 记录播放到第几个字幕了
    useMemo(() => {
        const currentIndex = subtitle.findIndex((item) => item.startTime <= currentTime && item.endTime > currentTime);
        setCurrentIndex(currentIndex);
    }, [currentTime, subtitle]);

    // 设置subtitle
    useEffect(() => {
        // 从浏览器缓存中获取subtitle
        const localSubtitleString = window.localStorage.getItem('subtitle');
        const fetchSubtitle = () =>
            fetch('/sample.json')
                .then((res) => res.json())
                .then((res) => {
                    setSubtitleOriginal(res.map((item) => new Sub(item)));
                });
        // 本地缓存有数据
        if (localSubtitleString) {
            try {
                const localSubtitle = JSON.parse(localSubtitleString);
                if (localSubtitle.length) {
                    // 优先设置为本地缓存的数据
                    setSubtitleOriginal(localSubtitle.map((item) => new Sub(item)));
                } else {
                    // 否则再是示例数据
                    fetchSubtitle();
                }
            } catch (error) {
                // 解析数据出错，同样设置为示例数据
                fetchSubtitle();
            }
        } else {
            fetchSubtitle();
        }
    }, [setSubtitleOriginal]);

    const props = {
        player,
        setPlayer,
        subtitle,
        setSubtitle,
        waveform,
        setWaveform,
        currentTime,
        setCurrentTime,
        currentIndex,
        setCurrentIndex,
        playing,
        setPlaying,
        language,
        setLanguage,
        loading,
        setLoading,
        setProcessing,
        subtitleHistory,

        notify,
        newSub,
        hasSub,
        checkSub,
        removeSub,
        addSub,
        undoSubs,
        clearSubs,
        updateSub,
        formatSub,
        mergeSub,
        splitSub,
    };

    return (
        <Style>
            <div className="main">
                {/* {...props}表示将props对象传递给组件 */}
                <Player {...props} />
                <Subtitles {...props} />
                <Tool {...props} />
            </div>
            <Footer {...props} />
            {loading ? <Loading loading={loading} /> : null}
            {processing > 0 && processing < 100 ? <ProgressBar processing={processing} /> : null}
            <NotificationSystem ref={notificationSystem} allowHTML={true} />
        </Style>
    );
}
