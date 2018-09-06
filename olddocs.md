Present video in optimal quality via Adaptive Bit Rate streaming ([ABR][]) in
modern desktop browsers without the need for Flash.

Get your ticket to the future of [HLS](../setup#hls) with this plugin
developed on top of the [hls.js](https://github.com/video-dev/hls.js) client
library.

Integrates seamlessly with your HLS streams from Flowplayer Drive.

[Manual HLS quality level selection](../setup#hls-quality-selection) via the
HD menu is available out of the box. See also the `hlsQualities`
[player](../setup#player-options) and [clip](../setup#clip-options) option.

If a stream offers
[alternate audio renditions](https://tools.ietf.org/html/draft-pantos-http-live-streaming#section-4.3.4.1)
(`#EXT-X-MEDIA`) as in the demo below a selection menu is added to the
controlbar (currently not supported by Safari).

HLS subtitle display and selection can be enabled via the `subtitles`
[hlsjs option](#hlsjs-options).

The hlsjs plugin is also loaded by [Twitter shared](../sharing#twitter) and
[embedded players](../sharing#embedding).




<!-- CSS for this demo -->
<link rel="stylesheet" href="/media/css/demos/plugins/hlsjs.css">


<div id="fp-hlsjs">
     <a class="fp-prev"></a>
     <a class="fp-next"></a>
</div>

<script>
flowplayer("#fp-hlsjs", {
    splash: true,
    loop: true,
    ratio: 9/16,

    playlist: [{
        title: "3 audio tracks",
        hlsjs: {
            // codec not specified in master playlist
            defaultAudioCodec: "mp4a.40.2"
        },
        sources: [
            { type: "application/x-mpegurl",
              src: "//wowzaec2demo.streamlock.net/vod-multitrack/_definst_/smil:ElephantsDream/ElephantsDream.smil/playlist.m3u8" }
        ]
    }, {
        title: "4 subtitle tracks, 2 audio tracks",
        hlsjs: {
            // enable subtitle display
            subtitles: true,
            // enable audio ABR
            audioABR: true
        },
        sources: [
            { type: "application/x-mpegurl",
              src: "//bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8" }
        ]
    }],
    embed: false
});
</script>



~~~ html
<div id="fp-hlsjs">
  <a class="fp-prev"></a>
  <a class="fp-next"></a>
</div>

<script>
flowplayer("#fp-hlsjs", {
    splash: true,
    loop: true,
    ratio: 9/16,

    playlist: [{
        title: "3 audio tracks",
        hlsjs: {
            // codec not specified in master playlist
            defaultAudioCodec: "mp4a.40.2"
        },
        sources: [
            { type: "application/x-mpegurl",
              src: "//wowzaec2demo.streamlock.net/vod-multitrack/_definst_/smil:ElephantsDream/ElephantsDream.smil/playlist.m3u8" }
        ]
    }, {
        title: "4 subtitle tracks, 2 audio tracks",
        hlsjs: {
            // enable subtitle display
            subtitles: true,
            // enable audio ABR
            audioABR: true
        },
        sources: [
            { type: "application/x-mpegurl",
              src: "//bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8" }
        ]
    }],
    embed: false
});
</script>
~~~


[View standalone page](../standalone/plugins/hlsjs.html){.standalone}



### Compatibility

#### Browser support

The `hlsjs` [engine](../api#engines) provided by the plugin is loaded if the browser features the [MediaSource extension](https://developer.mozilla.org/en-US/docs/Web/API/MediaSource), and if the MediaSource implementation __reliably__ handles playback of segmented MPEG-4 video. <!-- - Your browser: <span class="hlsjs-supported"></span>.-->

__Note:__ Mac OS Safari's MediaSource implementation has issues with
[remuxed MPEG-4 segments](https://github.com/video-dev/hls.js/issues/9) - for the moment the hlsjs engine will be loaded in Safari only if the `safari` [hlsjs option](#hlsjs-options) is enabled.


#### Stream compatibility

For stream compatibility check the [list of supported m3u8 tags](https://github.com/video-dev/hls.js#supported-m3u8-tags) and the as of yet
[unsupported HLS features](https://github.com/video-dev/hls.js#not-supported-yet).

[notice]
Chromecast cannot play streams with alternate audio renditions.
[/notice]


[notice]
Test your streams in the <a href="http://streambox.fr/mse/hls.js-0.8.4/demo/">hls.js demo player</a>. In case of playback issues with the hls.js client, we encourage you to use the <a href="https://github.com/video-dev/hls.js/issues/">hls.js bug tracker</a> as first port of call.
[/notice]


#### Server side

[notice]
The video streams must be served with a cross domain policy (CORS) allowing GET requests. If the segments are not static files, but are retrieved via byte-range requests HEAD and OPTIONS must be allowed as well.
[/notice]

Sample CORS Configuration for Amazon S3:

~~~ xml
<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
    <CORSRule>
        <AllowedOrigin>*</AllowedOrigin>
        <AllowedMethod>GET</AllowedMethod>

        <!-- only required for byte-range based retrieval -->
        <AllowedMethod>HEAD</AllowedMethod>

        <MaxAgeSeconds>3000</MaxAgeSeconds>
        <AllowedHeader>*</AllowedHeader>
    </CORSRule>
</CORSConfiguration>
~~~

For other server configurations, please check [enable-cors.org](https://enable-cors.org/) .

### Loading the assets

The only requirement is to load the plugin after the Flowplayer script.

~~~ html
<!-- load the Flowplayer script -->
<script src="%releases%/flowplayer.min.js"></script>
<!-- load the latest version of the hlsjs plugin -->
<script src="//releases.flowplayer.org/hlsjs/flowplayer.hlsjs.min.js"></script>
~~~


To speed up page loading a 'light' version of the plugin can be used:

~~~ html
<!-- load the Flowplayer script -->
<script src="%releases%/flowplayer.min.js"></script>
<!-- load the latest 'light' version of the hlsjs plugin -->
<script src="//releases.flowplayer.org/hlsjs/flowplayer.hlsjs.light.min.js"></script>
~~~


The full plugin is required for support of:

- [alternate audio renditions](https://developer.apple.com/library/content/referencelibrary/GettingStarted/AboutHTTPLiveStreaming/about/about.html#//apple_ref/doc/uid/TP40013978-CH3-SW17)
- manual audio track selection
- HLS subtitle support
- ID3 tag processing

[notice=note]
The development of the client library for this plugin is a fast moving target. Loading the latest version of the plugin as above is recommended. It packs a recent and tested release of the client library.
[/notice]


### Configuration

The plugin can be configured on the [clip](../setup#clip-options),
[player](../setup#player-options) and [global](../setup#global-configuration) level of the Flowplayer configuration.


All configuration is done by the `hlsjs` option:

| option | kind | description |
|--------|------|-------------|
| hlsjs | Boolean | Players can be told to disable the plugin by setting this to `false`. Normally used only for testing [Flash HLS](../setup#flash-hls).<br>Can be set on [clip level](../setup#clip-option) for convenience, but as it decides what engine to load it will only have an effect if configured for a single clip or the first clip of a playlist. |
| hlsjs | Object | The plugin behavior can be fine tuned in the `hlsjs` [configuration object](#hlsjs-options).<br>This option cannot be set as [HTML data-attribute](../setup#html-configuration). |


#### hlsjs options

The <code>hlsjs</code> configuration object makes all [hls.js tuning parameters](https://github.com/video-dev/hls.js/blob/master/docs/API.md#fine-tuning) available for Flowplayer.

Additionally <code>hlsjs</code> accepts the following Flowplayer-specific
properties:

| option | default value | description |
|--------|---------------|-------------|
| adaptOnStartOnly | false | If set to `true` adaptive bitrate switching is disabled after a suitable HLS level is chosen in an initial bandwidth check before playback. Useful for shorter videos, especially when looping. |
| audioABR | false | If multiple audio [groups](https://tools.ietf.org/html/draft-pantos-http-live-streaming#section-4.3.4.1.1) are present the hlsjs engine will load only one by default, regardless of the current video level. If this option is set to `true` the corresponding audio track will be loaded on level switch.<br>Requires the [full plugin build](#hlsjs-assets). |
| autoLevelCapping | -1 | Forbids the player to pick a higher clip resolution/bitrate than specified when in ABR mode. Accepts an index number from `0` (lowest) to highest. The default value `-1` means no capping, and may also be specified as boolean `false`. |
| bufferWhilePaused | true | If set to `false` the player does not buffer segments in paused state. Be careful, this may affect playback quality after pausing and seeking performance in paused state.<br>For bandwidth saving it is recommended to compare the effect with the generic hls.js buffer related options, especially [maxMaxBufferLength](https://github.com/video-dev/hls.js/blob/v0.8.4/doc/API.md#maxmaxbufferlength). |
| listeners | | An array of [hls.js runtime events](https://github.com/video-dev/hls.js/blob/v0.8.4/doc/API.md#runtime-events) to be exposed via the player API. Refer to [hlsjs events](#hlsjs-events) for details. |
| recover | | _Deprecated_ - use `recoverMediaError` or/and `recoverNetworkError` instead.<br>Maximum attempts to recover from [network and media errors](https://github.com/video-dev/hls.js/blob/v0.8.4/doc/API.md#errors) which are considered fatal by hls.js. If set to `-1`, recovery is always tried. |
| recoverMediaError | true | When `true`, the hlsjs engine will try to recover from otherwise fatal decoding errors if possible. |
| recoverNetworkError | false | When `true`, the hlsjs engine will try to recover from otherwise fatal network errors if possible.<br>_Note:_ Enabling network error recovery changes player behaviour, and only for the hlsjs engine. |
| safari | false | If set to `true` the plugin is enabled in Safari. Please read the section on [browser support](#hlsjs-browser-support) before enabling this option. |
| smoothSwitching | true | Whether manual [HLS quality switching](../setup#hls-quality-selection) should be smooth - level change with begin of next segment - or instant. Setting this to `false` can cause a playback pause on switch. |
| startLevel | firstLevel | Tells the player which clip resolution/bitrate to pick initially. Accepts an index number from `0` (lowest) to highest. Defaults to the level listed first in the variant (master) playlist, as with generic HLS playback. Set to `-1` or `"auto"` for automatic selection of suitable level after a bandwidth check. |
| strict | false | Set to `true` if you want non fatal hls.js playback errors to trigger Flowplayer errors. Useful for debugging streams and live stream maintenance. |
| subtitles | false | If set to `true` HLS subtitles are shown. If there are multiple subtitle tracks available, they can be selected from the CC menu. Native subtitle display can be configured via the `nativesubtitles` [player option](../subtitles#player-options).<br>Requires the [full plugin build](#hlsjs-assets). |


### JavaScript API

The plugin provides complete access to the [hls.js client API](https://github.com/video-dev/hls.js/blob/master/doc/API.md)
via the `engine.hlsjs` [property](../api#engines).

Simple example:

~~~ js
// switch to first hls level
flowplayer(0).engine.hlsjs.nextLevel = 0;
~~~



#### Video object

If several video quality levels are available and [hls quality selection](../setup#hls-quality-selection) is enabled, the
current [video object](../api#video-object) features these additional
properties:

| property | kind | description |
|----------|------|-------------|
| quality | integer | The currently selected video quality; `-1` stands for adaptive selection. |
| qualities | array | Lists all qualities available for manual selection. |




#### Events

[hls.js client runtime events](https://github.com/video-dev/hls.js/blob/master/doc/API.md#runtime-events)
which are listed in the `listeners` [hlsjs configuration](#hlsjs-options) are exposed to the Flowplayer API. The third argument of the event handle functions gives access to the event's data.

~~~ js
// expose hls.js LEVEL_SWITCH event to Flowplayer API
flowplayer.conf.hlsjs = {
  listeners: ["hlsLevelSwitch"]
};

flowplayer(function (api) {
  api.on("hlsLevelSwitch", function (e, api, data) {
    // listen to Hls.Events.LEVEL_SWITCH
    var level = api.engine.hlsjs.levels[data.level];

    console.info("switched to hls level index:", data.level);
    console.info("width:", level.width, "height": level.height);

  });
});
~~~

The mappings of hls.js event names to their respective constants are listed [here](https://github.com/video-dev/hls.js/blob/master/src/events.js).



#### Migration from Flowplayer Version 6

`hlsQualities` is now a core [option](../setup#player-options). *Note:*
The adaptive bitrate level `-1` must now be specified explicitly as first item
of the `hlsQualities` array.

No additonal CSS resources have to be loaded for manual HLS level selection, the
builtin HD menu is used to present the choices.

### Links

- [GitHub code repository](https://github.com/flowplayer/flowplayer-hlsjs)
- [complete demo](https://demos.flowplayer.com/plugins/hlsjs.html) with detailed
  explanations
