var sys = require('sys'),
  events = require('events');
  docker = require('docker.io')({host:'http://localhost', port: '4243', version:'v1.1'});

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
        console.log('Killing container');
        docker.containers.kill(self.id, function(err, res) {
          console.log('Container killed');
        });
      }, 60000 * 5);

      docker.containers.attach(self.id, {stream: true, stdout: true}, function(err, res) {
        if (err) throw err;
        buffer += res.msg;
      });

      docker.containers.wait(self.id, function(err, res) {
        if (err) throw err;

        //TODO: fix this bug in docker.io module, for now this quick patches the issue
        if(res.StatusCode !== undefined) {
          clearTimeout(timeout);

          docker.containers.remove(self.id, function(err, res) {
            console.log('Container removed');
          });

          self.emit('done', {'code': res.StatusCode, 'output': buffer});
        }
      });

    });
  });
};


module.exports = Container;