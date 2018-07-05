export const asyncLoader = (fn) => function (...args) {
    const callback = this.async();
    fn.apply(this, args).then(
        ({ content, sourceMap, meta }) => {
            callback(null, content, sourceMap, meta)
        },
        (error) => {
            callback(error)
        }
    );
};
