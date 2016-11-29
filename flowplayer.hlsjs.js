/*jslint browser: true, for: true, node: true */
/*eslint indent: ["error", 4], no-empty: ["error", { "allowEmptyCatch": true }] */
/*eslint-disable quotes, no-console */
/*global window */

/*!

   hlsjs engine plugin for Flowplayer HTML5

   Copyright (c) 2015-2016, Flowplayer Oy

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
                            } else {
                                if (!swapAudioCodecDate || (now - swapAudioCodecDate) > 3000) {
                                    swapAudioCodecDate = performance.now();
                                    hls.swapAudioCodec();
                                    hls.recoverMediaError();
                                } else {
                                    return 3;
                                }
                            }
                        }
                        // DEPRECATED
                        if (recover > 0) {
                            recover -= 1;
                        }
                    },

                    // pre 6.0.4 poster detection
                    bc,
                    has_bg,

                    posterClass = "is-poster",
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

                    setReplayLevel = false,
                    maxLevel = 0,

                    startUp = function () {
                        hls.startLoad(hls.config.startPosition);
                    },

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
                        delete player.hlsQualities;
                        removeAllQualityClasses();
                        common.find(".fp-quality-selector", root).forEach(common.removeNode);
                    },
                    qIndex = function () {
                        return player.hlsQualities[player.qualities.indexOf(player.quality) + 1];
                    },
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
                                    qIndices.push(typeof q === "number"
                                        ? q
                                        : q.level);
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

                        player.qualities = [];
                        hlsQualities.forEach(function (idx) {
                            var level = levels[idx],
                                width = level.width,
                                height = level.height,
                                q = qIndices.length
                                    ? hlsQualitiesConf[qIndices.indexOf(idx)]
                                    : idx,
                                label = typeof q === "object"
                                    ? q.label
                                    : (width && height)
                                        ? Math.min(width, height) + "p"
                                        : "Level " + (idx + 1);

                            player.qualities.push(label);
                        });

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
                                common.removeNode(common.findDirect("video", root)[0]
                                        || common.find(".fp-player > video", root)[0]);
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
                                        if (!player.ready && flow.indexOf("ready") < 0) {
                                            return;
                                        }

                                        var ct = videoTag.currentTime,
                                            buffered,
                                            buffer = 0,
                                            buffend = 0,
                                            updatedVideo = player.video,
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
                                                seekable: videoTag.seekable.end(null),
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
                                                buffered = videoTag.buffered;
                                                buffer = buffered.end(null);
                                                if (ct) {
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
                                            if (hls.autoLevelEnabled && (loop || conf.playlist.length < 2 || conf.advance === false)) {
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

                                                    // do not go to a lower cached level on loop/replay
                                                    if (loop) {
                                                        bean.one(videoTag, "pause." + engineName, function () {
                                                            common.removeClass(root, "is-paused");
                                                        });
                                                    }
                                                    bean.one(videoTag, (loop
                                                        ? "play."
                                                        : "timeupdate.") + engineName, function () {
                                                        var currentLevel = hls.currentLevel;

                                                        if (currentLevel < maxLevel) {
                                                            hls.currentLevel = maxLevel;
                                                            setReplayLevel = true;
                                                        }
                                                    });
                                                }
                                            }
                                            break;
                                        case "error":
                                            errorCode = videoTag.error.code;

                                            if ((hlsUpdatedConf.recoverMediaError && errorCode === 3) ||
                                                    (hlsUpdatedConf.recoverNetworkError && errorCode === 2) ||
                                                    (hlsUpdatedConf.recover && (errorCode === 2 || errorCode === 3))) {
                                                errorCode = doRecover(conf, flow, errorCode === 2);
                                            }
                                            if (errorCode !== undefined) {
                                                arg = {code: errorCode};
                                                if (errorCode > 2) {
                                                    arg.video = extend(updatedVideo, {
                                                        src: src,
                                                        url: src
                                                    });
                                                }
                                            } else {
                                                arg = false;
                                            }
                                            break;
                                        }

                                        if (arg === false) {
                                            return arg;
                                        }

                                        player.trigger(flow, [player, arg]);

                                        if (flow === "ready" && quality) {
                                            selectorIndex = quality === "abr"
                                                ? 0
                                                : player.qualities.indexOf(quality) + 1;
                                            common.addClass(common.find(".fp-quality-selector li", root)[selectorIndex],
                                                    qActive);
                                        }
                                    });
                                });

                                if (coreV6 && conf.poster) {
                                    // engine too late, poster already removed
                                    // abuse timeupdate to re-instate poster
                                    player.on("stop." + engineName, addPoster);
                                    // re-instate initial poster for live streams
                                    if (player.live && !autoplay && !player.video.autoplay) {
                                        bean.one(videoTag, "seeked." + engineName, addPoster);
                                    }
                                }
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

                                player.on("error." + engineName, function () {
                                    if (hls) {
                                        hls.destroy();
                                        hls = 0;
                                    }
                                });

                                common.prepend(common.find(".fp-player", root)[0], videoTag);

                            } else {
                                hls.destroy();
                                if ((player.video.src && video.src !== player.video.src) || video.index) {
                                    common.attr(videoTag, "autoplay", "autoplay");
                                }
                            }

                            // #28 obtain api.video props before ready
                            player.video = video;
                            maxLevel = 0;
                            setReplayLevel = false;

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
                                        if (hlsQualitiesSupport(conf)) {
                                            if (hlsQualitiesConf) {
                                                initQualitySelection(hlsQualitiesConf, hlsUpdatedConf, data);
                                            } else {
                                                qClean();
                                            }
                                        } else {
                                            delete player.quality;
                                        }
                                        if (player.live) {
                                            startUp();
                                        } else {
                                            setTimeout(startUp);
                                        }
                                        break;

                                    case "FRAG_LOADED":
                                        if (setReplayLevel) {
                                            hls.nextLevel = -1;
                                            setReplayLevel = false;
                                            maxLevel = 0;
                                        } else if (!player.live && hls.autoLevelEnabled && hls.loadLevel > maxLevel) {
                                            maxLevel = hls.loadLevel;
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
                                                    fperr = doRecover(conf, data.type);
                                                } else {
                                                    fperr = 3;
                                                }
                                                break;
                                            default:
                                                hls.destroy();
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
                var b = support.browser,
                    wn = win.navigator,
                    IE11 = wn.userAgent.indexOf("Trident/7") > -1;

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

                if (isHlsType(type)) {
                    // allow all browsers for hlsjs debugging
                    if (hlsconf.debug) {
                        return true;
                    }
                    // https://bugzilla.mozilla.org/show_bug.cgi?id=1244294
                    if (hlsconf.anamorphic &&
                            wn.platform.indexOf("Win") === 0 && b.mozilla && b.version.indexOf("44.") === 0) {
                        return false;
                    }

                    // https://github.com/dailymotion/hls.js/issues/9
                    return IE11 || !b.safari;
                }
                return false;
            };

            // put on top of engine stack
            // so hlsjs is tested before html5 video hls and flash hls
            flowplayer.engines.unshift(engineImpl);

            flowplayer(function (api) {
                // to take precedence over VOD quality selector
                api.pluginQualitySelectorEnabled = hlsQualitiesSupport(api.conf) &&
                        engineImpl.canPlay("application/x-mpegurl", api.conf);
            });
        }

    };
    if (typeof module === 'object' && module.exports) {
        module.exports = extension.bind(undefined, require('hls.js/lib/index.js'));
    } else if (window.Hls && window.flowplayer) {
        extension(window.Hls, window.flowplayer);
    }
}());
