'use strict';

var path = require('path')
  , webpack = require('webpack');

module.exports = {
  entry: {
    'hls': ['hls.js'],
    'flowplayer.hlsjs.min': './flowplayer.hlsjs.js'
  },
  externals: {
    flowplayer: 'flowplayer'
  },
  module: {
    loaders: [
      { test: /hls\.js/, loader: 'babel', query: { presets: ['es2015'] } }
    ]
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js'
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin({
      include: /\.min\.js$/,
      mangle: true,
      output: { comments: false }
    })
  ]
};
