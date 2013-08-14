var Container = require('./container'),
    npm = require('npm'),
    events = require('events'),
    sys = require('sys');

var Test = function (type, opt) {
  this.opt = opt;
  this.type = type;
  this.ulimit = 'ulimit -m 3048576; ulimit -v 3048576;';
};


sys.inherits(Test, events.EventEmitter);


Test.prototype.test = function(callback) {
  var self = this;

  var treatment = function(result) {
    switch(result.code) {
      case 0:
        if(self.type === 'repomake' && result.output.indexOf('make: Nothing to be done for') != -1) {
          callback({'result': 'nottested', 'output': result.output, 'code': result.code});
        } else {
          if(result.output.indexOf(' 0 passing') != -1) {
            console.log('MOCHA FIX!');
            callback({'result': 'nok', 'output': result.output, 'code': result.code});
          } else {
            callback({'result': 'ok', 'output': result.output, 'code': result.code});
          }
        }
        break;
      case 100:
        self.origret = {'result': 'nottested', 'output': null, 'code': result.code};
        if(self.type === 'tarball' && self.opt.repository !== null) {
          self.runRepoMake(treatment);
        } else {
          callback(self.origret);
        }
        break;
      case 2:
        callback({'result': 'nottested', 'output': null, 'code': result.code});
        break;
      case 999:
        callback(undefined);
        break;
      case 137:
        if(self.type === 'repomake') {
          callback({'result': 'nottested', 'output': result.output, 'code': result.code});
        } else {
          callback({'result': 'timedout', 'output': result.output, 'code': result.code});
        }
        break;
      case 8:
        callback({'result': 'tarball', 'output': result.output, 'code': result.code});
        break;
      case 128:
        if(self.type === 'repomake') {
          callback({'result': 'nottested', 'output': result.output, 'code': result.code});
        } else {
          callback({'result': 'nok', 'output': result.output, 'code': result.code});
        }
        break;
      case 1:
        self.origret = {'result': 'nok', 'output': result.output, 'code': result.code};
        if(self.type === 'tarball' && self.opt.repository !== null) {
          console.log('Retrying ' + self.opt.module);
          self.runRepo(treatment);
        } else {
          callback(self.origret);
        }
        break;
      default:
        if(self.origret) {
          callback(self.origret);
        } else {
          if(self.type === 'tarball' || self.type === 'repo') {
            callback({'result': 'nok', 'output': result.output, 'code': result.code});
          } else {
            callback(undefined);
          }
        }
        break;
    }
  };

  if(this.type === 'tarball') {
    this.runTarball(treatment);
  } else {
    this.runRepo(treatment);
  }
};


Test.prototype.runRepoMake = function (callback) {
  var self = this;
  this.type = 'repomake';

  var exec = new Container(self.ulimit + ' set -e; git clone ' + this.opt.repository + ' module; cd module; npm install; make test;');

  exec.on('done', function(result) {
    callback(result);
  });

  exec.on('started', function(stream) {
    self.emit('started', stream);
  });

  exec.run();
};


Test.prototype.runRepo = function (callback) {
  var self = this;
  this.type = 'repo';

  var branch = '';
  if(this.opt.branch) {
    branch = '-b ' + this.opt.branch + ' ';
  }

  var exec = new Container(self.ulimit + ' set -e; git clone ' + branch + this.opt.repository + ' module; cd module; npm install; npm test;');

  exec.on('done', function(result) {
    callback(result);
  });

  exec.on('started', function(stream) {
    self.emit('started', stream);
  });

  exec.run();
};


Test.prototype.runTarball = function (callback) {
  var self = this;
  this.type = 'tarball';

  npm.load({loglevel: 'silent'}, function (er) {
    npm.commands.info([self.opt.module], function (er, data) {
      //there are empty infos in registry
      if(data != undefined && data != null) {
        var auxm = data[Object.keys(data)[0]];

        if(auxm) {
          //npm test without tests returns exit code 0 and 'no test' test scripts.
          if(auxm.scripts && auxm.scripts.test && auxm.scripts.test.indexOf('no test') === -1) {
            var exec = new Container(self.ulimit + ' set -e; wget -O module ' + auxm.dist.tarball + '; tar -zxf module; cd package; npm install; npm test;');

            exec.on('done', function(result) {
              callback(result);
            });

            exec.on('started', function(stream) {
              self.emit('started', stream);
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