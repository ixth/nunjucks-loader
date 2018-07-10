/*******************************************************************
 *
 *  This module is based on nunjucks-loader.
 *  (https://www.npmjs.com/package/nunjucks-loader)
 *
 *  Full credit to the original authors.
 *
 ******************************************************************/

import nunjucks from 'nunjucks';
import slash from 'slash';
import path from 'path';
import loaderUtils from 'loader-utils';
import { asyncLoader } from './async-loader';
import evalModule from './eval-module';

const loadConfigure = (loaderContext, request) =>
    new Promise((resolve, reject) => {
        loaderContext.loadModule(request, (err, source) => {
            if (err) {
                reject(err);
                return;
            }
            const configure = evalModule(source).exports;
            if (!(configure instanceof Function)) {
                reject(new TypeError(`${request}: expect module to export function, got ${typeof configure}`));
                return;
            }
            resolve(configure);
        });
    });


function getDependencies(nunjucksCompiledStr) {
    const dependencyRegEx = /env\.getTemplate\("(.*?)"/g;
    const dependencies = [];
    let match;
    while (match = dependencyRegEx.exec(nunjucksCompiledStr)) {
        const [, templateRef] = match;
        if (dependencies.includes(templateRef)) {
            continue;
        }
        dependencies.push(templateRef);
    }
    return dependencies;
}

function buildModule(env, name, content, options, configPath) {
    let nunjucksCompiledStr = nunjucks.precompileString(content, {
            env: env,
            name: slash(name)
        })
        .replace(
            /window\.nunjucksPrecompiled/g,
            'nunjucks.nunjucksPrecompiled'
        )
        .replace(
            /env\.getFilter\("require"\)\.call\(context, "(.*?)"/g,
            'require("$1"'
        );

    const imports = getDependencies().map(
        (templateRef) => `dependencies["${templateRef}"] = require("${templateRef}");`
    );
    const installJinjaCompat = (options.jinjaCompat ? 'nunjucks.installJinjaCompat();' : '');
    const envOptions = (options.opts ? `[], ${JSON.stringify(options.opts)}` : '');
    const configureEnv = (options.config ? `require("${slash(configPath)}")(env);` : '');

    return `var nunjucks = require("nunjucks/browser/nunjucks-slim");
${ installJinjaCompat }
var env = nunjucks.currentEnv || (nunjucks.currentEnv = new nunjucks.Environment(${envOptions}));
${ configureEnv }
var dependencies = nunjucks.webpackDependencies || (nunjucks.webpackDependencies = {});
${ imports.join('\n') }
${nunjucksCompiledStr}
module.exports = new nunjucks.Template({
    type: 'code',
    obj: nunjucks.nunjucksPrecompiled["${slash(name)}"]
}, env);`;
}

async function getEnv(options, loaderContext) {
    if (!options) {
        return new nunjucks.Environment();
    }

    const env = new nunjucks.Environment([], options);

    if (!options.config) {
        return env;
    }

    try {
        const configure = await loadConfigure(loaderContext, options.config);
        configure(env);
    } catch (e) {
        if (e.code === 'MODULE_NOT_FOUND') {
            if (!options.quiet) {
                loaderContext.emitWarning(`Cannot configure nunjucks environment before precompile
    ${e.message}
Async filters and custom extensions are unsupported when the nunjucks
environment configuration depends on webpack loaders or custom module
resolve rules. If you are not using async filters or custom extensions
with nunjucks, you can safely ignore this warning.`);
            }
        } else {
            throw e;
        }
    }
   return env;
}

export default asyncLoader(async function (content) {
    if (this.target !== 'web') {
        throw new Error('[nunjucks-loader] non-web targets are not supported');
    }

    this.cacheable();

    const options = loaderUtils.getOptions(this);
    return {
        content: buildModule(
            await getEnv(options, this),
            path.relative(options.root || this.rootContext || this.options.context, this.resourcePath),
            content,
            options,
            path.relative(this.context, options.config)
        ),
    };
});
