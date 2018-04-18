const chalk = require('chalk');
const decamel = require('decamelize');
const loadUtils = require('loader-utils');
const meant = require('meant');
const merge = require('merge-options');
const resolve = require('enhanced-resolve');
const strip = require('strip-ansi');
const table = require('text-table');
const weblog = require('webpack-log');

module.exports = {
  bind(value, enforce, options) {
    if (!value) {
      return;
    }

    let [extension, loader] = value.split('=');

    // this is logic copied from webpack-cli/convert-arg. not entirely sure why
    // this is done, perhaps for something like `--module-bind js`?
    if (extension && !loader) {
      loader = `${extension}-loader`;
    }

    // eslint-disable-next-line no-useless-escape
    extension = extension.replace(
      // eslint-disable-next-line no-useless-escape
      /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g,
      '\\$&'
    );

    const test = new RegExp(`\\.${extension}$`);
    const rule = { enforce, loader, test };

    // eslint-disable-next-line no-param-reassign
    options = merge({ module: { rules: [] } }, options);
    options.module.rules.push(rule);
  },

  loadPlugin(name) {
    const log = weblog({ name: 'woof', id: 'webpack-woof-cli' });
    const queryPos = name && name.indexOf('?');
    let args;
    let pluginPath;

    try {
      if (queryPos > -1) {
        args = loadUtils.parseQuery(name.substring(queryPos));
        // eslint-disable-next-line no-param-reassign
        name = name.substring(0, queryPos);
      }
    } catch (e) {
      log.error(`Invalid plugin arguments ${name} (${e}).`);
      throw e;
    }

    try {
      pluginPath = resolve.sync(process.cwd(), name);
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const PluginClass = require(pluginPath);
      return new PluginClass(args);
    } catch (e) {
      log.error(chalk`Cannot load plugin ${name} {grey from ${pluginPath}}`);
      throw e;
    }
  },

  // eslint-disable-next-line consistent-return
  validate(flag, value) {
    const { type: types } = flag;
    let result = false;

    if (!value || !types) {
      return true;
    }

    for (const type of [].concat(types)) {
      if (result !== true) {
        if (type === 'array') {
          result = Array.isArray(value);
        } else {
          // eslint-disable-next-line valid-typeof
          result = typeof value === type;
        }
      }
    }

    return result;
  },

  validateFlags(flags, argv) {
    const errors = [];
    const log = weblog({ name: 'woof', id: 'webpack-woof-cli' });
    const names = Object.keys(flags);
    const tableOptions = {
      align: ['', 'l', 'l'],
      stringLength(str) {
        return strip(str).length;
      },
    };
    const uniqueArgs = new Set(Object.keys(argv).map((n) => decamel(n)));
    const unknown = [];
    const { validate } = module.exports;

    for (const unique of uniqueArgs) {
      if (!names.includes(unique)) {
        const [suggestion] = meant(unique, names);
        let help = 'Not sure what you mean there';

        if (suggestion) {
          help = chalk`Did you mean {bold --${suggestion}}?`;
        }

        unknown.push(['', chalk.blue(`--${unique}`), help]);
      }
    }

    for (const name of names) {
      const flag = flags[name];
      const value = argv[name];

      // eslint-disable-next-line valid-typeof
      if (!validate(flag, value)) {
        errors.push([
          '',
          chalk.blue(`--${name}`),
          chalk`must be set to a {bold ${flag.type}}`,
        ]);
      }
    }

    if (errors.length) {
      const pre = 'Flags were specified with invalid values:';
      const post = 'Please check the command executed.';
      log.error(`${pre}\n\n${table(errors, tableOptions)}\n\n${post}`);
    }

    if (unknown.length) {
      if (errors.length) {
        console.log(''); // eslint-disable-line no-console
      }

      const pre = `Flags were specified that weren't recognized:`;
      const post = 'Please check the command executed.';
      log.error(`${pre}\n\n${table(unknown, tableOptions)}\n\n${post}`);
    }

    if (errors.length || unknown.length) {
      return false;
    }

    return true;
  },
};