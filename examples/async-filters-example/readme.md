# Async filters example.

This example registers an async filter which parses input as markdown before returning the result.  

To run this example:

- change `cwd` to this directory
- `npm install`
- `webpack-dev-server`
- open [http://localhost:8080]


## Files of note

- `src/nunjucks.config.js` contains a function that registers the 'markdown' filter to the passed environment. 
- `webpack.config.js` sets the loaders `options.config` to the path of `src/nunjucks.config.js`
- `views/markdown-form.njk` A basic ui to accept input to convert to markdown
- `views/markdown-result.njk` A basic template that applies the markdown filter and renders the result.
- `src/entry.js` Requires the two templates and renders the page.
