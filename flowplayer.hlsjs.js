/*jslint browser: true, for: true */
/*global Hls, flowplayer */

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

*/

(function () {
    "use strict";
    var engineName = "hlsjs",
        hlsconf,
        common = flowplayer.common,
        extend = flowplayer.extend,
        client = flowplayer.support.browser,

        engineImpl = function hlsjsEngine(player, root) {
            var bean = flowplayer.bean,
                videoTag,
                hls,

                engine = {
                    engineName: engineName,

                    pick: function (sources) {
                        var i,
                            source;

                        for (i = 0; i < sources.length; i += 1) {
                            source = sources[i];
                            if (/mpegurl/i.test(source.type) && (!source.engine || source.engine === "hlsjs")) {
                                return source;
                            }
                        }
                    },

                    load: function (video) {
                        var init = !hls,
                            conf = player.conf;

                        if (init) {
                            common.removeNode(common.findDirect("video", root)[0] || common.find(".fp-player > video", root)[0]);
                            videoTag = common.createElement("video", {
                                className: "fp-engine hlsjs-engine",
                                autoplay: conf.autoplay
                                    ? "autoplay"
                                    : false
                            });
                        } else {
                            hls.destroy();
                        }

                        videoTag.setAttribute("x-webkit-airplay", "allow");

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

                        hls = new Hls(hlsconf);

                        hls.on(Hls.Events.MSE_ATTACHED, function () {
                            hls.loadSource(video.src);

                            videoTag.load();
                            if (videoTag.paused && (video.autoplay || conf.autoplay)) {
                                videoTag.play();
                            }

                        }).on(Hls.Events.ERROR, function (e, data) {
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
                        hls.attachVideo(videoTag);
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

            return engine;
        };

    if (Hls.isSupported()) {
        // only load engine if it can be used
        engineImpl.engineName = engineName; // must be exposed
        engineImpl.canPlay = function (type, conf) {
            var UA = navigator.userAgent,
                IE11 = UA.indexOf("Trident/7") > -1;

            if (conf.hlsjs === false || conf.clip.hlsjs === false) {
                // engine disabled for player or clip
                return false;
            }

            // merge hlsjs clip config at earliest opportunity
            hlsconf = extend({}, conf.hlsjs, conf.clip.hlsjs);

            // support Safari only when hlsjs debugging
            // https://github.com/dailymotion/hls.js/issues/9
            return /mpegurl/i.test(type) &&
                    (IE11 || !client.safari || hlsconf.debug);
        };

        // put on top of engine stack
        // so hlsjs is tested before html5 video hls and flash hls
        flowplayer.engines.unshift(engineImpl);


        // poster hack
        flowplayer(function (api, root) {
            // detect poster condition as in core on boot
            var bc = common.css(root, 'backgroundColor'),
                has_bg = common.css(root, 'backgroundImage') !== "none" ||
                        (bc && bc !== "rgba(0, 0, 0, 0)" && bc !== "transparent"),
                posterCondition = has_bg && !api.conf.splash && !api.conf.autoplay,

                posterHack = function (e) {
                    api.off("seek.hlsjs");

                    //if (api.engine.engineName === engineName) {
                    // omitting this condition which would confine the hack to
                    // the hlsjs engine works around
                    // https://github.com/flowplayer/flowplayer/issues/942

                    // Firefox does not catch the first seek after pause
                    if (e.type.stop || client.chrome || client.opera) {
                        setTimeout(function () {
                            var posterClass = "is-poster";

                            common.addClass(root, posterClass);
                            api.one("resume", function () {
                                common.removeClass(root, posterClass);
                            });
                        }, 0);
                    }
                };

            if (posterCondition) {
                // setup once at first load
                api.one("load", function (e, api) {
                    // one("seek") is not reliable as it's caught only
                    // with playlists, so will be off'd in posterHack
                    api.on("seek.hlsjs", posterHack).on("stop.hlsjs", posterHack);
                });
            }
        });
    }

}());
