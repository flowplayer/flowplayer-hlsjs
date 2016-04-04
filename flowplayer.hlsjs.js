/*jslint browser: true, for: true, node: true */
/*global window */

/*!

   hlsjs engine plugin for Flowplayer HTML5

   Copyright (c) 2015-2016, Flowplayer Oy

   Released under the MIT License:
   http://www.opensource.org/licenses/mit-license.php

   Includes hls.js
   Copyright (c) 2015 Dailymotion (http://www.dailymotion.com)
   https://github.com/dailymotion/hls.js/blob/master/LICENSE

   requires:
   - Flowplayer HTML5 version 6.x or greater
   - hls.js https://github.com/dailymotion/hls.js
   revision: $GIT_ID$

*/

(function (flowplayer, Hls) {
    "use strict";
    var engineName = "hlsjs",
        hlsconf,
        common = flowplayer.common,
        extend = flowplayer.extend,
        support = flowplayer.support,
        version = flowplayer.version,

        isHlsType = function (typ) {
            return typ.toLowerCase().indexOf("mpegurl") > -1;
        },
        hlsQualitiesSupport = function (conf) {
            var hlsQualities = conf.clip.hlsQualities || conf.hlsQualities;

            return support.inlineVideo &&
                    (hlsQualities === true ||
                    (hlsQualities && hlsQualities.length));
        },

        engineImpl = function hlsjsEngine(player, root) {
            var bean = flowplayer.bean,
                videoTag,
                hls,
                recover,

                // pre 6.0.4 poster detection
                bc,
                has_bg,

                getStartLevelConf = function () {
                    var value = hlsconf.startLevel;

                    switch (value) {
                    case "auto":
                        value = -1;
                        break;
                    case "firstLevel":
                        value = undefined;
                        break;
                    }
                    return value;
                },

                disableAutoLevel = 0,
                setStickyLevel = function () {
                    hls.nextLevel = hls[disableAutoLevel];
                    disableAutoLevel = 0;
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
                initQualitySelection = function (hlsQualitiesConf, data) {
                    var levels = data.levels,
                        levelIndex = 0,
                        selector;

                    qClean();
                    player.hlsQualities = [];
                    levels.forEach(function (level) {
                        // do not check audioCodec,
                        // as e.g. HE_AAC is decoded as LC_AAC by hls.js on Android
                        if ((hlsQualitiesConf === true || hlsQualitiesConf.indexOf(levelIndex) > -1) &&
                                (!level.videoCodec ||
                                (level.videoCodec &&
                                window.MediaSource.isTypeSupported('video/mp4;codecs=' + level.videoCodec)))) {
                            player.hlsQualities.push(levelIndex);
                        }
                        levelIndex += 1;
                    });
                    if (player.hlsQualities.length < 2) {
                        return;
                    }

                    player.qualities = [];
                    player.hlsQualities.forEach(function (levelIndex) {
                        var level = levels[levelIndex],
                            width = level.width,
                            height = level.height,
                            label = (width && height)
                                ? Math.min(width, height) + "p"
                                : "Level " + (levelIndex + 1);

                        player.qualities.push(label);
                    });

                    selector = common.createElement("ul", {
                        "class": "fp-quality-selector"
                    });
                    common.find(".fp-ui", root)[0].appendChild(selector);

                    player.hlsQualities.unshift(-1);

                    if (!player.quality || player.qualities.indexOf(player.quality) < 0) {
                        hls.startLevel = getStartLevelConf();
                        player.quality = "abr";
                    } else {
                        hls.startLevel = qIndex();
                        disableAutoLevel = "startLevel";
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
                            paused,
                            i;

                        if (common.hasClass(choice, qActive)) {
                            return;
                        }

                        selectors = common.find(".fp-quality-selector li", root);

                        for (i = 0; i < selectors.length; i += 1) {
                            active = selectors[i] === choice;
                            if (active) {
                                player.quality = i > 0
                                    ? player.qualities[i - 1]
                                    : "abr";
                                paused = player.paused;
                                if (paused) {
                                    player.resume();
                                }
                                if (hlsconf.smoothSwitching && !paused) {
                                    hls.nextLevel = qIndex();
                                } else {
                                    hls.currentLevel = qIndex();
                                }
                                common.addClass(choice, qActive);
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
                                volumechange: "volume"
                            },
                            autoplay = !!video.autoplay || !!conf.autoplay,
                            posterClass = "is-poster",
                            hlsQualitiesConf = video.hlsQualities || conf.hlsQualities,
                            hlsClientConf = extend({}, hlsconf),
                            hlsParams = [
                                "autoLevelCapping", "startLevel",
                                "adaptOnStartOnly", "smoothSwitching",
                                "anamorphic", "recover", "strict"
                            ];

                        if (!hls) {
                            common.removeNode(common.findDirect("video", root)[0]
                                    || common.find(".fp-player > video", root)[0]);
                            videoTag = common.createElement("video", {
                                "class": "fp-engine " + engineName + "-engine",
                                "autoplay": autoplay
                                    ? "autoplay"
                                    : false,
                                "preload": conf.clip.preload || "metadata",
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

                                    var ct,
                                        buffered,
                                        buffer = 0,
                                        buffend = 0,
                                        i,
                                        quality = player.quality,
                                        selectorIndex;

                                    switch (flow) {
                                    case "ready":
                                        arg = extend(video, {
                                            duration: videoTag.duration,
                                            seekable: videoTag.seekable.end(null),
                                            width: videoTag.videoWidth,
                                            height: videoTag.videoHeight,
                                            url: videoTag.currentSrc
                                        });
                                        break;
                                    case "resume":
                                        if (player.poster) {
                                            player.poster = false;
                                            common.removeClass(root, posterClass);
                                        }
                                        break;
                                    case "seek":
                                    case "progress":
                                        arg = videoTag.currentTime;
                                        break;
                                    case "speed":
                                        arg = videoTag.playbackRate;
                                        break;
                                    case "volume":
                                        arg = videoTag.volume;
                                        break;
                                    case "buffer":
                                        try {
                                            ct = videoTag.currentTime;
                                            if (ct) {
                                                // cycle through time ranges to obtain buffer
                                                // nearest current time
                                                buffered = videoTag.buffered;
                                                for (i = buffered.length - 1; i > -1; i -= 1) {
                                                    buffend = buffered.end(i);
                                                    if (buffend >= ct) {
                                                        buffer = buffend;
                                                    }
                                                }
                                            }
                                        } catch (ignore) {}
                                        video.buffer = buffer;
                                        arg = e;
                                        break;
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

                            if (conf.poster) {
                                // engine too late, poster already removed
                                // abuse timeupdate to re-instate poster
                                player.on("stop." + engineName, function () {
                                    bean.one(videoTag, "timeupdate." + engineName, function () {
                                        player.poster = true;
                                        common.addClass(root, posterClass);
                                    });
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
                            videoTag.type = video.type;
                            videoTag.src = video.src;

                        }

                        hlsParams.forEach(function (key) {
                            var value = hlsconf[key];

                            delete hlsClientConf[key];

                            switch (key) {
                            case "adaptOnStartOnly":
                                if (value) {
                                    hlsClientConf.startLevel = -1;
                                    disableAutoLevel = "currentLevel";
                                }
                                break;
                            case "autoLevelCapping":
                                if (value === false) {
                                    value = -1;
                                }
                                break;
                            case "recover":
                                recover = hlsconf.strict
                                    ? 0
                                    : value;
                                break;
                            case "startLevel":
                                value = (player.hlsQualities && player.quality)
                                    ? qIndex()
                                    : getStartLevelConf();
                                break;
                            }

                            if ((key === "autoLevelCapping" || key === "startLevel") && value !== undefined) {
                                hlsClientConf[key] = value;
                            }
                        });

                        hlsClientConf.autoStartLoad = false;

                        hls = new Hls(hlsClientConf);
                        player.engine[engineName] = hls;

                        Object.keys(Hls.Events).forEach(function (key) {
                            hls.on(Hls.Events[key], function (etype, data) {
                                var fperr,
                                    errobj = {};

                                switch (key) {
                                case "MANIFEST_PARSED":
                                    if (hlsQualitiesSupport(conf)) {
                                        initQualitySelection(hlsQualitiesConf, data);
                                    } else {
                                        delete player.quality;
                                    }
                                    hls.startLoad();
                                    break;

                                case "FRAG_LOADED":
                                    if (disableAutoLevel === "startLevel") {
                                        // qsel
                                        setStickyLevel();
                                    }
                                    break;

                                case "FRAG_CHANGED":
                                    if (disableAutoLevel === "currentLevel" && player.ready) {
                                        // adaptOnStartOnly
                                        setStickyLevel();
                                    }
                                    break;

                                case "ERROR":
                                    if (data.fatal || hlsconf.strict) {
                                        switch (data.type) {
                                        case Hls.ErrorTypes.NETWORK_ERROR:
                                            if (recover) {
                                                hls.startLoad();
                                                if (recover > 0) {
                                                    recover -= 1;
                                                }
                                            } else if (data.frag && data.frag.url) {
                                                errobj.url = data.frag.url;
                                                fperr = 2;
                                            } else {
                                                fperr = 4;
                                            }
                                            break;
                                        case Hls.ErrorTypes.MEDIA_ERROR:
                                            if (recover) {
                                                hls.recoverMediaError();
                                                if (recover > 0) {
                                                    recover -= 1;
                                                }
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
                                                errobj.video = extend(video, {
                                                    src: video.src,
                                                    url: data.url || video.src
                                                });
                                            }
                                            player.trigger("error", [player, errobj]);
                                        }
                                    }
                                    break;
                                }

                                player.trigger(etype, [player, data]);
                            });
                        });

                        hls.attachMedia(videoTag);
                        hls.loadSource(video.src);

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
                            bean.off(root, "." + engineName);
                            player.off("." + engineName);
                            qClean();
                            hls.destroy();
                            hls = 0;
                            bean.off(videoTag, "." + engineName);
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
                wn = window.navigator,
                IE11 = wn.userAgent.indexOf("Trident/7") > -1;

            if (conf[engineName] === false || conf.clip[engineName] === false) {
                // engine disabled for player or clip
                return false;
            }

            // merge hlsjs clip config at earliest opportunity
            hlsconf = extend({
                smoothSwitching: true,
                recover: 0
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

}.apply(null, (typeof module === 'object' && module.exports)
    ? [require('flowplayer'), require('hls.js')]
    : [window.flowplayer, window.Hls]));
