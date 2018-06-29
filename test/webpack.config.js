module.exports = {

    target: 'web',

    context: __dirname,

    entry: './web.js',

    module: {
        rules: [
            {
                test: /\.(njk|nunjucks)$/,
                loader: '../index.js',
                options: {
                    jinjaCompat: true,
                    config: __dirname + '/nunjucks.config.js'
                }
            },
            {
                test: /\/web.js$/,
                loader: 'mocha-loader'
            },
            {
                test: /\.txt$/,
                loader: 'raw-loader'
            }
        ]
    },

    resolve: {
        modules: [
            __dirname + '/../node_modules',
            __dirname + '/fixtures/templates',
            __dirname + '/fixtures/custom_modules'
        ]
    }
};
