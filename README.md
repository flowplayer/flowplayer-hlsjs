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

- [compatibility](https://flowplayer.org/docs/plugins.html#hlsjs-compatibility)
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
  [v0.6.2-3](https://github.com/dailymotion/hls.js/releases/tag/v0.6.2-3) - of hls.js
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
<!-- test a hls.js release -->
<script src="//cdn.jsdelivr.net/hls.js/0.6.2-3/hls.min.js"></script>
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

Known issues
------------

- IE8: due to loading the hls.js client library, errors which do not affect functionality are
  reported in the console (see:
  [issue #38](https://github.com/flowplayer/flowplayer-hlsjs/issues/38)). Workaround:
  additionally load jquery (unless loaded already) and the es5 polyfill **in this order**:
```html
<!--[if lt IE 9]>
<script src="//code.jquery.com/jquery-1.11.2.min.js"></script>
<![endif]-->
<script src="//releases.flowplayer.org/6.0.5/flowplayer.min.js"></script>
<!--[if lt IE 9]>
<script src="//releases.flowplayer.org/hlsjs/es5.js"></script>
<![endif]-->
<script src="//releases.flowplayer.org/hlsjs/flowplayer.hlsjs.min.js"></script>
```
