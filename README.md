Flowplayer hlsjs plugin
===========================

This plugin provides the `hlsjs` [engine](https://flowplayer.org/docs/api.html#engines) for
playback of [HLS](https://flowplayer.org/docs/setup.html#hls) streams in browsers which do not
support playback of HLS in a VIDEO tag, and without the need for
[Flash](https://flowplayer.org/docs/setup.html#flash-hls).

The plugin relies on the [hls.js](https://github.com/dailymotion/hls.js) client, courtesy of
[dailymotion](http://www.dailymotion.com).

Usage
-----

In production simply load the latest plugin after the Flowplayer script:

```html
<script src="//releases.flowplayer.org/6.0.3/flowplayer.min.js"></script>
<script src="//releases.flowplayer.org/hlsjs/flowplayer.hlsjs.min.js"></script>
```

Sources configuration:

```js
clip: {
   sources: [
        { type: "application/x-mpegurl", src: "//example.com/video.m3u8" },
        { type: "video/webm",            src: "//example.com/video.webm" },
        { type: "video/mp4",             src: "//example.com/video.mp4" }
   ]
}
```

Plugin configuration
--------------------

The plugin provides the following `hlsjs` option on the
[player](https://flowplayer.org/docs/setup.html#player-options) and 
[clip](https://flowplayer.org/docs/setup.html#player-options) levels.

The `hlsjs` option accepts all
[configuration parameters for hls.js](https://github.com/dailymotion/hls.js/blob/master/API.md#fine-tuning)
which are passed on to the client.

CORS
----

The HLS streams must be loaded from a server with a
[cross domain policy](https://flowplayer.org/docs/setup.html#cross-domain) permitting `GET`
requests.


<!--
Demo
----

A fully documented demo can be found [here](http://demos.flowplayer.org/api/hlsjs.html).
-->

Features
--------

- packs a compatibility tested version - current:
  https://github.com/dailymotion/hls.js/commit/e912b424c1930b7858cc44ac86e71f22273091ea - of
  hls.js
- engine is only loaded if the browser supports
  [MediaSource extensions](http://w3c.github.io/media-source/) reliably for playback

## Upcoming

Manual quality switching.

Debugging
---------

A quick way to find out whether there's a problem with the acutal plugin component is to
run your stream in the [hls.js demo player](http://dailymotion.github.io/hls.js/demo/).

For fine grained debugging load the unminified components and turn hlsjs debugging on:

```html
<script src="//releases.flowplayer.org/6.0.3/flowplayer.min.js"></script>
<!-- unminified hls.js library -->
<script src="//releases.flowplayer.org/hlsjs/hls.js"></script>
<!-- separate hlsjs plugin component -->
<script src="//releases.flowplayer.org/hlsjs/flowplayer.hlsjs.js"></script>

<script>
// turn on hlsjs debugging
flowplayer.conf.hlsjs = {
  debug: true
});
</script>
```

Known issues
------------

- Safari's MSE implementation has fatal problems with
  [fragmented MP4 playback](https://github.com/dailymotion/hls.js/issues/9) - for the moment the
  hlsjs engine will only be loaded in Safari for [debugging purposes](#debugging).
- not tested with live streams by lack of examples where CORS is enabled on the server
- encrypted streams not yet supported
