module.exports = {

    entry: './src/entry.js',

    output: {
        path: __dirname,
        filename: 'bundle.js'
    },

    module: {
        loaders: [
            {
                test: /\.(nunj|nunjucks)$/,
                loader: 'nunjucks-loader',
                options: {
                    config: __dirname + '/src/nunjucks.config.js'
                }
            }
        ]
    },

    resolve: {
        root: [
            __dirname,
            __dirname + '/views',
        ]
    }
};
