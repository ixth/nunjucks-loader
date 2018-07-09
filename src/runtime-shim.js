export default (nunjucks, env, obj, dependencies) => {
    const oldRoot = obj.root;

    obj.root = (env, context, frame, runtime, ignoreMissing, cb) => {
        const oldGetTemplate = env.getTemplate;

        env.getTemplate = (name, eager, parentName, ignoreMissing, cb) => {
            if (typeof eager === 'function') {
                cb = eager = false;
            }

            const _require = (name) => {
                // add a reference to the already resolved dependency here
                if (dependencies.hasOwnProperty(name)) {
                    return dependencies[name]
                }
                if (frame.get('_require') && frame.get('_require') !== _require) {
                    return frame.get('_require')(name);
                }
                console.warn(`Could not load template "${name}"`);
            };

            frame.set('_require', _require);

            const tmpl = _require(name);
            if (eager) {
                tmpl.compile();
            }
            cb(null, tmpl);
        };

        oldRoot(env, context, frame, runtime, ignoreMissing, (err, res) => {
            env.getTemplate = oldGetTemplate;
            cb(err, res);
        });
    };

    return new nunjucks.Template({ type: 'code', obj }, env);
};
