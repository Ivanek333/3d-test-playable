const zlib = require('zlib');
class GzipInlinePlugin {
  apply(compiler) {
    compiler.hooks.emit.tapAsync('GzipInlinePlugin', (compilation, callback) => {
      const htmlAsset = compilation.assets['index.html'];
      if (!htmlAsset) return callback();

      const html = htmlAsset.source();
      
      const match = html.match(/<script defer="defer">([\s\S]*?)<\/script>/);
      if (!match) return callback();
      
      const scriptContent = match[1];

      zlib.gzip(Buffer.from(scriptContent), { level: 9 }, (err, compressed) => {
        if (err) return callback(err);
        
        const b64 = compressed.toString('base64');
        const bootstrap = `<script>(async()=>{
  const b64='${b64}';
  const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  const ds=new DecompressionStream('gzip');
  const w=ds.writable.getWriter();
  w.write(bin);w.close();
  const code=await new Response(ds.readable).text();
  eval(code);
})();</script>`;

        const newHtml = html.replace(/<script defer="defer">[\s\S]*?<\/script>/, bootstrap);
        compilation.assets['index.html'] = {
          source: () => newHtml,
          size: () => newHtml.length
        };
        callback();
      });
    });
  }
}


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
        },
        {
          test: /\.(glb|gltf)$/i,
          type: 'asset/inline',
        },
        {
          test: /\.mp3$/i,
          type: 'asset/inline',
        },
        {
          test: /draco_wasm_wrapper\.js$/,
          type: 'asset/inline',
        },
        {
          test: /draco_decoder\.wasm$/,
          type: 'asset/inline',
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
      isProduction ? new GzipInlinePlugin() : null,
      //new BundleAnalyzerPlugin()
    ],
    devtool: 'inline-source-map',
    devServer: {
      static: './dist',
      hot: true,
      open: true
    }
  };
};