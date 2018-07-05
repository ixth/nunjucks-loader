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
import loaderRunner from 'loader-runner';
import { asyncLoader } from './async-loader';

async function loadConfig(resource, loaders) {
    const { result } = await loaderRunner.runLoaders({resource, loaders});
    return eval(result);
}

function getDependencied(nunjucksCompiledStr) {
    const dependencyRegEx = /env\.getTemplate\(\"(.*?)\"/g;
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

function buildModule(env, name, content, options, configPath, shimPath) {
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

    const imports = getDependencied().map(
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
var shim = require("${slash(shimPath)}");
${nunjucksCompiledStr}
module.exports = shim(nunjucks, env, nunjucks.nunjucksPrecompiled["${slash(name)}"] , dependencies)`;
}

async function getEnv(options, loaderContext) {
    return new nunjucks.Environment();

    if (!options) {
        return new nunjucks.Environment();
    }

    const env = new nunjucks.Environment([], options);

    if (!options.config) {
        return env;
    }

    try {
        const configure = loadConfig(options.config, loaderContext.loaders);
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

module.exports = asyncLoader(async function (content) {
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
            path.relative(this.context, options.config),
            path.resolve(__dirname, 'runtime-shim')
        ),
    };
});
