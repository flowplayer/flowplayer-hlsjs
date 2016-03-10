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

        engineImpl = function hlsjsEngine(player, root) {
            var bean = flowplayer.bean,
                videoTag,
                hls,
                recover,

                bc,
                has_bg,
                posterHack = function () {
                    // abuse timeupdate to re-instate poster
                    var posterClass = "is-poster",
                        etype = "progress." + engineName;

                    player.one(etype, function () {
                        common.addClass(root, posterClass);
                        player.poster = true;
                        player.one(etype, function () {
                            common.removeClass(root, posterClass);
                            player.poster = false;
                        });
                    });
                },

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
                    player.qualities = [];
                    removeAllQualityClasses();
                    common.find(".fp-quality-selector li", root).forEach(bean.off);
                    common.find(".fp-quality-selector", root).forEach(common.removeNode);
                },
                qIndex = function () {
                    return player.hlsQualities[player.qualities.indexOf(player.quality) + 1];
                },
                initQualitySelection = function (hlsQualitiesConf, data) {
                    var levels = data.levels,
                        levelIndex = 0,
                        selector;

                    player.hlsQualities = [];
                    levels.forEach(function (level) {
                        if ((hlsQualitiesConf === true || hlsQualitiesConf.indexOf(levelIndex) > -1) &&
                                level.videoCodec &&
                                window.MediaSource.isTypeSupported('video/mp4;codecs=' + level.videoCodec)) {
                            // do not check audioCodec,
                            // as e.g. HE_AAC is decoded as LC_AAC by hls.js on Android
                            player.hlsQualities.push(levelIndex);
                        }
                        levelIndex += 1;
                    });
                    if (player.hlsQualities.length < 2) {
                        qClean();
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
                        // disable autoLevel at earliest opportunity
                        player.one("hlsFragChanged.qsel", function () {
                            hls.currentLevel = hls.startLevel;
                        });
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

                    bean.on(root, "click", ".fp-quality-selector li", function (e) {
                        var choice = e.currentTarget,
                            selectors,
                            active,
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
                                if (hlsconf.smoothSwitching) {
                                    hls.nextLevel = qIndex();
                                } else {
                                    hls.currentLevel = qIndex();
                                }
                                player.resume();
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
                            if (isHlsType(source.type)
                                    && (!source.engine || source.engine === engineName)) {
                                if (typeof source.src === 'string') {
                                    source.src = common.createAbsoluteUrl(source.src);
                                }
                                return source;
                            }
                        }
                    },

                    load: function (video) {
                        var init = !hls,
                            conf = player.conf,
                            hlsQualitiesConf = conf.clip.hlsQualities || conf.hlsQualities,
                            hlsClientConf = extend({}, hlsconf),
                            hlsParams = [
                                "anamorphic", "autoLevelCapping", "recover",
                                "smoothSwitching", "startLevel", "strict"
                            ],
                            hlsEvents = [
                                "MEDIA_ATTACHING", "MEDIA_ATTACHED", "MEDIA_DETACHING", "MEDIA_DETACHED",
                                "MANIFEST_LOADING", "MANIFEST_LOADED", "MANIFEST_PARSED",
                                "LEVEL_LOADING", "LEVEL_LOADED", "LEVEL_UPDATED", "LEVEL_PTS_UPDATED", "LEVEL_SWITCH",
                                "KEY_LOADING", "KEY_LOADED",
                                "FRAG_LOADING", "FRAG_LOAD_PROGRESS", "FRAG_LOADED",
                                "FRAG_PARSING_INIT_SEGMENT", "FRAG_PARSING_METADATA", "FRAG_PARSING_DATA", "FRAG_PARSED",
                                "FRAG_BUFFERED", "FRAG_CHANGED",
                                "FPS_DROP",
                                "DESTROYING",
                                "ERROR"
                            ];

                        if (init) {
                            common.removeNode(common.findDirect("video", root)[0]
                                    || common.find(".fp-player > video", root)[0]);
                            videoTag = common.createElement("video", {
                                className: "fp-engine " + engineName + "-engine",
                                autoplay: conf.autoplay
                                    ? "autoplay"
                                    : false
                            });
                            videoTag.setAttribute("x-webkit-airplay", "allow");

                        } else {
                            hls.destroy();
                        }

                        bean.on(videoTag, "play", function () {
                            player.trigger('resume', [player]);
                        });
                        bean.on(videoTag, "pause", function () {
                            player.trigger('pause', [player]);
                        });
                        bean.on(videoTag, "timeupdate", function () {
                            player.trigger('progress', [player, videoTag.currentTime]);
                        });
                        bean.on(videoTag, "loadeddata", function () {
                            video = extend(video, {
                                duration: videoTag.duration,
                                seekable: videoTag.seekable.end(null),
                                width: videoTag.videoWidth,
                                height: videoTag.videoHeight,
                                url: videoTag.currentSrc
                            });
                            player.trigger('ready', [player, video]);

                            var quality = player.quality,
                                selectorIndex;

                            if (quality) {
                                selectorIndex = quality === "abr"
                                    ? 0
                                    : player.qualities.indexOf(quality) + 1;
                                common.addClass(common.find(".fp-quality-selector li", root)[selectorIndex], qActive);
                            }
                        });
                        bean.on(videoTag, "seeked", function () {
                            player.trigger('seek', [player, videoTag.currentTime]);
                        });
                        bean.on(videoTag, "progress", function (e) {
                            var ct = videoTag.currentTime,
                                buffer = 0,
                                buffend,
                                buffered,
                                last,
                                i;

                            try {
                                buffered = videoTag.buffered;
                                last = buffered.length - 1;
                                buffend = 0;
                                // cycle through time ranges to obtain buffer
                                // nearest current time
                                if (ct) {
                                    for (i = last; i > -1; i -= 1) {
                                        buffend = buffered.end(i);

                                        if (buffend >= ct) {
                                            buffer = buffend;
                                        }
                                    }
                                }
                            } catch (ignore) {}

                            video.buffer = buffer;
                            player.trigger('buffer', [player, e]);
                        });
                        bean.on(videoTag, "ended", function () {
                            player.trigger('finish', [player]);
                        });
                        bean.on(videoTag, "volumechange", function () {
                            player.trigger('volume', [player, videoTag.volume]);
                        });

                        hlsParams.forEach(function (key) {
                            delete hlsClientConf[key];
                        });
                        hls = new Hls(hlsClientConf);
                        player.engine[engineName] = hls;

                        hlsParams.forEach(function (key) {
                            var value = hlsconf[key];

                            switch (key) {
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

                            if (key !== "strict" && key !== "recover" && value !== undefined) {
                                hls[key] = value;
                            }
                        });

                        qClean();

                        hlsEvents.forEach(function (e) {
                            hls.on(Hls.Events[e], function (etype, data) {
                                var fperr,
                                    errobj = {};

                                switch (e) {
                                case "MANIFEST_PARSED":
                                    if (support.inlineVideo && hlsQualitiesConf) {
                                        initQualitySelection(hlsQualitiesConf, data);
                                    } else {
                                        delete player.quality;
                                    }
                                    break;

                                case "ERROR":
                                    if (data.fatal || hlsconf.strict > 0) {
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
                                            player.trigger('error', [player, errobj]);
                                            return;
                                        }
                                    }
                                    // log non fatals?
                                    break;
                                }

                                player.trigger(etype, [player, data]);
                            });
                        });

                        if (init) {
                            common.prepend(common.find(".fp-player", root)[0], videoTag);
                        }

                        hls.loadSource(video.src);
                        hls.attachMedia(videoTag);

                        if (videoTag.paused && (video.autoplay || conf.autoplay)) {
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
                        // hls conditional probably not needed once
                        // https://github.com/flowplayer/flowplayer/commit/871ff783a8f23aa603e1120f4319d4a892125b0a
                        // is released
                        if (hls) {
                            hls.destroy();
                            hls = 0;
                            bean.off(videoTag);
                            common.removeNode(videoTag);
                            videoTag = 0;
                            qClean();
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
            if (player.conf.poster) {
                // when engine is loaded or player stopped
                // the engine is too late to the party:
                // poster is already removed and api.poster is false
                // poster state must be set again
                player.on("ready." + engineName + " stop." + engineName, posterHack);
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
            // hlsQualities must be configure at player or global level
            var hlsQualities = api.conf.hlsQualities || flowplayer.conf.hlsQualities;
            if (hlsQualities) {
                api.pluginQualitySelectorEnabled = engineImpl.canPlay("application/x-mpegurl", api.conf);
            }
        });

    }

}.apply(null, (typeof module === 'object' && module.exports)
    ? [require('flowplayer'), require('hls.js')]
    : [window.flowplayer, window.Hls]));
