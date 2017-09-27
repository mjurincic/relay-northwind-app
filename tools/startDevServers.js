/* eslint no-param-reassign: [2, { "props": false }] */

import webpack from 'webpack';
import WebpackDevServer from 'webpack-dev-server';
import express from 'express';
import expressHttpProxy from 'express-http-proxy';
import path from 'path';
import chalk from 'chalk';
import open from 'open';
import fs from 'fs';
import jsonfile from 'jsonfile';
import errorOverlayMiddleware from 'react-dev-utils/errorOverlayMiddleware';
import noopServiceWorkerMiddleware from 'react-dev-utils/noopServiceWorkerMiddleware';
import { PORT, PORT_FRONTEND_DEV_SERVER } from './webpack.config.common.js';
// import serverConfig from './webpack.config.server.js';
// import backendNodemon from './backendNodemon';
import clientConfig from './webpack.config.client.js';
import run from './run';

let supervisor;

/**
 * Launches a development web server with "live reload" functionality -
 * synchronizing URLs, interactions and code changes across multiple devices.
 */
export default async function startDevServers() {
  const cleanExit = function() {
    if (supervisor) {
      // remove all nodemon listeners, to avoid restart child server
      supervisor.removeAllListeners();
    }
    process.exit();
  };
  process.on('SIGINT', cleanExit); // catch ctrl-c
  process.on('SIGTERM', cleanExit); // catch kill

  jsonfile.spaces = 2;
  jsonfile.writeFile('./build/webpack.client.json', clientConfig, () => {});

  const bundler = webpack([clientConfig]);
  await run(frontendServer, bundler.compilers[0]);
  await run(commmonDevServer);
}

function frontendServer(compiler) {
  return new Promise(resolve => {
    const devServer = new WebpackDevServer(compiler, {
      publicPath: clientConfig.output.publicPath,
      hot: true,
      historyApiFallback: true,
      stats: clientConfig.stats,
      disableHostCheck: true,
      watchOptions: {
        aggregateTimeout: 300,
        poll: 1000,
        ignored: /node_modules/,
      },
      compress: true,
      overlay: false,
      setup(app) {
        app.use(errorOverlayMiddleware());
        app.use(noopServiceWorkerMiddleware());
      },
    });

    const innerSendStat = devServer._sendStats.bind(devServer);
    devServer._sendStats = (sockets, stats, force) => {
      fs.writeFile('./build/profile_client.json', JSON.stringify(stats), () => {});
      return innerSendStat(sockets, stats, force);
    };

    devServer.listen(PORT_FRONTEND_DEV_SERVER, 'localhost');
    compiler.plugin('done', resolve);
    process.on('exit', () => {
      if (devServer) {
        devServer.close();
      }
    });
  });
}

function commmonDevServer() {
  return new Promise((resolve, reject) => {
    const devCommonProxy = express();
    devCommonProxy.use(express.static(path.resolve(__dirname, '../public')));
    devCommonProxy.use(
      expressHttpProxy(`127.0.0.1:${PORT_FRONTEND_DEV_SERVER}`, {
        forwardPath: req => req.originalUrl,
      })
    );
    const http = devCommonProxy.listen(PORT, () => {
      resolve();
      const serverUrl = `http://127.0.0.1:${PORT}`;
      console.log(chalk.bgGreen.bold(`Development server started at ${serverUrl}`));
      open(serverUrl);
    });
    http.on('error', reject);
  });
}
