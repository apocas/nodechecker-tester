var sys = require('sys'),
  events = require('events');
  Docker = require('dockerode');


var Container = function (cmd) {
  this.options = {
    'Hostname': '',
    'User': '',
    'AttachStdin': false,
    'AttachStdout': true,
    'AttachStderr': true,
    'Tty': true,
    'OpenStdin': false,
    'StdinOnce': false,
    'Env': null,
    'Cmd': ['bash', '-c', cmd],
    'Dns': ['8.8.8.8', '8.8.4.4'],
    'Image': 'apocas/nodechecker',
    'Volumes': {},
    'VolumesFrom': ''
  };

  this.buffer = '';
  this.running = false;

  this.docker = new Docker({socketPath: '/var/run/docker.sock'});
};


sys.inherits(Container, events.EventEmitter);


Container.prototype.run = function () {
  var self = this;

  this.docker.createContainer(this.options, function (err, container) {
    if (err) return console.log(err);

    self.container = container;
    self.start();
  });
};


Container.prototype.start = function () {
  var self = this;

  this.container.start(function(err, res) {
    if (err) return console.log(err);

    //console.log('Container started! ' + self.container.id);
    self.running = true;
    self.wait();
    self.attach();
  });
};


Container.prototype.kill = function(remove) {
  var self = this;

  if(self.container) {
    //console.log('Killing container ' + self.container.id);
    self.container.kill(function(err, res) {
      //console.log('Container killed ' + self.container.id);
      if(remove !== undefined && remove === true) {
        self.remove();
      }
    });
  }
};


Container.prototype.stop = function(remove) {
  var self = this;

  //console.log('Stopping container ' + self.container.id);
  self.container.stop(function(err, res) {
    //console.log('Container stopped ' + self.container.id);
    if(remove !== undefined && remove === true) {
      self.remove();
    }
  });
};


Container.prototype.wait = function() {
  var self = this;

  self.container.wait(function(err, res) {
    if (err) return console.log(err);

    if(res.StatusCode !== undefined) {
      //console.log('Container ended ' + self.container.id + ' - ' + res.StatusCode);

      if(self.running == true) {
        self.emit('done', {'code': res.StatusCode, 'output': self.buffer});
      }
    }
  });
};


Container.prototype.attach = function() {
  var self = this;
  self.container.attach({stream: true, stdout: true, stderr: true, tty: true}, function(err, stream) {
    if (err) return console.log(err);

    if(stream !== null) {

      stream.on('data', function(chunk) {
        self.buffer += chunk;
      });

      self.emit('started', stream);
    }
  });
};


Container.prototype.remove = function () {
  var self = this;
  self.container.remove(function(err, res) {
    //console.log('Container removed ' + self.container.id);
  });
};


module.exports = Container;