import styled from 'styled-components';
import React, { useState, useCallback, useEffect } from 'react';
import { Table } from 'react-virtualized';
import unescape from 'lodash/unescape';
import debounce from 'lodash/debounce';

const Style = styled.div`
    position: relative;
    box-shadow: 0px 5px 25px 5px rgb(0 0 0 / 80%);
    background-color: rgb(0 0 0 / 100%);

    .ReactVirtualized__Table {
        .ReactVirtualized__Table__Grid {
            outline: none;
        }

        .ReactVirtualized__Table__row {
            .item {
                height: 100%;
                padding: 5px;

                .textarea {
                    border: none;
                    width: 100%;
                    height: 100%;
                    color: #fff;
                    font-size: 12px;
                    padding: 10px;
                    text-align: center;
                    background-color: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    transition: all 0.2s ease;
                    resize: none;
                    outline: none;

                    &.highlight {
                        background-color: rgb(0 87 158);
                        border: 1px solid rgba(255, 255, 255, 0.3);
                    }

                    &.illegal {
                        background-color: rgb(123 29 0);
                        border: 1px solid rgba(255, 255, 255, 0.3);
                    }
                }
            }
        }
    }
`;

export default function Subtitles({ currentIndex, subtitle, checkSub, player, updateSub }) {
    // height初始化为100
    const [height, setHeight] = useState(100);
    // resize：一个回调函数，用于更新height状态变量。它根据页面的高度进行计算并设置新的高度值。
    // 使用useCallback确保resize函数在依赖项不变的情况下不会被重新创建，提高性能。
    const resize = useCallback(() => {
        setHeight(document.body.clientHeight - 170);
    }, [setHeight]);
    // 监听函数，若窗口发生变化，则会使用debounce进行防抖处理
    useEffect(() => {
        resize();
        if (!resize.init) {
            resize.init = true;
            // 延迟500毫秒再调用resize的新高度
            const debounceResize = debounce(resize, 500);
            window.addEventListener('resize', debounceResize);
        }
    }, [resize]);
    // 组件返回值，返回一个Style组件
    return (
        <Style className="subtitles">
            <Table
                headerHeight={40}
                width={250}
                height={height}
                rowHeight={80}
                scrollToIndex={currentIndex}
                rowCount={subtitle.length}
                rowGetter={({ index }) => subtitle[index]}
                headerRowRenderer={() => null}
                rowRenderer={(props) => {
                    return (
                        <div
                            key={props.key}
                            className={props.className}
                            style={props.style}
                            // 点击的时候处理暂停和播放的逻辑
                            onClick={() => {
                                if (player) {
                                    player.pause();
                                    if (player.duration >= props.rowData.startTime) {
                                        player.currentTime = props.rowData.startTime + 0.001;
                                    }
                                }
                            }}
                        >
                            <div className="item">
                                <textarea
                                    maxLength={200}
                                    spellCheck={false}
                                    className={[
                                        'textarea',
                                        currentIndex === props.index ? 'highlight' : '',
                                        checkSub(props.rowData) ? 'illegal' : '',
                                    ]
                                        .join(' ')
                                        .trim()}
                                    value={unescape(props.rowData.text)}
                                    onChange={(event) => {
                                        updateSub(props.rowData, {
                                            text: event.target.value,
                                        });
                                    }}
                                />
                            </div>
                        </div>
                    );
                }}
            ></Table>
        </Style>
    );
}
