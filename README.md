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

See: https://flowplayer.org/docs/plugins.html#hlsjs

- [loading the assets](https://flowplayer.org/docs/plugins.html#hlsjs-assets)
- [configuration](https://flowplayer.org/docs/plugins.html#hlsjs-configuration)
- [hlsjs options](https://flowplayer.org/docs/plugins.html#hlsjs-options)
- [hlsjs API](https://flowplayer.org/docs/plugins.html#hlsjs-api)

### CommonJS

The plugin can be used in a [browserify](http://browserify.org) and/or
[webpack](https://webpack.github.io/) environment with a
[commonjs](http://requirejs.org/docs/commonjs.html) loader:

```js
var flowplayer = require('flowplayer');
require('flowplayer-hlsjs'); // Plugin injects itself to flowplayer

flowplayer('#container', {
  clip: {
    sources: [{
      type: 'application/x-mpegurl',
      src: '//stream.flowplayer.org/bauhaus.m3u8'
    }]
  }
});
```

Demo
----

A fully documented demo can be found [here](http://demos.flowplayer.org/api/hlsjs.html).

Features
--------

- packs a compatibility tested version - current:
  [v0.5.9](https://github.com/dailymotion/hls.js/releases/tag/v0.5.9) - of hls.js
- by default the engine is only loaded if the browser supports
  [MediaSource extensions](http://w3c.github.io/media-source/) reliably for playback
- configurable manual HLS quality selection

Debugging
---------

A quick way to find out whether there's a problem with the actual plugin component is to
run your stream in the [hls.js demo player](http://dailymotion.github.io/hls.js/demo/).

For fine grained debugging load the unminified components and turn hlsjs debugging on:

```html
<script src="//releases.flowplayer.org/6.0.5/flowplayer.min.js"></script>
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

### Building the plugin

Build requirement:

- [nodejs](https://nodejs.org) with [npm](https://www.npmjs.com)

```sh
cd flowplayer-hlsjs
make deps
make
```

Known issues and constraints
----------------------------

- Only codecs which are valid in advanced MP4 video/audio and are supported by MSE are allowed:
  [MPEG-4 AVC](https://en.wikipedia.org/wiki/H.264/MPEG-4_AVC) for video,
  [AAC](https://en.wikipedia.org/wiki/Advanced_Audio_Coding) for audio.
- Safari's MSE implementation has fatal problems with
  [fragmented MP4 playback](https://github.com/dailymotion/hls.js/issues/9) - for the moment the
  hlsjs engine will only be loaded in Safari for [debugging purposes](#debugging).
