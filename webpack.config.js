var path = require('path');
var fs = require('fs');
var webpack = require('webpack');
var CommonsChunkPlugin = webpack.optimize.CommonsChunkPlugin;

var ENV = process.env.npm_lifecycle_event;
var isProd = ENV === 'build-prod';
var apiUrl = "https://z9cjeucs49.execute-api.us-east-1.amazonaws.com/prod";

if (!isProd) {
  try {
    apiUrl = fs.readFileSync('../api-dev-url.txt', 'utf-8');
    console.log('Using ' + apiUrl + ' for API URL!');
  } catch (Error) {
    console.log('There wasn\'t anything in ../api-dev-url.txt, using prod api url...');
  }
}

module.exports = {
  devtool: 'source-map',
  debug: true,

  entry: {
    'rollbar': './ui/rollbar.js',
    'zone': 'zone.js',
    'vendor': [
      'reflect-metadata',
      'bootstrap-loader'
    ],
    'app': './ui/bootstrap.ts'
  },

  output: {
    path: __dirname + '/app/ui_compiled/',
    publicPath: 'ui_compiled/',
    filename: '[name].js',
    sourceMapFilename: '[name].js.map',
    chunkFilename: '[id].chunk.js'
  },

  resolve: {
    extensions: ['','.ts','.js','.json', '.css', '.html']
  },

  module: {
    loaders: [
      { test: /\.ts$/, loaders: ['ts', 'angular2-template-loader'], exclude: [ /node_modules/, /app\/node_modules/ ] },
      { test: /\.(html|css)$/, loader: 'raw-loader' },
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
        PROD: JSON.stringify(isProd),
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
