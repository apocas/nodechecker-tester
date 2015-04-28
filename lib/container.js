var sys = require('sys'),
  events = require('events'),
  Docker = require('dockerode'),
  stream = require('stream');


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
    'VolumesFrom': '',
    'HostConfig': {
      'Memory': 2000000000,
      'MemorySwap': 2200000000
    }
  };

  this.buffer_stdout = '';
  this.buffer_stderr = '';
  this.running = false;
  this.retries = 0;

  this.docker = new Docker({socketPath: '/var/run/docker.sock'});
};


sys.inherits(Container, events.EventEmitter);


Container.prototype.run = function () {
  var self = this;

  this.docker.createContainer(this.options, function (err, container) {
    if (err) return console.log(err);

    console.log('Container created! ' + container.id);

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
  if(self.container) {
    self.container.stop(function(err, res) {
      //console.log('Container stopped ' + self.container.id);
      if(remove !== undefined && remove === true) {
        self.remove();
      }
    });
  }
};


Container.prototype.wait = function() {
  var self = this;

  self.container.wait(function(err, res) {
    if (err) return console.log(err);

    if(res.StatusCode !== undefined) {
      console.log('Container ended ' + self.container.id + ' - ' + res.StatusCode);

      if(self.running == true) {
        self.emit('done', {'code': res.StatusCode, 'output': {'stdout': self.buffer_stdout, 'stderr': self.buffer_stderr } } );
      }
    }
  });
};


Container.prototype.attach = function() {
  var self = this;
  self.container.attach({stream: true, stdout: true, stderr: true, tty: false}, function(err, streamc) {
    if (err) return console.log(err);

    if(streamc) {
      var stdout = new stream.PassThrough();
      var stderr = new stream.PassThrough();
      self.container.modem.demuxStream(streamc, stdout, stderr);

      stdout.on('data', function(chunk) {
        self.buffer_stdout += chunk;
      });

      stderr.on('data', function(chunk) {
        self.buffer_stderr += chunk;
      });

      self.emit('started', streamc);
    }
  });
};


Container.prototype.remove = function () {
  var self = this;
  setTimeout(function() {
    self.container.remove(function(err, res) {
      if(err) {
        if(self.retries < 10) {
          self.remove();
        } else {
          return console.log("REMOVAL FAILED: " + err);
        }
        self.retries++;
      } else {
        console.log('Container removed ' + self.container.id);
      }
    });
  }, 3000);
};


module.exports = Container;
