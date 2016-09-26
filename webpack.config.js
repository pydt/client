var path = require('path');
var fs = require('fs');
var webpack = require('webpack');
var CommonsChunkPlugin = webpack.optimize.CommonsChunkPlugin;

var apiUrl = "https://z9cjeucs49.execute-api.us-east-1.amazonaws.com/prod";

if (process.env.NODE_ENV !== 'production') {
  try {
    apiUrl = fs.readFileSync('../api-url.txt', 'utf-8');
    console.log('Using ' + apiUrl + ' for API URL!');
  } catch (Error) {
    console.log('There wasn\'t anything in ../api-url.txt, using prod api url...');
  }
}

module.exports = {
  devtool: 'source-map',
  debug: true,

  entry: {
    'vendor': [
      'reflect-metadata',
      'bootstrap-loader'
    ],
    'app': './app/ui/bootstrap.ts'
  },

  output: {
    path: __dirname + '/build/',
    publicPath: 'build/',
    filename: '[name].js',
    sourceMapFilename: '[name].js.map',
    chunkFilename: '[id].chunk.js'
  },

  resolve: {
    extensions: ['','.ts','.js','.json', '.css', '.html']
  },

  module: {
    loaders: [
      { test: /\.ts$/, loader: 'ts', exclude: [ /node_modules/ ] },
      // Hack for chokidar, doesn't work without this?
      { test: /binary-extensions/, loader: 'json-loader' },
      // Hacks for bootstrap fonts
      { test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/, loader: "url-loader?limit=10000&mimetype=application/font-woff" },
      { test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/, loader: "file-loader" }
    ]
  },

  plugins: [
    new CommonsChunkPlugin({ name: 'common',   filename: 'common.js' }),
    new webpack.DefinePlugin({
      // Environment helpers
      'process.env': {
        API_URL: JSON.stringify(apiUrl)
      }
    })
  ],
  target:'node-webkit',
  externals: [
    (function () {
      var IGNORES = [
        'electron'
      ];
      return function (context, request, callback) {
        if (IGNORES.indexOf(request) >= 0) {
          return callback(null, "require('" + request + "')");
        }
        return callback();
      };
    })()
  ]
};
