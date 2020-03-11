import path from 'path';
import loaderUtils from 'loader-utils';
import { Environment, precompileString } from 'nunjucks';

const getWarning = (message) =>
    `Cannot configure nunjucks environment before precompile
    ${message}
Async filters and custom extensions are unsupported when the nunjucks
environment configuration depends on webpack loaders or custom module
resolve rules. If you are not using async filters or custom extensions
with nunjucks, you can safely ignore this warning.`;

const getEnv = (query) => {
    if (!query) {
        return new Environment([]);
    }

    const { opts, config } = query;
    if (!config) {
        return new Environment([], opts);
    }

    const env = new Environment([], opts);
    try {
        require(config)(env);
    } catch (e) {
        if (e.code === 'MODULE_NOT_FOUND') {
            if (!query.quiet) {
                this.emitWarning(getWarning(e.message));
            }
        } else {
            this.emitError(e.message);
        }
    }
    return env;
};

const getDependencies = (nunjucksCompiledStr) =>
    new Set(
        Array.from(
            nunjucksCompiledStr.matchAll(/env\.getTemplate\("(?<ref>.+?)"/g),
            ({ ref }) => ref,
        ),
    );

const defaultQuery = {
    root: '',
    opts: {},
    config: '',
    quiet: false,
    jinjaCompat: false,
};

let cached;
const init = (rawQuery) => {
    if (!cached) {
        const query = { ...defaultQuery, ...loaderUtils.parseQuery(rawQuery) };
        const env = getEnv(query);
        cached = { query, env };
    }
    return cached;
};

const render = ({ configPath, shimPath, query, name, dependencies, precompiledTemplate }) => {
    const jinjaCompatInvocation = query.jinjaCompat ? 'nunjucks.installJinjaCompat();' : '';
    const configureInvocation = configPath ? `var configure = require("${configPath}")(env);` : '';
    const dependencyImports = dependencies.map((ref) => `dependencies["${ref}"] = require("${ref}");`).join('\n');
    return `var nunjucks = require("nunjucks/browser/nunjucks-slim");
${jinjaCompatInvocation}
var env = nunjucks.currentEnv || (nunjucks.currentEnv = new nunjucks.Environment([], ${JSON.stringify(query.opts)}))
${configureInvocation}
var dependencies = nunjucks.webpackDependencies || (nunjucks.webpackDependencies = {});
${dependencyImports}
var shim = require("${shimPath}");
${precompiledTemplate}
module.exports = shim(nunjucks, env, nunjucks.nunjucksPrecompiled["${name}"] , dependencies);`;
};

function hook(source) {
    if (this.target !== 'web') {
        throw new Error('[nunjucks-loader] non-web targets are not supported');
    }

    this.cacheable();

    const { query, env } = init(this.query);

    const root = query.root || this.rootContext || this.options.context;
    const name = path.relative(root, this.resourcePath);

    const precompiledTemplate = precompileString(source, { env, name })
        .replace(/window(?=\.nunjucksPrecompiled)/g, 'nunjucks')
        .replace(/env\.getFilter\("require"\)\.call\(context, "(.*?)"/g, 'require("$1"');

    return render({
        configPath: query.config ? path.relative(this.context, query.config) : '',
        shimPath: path.resolve(this.context, __dirname + '/runtime-shim'),
        query,
        name,
        dependencies: getDependencies(precompiledTemplate),
        precompiledTemplate,
    });
}

export default hook;
