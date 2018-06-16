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

function configureWarning(message) {
    return 'Cannot configure nunjucks environment before precompile\n' +
        '\t' + message + '\n' +
        'Async filters and custom extensions are unsupported when the nunjucks\n' +
        'environment configuration depends on webpack loaders or custom module\n' +
        'resolve rules. If you are not using async filters or custom extensions\n' +
        'with nunjucks, you can safely ignore this warning.';
}

function getEnv(loaderContext, options) {
    var envPromise = _getEnv(loaderContext, options);
    getEnv = function () {
        return envPromise;
    };
    return envPromise;
}

function _getEnv(loaderContext, options) {
    return Promise.resolve(new nunjucks.Environment());
    if (!options) {
        return Promise.resolve(new nunjucks.Environment());
    }

    var env = new nunjucks.Environment([], options.opts);

    if (!options.config) {
        return Promise.resolve(env);
    }

    return loadConfig(options.config, loaderContext.loaders)
        .then(
            function (configure) {
                return configure(env);
            },
            function (e) {
                if (e.code === 'MODULE_NOT_FOUND') {
                    if (!options.quiet) {
                        loaderContext.emitWarning(configureWarning(e.message));
                    }
                    return env;
                }
                throw e;
            }
        );
}

function buildModule(loaderContext, env, name, content, options) {
    var nunjucksCompiledStr = nunjucks.precompileString(content, {
        env: env,
        name: name
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
        compiledTemplate += 'var configure = require("' + slash(path.relative(loaderContext.context, options.config)) + '")(env);\n';
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
    compiledTemplate += 'var shim = require("' + slash(path.resolve(loaderContext.context, __dirname + '/runtime-shim')) + '");\n';
    compiledTemplate += '\n\n';

    // Write the compiled template string
    compiledTemplate += nunjucksCompiledStr + '\n';

    compiledTemplate += '\n\n';

    // export the shimmed module
    compiledTemplate += 'module.exports = shim(nunjucks, env, nunjucks.nunjucksPrecompiled["' + name + '"] , dependencies)';

    return compiledTemplate;
}

module.exports = function (content) {
    var callback = this.async();

    if (this.target !== 'web') {
        throw new Error('[nunjucks-loader] non-web targets are not supported');
    }

    this.cacheable();

    var options = loaderUtils.getOptions(this);
    var name = slash(path.relative(options.root || this.rootContext || this.options.context, this.resourcePath));

    getEnv(this, options).then(
        function (env) {
            callback(null, buildModule(this, env, name, content, options));
        }.bind(this),
        function (e) {
            this.emitError(e.message);
        }.bind(this)
    );
};
