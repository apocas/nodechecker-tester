var sys = require('sys'),
  events = require('events');
  docker = require('docker.io')({host:'http://localhost', port: '4243', version:'v1.3'});

var Container = function (cmd) {
  this.options = {
    'Hostname': '',
    'User': '',
    'Memory': 0,
    'MemorySwap': 0,
    'CpuShares': 0,
    'AttachStdin': false,
    'AttachStdout': true,
    'AttachStderr': true,
    'Tty': false,
    'OpenStdin': false,
    'StdinOnce': false,
    'Env': null,
    'Cmd': ['bash', '-c', cmd],
    'Dns': ['8.8.8.8', '8.8.4.4'],
    'Image': 'node',
    'Volumes': {},
    'VolumesFrom': ''
  };
};


sys.inherits(Container, events.EventEmitter);


Container.prototype.run = function () {
  var self = this;

  docker.containers.create(this.options, function (err, res) {
    if (err) throw err;

    var buffer = '';
    self.id = res.Id;

    docker.containers.start(self.id, function(err, res) {
      if (err) throw err;

      console.log('Container started!');

      var timeout = setTimeout(function() {
        console.log('Stopping container');
        docker.containers.stop(self.id, function(err, res) {
          console.log('Container stopped');
        });
      }, 60000 * 3);

      docker.containers.attach(self.id, {stream: true, stdout: true}, function(err, res) {
        if (err) throw err;
        if(res !== null) {
          buffer += res.msg;
        }
      });

      docker.containers.wait(self.id, function(err, res) {
        if (err) throw err;

        //TODO: fix this bug in docker.io module, for now this condition monkey patches the issue
        if(res.StatusCode !== undefined) {
          clearTimeout(timeout);

          try {
            docker.containers.remove(self.id, function(err, res) {
              console.log('Container removed');
            });
          } catch (err) {
            console.log('Container removal failed. Container inspection needed.');
            console.log(err);
          }

          self.emit('done', {'code': res.StatusCode, 'output': buffer});
        }
      });

    });
  });
};


module.exports = Container;