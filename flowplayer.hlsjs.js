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
    var win = window,
        engineName = "hlsjs",
        support = flowplayer.support,
        clientSupport = support.video && win.MediaSource,
        extend = flowplayer.extend,

        engineImpl = function hlsjsEngine(player, root) {
            var bean = flowplayer.bean,
                common = flowplayer.common,
                videoTag,
                hls = new Hls({
                    debug: player.conf.debug
                });

                engine = {
                    engineName: engineName,

                    pick: function (sources) {
                        var i,
                            source;

                        for (i = 0; i < sources.length; i = i + 1) {
                            source = sources[i];
                            if (/mpegurl/i.test(source.type) && (!source.engine || source.engine == "hlsjs")) {
                                return source;
                            }
                        }
                    },

                    load: function (video) {
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
                            extend(video, {
                                duration: videoTag.duration,
                                seekable: videoTag.seekable.end(null),
                                width: videoTag.videoWidth,
                                height: videoTag.videoHeight,
                                url: videoTag.currentSrc
                            });
                            player.trigger('ready', [player, video]);

                            // fix timing for poster class
                            var poster = "is-poster";
                            if (common.hasClass(root, poster)) {
                                player.on("stop.hlsjs", function () {
                                    setTimeout(function () {
                                        common.addClass(root, poster);
                                        bean.one(videoTag, "play.hlsjs", function () {
                                            common.removeClass(root, poster);
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
                                    for (i = 1; i < buffered.length; i = i + 1) {
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
                            /*
                            if (support.browser.safari && !player.conf.autoplay) {
                                bean.one(videoTag, "seeked.hlsjsreplay", function () {
                                    if (!videoTag.currentTime) {
                                        videoTag.play();
                                    }
                                });
                            }
                            */
                        });
                        bean.on(videoTag, "volumechange", function () {
                            player.trigger('volume', [player, videoTag.volume]);
                        });

                        videoTag.className = 'fp-engine hlsjs-engine';
                        common.prepend(common.find(".fp-player", root)[0], videoTag);

                        hls.on(Hls.Events.ERROR, function (e, data) {
                            var fperr,
                                errtypes = Hls.ErrorTypes,
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
                                        url: video.src
                                    });
                                }
                                player.trigger('error', [player, errobj]);
                            }
                            /* TODO: */
                            // log non fatals
                        });

                        player.on("error", function () {
                            hls.destroy();
                        });

                        hls.attachVideo(videoTag);
                        hls.on(Hls.Events.MSE_ATTACHED, function () {
                            hls.loadSource(video.src);
                        });
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
                        /*
                        if (player.video.live && player.paused) {
                            videoTag.play();
                        }
                        */
                        if (player.conf.splash) {
                            hls.detachVideo();
                        }
                        player.trigger('unload', [player]);
                    }
                };

            return engine;
        };

    if (clientSupport) {
        // only load engine if it can be used
        engineImpl.engineName = engineName; // must be exposed
        engineImpl.canPlay = function (type, conf) {
            var hlsjsconf = conf.hlsjs;

            /*
              WARNING: MediaSource.isTypeSupported very inconsistent!
              e.g. Safari ignores codecs entirely, even bogus, like codecs="XYZ"
              example avc1 main level 3.1 + aac_he: avc1.4d401e, mp4a.40.5
              example avc1 high level 4.1 + aac_lc: avc1.640029; mp4a.40.2
              hls.js check (extended baseline): avc1.42e01e, mp4a.40.2

              default: avc1 constrained baseline level 3.0 + aac_lc
            */
            conf.hlsjs = extend({
                type: "video/mp4",
                codecs: "avc1.42c00d, mp4a.40.2"
            }, hlsjsconf);
            if (/mpegurl/i.test(type)) {
                return win.MediaSource.isTypeSupported(conf.hlsjs.type + '; codecs="' + conf.hlsjs.codecs + '"');
            }
            return false;
        };

        // put on top of engine stack
        // so hlsjs is tested before html5
        flowplayer.engines.unshift(engineImpl);
    }

}());
