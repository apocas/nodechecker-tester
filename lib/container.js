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
    'Tty': false,
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
    if (err) throw err;

    self.container = container;
    setTimeout(function() {
      self.start();
    }, 1000);
  });
};


Container.prototype.start = function () {
  var self = this;

  this.container.start(function(err, res) {
    console.log('Container created! ' + self.container.id);
    if (err) {
      console.log('Container failed to start, retrying...');
      setTimeout(function() {
        self.start();
      }, 2000);
    } else {
      console.log('Container started! ' + self.container.id);
      self.running = true;
      self.wait();
      self.attach();
      self.setTimeouts();
    }
  });
};


Container.prototype.setTimeouts = function () {
  var self = this;

  self.timeout_stop = setTimeout(function() {
    console.log('Checking container status... ' + self.container.id);

    self.container.inspect(function(err, res) {
      if(res.State.Running == false) {
        console.log('Container misfired! ' + self.container.id + ' - ' + res.State.ExitCode);
        self.running = false;
        self.emit('done', {'code': res.State.ExitCode, 'output': self.buffer});
        self.remove();
        clearTimeout(self.timeout_kill);
      } else {
        self.stop(true);
      }
    });
  }, 60000 * 3);

  self.timeout_kill = setTimeout(function() {
    self.running = false;
    self.emit('done', {'code': 137, 'output': null});
    self.kill(true);
  }, 60000 * 4);
};


Container.prototype.kill = function(remove) {
  var self = this;

  console.log('Killing container ' + self.container.id);
  self.container.kill(function(err, res) {
    console.log('Container killed ' + self.container.id);
    if(remove !== undefined && remove === true) {
      self.remove();
    }
  });
};


Container.prototype.stop = function(remove) {
  var self = this;

  console.log('Stopping container ' + self.container.id);
  self.container.stop(function(err, res) {
    console.log('Container stopped ' + self.container.id);
    if(remove !== undefined && remove === true) {
      self.remove();
    }
  });
};


Container.prototype.wait = function() {
  var self = this;

  self.container.wait(function(err, res) {
    if (err) throw err;

    if(res.StatusCode !== undefined) {
      console.log('Container ended ' + self.container.id + ' - ' + res.StatusCode);

      clearTimeout(self.timeout_stop);
      clearTimeout(self.timeout_kill);

      if(self.running == true) {
        self.remove();
        self.emit('done', {'code': res.StatusCode, 'output': self.buffer});
      }
    }
  });
};


Container.prototype.attach = function() {
  var self = this;
  self.container.attach({stream: true, stdout: true, stderr: true}, function(err, stream) {
    if (err) throw err;

    if(stream !== null) {

      stream.on('data', function(chunk) {
        self.buffer += chunk;
      });

      //stream.pipe(process.stdout, {end : false});
      self.emit('started', stream);
    }
  });
};


Container.prototype.remove = function () {
  var self = this;
  self.container.remove(function(err, res) {
    console.log('Container removed ' + self.container.id);
  });
};


module.exports = Container;