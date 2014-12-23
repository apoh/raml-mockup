#!/usr/bin/env node

'use strict';

var fs = require('fs'),
    minimist = require('minimist');

var argv = minimist(process.argv.slice(2), {
  alias: {
    h: 'help',
    v: 'version',
    d: 'directory',
    f: 'fakeroot',
    r: 'formats',
    w: 'watch',
    p: 'port'
  },
  string: ['port', 'formats', 'fakeroot', 'directory'],
  boolean: ['help', 'watch', 'version']
});

var exit = process.exit.bind(process);

function isFile(filepath) {
  return fs.existsSync(filepath) && fs.statSync(filepath).isFile();
}

function writeln(message, error) {
  process[error ? 'stderr' : 'stdout'].write(message + '\n');
}

function usage(header) {
  var message = [];

  if (header) {
    message.push(header);
  }

  message.push('Usage:');
  message.push('  raml-mockup src/index.raml [OPTIONS]');

  message.push('Options:');
  message.push('  -p, --port       The port used for exposing the faked-api');
  message.push('  -p, --watch      Enables file watching for reloading the mock-server');
  message.push('  -r, --formats    Require CommonJS-module for custom format generators');
  message.push('  -f, --fakeroot   Used to resolve $ref\'s using a directory as absolute URI');
  message.push('  -d, --directory  Used with the --fakeroot option for resoving $ref\'s');
  message.push('  -v, --version    Show the current version');
  message.push('  -h, --help       Display this help');

  return message.join('\n');
}

function glob(dir) {
  return dir.replace(/[\\\/]+$/, '') + '/**/*';
}

if (argv.version) {
  var pkg = require('../package.json');

  writeln([pkg.name, pkg.version].join(' '));
  exit(1);
} else if (argv.help) {
  writeln(usage());
  exit(1);
} else {
  var file = argv._.shift();

  if (!file) {
    writeln(usage('Missing arguments'), true);
    exit(1);
  }

  if (!isFile(file)) {
    writeln(usage('Invalid input'), true);
    exit(1);
  }

  var watching = argv._.shift() === '__watching';

  if (argv.watch && !watching) {
    var gaze = require('gaze'),
        path = require('path'),
        child_process = require('child_process');

    var src = [path.dirname(file) + '/**/*'];

    if (argv.formats) {
      if (!isFile(argv.formats)) {
        src.push(glob(argv.formats));
      } else {
        src.push(argv.formats);
      }
    }

    if (argv.directory) {
      src.push(glob(argv.directory));
    }

    src = src.map(function(v) {
      return path.resolve(v);
    });

    gaze(src, function(err) {
      if (err) {
        writeln(err, true);
        exit(1);
      }

      var child;

      function spawn() {
        if (child) {
          child.kill('SIGINT');
        }

        var cmd = process.argv.join(' ')
          .replace(/--?w(atch)?\s+\S+/) + ' __watching';

        child = child_process.exec(cmd, function() {
          // do nothing
        });

        child.stdout.pipe(process.stdout);
        child.stderr.on('data', function(err) {
          writeln((err.message ? err.message : ('Error: ' + err)).trim(), true);
        });
      }

      this.on('all', function(evt, filepath) {
        writeln('\nFile ' + evt + ' ' + filepath.replace(process.cwd() + '/', '') + ', reloading...\n');
        spawn();
      });

      spawn();
    });
  } else {
    var mock_server = require('../lib/mock-server');

    mock_server({
      raml: file,
      port: argv.port,
      watch: watching,
      formats: argv.formats,
      fakeroot: argv.fakeroot,
      directory: argv.directory
    }, function(err) {
      if (err) {
        writeln(err, true);
        exit(1);
      }
    });
  }
}
