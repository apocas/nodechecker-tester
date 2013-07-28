var Container = require('./container'),
    npm = require('npm');

var Test = function (opt) {
  this.opt = opt;
};


Test.prototype.test = function(callback) {
  var treatment = function(result) {
    console.log(result.code);
    switch(result.code) {
      case 0:
        callback({'result': 'ok', 'output': result.output});
        break;
      case 100:
        callback({'result': 'nottested', 'output': null});
        break;
      case 999:
        callback(undefined);
        break;
      case 137:
        callback({'result': 'timedout', 'output': result.output});
        break;
      case 8:
        callback({'result': 'tarball', 'output': result.output});
        break;
      default:
        callback({'result': 'nok', 'output': result.output});
        break;
    }
  };

  if(this.opt.module) {
    this.runNpm(treatment);
  } else if(this.opt.repository) {
    this.runGit(treatment);
  }
};


Test.prototype.runGit = function (callback) {
  var self = this;

  var exec = new Container('set -e; git clone ' + this.opt.repository + ' module; cd module; npm install; npm test;');

  exec.on('done', function(result) {
    callback(result);
  });

  exec.run();
};


Test.prototype.runNpm = function (callback) {
  var self = this;

  //npm is ignoring this loglevel, dunno why yet
  npm.load({'loglevel': 'error'}, function (er, npml) {
    npml.commands.info([self.opt.module], function (er, data) {
      //there are empty infos in registry
      if(data != undefined && data != null) {
        var auxm = data[Object.keys(data)[0]];

        if(auxm) {
          //npm test without tests returns exit code 0 and 'no test' test scripts.
          if(auxm.scripts && auxm.scripts.test && auxm.scripts.test.indexOf('no test') === -1) {
            var exec = new Container('set -e; wget -O module ' + auxm.dist.tarball + '; tar -zxf module; cd package; npm install; npm test;');

            exec.on('done', function(result) {
              callback(result);
            });

            exec.run();
          } else {
            callback({'code':100});
          }
        } else {
          callback({'code':999});
        }
      } else {
        callback({'code':999});
      }
    });
  });
};

module.exports = Test;