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
    'AttachStderr': false,
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

  this.running = false;
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

      console.log('Container started! ' + self.id);
      self.running = true;

      var timeout = setTimeout(function() {
        console.log('Stopping container ' + self.id);
        docker.containers.stop(self.id, function(err, res) {
          console.log('Container stopped ' + self.id);
          self.remove();
        });
      }, 60000 * 3);

      var timeout2 = setTimeout(function() {
        console.log('Killing container ' + self.id);
        docker.containers.kill(self.id, function(err, res) {
          console.log('Container killed ' + self.id);
        });

        self.remove();

        this.running = false;
        self.emit('done', {'code': 137, 'output': null});
      }, 60000 * 4);

      docker.containers.attach(self.id, {stream: true, stdout: true}, function(err, res) {
        if (err) throw err;
        if(res !== null) {
          buffer += res.msg;
        }
      });

      docker.containers.wait(self.id, function(err, res) {
        if (err) throw err;

        if(res.StatusCode !== undefined && self.running === true) {
          clearTimeout(timeout);
          clearTimeout(timeout2);

          self.remove();

          self.emit('done', {'code': res.StatusCode, 'output': buffer});
        }
      });

    });
  });
};

Container.prototype.remove = function () {
  var self = this;
  try {
    docker.containers.remove(this.id, function(err, res) {
      console.log('Container removed ' + self.id);
    });
  } catch (err) {
    console.log('Container removal failed. Container inspection needed. ' + self.id);
    console.log(err);
  }
};


module.exports = Container;