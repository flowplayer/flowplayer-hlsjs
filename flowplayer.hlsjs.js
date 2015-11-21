/*jslint browser: true, for: true, node: true */
/*global window */

/*!

   hlsjs engine plugin for Flowplayer HTML5

   Copyright (c) 2015, Flowplayer Oy

   Released under the MIT License:
   http://www.opensource.org/licenses/mit-license.php

   Includes hls.min.js
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
        version = flowplayer.version,

        isHlsType = function (typ) {
            return typ.toLowerCase().indexOf("mpegurl") > -1;
        },

        engineImpl = function hlsjsEngine(player, root) {
            var bean = flowplayer.bean,
                videoTag,
                hls,

                pre604 = /^6\.0\.[0-3]$/.test(version),
                bc = common.css(root, 'backgroundColor'),
                // spaces in rgba arg mandatory for recognition
                has_bg = common.css(root, 'backgroundImage') !== "none" ||
                        (bc && bc !== "rgba(0, 0, 0, 0)" && bc !== "transparent"),
                posterCondition = has_bg && !player.conf.splash
                        && (!pre604 || (pre604 && !player.conf.autoplay)),

                posterHack = function (e) {
                    // assert that poster is set regardless of client of
                    // video loading delay
                    setTimeout(function () {
                        var posterClass = "is-poster";

                        if (!player.conf.autoplay || e.type === "stop") {
                            common.addClass(root, posterClass);
                            if (!pre604) {
                                // must set this ourselves
                                player.poster = true;
                            }
                            player.one("resume." + engineName, function () {
                                common.removeClass(root, posterClass);
                                player.off("seek." + engineName);
                                if (player.poster) {
                                    player.poster = false;
                                }
                            });
                        }
                    }, 0);
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
                            hlsClientConf = extend({}, hlsconf),
                            hlsParams = ["autoLevelCapping", "startLevel", "strict"];

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
                            } catch (ignored) {}

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

                        hlsParams.forEach(function (key) {
                            var value = hlsconf[key];

                            switch (key) {
                            case "autoLevelCapping":
                                if (value === false) {
                                    value = -1;
                                }
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
                                break;
                            }

                            if (value !== undefined) {
                                hls[key] = value;
                            }
                        });

                        hls.on(Hls.Events.ERROR, function (e, data) {
                            var fperr,
                                errobj = {};

                            if (data.fatal || hlsconf.strict) {
                                switch (data.type) {
                                case Hls.ErrorTypes.NETWORK_ERROR:
                                    if (data.frag && data.frag.url) {
                                        errobj.url = data.frag.url;
                                        fperr = 2;
                                    } else {
                                        fperr = 4;
                                    }
                                    break;
                                case Hls.ErrorTypes.MEDIA_ERROR:
                                    fperr = 3;
                                    break;
                                default:
                                    fperr = 5;
                                    break;
                                }
                                errobj.code = fperr;
                                if (fperr > 2) {
                                    errobj.video = extend(video, {
                                        src: video.src,
                                        url: data.url || video.src
                                    });
                                }
                                player.trigger('error', [player, errobj]);
                            }
                            /* TODO: */
                            // log non fatals
                        });

                        if (init) {
                            common.prepend(common.find(".fp-player", root)[0], videoTag);
                        }

                        hls.loadSource(video.src);
                        hls.attachVideo(videoTag);

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
                        }
                    }
                };


            if (posterCondition) {
                player.on("ready." + engineName + " stop." + engineName, posterHack)
                    .one("seek." + engineName, posterHack);
            }

            return engine;
        };

    if (Hls.isSupported() && version.indexOf("5.") !== 0) {
        // only load engine if it can be used
        engineImpl.engineName = engineName; // must be exposed
        engineImpl.canPlay = function (type, conf) {
            var IE11 = navigator.userAgent.indexOf("Trident/7") > -1;

            if (conf[engineName] === false || conf.clip[engineName] === false) {
                // engine disabled for player or clip
                return false;
            }

            // merge hlsjs clip config at earliest opportunity
            hlsconf = extend({}, flowplayer.conf[engineName], conf[engineName], conf.clip[engineName]);

            // support Safari only when hlsjs debugging
            // https://github.com/dailymotion/hls.js/issues/9
            return isHlsType(type) &&
                    (IE11 || !flowplayer.support.browser.safari || hlsconf.debug);
        };

        // put on top of engine stack
        // so hlsjs is tested before html5 video hls and flash hls
        flowplayer.engines.unshift(engineImpl);

    }

}.apply(null, (typeof module === 'object' && module.exports)
    ? [require('flowplayer'), require('hls.js')]
    : [window.flowplayer, window.Hls]));
