/*******************************************************************
 *
 *  This module was heavily inspired by nunjucksify.
 *  (https://www.npmjs.com/package/nunjucksify)
 *
 *  Full credit to the original authors.
 *
 ******************************************************************/

var nunjucks = require('nunjucks');
var slash = require('slash');
var path = require('path');
var loaderUtils = require('loader-utils');
var loaderRunner = require('loader-runner');

function loadConfig(path, loaders) {
    return new Promise(function (resolve, reject) {
        loaderRunner.runLoaders(
            {
                resource: path,
                loaders: loaders
            },
            function (err, result) {
                if (err) {
                    reject(err);
                } else {
                    resolve(eval(result.result));
                }
            }
        );
    });
}

function configurationWarning(message) {
    return 'Cannot configure nunjucks environment before precompile\n' +
        '\t' + message + '\n' +
        'Async filters and custom extensions are unsupported when the nunjucks\n' +
        'environment configuration depends on webpack loaders or custom module\n' +
        'resolve rules. If you are not using async filters or custom extensions\n' +
        'with nunjucks, you can safely ignore this warning.';
}

function buildModule(env, name, content, options, configPath, shimPath) {
    var nunjucksCompiledStr = nunjucks.precompileString(content, {
        env: env,
        name: slash(name)
    });

    nunjucksCompiledStr = nunjucksCompiledStr.replace(/window\.nunjucksPrecompiled/g, 'nunjucks.nunjucksPrecompiled');

    // ==============================================================================
    // replace 'require' filter with a webpack require expression (to resolve assets)
    // ==============================================================================
    var filterReg = /env\.getFilter\(\"require\"\)\.call\(context, \"(.*?)\"/g;
    nunjucksCompiledStr = nunjucksCompiledStr.replace(filterReg, 'require("$1"');

    // ================================================================
    // Begin to write the compiled template output to return to webpack
    // ================================================================
    var compiledTemplate = '';
    compiledTemplate += 'var nunjucks = require("nunjucks/browser/nunjucks-slim");\n';
    if (options.jinjaCompat) {
        compiledTemplate += 'nunjucks.installJinjaCompat();\n';
    }
    compiledTemplate += 'var env;\n';
    compiledTemplate += 'if (!nunjucks.currentEnv){\n';
    compiledTemplate += '\tenv = nunjucks.currentEnv = new nunjucks.Environment(';
    if (options.opts) {
        compiledTemplate += '[], ' + JSON.stringify(options.opts);
    }
    compiledTemplate += ');\n';
    compiledTemplate += '} else {\n';
    compiledTemplate += '\tenv = nunjucks.currentEnv;\n';
    compiledTemplate += '}\n';
    if (options.config) {
        compiledTemplate += 'var configure = require("' + slash(configPath) + '")(env);\n';
    }


    // =========================================================================
    // Find template dependencies within nunjucks (extends, import, include etc)
    // =========================================================================
    //
    // Create an object on nunjucks to hold the template dependencies so that they persist
    // when this loader compiles multiple templates.
    compiledTemplate += 'var dependencies = nunjucks.webpackDependencies || (nunjucks.webpackDependencies = {});\n';

    var templateReg = /env\.getTemplate\(\"(.*?)\"/g;
    var match;

    // Create an object to store references to the dependencies that have been included - this ensures that a template
    // dependency is only written once per file, even if it is used multiple times.
    var required = {};

    // Iterate over the template dependencies
    while (match = templateReg.exec(nunjucksCompiledStr)) {
        var templateRef = match[1];
        if (!required[templateRef]) {
            // Require the dependency by name, so it gets bundled by webpack
            compiledTemplate += 'dependencies["' + templateRef + '"] = require( "' + templateRef + '" );\n';
            required[templateRef] = true;
        }
    }


    compiledTemplate += '\n\n\n\n';

    // Include a shim module (by reference rather than inline) that modifies the nunjucks runtime to work with the loader.
    compiledTemplate += 'var shim = require("' + slash(shimPath) + '");\n';
    compiledTemplate += '\n\n';

    // Write the compiled template string
    compiledTemplate += nunjucksCompiledStr + '\n';

    compiledTemplate += '\n\n';

    // export the shimmed module
    compiledTemplate += 'module.exports = shim(nunjucks, env, nunjucks.nunjucksPrecompiled["' + slash(name) + '"] , dependencies)';

    return compiledTemplate;
}

function getEnv(options, loaderContext) {
    return Promise.resolve(new nunjucks.Environment());
    if (!options) {
        return Promise.resolve(new nunjucks.Environment());
    }

    var env = new nunjucks.Environment([], options);

    if (!options.config) {
        return Promise.resolve(env);
    }

    return loadConfig(options.config, loaderContext.loaders)
        .catch(function (e) {
            if (e.code === 'MODULE_NOT_FOUND') {
                if (!options.quiet) {
                    loaderContext.emitWarning(configurationWarning(e.message));
                }
                return env;
            }
            throw e;
        })
        .then(function (configure) {
            configure(env);
            return env;
        });
}

module.exports = function (content) {
    if (this.target !== 'web') {
        throw new Error('[nunjucks-loader] non-web targets are not supported');
    }

    this.cacheable();

    var callback = this.async();
    var options = loaderUtils.getOptions(this);
    getEnv(options, this)
        .then(function (env) {
            return buildModule(
                env,
                path.relative(options.root || this.rootContext || this.options.context, this.resourcePath),
                content,
                options,
                path.relative(this.context, options.config),
                path.resolve(this.context, __dirname + '/runtime-shim')
            );
        }.bind(this))
        .then(
            function (result) {
                callback(null, result);
            },
            function (e) {
                this.emitError(e.message);
                callback(e);
            }.bind(this)
        );
};
