import Module from 'module';

export default (source) => {
    const module = new Module();
    new Function('module', 'exports', 'require', source)(module, module.exports, module.require);
    return module;
};
