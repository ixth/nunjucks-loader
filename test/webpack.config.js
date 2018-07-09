const path = require('path');
const entry = path.resolve(__dirname, './web.js');

module.exports = {
    devtool: 'inline-source-map',
    context: __dirname,
    entry: entry,
    output: {
        path: path.resolve(__dirname, 'dist'),
    },
    module: {
        rules: [
            {
                resource: entry,
                loader: 'mocha-loader',
            },
            {
                test: /\.(njk|nunjucks)$/,
                loader: 'nunjucks-loader',
                options: {
                    jinjaCompat: true,
                    config: path.resolve(__dirname, 'nunjucks.config.js'),
                }
            },
            {
                test: /\.txt$/,
                loader: 'raw-loader',
            },
        ],
    },
    resolveLoader: {
        alias: {
            'nunjucks-loader': path.resolve(__dirname, '..'),
        },
    },
    resolve: {
        alias: {
            'nunjucks-loader': path.resolve(__dirname, '..'),
        },
        modules: [
            path.resolve(__dirname, '../node_modules'),
            path.resolve(__dirname, 'fixtures/templates'),
            path.resolve(__dirname, 'fixtures/custom_modules'),
        ],
    },
};
