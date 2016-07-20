'use strict';

var fs = require('fs')
  , path = require('path')
  , webpack = require('webpack')
  , console = require('console')
  , exec = require('child_process').execSync
  , gitId
  , banner = ''
  , bannerAppend = false
  , lines = fs.readFileSync('./flowplayer.hlsjs.js', 'utf8').split('\n');

try {
    gitId = exec('git rev-parse --short HEAD').toString('utf8').trim();
} catch (ignore) {
    console.warn('unable to determine git revision');
}

lines.forEach(function (line) {
    if (line === '/*!') {
        bannerAppend = true;
    }
    if (bannerAppend) {
        bannerAppend = line.indexOf('$GIT_ID$') < 0;
        if (gitId) {
            line = line.replace('$GIT_ID$', gitId);
        }
        banner += line + (bannerAppend ? '\n' : '\n\n*/');
    }
});

module.exports = {
  entry: {'flowplayer.hlsjs.min': ['./standalone.js']},
  externals: {
    flowplayer: 'flowplayer'
  },
  module: {
    loaders: [
      { test: /\/hls\.js\/.+/, loader: 'babel', query: { presets: ['es2015'] } }
    ]
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js'
  },
  plugins: [
    new webpack.optimize.OccurrenceOrderPlugin(true),
    new webpack.optimize.UglifyJsPlugin({
      include: /\.min\.js$/,
      mangle: true,
      output: { comments: false }
    }),
    new webpack.BannerPlugin(banner, {raw: true}),
    new webpack.NormalModuleReplacementPlugin(/^webworkify$/, 'webworkify-webpack')
  ]
};
