Flowplayer hlsjs plugin
===========================

This plugin provides the `hlsjs` [engine](https://flowplayer.org/docs/api.html#engines) for
playback of [HLS](https://flowplayer.org/docs/setup.html#hls) streams in browsers which do not
support playback of HLS in a VIDEO tag, and without the need for
[Flash](https://flowplayer.org/docs/setup.html#flash-hls).

The plugin relies on the [hls.js](https://github.com/video-dev/hls.js) client library.

Usage
-----

See: https://flowplayer.org/docs/plugins.html#hlsjs

- [compatibility](https://flowplayer.org/docs/plugins.html#hlsjs-compatibility)
- [loading the assets](https://flowplayer.org/docs/plugins.html#hlsjs-assets)
- [configuration](https://flowplayer.org/docs/plugins.html#hlsjs-configuration)
- [hlsjs options](https://flowplayer.org/docs/plugins.html#hlsjs-options)
- [hlsjs API](https://flowplayer.org/docs/plugins.html#hlsjs-api)

### Installation

The plugin can be installed with:

```
npm install --save flowplayer/flowplayer-hlsjs
```

### CommonJS

The plugin can be used in a [browserify](http://browserify.org) and/or
[webpack](https://webpack.github.io/) environment with a
[commonjs](http://requirejs.org/docs/commonjs.html) loader:

```js
var flowplayer = require('flowplayer');
var engine = require('flowplayer-hlsjs');
engine(flowplayer);

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
  [v0.7.8](https://github.com/video-dev/hls.js/releases/tag/v0.7.8) - of hls.js
- by default the engine is only loaded if the browser supports
  [MediaSource extensions](http://w3c.github.io/media-source/) reliably for playback
- configurable manual HLS quality selection

Debugging
---------

A quick way to find out whether there's a problem with the actual plugin component is to
run your stream in the [hls.js demo player](http://streambox.fr/mse/hls.js-0.7.8/demo/).

For fine grained debugging load the unminified components and turn hlsjs debugging on:

```html
<script src="//releases.flowplayer.org/7.0.2/flowplayer.min.js"></script>
<!-- test a hls.js release -->
<script src="//cdnjs.cloudflare.com/ajax/libs/hls.js/0.7.8/hls.min.js"></script>
<!-- separate hlsjs plugin component -->
<script src="//releases.flowplayer.org/hlsjs/flowplayer.hlsjs.js"></script>

<script>
// turn on hlsjs debugging
flowplayer.conf.hlsjs = {
  debug: true
};
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
