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
   Copyright (c) 2017 Dailymotion (http://www.dailymotion.com)
   https://github.com/video-dev/hls.js/blob/master/LICENSE

   Requires Flowplayer HTML5 version 6 or greater
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
            brwsr = support.browser,
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
            destroyVideoTag = function (root) {
                var vtag = common.findDirect("video", root)[0]
                        || common.find(".fp-player>video", root)[0];

                if (vtag) {
                    common.find("source", vtag).forEach(function (source) {
                        source.removeAttribute("src");
                    });
                    vtag.removeAttribute("src");
                    vtag.load();
                    common.removeNode(vtag);
                }
            },

            textencoding = require("text-encoding"),
            Decoder = new textencoding.TextDecoder("utf-8"),
            uint8ArrayToString = function (arr) {
                var txt = "";

                try {
                    txt = Decoder.decode(arr);
                } catch (ignore) {
                    try {
                        Decoder = new textencoding.TextDecoder("utf-16be");
                        txt = Decoder.decode(arr);
                    } catch (ignore) {
                        try {
                            Decoder = new textencoding.TextDecoder("utf-16le");
                            txt = Decoder.decode(arr);
                        } catch (ignore) {}
                    }
                }
                return txt;
            },

            loadHlsSubtitle = function (api, entry, num) {
                entry.title = entry.title || num + "";

                var cue = {
                    time: entry.startTime,
                    subtitle: entry,
                    visible: false
                };

                api.subtitles.push(entry);
                api.addCuepoint(cue);
                api.addCuepoint({
                    time: entry.endTime,
                    subtitleEnd: entry.title,
                    visible: false
                });
                // initial cuepoint
                if (entry.startTime === 0 && !api.video.time && !api.splash) {
                    api.trigger("cuepoint", [api, cue]);
                }
                if (api.splash) {
                    api.one("ready." + engineName, function () {
                        api.trigger('cuepoint', [api, cue]);
                    });
                }
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
                    handleError = function (errorCode, src, url) {
                        var errobj = {code: errorCode};

                        if (errorCode > 2) {
                            errobj.video = extend(player.video, {
                                src: src,
                                url: url || src
                            });
                        }
                        return errobj;
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

                    audioGroups,
                    audioUXGroup,
                    audioAutoSwitch = function (level) {
                        if (audioGroups && audioGroups.length > 1) {
                            var audioTracks = hls.audioTracks,
                                tracks = audioTracks.filter(function (atrack) {
                                    var attrs = hls.levels[level].attrs;

                                    return atrack.autoselect && attrs &&
                                            atrack.groupId === attrs.AUDIO &&
                                            atrack.name === audioTracks[hls.audioTrack].name;
                                }),
                                audioTrackId = tracks.length && tracks[0].id;

                            if (audioTrackId !== undefined && audioTrackId !== hls.audioTrack) {
                                hls.audioTrack = audioTrackId;
                            }
                        }
                    },
                    selectAudioTrack = function (audioTrack) {
                        common.find(".fp-audio", root)[0].innerHTML = audioTrack.lang || audioTrack.name;
                        common.find(".fp-audio-menu a", root).forEach(function (el) {
                            var adata = el.getAttribute("data-audio"),
                                isSelected = adata === audioTrack.name;

                            common.toggleClass(el, "fp-selected", isSelected);
                            common.toggleClass(el, "fp-color", isSelected);
                        });
                    },
                    removeAudioMenu = function () {
                        common.find(".fp-audio-menu", root).forEach(common.removeNode);
                        common.find(".fp-audio", root).forEach(common.removeNode);
                    },

                    nativeSubs,
                    hlsSubtitles,
                    setActiveSubtitleClass = function (idx) {
                        var menu = common.find(".fp-subtitle-menu", root)[0];

                        common.toggleClass(common.find('a.fp-selected', menu)[0], 'fp-selected');
                        common.toggleClass(common.find('a[data-subtitle-index="' + idx + '"]', menu)[0], 'fp-selected');
                    },
                    updateSubtitles = function (data, conf) {
                        var entries = uint8ArrayToString(data.payload),
                            id = data.frag.trackId;

                        if (!entries) {
                            return;
                        }
                        if (!hlsSubtitles[id]) {
                            hlsSubtitles[id] = [];
                        }
                        entries = conf.subtitleParser(entries);
                        entries.forEach(function (entry) {
                            if (entry.text) {
                                hlsSubtitles[id].push(entry);
                                if (player.ready) {
                                    loadHlsSubtitle(player, entry, hlsSubtitles[id].length);
                                    if (player.live) {
                                        var seekOffset = player.video.seekOffset;

                                        hlsSubtitles[id] = hlsSubtitles[id].filter(function (sub) {
                                            return sub.endTime >= seekOffset;
                                        });
                                        player.subtitles = player.subtitles.filter(function (sub) {
                                            return sub.endTime >= seekOffset;
                                        });
                                        player.cuepoints.forEach(function (cue) {
                                            if (cue.subtitle && cue.time < seekOffset) {
                                                player.removeCuepoint(cue);
                                            }
                                        });
                                    }
                                }
                            }
                        });
                    },
                    disableSubtitleTracks = function () {
                        [].forEach.call(videoTag.textTracks, function (track) {
                            if (track.kind === "subtitles") {
                                track.mode = "hidden";
                            }
                        });
                    },
                    initSubtitles = function (data, conf) {
                        var subtitleTracks = data.subtitleTracks;

                        if (!conf.subtitles || !subtitleTracks.length || !support.inlineVideo || coreV6) {
                            return;
                        }
                        // can there be more than 1 groupId?
                        subtitleTracks = subtitleTracks.filter(function (subtitleTrack) {
                            return subtitleTrack.groupId === subtitleTracks[0].groupId;
                        });
                        player.video.subtitles = subtitleTracks.map(function (subtitleTrack) {
                            // fake tracks
                            var track = {
                                kind: "subtitles",
                                id: subtitleTrack.id,
                                srclang: subtitleTrack.lang,
                                label: subtitleTrack.name,
                                "default": subtitleTrack.default
                            };
                            common.append(videoTag, common.createElement("track", track));
                            return track;
                        });
                        player.on("ready." + engineName, function (_e, api) {
                            var tracks = hls.subtitleTracks,
                                defaultTrack;

                            if (!tracks || !tracks.length) {
                                return;
                            }
                            if (nativeSubs) {
                                common.addClass(videoTag, "native-subtitles");
                            } else {
                                disableSubtitleTracks();
                            }
                            tracks.map(function (sub, idx) {
                                if (sub.default) {
                                    hls.subtitleTrack = idx;
                                }
                            });
                            defaultTrack = hls.subtitleTrack;
                            if (defaultTrack > -1) {
                                if (!nativeSubs && hlsSubtitles[defaultTrack]) {
                                    hlsSubtitles[defaultTrack].forEach(function (entry, i) {
                                        loadHlsSubtitle(api, entry, i + 1);
                                    });
                                }
                                setActiveSubtitleClass(defaultTrack);
                            } else {
                                setActiveSubtitleClass(-1);
                            }
                        });
                        bean.on(root, "click." + engineName, ".fp-subtitle-menu [data-subtitle-index]", function (e) {
                            e.preventDefault();
                            var idx = e.target.getAttribute("data-subtitle-index");

                            player.disableSubtitles();
                            hls.subtitleTrack = idx;
                            if (idx < 0) {
                                disableSubtitleTracks();
                                return;
                            }
                            setActiveSubtitleClass(idx);
                            if (!nativeSubs && hlsSubtitles[idx]) {
                                hlsSubtitles[idx].forEach(function (entry, i) {
                                    loadHlsSubtitle(player, entry, i + 1);
                                });
                            }
                        });
                    },

                    initAudio = function (data) {
                        audioGroups = [];
                        audioUXGroup = [];
                        data.levels.forEach(function (level) {
                            var agroup = level.attrs && level.attrs.AUDIO,
                                acodec = level.audioCodec;

                            if (agroup && audioGroups.indexOf(agroup) < 0 &&
                                    (!acodec || mse.isTypeSupported("audio/mp4;codecs=" + acodec))) {
                                audioGroups.push(agroup);
                            }
                        });
                        if (audioGroups.length) {
                            // create sample group
                            audioUXGroup = data.audioTracks.filter(function (audioTrack) {
                                return audioTrack.groupId === audioGroups[0];
                            });
                        }
                        if (!support.inlineVideo || coreV6 || audioUXGroup.length < 2) {
                            return;
                        }

                        // audio menu
                        bean.on(root, "click." + engineName, ".fp-audio", function () {
                            var menu = common.find(".fp-audio-menu", root)[0];

                            if (common.hasClass(menu, "fp-active")) {
                                player.hideMenu();
                            } else {
                                player.showMenu(menu);
                            }
                        });
                        bean.on(root, "click." + engineName, ".fp-audio-menu a", function (e) {
                            var adata = e.target.getAttribute("data-audio"),
                                audioTracks = hls.audioTracks,
                                gid = audioTracks[hls.audioTrack].groupId,
                                // confine choice to current group
                                atrack = audioTracks.filter(function (at) {
                                    return at.groupId === gid && (at.name === adata || at.lang === adata);
                                })[0];
                            hls.audioTrack = atrack.id;
                            selectAudioTrack(atrack);
                        });

                        player.on("ready." + engineName, function () {
                            removeAudioMenu();
                            if (!hls || !audioUXGroup || audioUXGroup.length < 2) {
                                return;
                            }

                            var ui = common.find(".fp-ui", root)[0],
                                controlbar = common.find(".fp-controls", ui)[0],
                                currentAudioTrack = hls.audioTracks[hls.audioTrack],
                                menu = common.createElement("div", {
                                    className: "fp-menu fp-audio-menu",
                                    css: {width: "auto"}
                                }, "<strong>Audio</strong>");

                            audioUXGroup.forEach(function (audioTrack) {
                                menu.appendChild(common.createElement("a", {
                                    "data-audio": audioTrack.name
                                }, audioTrack.name));
                            });
                            ui.appendChild(menu);
                            controlbar.appendChild(common.createElement("strong", {
                                className: "fp-audio"
                            }, currentAudioTrack));

                            selectAudioTrack(currentAudioTrack);
                        });
                    },

                    // v6 qsel
                    qActive = "active",
                    dataQuality = function (quality) {
                        // e.g. "Level 1" -> "level1"
                        if (!quality) {
                            quality = player.quality;
                        } else if (player.qualities.indexOf(quality) < 0) {
                            quality = "abr";
                        }
                        return quality.toLowerCase().replace(/\ /g, "");
                    },
                    removeAllQualityClasses = function () {
                        var qualities = player.qualities;

                        if (qualities) {
                            common.removeClass(root, "quality-abr");
                            qualities.forEach(function (quality) {
                                common.removeClass(root, "quality-" + dataQuality(quality));
                            });
                        }
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
                            hlsQualities,
                            qualities,
                            getLevel = function (q) {
                                return isNaN(Number(q))
                                    ? q.level
                                    : q;
                            },
                            selector;

                        qClean();
                        if (!hlsQualitiesConf || levels.length < 2) {
                            return;
                        }

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
                            hlsQualities.unshift(-1);
                        } else {
                            switch (typeof hlsQualitiesConf) {
                            case "object":
                                hlsQualities = hlsQualitiesConf.map(getLevel);
                                break;
                            case "string":
                                hlsQualities = hlsQualitiesConf.split(/\s*,\s*/).map(Number);
                                break;
                            default:
                                hlsQualities = levels.map(function (_level, i) {
                                    return i;
                                });
                                hlsQualities.unshift(-1);
                            }
                        }
                        if (coreV6 && hlsQualities.indexOf(-1) < 0) {
                            hlsQualities.unshift(-1);
                        }

                        hlsQualities = hlsQualities.filter(function (q) {
                            if (q > -1 && q < levels.length) {
                                var level = levels[q];

                                // do not check audioCodec,
                                // as e.g. HE_AAC is decoded as LC_AAC by hls.js on Android
                                return !level.videoCodec ||
                                        (level.videoCodec &&
                                        mse.isTypeSupported('video/mp4;codecs=' + level.videoCodec));
                            } else {
                                return q === -1;
                            }
                        });

                        qualities = hlsQualities.map(function (idx, i) {
                            var level = levels[idx],
                                q = typeof hlsQualitiesConf === "object"
                                    ? hlsQualitiesConf.filter(function (q) {
                                        return getLevel(q) === idx;
                                    })[0]
                                    : idx,
                                label = "Level " + (i + 1);

                            if (idx < 0) {
                                label = q.label || "Auto";
                            } else if (q.label) {
                                label = q.label;
                            } else {
                                if (level.width && level.height) {
                                    label = Math.min(level.width, level.height) + "p";
                                }
                                if (hlsQualitiesConf !== "drive" && level.bitrate) {
                                    label += " (" + Math.round(level.bitrate / 1000) + "k)";
                                }
                            }
                            if (coreV6) {
                                return label;
                            }
                            return {value: idx, label: label};
                        });

                        if (!coreV6) {
                            player.video.qualities = qualities;
                            if (lastSelectedLevel > -1 || hlsQualities.indexOf(-1) < 0) {
                                hls.loadLevel = hlsQualities.indexOf(lastSelectedLevel) < 0
                                    ? hlsQualities[0]
                                    : lastSelectedLevel;
                                hls.config.startLevel = hls.loadLevel;
                                player.video.quality = hls.loadLevel;
                            } else {
                                player.video.quality = -1;
                            }
                            lastSelectedLevel = player.video.quality;
                            return;
                        }

                        // v6
                        player.hlsQualities = hlsQualities;
                        player.qualities = qualities.slice(1);

                        selector = common.createElement("ul", {
                            "class": "fp-quality-selector"
                        });
                        common.find(".fp-ui", root)[0].appendChild(selector);

                        if (!player.quality || qualities.indexOf(player.quality) < 1) {
                            player.quality = "abr";
                        } else {
                            hls.loadLevel = qIndex();
                            hls.config.startLevel = hls.loadLevel;
                        }

                        qualities.forEach(function (q) {
                            selector.appendChild(common.createElement("li", {
                                "data-quality": dataQuality(q)
                            }, q));
                        });

                        common.addClass(root, "quality-" + dataQuality());

                        bean.on(root, "click." + engineName, ".fp-quality-selector li", function (e) {
                            var choice = e.currentTarget,
                                items = common.find(".fp-quality-selector li", root),
                                smooth = conf.smoothSwitching,
                                paused = videoTag.paused;

                            if (common.hasClass(choice, qActive)) {
                                return;
                            }

                            if (!paused && !smooth) {
                                bean.one(videoTag, "pause." + engineName, function () {
                                    common.removeClass(root, "is-paused");
                                });
                            }

                            items.forEach(function (item, i) {
                                var active = item === choice;

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
                                common.toggleClass(item, qActive, active);
                            });
                            removeAllQualityClasses();
                            common.addClass(root, "quality-" + dataQuality());
                        });
                    },

                    engine = {
                        engineName: engineName,

                        pick: function (sources) {
                            var source = sources.filter(function (s) {
                                return isHlsType(s.type);
                            })[0];

                            if (typeof source.src === "string") {
                                source.src = common.createAbsoluteUrl(source.src);
                            }
                            return source;
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
                                hlsUpdatedConf = extend(hlsconf, conf.hlsjs, video.hlsjs),
                                hlsClientConf = extend({}, hlsUpdatedConf);

                            // allow disabling level selection for single clips
                            if (video.hlsQualities === false) {
                                hlsQualitiesConf = false;
                            }
                            nativeSubs = hlsUpdatedConf.subtitles &&
                                    support.subtitles && conf.nativesubtitles;

                            if (!hls) {
                                destroyVideoTag(root);
                                videoTag = common.createElement("video", {
                                    "class": "fp-engine " + engineName + "-engine",
                                    "autoplay": autoplay
                                        ? "autoplay"
                                        : false,
                                    "volume": player.volumeLevel
                                });
                                if (support.mutedAutoplay && autoplay) {
                                    videoTag.muted = true;
                                }

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
                                            liveResumePosition = player.dvr
                                                ? updatedVideo.seekOffset
                                                : player.live
                                                    ? hls.liveSyncPosition
                                                    : 0,
                                            buffered = videoTag.buffered,
                                            i,
                                            buffends = [],
                                            src = updatedVideo.src,
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
                                            if (ct < liveResumePosition) {
                                                videoTag.currentTime = liveResumePosition;
                                            }
                                            break;
                                        case "seek":
                                            removePoster();
                                            if (!hlsUpdatedConf.bufferWhilePaused && videoTag.paused) {
                                                hls.stopLoad();
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
                                            for (i = 0; i < buffered.length; i += 1) {
                                                buffends.push(buffered.end(i));
                                            }
                                            arg = buffends.filter(function (b) {
                                                return b >= ct;
                                            }).sort()[0];
                                            updatedVideo.buffer = arg;
                                            break;
                                        case "finish":
                                            if (hlsUpdatedConf.bufferWhilePaused && hls.autoLevelEnabled &&
                                                    (updatedVideo.loop || conf.playlist.length < 2 || conf.advance === false)) {
                                                hls.nextLoadLevel = maxLevel;
                                            }
                                            break;
                                        case "error":
                                            errorCode = videoTag.error && videoTag.error.code;

                                            if ((hlsUpdatedConf.recoverMediaError && (errorCode === 3 || !errorCode)) ||
                                                    (hlsUpdatedConf.recoverNetworkError && errorCode === 2) ||
                                                    (hlsUpdatedConf.recover && (errorCode === 2 || errorCode === 3))) {
                                                e.preventDefault();
                                                doRecover(conf, flow, errorCode === 2);
                                                return;
                                            }

                                            arg = handleError(errorCode, src);
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
                                        player.engine.unload();
                                    }

                                }).on("beforeseek." + engineName, function (e, api, pos) {
                                    if (pos === undefined) {
                                        e.preventDefault();
                                    } else if (!hlsUpdatedConf.bufferWhilePaused && api.paused) {
                                        hls.startLoad(pos);
                                    }
                                });

                                if (!coreV6) {
                                    player.on("quality." + engineName, function (_e, _api, q) {
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
                                common.find("track", videoTag).forEach(common.removeNode);
                                common.removeClass(videoTag, "native-subtitles");
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

                            hls = new Hls(hlsClientConf);
                            player.engine[engineName] = hls;
                            recoverMediaErrorDate = null;
                            swapAudioCodecDate = null;
                            player.disableSubtitles();
                            hlsSubtitles = {};

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
                                    case "MANIFEST_PARSED":
                                        if (hlsQualitiesSupport(conf) &&
                                                !(!coreV6 && player.pluginQualitySelectorEnabled)) {
                                            initQualitySelection(hlsQualitiesConf, hlsUpdatedConf, data);
                                        } else if (coreV6) {
                                            delete player.quality;
                                        }
                                        break;
                                    case "MANIFEST_LOADED":
                                        initAudio(data);
                                        break;
                                    case "SUBTITLE_TRACKS_UPDATED":
                                        initSubtitles(data, hlsUpdatedConf);
                                        break;
                                    case "MEDIA_ATTACHED":
                                        hls.loadSource(src);
                                        break;
                                    case "FRAG_LOADED":
                                        if (data.frag.type === "subtitle" && hlsUpdatedConf.subtitles && !nativeSubs) {
                                            updateSubtitles(data, conf);
                                        }
                                        if (hlsUpdatedConf.bufferWhilePaused && !player.live &&
                                                hls.autoLevelEnabled && hls.nextLoadLevel > maxLevel) {
                                            maxLevel = hls.nextLoadLevel;
                                        }
                                        break;
                                    case "SUBTITLE_TRACK_SWITCH":
                                        if (nativeSubs) {
                                            [].forEach.call(videoTag.textTracks, function (track) {
                                                track.mode = (hls.subtitleTracks[data.id].lang === track.language &&
                                                        track.kind === "subtitles")
                                                    ? "showing"
                                                    : "hidden";
                                            });
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

                                                var txt = uint8ArrayToString(sample.unit || sample.data);

                                                player.trigger('metadata', [player, {
                                                    key: txt.substr(10, 4),
                                                    data: txt
                                                }]);
                                            };
                                            bean.on(videoTag, 'timeupdate.' + engineName, metadataHandler);
                                        });
                                        break;
                                    case "LEVEL_UPDATED":
                                        if (player.live) {
                                            extend(updatedVideo, {
                                                seekOffset: data.details.fragments[0].start + hls.config.nudgeOffset,
                                                duration: hls.liveSyncPosition
                                            });
                                            if (player.dvr && player.playing) {
                                                player.trigger('dvrwindow', [player, {
                                                    start: updatedVideo.seekOffset,
                                                    end: hls.liveSyncPosition
                                                }]);
                                            }
                                        }
                                        break;
                                    case "LEVEL_SWITCHED":
                                        if (hlsUpdatedConf.audioABR) {
                                            player.one("buffer." + engineName, function (_e, api, buffer) {
                                                if (buffer > api.video.time) {
                                                    audioAutoSwitch(data.level);
                                                }
                                            });
                                        }
                                        break;
                                    case "BUFFER_APPENDED":
                                        common.removeClass(root, recoveryClass);
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
                                                errobj = handleError(fperr, src, data.url);
                                                player.trigger("error", [player, errobj]);
                                            }
                                        } else if (data.details === ERRORDETAILS.FRAG_LOOP_LOADING_ERROR ||
                                                data.details === ERRORDETAILS.BUFFER_STALLED_ERROR) {
                                            common.addClass(root, recoveryClass);
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

                            if (autoplay && videoTag.paused) {
                                var playPromise = videoTag.play();
                                if (playPromise !== undefined) {
                                    playPromise.catch(function () {
                                        if (!support.mutedAutoplay) {
                                            player.unload();
                                            if (!coreV6) {
                                                player.message("Please click the play button", 3000);
                                            }
                                        }
                                    });
                                }
                            }
                        },

                        resume: function () {
                            videoTag.play();
                        },

                        pause: function () {
                            videoTag.pause();
                        },

                        seek: function (time) {
                            if (videoTag) {
                                videoTag.currentTime = time;
                            }
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

                                player.disableSubtitles();
                                hls.destroy();
                                hls = 0;
                                qClean();
                                removeAudioMenu();
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
            engineImpl[engineName + "ClientVersion"] = Hls.version;
            engineImpl.canPlay = function (type, conf) {
                if (conf[engineName] === false || conf.clip[engineName] === false) {
                    // engine disabled for player
                    return false;
                }

                // merge hlsjs clip config at earliest opportunity
                hlsconf = extend({
                    bufferWhilePaused: true,
                    smoothSwitching: true,
                    recoverMediaError: true
                }, conf[engineName], conf.clip[engineName]);

                // https://github.com/dailymotion/hls.js/issues/9
                return isHlsType(type) && (!(brwsr.safari && support.dataload) || hlsconf.safari);
            };

            flowplayer(function (api, root) {
                var c = api.conf;

                if (coreV6) {
                    // to take precedence over VOD quality selector
                    api.pluginQualitySelectorEnabled = hlsQualitiesSupport(c) &&
                            engineImpl.canPlay("application/x-mpegurl", c);

                } else if (support.mutedAutoplay && !c.splash && !c.autoplay &&
                        (version === "7.1.0" || version === "7.0.0")) {
                    // issue #94
                    api.splash = true;
                    c.splash = typeof c.poster === "string"
                        ? c.poster
                        : true;
                    c.poster = undefined;
                    c.autoplay = true;
                    destroyVideoTag(root);
                }
            });

            // put on top of engine stack
            // so hlsjs is tested before html5 video hls and flash hls
            flowplayer.engines.unshift(engineImpl);
        }

    };
    if (typeof module === 'object' && module.exports) {
        module.exports = extension.bind(undefined, require('hls.js'));
    } else if (window.Hls && window.flowplayer) {
        extension(window.Hls, window.flowplayer);
    }
}());
