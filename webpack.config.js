const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
    target: 'node',
    devtool: 'inline-source-map',
    context: path.resolve('src'),
    entry: {
        index: './index.js',
        'runtime-shim': './runtime-shim.js',
    },
    output: {
        libraryExport: 'default',
        libraryTarget: 'umd',
    },
    externals: [
        nodeExternals(),
    ],
    module: {
        rules: [
            {
                test: /\.js$/,
                include: path.resolve('src'),
                exclude: /\/node_modules\//,
                use: [
                    'babel-loader',
                ],
            },
        ],
    },
};
