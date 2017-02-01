/*jslint browser: true, for: true, node: true */
/*eslint indent: ["error", 4], no-empty: ["error", { "allowEmptyCatch": true }] */
/*eslint-disable quotes, no-console */
/*global window */

/*!

   hlsjs engine plugin for Flowplayer HTML5

   Copyright (c) 2015-2017, Flowplayer Drive Oy

   Released under the MIT License:
   http://www.opensource.org/licenses/mit-license.php

   Includes hls.js
   Copyright (c) 2015 Dailymotion (http://www.dailymotion.com)
   https://github.com/dailymotion/hls.js/blob/master/LICENSE

   Requires Flowplayer HTML5 version 6.x
   $GIT_DESC$

*/
(function () {
    "use strict";
    var extension = function (Hls, flowplayer) {
        var engineName = "hlsjs",
            hlsconf,
            common = flowplayer.common,
            extend = flowplayer.extend,
            support = flowplayer.support,
            version = flowplayer.version,
            coreV6 = version.indexOf("6.") === 0,
            win = window,
            mse = win.MediaSource || win.WebKitMediaSource,
            performance = win.performance,

            isHlsType = function (typ) {
                return typ.toLowerCase().indexOf("mpegurl") > -1;
            },
            hlsQualitiesSupport = function (conf) {
                var hlsQualities = (conf.clip && conf.clip.hlsQualities) || conf.hlsQualities;

                return support.inlineVideo &&
                        (hlsQualities === true ||
                        (hlsQualities && hlsQualities.length));
            },

            engineImpl = function hlsjsEngine(player, root) {
                var bean = flowplayer.bean,
                    videoTag,
                    hls,

                    recover, // DEPRECATED
                    recoverMediaErrorDate,
                    swapAudioCodecDate,
                    recoveryClass = "is-seeking",
                    posterClass = "is-poster",
                    doRecover = function (conf, etype, isNetworkError) {
                        if (conf.debug) {
                            console.log("recovery." + engineName, "<-", etype);
                        }
                        common.removeClass(root, "is-paused");
                        common.addClass(root, recoveryClass);
                        if (isNetworkError) {
                            hls.startLoad();
                        } else {
                            var now = performance.now();
                            if (!recoverMediaErrorDate || now - recoverMediaErrorDate > 3000) {
                                recoverMediaErrorDate = performance.now();
                                hls.recoverMediaError();
                            } else if (!swapAudioCodecDate || (now - swapAudioCodecDate) > 3000) {
                                swapAudioCodecDate = performance.now();
                                hls.swapAudioCodec();
                                hls.recoverMediaError();
                            }
                        }
                        // DEPRECATED
                        if (recover > 0) {
                            recover -= 1;
                        }
                        bean.one(videoTag, "seeked." + engineName, function () {
                            if (videoTag.paused) {
                                common.removeClass(root, posterClass);
                                player.poster = false;
                                videoTag.play();
                            }
                            common.removeClass(root, recoveryClass);
                        });
                    },

                    // pre 6.0.4 poster detection
                    bc,
                    has_bg,

                    addPoster = function () {
                        bean.one(videoTag, "timeupdate." + engineName, function () {
                            common.addClass(root, posterClass);
                            player.poster = true;
                        });
                    },
                    removePoster = function () {
                        if (coreV6 && player.poster) {
                            bean.one(videoTag, "timeupdate." + engineName, function () {
                                common.removeClass(root, posterClass);
                                player.poster = false;
                            });
                        }
                    },

                    maxLevel = 0,

                    // v6 qsel
                    qActive = "active",
                    dataQuality = function (quality) {
                        // e.g. "Level 1" -> "level1"
                        if (!quality) {
                            quality = player.quality;
                        }
                        return quality.toLowerCase().replace(/\ /g, "");
                    },
                    removeAllQualityClasses = function () {
                        var qualities = player.qualities;

                        if (!qualities || !qualities.length) {
                            return;
                        }
                        common.removeClass(root, "quality-abr");
                        qualities.forEach(function (quality) {
                            common.removeClass(root, "quality-" + dataQuality(quality));
                        });
                    },
                    qClean = function () {
                        if (coreV6) {
                            delete player.hlsQualities;
                            removeAllQualityClasses();
                            common.find(".fp-quality-selector", root).forEach(common.removeNode);
                        }
                    },
                    qIndex = function () {
                        return player.hlsQualities[player.qualities.indexOf(player.quality) + 1];
                    },

                    // v7 qsel
                    lastSelectedLevel = -1,

                    // v7 and v6 qsel
                    initQualitySelection = function (hlsQualitiesConf, conf, data) {
                        var levels = data.levels,
                            hlsQualities = [],
                            qIndices = [],
                            levelIndex = 0,
                            selector;

                        qClean();

                        if (hlsQualitiesConf === "drive") {
                            switch (levels.length) {
                            case 4:
                                hlsQualities = [1, 2, 3];
                                break;
                            case 5:
                                hlsQualities = [1, 2, 3, 4];
                                break;
                            case 6:
                                hlsQualities = [1, 3, 4, 5];
                                break;
                            case 7:
                                hlsQualities = [1, 3, 5, 6];
                                break;
                            case 8:
                                hlsQualities = [1, 3, 6, 7];
                                break;
                            default:
                                if (levels.length < 3 ||
                                        (levels[0].height && levels[2].height && levels[0].height === levels[2].height)) {
                                    return;
                                }
                                hlsQualities = [1, 2];
                            }
                        } else {
                            if (typeof hlsQualitiesConf === "string") {
                                hlsQualitiesConf.split(/\s*,\s*/).forEach(function (q) {
                                    qIndices.push(parseInt(q, 10));
                                });
                            } else if (typeof hlsQualitiesConf !== "boolean") {
                                hlsQualitiesConf.forEach(function (q) {
                                    qIndices.push(isNaN(Number(q))
                                        ? q.level
                                        : q);
                                });
                            }
                            levels.forEach(function (level) {
                                // do not check audioCodec,
                                // as e.g. HE_AAC is decoded as LC_AAC by hls.js on Android
                                if ((hlsQualitiesConf === true || qIndices.indexOf(levelIndex) > -1) &&
                                        (!level.videoCodec ||
                                        (level.videoCodec &&
                                        mse.isTypeSupported('video/mp4;codecs=' + level.videoCodec)))) {
                                    hlsQualities.push(levelIndex);
                                }
                                levelIndex += 1;
                            });
                            if (hlsQualities.length < 2) {
                                return;
                            }
                        }

                        if (coreV6) {
                            player.qualities = [];
                        } else {
                            if (hlsQualitiesConf === "drive" ||
                                    hlsQualitiesConf === true ||
                                    qIndices[0] === -1) {
                                hlsQualities.unshift(-1);
                            }

                            player.video.qualities = [];
                        }

                        hlsQualities.forEach(function (idx) {
                            var level = levels[idx],
                                q = qIndices.length
                                    ? hlsQualitiesConf[qIndices.indexOf(idx)]
                                    : idx,
                                label = "Level " + (idx + 1);

                            if (idx < 0) {
                                label = q.label || "Auto";
                            } else if (q.label) {
                                label = q.label;
                            } else {
                                if (level.width && level.height) {
                                    label = Math.min(level.width, level.height) + "p";
                                }
                                if (!coreV6 && hlsQualitiesConf !== "drive" && level.bitrate) {
                                    label += " (" + Math.round(level.bitrate / 1000) + "k)";
                                }
                            }

                            if (coreV6) {
                                player.qualities.push(label);
                            } else {
                                player.video.qualities.push({value: idx, label: label});
                            }
                        });

                        if (!coreV6) {
                            if (lastSelectedLevel > -1 || hlsQualities.indexOf(-1) < 0) {
                                hls.startLevel = hlsQualities.indexOf(lastSelectedLevel) < 0
                                    ? hlsQualities[0]
                                    : lastSelectedLevel;
                                hls.loadLevel = hls.startLevel;
                                player.video.quality = hls.startLevel;
                            } else {
                                player.video.quality = hlsQualities.indexOf(lastSelectedLevel) < 0
                                    ? hlsQualities[0]
                                    : lastSelectedLevel;
                            }
                            lastSelectedLevel = player.video.quality;

                            return;
                        }

                        // v6
                        selector = common.createElement("ul", {
                            "class": "fp-quality-selector"
                        });
                        common.find(".fp-ui", root)[0].appendChild(selector);

                        hlsQualities.unshift(-1);
                        player.hlsQualities = hlsQualities;

                        if (!player.quality || player.qualities.indexOf(player.quality) < 0) {
                            player.quality = "abr";
                        } else {
                            hls.startLevel = qIndex();
                            hls.loadLevel = hls.startLevel;
                        }

                        selector.appendChild(common.createElement("li", {
                            "data-quality": "abr"
                        }, "Auto"));
                        player.qualities.forEach(function (q) {
                            selector.appendChild(common.createElement("li", {
                                "data-quality": dataQuality(q)
                            }, q));
                        });

                        common.addClass(root, "quality-" + dataQuality());

                        bean.on(root, "click." + engineName, ".fp-quality-selector li", function (e) {
                            var choice = e.currentTarget,
                                selectors,
                                active,
                                smooth = conf.smoothSwitching,
                                paused = videoTag.paused,
                                i;

                            if (common.hasClass(choice, qActive)) {
                                return;
                            }

                            if (!paused && !smooth) {
                                bean.one(videoTag, "pause." + engineName, function () {
                                    common.removeClass(root, "is-paused");
                                });
                            }

                            selectors = common.find(".fp-quality-selector li", root);

                            for (i = 0; i < selectors.length; i += 1) {
                                active = selectors[i] === choice;
                                if (active) {
                                    player.quality = i > 0
                                        ? player.qualities[i - 1]
                                        : "abr";
                                    if (smooth && !player.poster) {
                                        hls.nextLevel = qIndex();
                                    } else {
                                        hls.currentLevel = qIndex();
                                    }
                                    common.addClass(choice, qActive);
                                    if (paused) {
                                        videoTag.play();
                                    }
                                }
                                common.toggleClass(selectors[i], qActive, active);
                            }
                            removeAllQualityClasses();
                            common.addClass(root, "quality-" + dataQuality());
                        });
                    },

                    engine = {
                        engineName: engineName,

                        pick: function (sources) {
                            var i,
                                source;

                            for (i = 0; i < sources.length; i += 1) {
                                source = sources[i];
                                if (isHlsType(source.type)) {
                                    if (typeof source.src === 'string') {
                                        source.src = common.createAbsoluteUrl(source.src);
                                    }
                                    return source;
                                }
                            }
                        },

                        load: function (video) {
                            var conf = player.conf,
                                EVENTS = {
                                    ended: "finish",
                                    loadeddata: "ready",
                                    pause: "pause",
                                    play: "resume",
                                    progress: "buffer",
                                    ratechange: "speed",
                                    seeked: "seek",
                                    timeupdate: "progress",
                                    volumechange: "volume",
                                    error: "error"
                                },
                                HLSEVENTS = Hls.Events,
                                autoplay = !!video.autoplay || !!conf.autoplay,
                                hlsQualitiesConf = video.hlsQualities || conf.hlsQualities,
                                hlsUpdatedConf = extend(hlsconf, conf.hlsjs, conf.clip.hlsjs, video.hlsjs),
                                hlsClientConf = extend({}, hlsUpdatedConf);

                            // allow disabling level selection for single clips
                            if (video.hlsQualities === false) {
                                hlsQualitiesConf = false;
                            }

                            if (!hls) {
                                videoTag = common.findDirect("video", root)[0]
                                        || common.find(".fp-player > video", root)[0];

                                if (videoTag) {
                                    // destroy video tag
                                    // otherwise <video autoplay> continues to play
                                    common.find("source", videoTag).forEach(function (source) {
                                        source.removeAttribute("src");
                                    });
                                    videoTag.removeAttribute("src");
                                    videoTag.load();
                                    common.removeNode(videoTag);
                                }

                                videoTag = common.createElement("video", {
                                    "class": "fp-engine " + engineName + "-engine",
                                    "autoplay": autoplay
                                        ? "autoplay"
                                        : false,
                                    "volume": player.volumeLevel, // core ready stanza too late
                                    "x-webkit-airplay": "allow"
                                });

                                Object.keys(EVENTS).forEach(function (key) {
                                    var flow = EVENTS[key],
                                        type = key + "." + engineName,
                                        arg;

                                    bean.on(videoTag, type, function (e) {
                                        if (conf.debug && flow.indexOf("progress") < 0) {
                                            console.log(type, "->", flow, e.originalEvent);
                                        }

                                        var ct = videoTag.currentTime,
                                            seekable = videoTag.seekable,
                                            updatedVideo = player.video,
                                            seekOffset = updatedVideo.seekOffset,
                                            liveSyncPosition = player.dvr && hls.liveSyncPosition,
                                            buffered = videoTag.buffered,
                                            buffer = 0,
                                            buffend = 0,
                                            src = updatedVideo.src,
                                            flush = false,
                                            loop = updatedVideo.loop,
                                            i,
                                            quality = player.quality,
                                            selectorIndex,
                                            errorCode;

                                        switch (flow) {
                                        case "ready":
                                            arg = extend(updatedVideo, {
                                                duration: videoTag.duration,
                                                seekable: seekable.length && seekable.end(null),
                                                width: videoTag.videoWidth,
                                                height: videoTag.videoHeight,
                                                url: src
                                            });
                                            break;
                                        case "resume":
                                            removePoster();
                                            if (!hlsUpdatedConf.bufferWhilePaused) {
                                                hls.startLoad(ct);
                                            }
                                            break;
                                        case "seek":
                                            removePoster();
                                            if (!hlsUpdatedConf.bufferWhilePaused && videoTag.paused) {
                                                hls.stopLoad();
                                                videoTag.pause();
                                            }
                                            arg = ct;
                                            break;
                                        case "pause":
                                            if (!hlsUpdatedConf.bufferWhilePaused) {
                                                hls.stopLoad();
                                            }
                                            break;
                                        case "progress":
                                            if (player.dvr && liveSyncPosition) {
                                                updatedVideo.duration = liveSyncPosition;
                                                player.trigger('dvrwindow', [player, {
                                                    start: seekOffset,
                                                    end: liveSyncPosition
                                                }]);
                                                if (ct < seekOffset) {
                                                    videoTag.currentTime = seekOffset;
                                                }
                                            }
                                            arg = ct;
                                            break;
                                        case "speed":
                                            arg = videoTag.playbackRate;
                                            break;
                                        case "volume":
                                            arg = videoTag.volume;
                                            break;
                                        case "buffer":
                                            try {
                                                buffer = buffered.length && buffered.end(null);
                                                if (ct && buffer) {
                                                    // cycle through time ranges to obtain buffer
                                                    // nearest current time
                                                    for (i = buffered.length - 1; i > -1; i -= 1) {
                                                        buffend = buffered.end(i);
                                                        if (buffend >= ct) {
                                                            buffer = buffend;
                                                        }
                                                    }
                                                }
                                            } catch (ignore) {}
                                            video.buffer = buffer;
                                            arg = buffer;
                                            break;
                                        case "finish":
                                            if (hlsUpdatedConf.bufferWhilePaused && hls.autoLevelEnabled &&
                                                    (loop || conf.playlist.length < 2 || conf.advance === false)) {
                                                flush = !hls.levels[maxLevel].details;
                                                if (!flush) {
                                                    hls.levels[maxLevel].details.fragments.forEach(function (frag) {
                                                        flush = !!flush || !frag.loadCounter;
                                                    });
                                                }
                                                if (flush) {
                                                    hls.trigger(HLSEVENTS.BUFFER_FLUSHING, {
                                                        startOffset: 0,
                                                        endOffset: updatedVideo.duration * 0.9
                                                    });
                                                    hls.nextLoadLevel = maxLevel;
                                                    maxLevel = 0;
                                                    if (!loop) {
                                                        // hack to prevent Chrome engine from hanging
                                                        bean.one(videoTag, "play." + engineName, function () {
                                                            if (videoTag.currentTime >= videoTag.duration) {
                                                                videoTag.currentTime = 0;
                                                            }
                                                        });
                                                    }
                                                }
                                            }
                                            break;
                                        case "error":
                                            errorCode = videoTag.error && videoTag.error.code;

                                            if ((hlsUpdatedConf.recoverMediaError && (errorCode === 3 || !errorCode)) ||
                                                    (hlsUpdatedConf.recoverNetworkError && errorCode === 2) ||
                                                    (hlsUpdatedConf.recover && (errorCode === 2 || errorCode === 3))) {
                                                doRecover(conf, flow, errorCode === 2);
                                                return false;
                                            }

                                            arg = {code: errorCode || 3};
                                            if (errorCode > 2) {
                                                arg.video = extend(updatedVideo, {
                                                    src: src,
                                                    url: src
                                                });
                                            }
                                            break;
                                        }

                                        player.trigger(flow, [player, arg]);

                                        if (coreV6) {
                                            if (flow === "ready" && quality) {
                                                selectorIndex = quality === "abr"
                                                    ? 0
                                                    : player.qualities.indexOf(quality) + 1;
                                                common.addClass(common.find(".fp-quality-selector li", root)[selectorIndex],
                                                        qActive);
                                            }
                                        }
                                    });
                                });

                                player.on("error." + engineName, function () {
                                    if (hls) {
                                        hls.destroy();
                                        hls = 0;
                                    }
                                });

                                if (!hlsUpdatedConf.bufferWhilePaused) {
                                    player.on("beforeseek." + engineName, function (e, api, pos) {
                                        if (api.paused) {
                                            bean.one(videoTag, "seeked." + engineName, function () {
                                                videoTag.pause();
                                            });
                                            hls.startLoad(pos);
                                        }
                                    });
                                }

                                if (!coreV6) {
                                    player.on("quality." + engineName, function (e, api, q) {
                                        if (hlsUpdatedConf.smoothSwitching) {
                                            hls.nextLevel = q;
                                        } else {
                                            hls.currentLevel = q;
                                        }
                                        lastSelectedLevel = q;
                                    });

                                } else if (conf.poster) {
                                    // v6 only
                                    // engine too late, poster already removed
                                    // abuse timeupdate to re-instate poster
                                    player.on("stop." + engineName, addPoster);
                                    // re-instate initial poster for live streams
                                    if (player.live && !autoplay && !player.video.autoplay) {
                                        bean.one(videoTag, "seeked." + engineName, addPoster);
                                    }
                                }

                                common.prepend(common.find(".fp-player", root)[0], videoTag);

                            } else {
                                hls.destroy();
                                if ((player.video.src && video.src !== player.video.src) || video.index) {
                                    common.attr(videoTag, "autoplay", "autoplay");
                                }
                            }

                            // #28 obtain api.video props before ready
                            player.video = video;

                            // reset
                            maxLevel = 0;

                            Object.keys(hlsUpdatedConf).forEach(function (key) {
                                if (!Hls.DefaultConfig.hasOwnProperty(key)) {
                                    delete hlsClientConf[key];
                                }

                                var value = hlsUpdatedConf[key];

                                switch (key) {
                                case "adaptOnStartOnly":
                                    if (value) {
                                        hlsClientConf.startLevel = -1;
                                    }
                                    break;
                                case "autoLevelCapping":
                                    if (value === false) {
                                        value = -1;
                                    }
                                    hlsClientConf[key] = value;
                                    break;
                                case "startLevel":
                                    switch (value) {
                                    case "auto":
                                        value = -1;
                                        break;
                                    case "firstLevel":
                                        value = undefined;
                                        break;
                                    }
                                    hlsClientConf[key] = value;
                                    break;
                                case "recover": // DEPRECATED
                                    hlsUpdatedConf.recoverMediaError = false;
                                    hlsUpdatedConf.recoverNetworkError = false;
                                    recover = value;
                                    break;
                                case "strict":
                                    if (value) {
                                        hlsUpdatedConf.recoverMediaError = false;
                                        hlsUpdatedConf.recoverNetworkError = false;
                                        recover = 0;
                                    }
                                    break;

                                }
                            });

                            hlsClientConf.autoStartLoad = false;

                            hls = new Hls(hlsClientConf);
                            player.engine[engineName] = hls;
                            recoverMediaErrorDate = null;
                            swapAudioCodecDate = null;

                            Object.keys(HLSEVENTS).forEach(function (key) {
                                var etype = HLSEVENTS[key],
                                    listeners = hlsUpdatedConf.listeners,
                                    expose = listeners && listeners.indexOf(etype) > -1;

                                hls.on(etype, function (e, data) {
                                    var fperr,
                                        errobj = {},
                                        ERRORTYPES = Hls.ErrorTypes,
                                        ERRORDETAILS = Hls.ErrorDetails,
                                        updatedVideo = player.video,
                                        src = updatedVideo.src;

                                    switch (key) {
                                    case "MEDIA_ATTACHED":
                                        hls.loadSource(src);
                                        break;

                                    case "MANIFEST_PARSED":
                                        if (hlsQualitiesSupport(conf) &&
                                                !(!coreV6 && player.pluginQualitySelectorEnabled)) {
                                            if (hlsQualitiesConf) {
                                                initQualitySelection(hlsQualitiesConf, hlsUpdatedConf, data);
                                            } else {
                                                qClean();
                                            }
                                        } else if (coreV6) {
                                            delete player.quality;
                                        }
                                        hls.startLoad(hls.config.startPosition);
                                        break;

                                    case "FRAG_LOADED":
                                        if (hlsUpdatedConf.bufferWhilePaused && !player.live &&
                                                hls.autoLevelEnabled && hls.nextLoadLevel > maxLevel) {
                                            maxLevel = hls.nextLoadLevel;
                                        }
                                        break;
                                    case "FRAG_PARSING_METADATA":
                                        if (coreV6) {
                                            return;
                                        }
                                        data.samples.forEach(function (sample) {
                                            var metadataHandler;

                                            metadataHandler = function () {
                                                if (videoTag.currentTime < sample.dts) {
                                                    return;
                                                }
                                                bean.off(videoTag, 'timeupdate.' + engineName, metadataHandler);

                                                var raw,
                                                    Decoder = win.TextDecoder;

                                                if (Decoder && typeof Decoder === "function") {
                                                    raw = new Decoder('utf-8').decode(sample.data);
                                                } else {
                                                    raw = decodeURIComponent(win.escape(
                                                        String.fromCharCode.apply(null, sample.data)
                                                    ));
                                                }
                                                player.trigger('metadata', [player, {
                                                    key: raw.substr(10, 4),
                                                    data: raw.substr(21)
                                                }]);
                                            };
                                            bean.on(videoTag, 'timeupdate.' + engineName, metadataHandler);
                                        });
                                        break;
                                    case "LEVEL_UPDATED":
                                        if (player.dvr) {
                                            player.video.seekOffset = data.details.fragments[0].start + hls.config.nudgeOffset;
                                        }
                                        break;
                                    case "ERROR":
                                        if (data.fatal || hlsUpdatedConf.strict) {
                                            switch (data.type) {
                                            case ERRORTYPES.NETWORK_ERROR:
                                                if (hlsUpdatedConf.recoverNetworkError || recover) {
                                                    doRecover(conf, data.type, true);
                                                } else if (data.frag && data.frag.url) {
                                                    errobj.url = data.frag.url;
                                                    fperr = 2;
                                                } else {
                                                    fperr = 4;
                                                }
                                                break;
                                            case ERRORTYPES.MEDIA_ERROR:
                                                if (hlsUpdatedConf.recoverMediaError || recover) {
                                                    doRecover(conf, data.type);
                                                } else {
                                                    fperr = 3;
                                                }
                                                break;
                                            default:
                                                fperr = 5;
                                            }

                                            if (fperr !== undefined) {
                                                errobj.code = fperr;
                                                if (fperr > 2) {
                                                    errobj.video = extend(updatedVideo, {
                                                        src: src,
                                                        url: data.url || src
                                                    });
                                                }
                                                player.trigger("error", [player, errobj]);
                                            }
                                        } else {
                                            switch (data.details) {
                                            case ERRORDETAILS.BUFFER_STALLED_ERROR:
                                            case ERRORDETAILS.FRAG_LOOP_LOADING_ERROR:
                                                common.addClass(root, recoveryClass);
                                                bean.one(videoTag, "timeupdate." + engineName, function () {
                                                    common.removeClass(root, recoveryClass);
                                                });
                                                break;
                                            }
                                        }
                                        break;
                                    }

                                    // memory leak if all these are re-triggered by api #29
                                    if (expose) {
                                        player.trigger(e, [player, data]);
                                    }
                                });
                            });

                            if (hlsUpdatedConf.adaptOnStartOnly) {
                                bean.one(videoTag, "timeupdate." + engineName, function () {
                                    hls.loadLevel = hls.loadLevel;
                                });
                            }

                            hls.attachMedia(videoTag);

                            if (videoTag.paused && autoplay) {
                                videoTag.play();
                            }
                        },

                        resume: function () {
                            videoTag.play();
                        },

                        pause: function () {
                            videoTag.pause();
                        },

                        seek: function (time) {
                            videoTag.currentTime = time;
                        },

                        volume: function (level) {
                            if (videoTag) {
                                videoTag.volume = level;
                            }
                        },

                        speed: function (val) {
                            videoTag.playbackRate = val;
                            player.trigger('speed', [player, val]);
                        },

                        unload: function () {
                            if (hls) {
                                var listeners = "." + engineName;

                                hls.destroy();
                                hls = 0;
                                qClean();
                                player.off(listeners);
                                bean.off(root, listeners);
                                bean.off(videoTag, listeners);
                                common.removeNode(videoTag);
                                videoTag = 0;
                            }
                        }
                    };

                // pre 6.0.4: no boolean api.conf.poster and no poster with autoplay
                if (/^6\.0\.[0-3]$/.test(version) &&
                        !player.conf.splash && !player.conf.poster && !player.conf.autoplay) {
                    bc = common.css(root, 'backgroundColor');
                    // spaces in rgba arg mandatory for recognition
                    has_bg = common.css(root, 'backgroundImage') !== "none" ||
                            (bc && bc !== "rgba(0, 0, 0, 0)" && bc !== "transparent");
                    if (has_bg) {
                        player.conf.poster = true;
                    }
                }

                return engine;
            };

        if (Hls.isSupported() && version.indexOf("5.") !== 0) {
            // only load engine if it can be used
            engineImpl.engineName = engineName; // must be exposed
            engineImpl.canPlay = function (type, conf) {
                if (conf[engineName] === false || conf.clip[engineName] === false) {
                    // engine disabled for player or clip
                    return false;
                }

                // merge hlsjs clip config at earliest opportunity
                hlsconf = extend({
                    bufferWhilePaused: true,
                    smoothSwitching: true,
                    recoverMediaError: true
                }, flowplayer.conf[engineName], conf[engineName], conf.clip[engineName]);

                // https://github.com/dailymotion/hls.js/issues/9
                return isHlsType(type) && (!support.browser.safari || hlsconf.safari);
            };

            // put on top of engine stack
            // so hlsjs is tested before html5 video hls and flash hls
            flowplayer.engines.unshift(engineImpl);

            if (coreV6) {
                flowplayer(function (api) {
                    // to take precedence over VOD quality selector
                    api.pluginQualitySelectorEnabled = hlsQualitiesSupport(api.conf) &&
                            engineImpl.canPlay("application/x-mpegurl", api.conf);
                });
            }
        }

    };
    if (typeof module === 'object' && module.exports) {
        module.exports = extension.bind(undefined, require('hls.js/lib/index.js'));
    } else if (window.Hls && window.flowplayer) {
        extension(window.Hls, window.flowplayer);
    }
}());
