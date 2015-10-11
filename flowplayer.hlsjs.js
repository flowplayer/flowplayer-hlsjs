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
        extend = flowplayer.extend,

        engineImpl = function hlsjsEngine(player, root) {
            var bean = flowplayer.bean,
                common = flowplayer.common,
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
                        if (hls) {
                            hls.destroy();
                        }
                        common.removeNode(common.findDirect("video", root)[0] || common.find(".fp-player > video", root)[0]);
                        videoTag = common.createElement("video");

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
                            var posterClass = "is-poster";

                            extend(video, {
                                duration: videoTag.duration,
                                seekable: videoTag.seekable.end(null),
                                width: videoTag.videoWidth,
                                height: videoTag.videoHeight,
                                url: videoTag.currentSrc
                            });
                            player.trigger('ready', [player, video]);

                            // fix timing for poster class
                            if (common.hasClass(root, posterClass)) {
                                player.on("stop.hlsjs", function () {
                                    setTimeout(function () {
                                        common.addClass(root, posterClass);
                                        bean.one(videoTag, "play.hlsjs", function () {
                                            common.removeClass(root, posterClass);
                                        });
                                    }, 0);
                                });
                            }

                            if (player.conf.autoplay) {
                                // let the fp API take care of autoplay
                                videoTag.play();
                            }
                        });
                        bean.on(videoTag, "seeked", function () {
                            player.trigger('seek', [player, videoTag.currentTime]);
                        });
                        bean.on(videoTag, "progress", function (e) {
                            try {
                                var buffered = videoTag.buffered,
                                    buffer = buffered.end(null), // first loaded buffer
                                    ct = videoTag.currentTime,
                                    buffend = 0,
                                    i;

                                // buffered.end(null) will not always return the current buffer
                                // so we cycle through the time ranges to obtain it
                                if (ct) {
                                    for (i = 1; i < buffered.length; i += 1) {
                                        buffend = buffered.end(i);

                                        if (buffend >= ct && buffered.start(i) <= ct) {
                                            buffer = buffend;
                                        }
                                    }
                                }
                                video.buffer = buffer;
                            } catch (ignored) {}
                            player.trigger('buffer', [player, e]);
                        });
                        bean.on(videoTag, "ended", function () {
                            player.trigger('finish', [player]);
                        });
                        bean.on(videoTag, "volumechange", function () {
                            player.trigger('volume', [player, videoTag.volume]);
                        });

                        videoTag.className = 'fp-engine hlsjs-engine';
                        common.prepend(common.find(".fp-player", root)[0], videoTag);

                        hls = new Hls(hlsconf);

                        hls.on(Hls.Events.MSE_ATTACHED, function () {
                            hls.loadSource(video.src);

                        }).on(Hls.Events.ERROR, function (e, data) {
                            var fperr,
                                errobj;

                            if (data.fatal) {
                                // try recovery?
                                switch (data.type) {
                                case Hls.ErrorTypes.NETWORK_ERROR:
                                    // in theory should be 3 (Network error)
                                    fperr = 4;
                                    break;
                                case Hls.ErrorTypes.MEDIA_ERROR:
                                    fperr = 3;
                                    break;
                                default:
                                    fperr = 5;
                                    break;
                                }
                                errobj = {code: fperr};
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
                        player.trigger('unload', [player]);
                        if (hls && player.conf.splash) {
                            hls.destroy();
                            common.find("video.fp-engine", root).forEach(common.removeNode);
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
                    (IE11 || !flowplayer.support.browser.safari || hlsconf.debug);
        };

        // put on top of engine stack
        // so hlsjs is tested before html5 video hls and flash hls
        flowplayer.engines.unshift(engineImpl);
    }

}());
