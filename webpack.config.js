const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlInlineScriptPlugin = require('html-inline-script-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  const configRaw = fs.readFileSync(path.resolve(__dirname, 'gameconfig.json'), 'utf8');
  const config = JSON.parse(configRaw);

  return {
    mode: 'production',
    entry: './src/main.ts',
    output: {
      filename: 'bundle.js',
      path: path.resolve(__dirname, 'dist'),
      clean: true
    },
    resolve: {
      extensions: ['.ts', '.js']
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/
        },
        {
          test: /\.(png|jpg|gif|svg)$/i,
          type: 'asset/inline',
          parser: {
            dataUrlCondition: {
              maxSize: 50 * 1024 // 50kb
            }
          }
        }
      ]
    },
    optimization: {
      usedExports: isProduction,
      minimize: isProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: true,
              drop_debugger: true,
              pure_funcs: ['console.log']
            },
            mangle: {
              properties: false
            }
          },
          extractComments: false
        })
      ],
      splitChunks: false,
      runtimeChunk: false
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/index.html',
        inject: 'body',
        minify: isProduction ? {
          collapseWhitespace: true,
          removeComments: true,
          removeRedundantAttributes: true,
          removeScriptTypeAttributes: true,
          removeStyleLinkTypeAttributes: true,
          useShortDoctype: true
        } : false,
        templateParameters: {
          config: config
        }
      }),
      isProduction ? new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }) : null,
      isProduction ? new HtmlInlineScriptPlugin() : null,
      // new BundleAnalyzerPlugin()
    ],
    devtool: 'inline-source-map',
    devServer: {
      static: './dist',
      hot: true,
      open: true
    }
  };
};