const path = require('path');
const entry = path.resolve(__dirname, './web.js');

module.exports = {
    devtool: 'none',
    context: __dirname,
    entry: entry,
    module: {
        rules: [
            {
                resource: entry,
                loader: 'mocha-loader',
            },
            {
                test: /\.(njk|nunjucks)$/,
                loader: path.resolve(__dirname, '../dist/index.js'),
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
    resolve: {
        modules: [
            path.resolve(__dirname, '../node_modules'),
            path.resolve(__dirname, 'fixtures/templates'),
            path.resolve(__dirname, 'fixtures/custom_modules'),
        ],
    },
};
