var Client = require('../lib/client'),
    Server = require('../lib/server'),
    OPEN_MODE = require('ssh2-streams').SFTPStream.OPEN_MODE,
    STATUS_CODE = require('ssh2-streams').SFTPStream.STATUS_CODE,
    utils = require('ssh2-streams').utils;

var fs = require('fs'),
    crypto = require('crypto'),
    path = require('path'),
    join = path.join,
    inspect = require('util').inspect,
    assert = require('assert');

var t = -1,
    group = path.basename(__filename, '.js') + '/',
    fixturesdir = join(__dirname, 'fixtures');

var USER = 'nodejs',
    PASSWORD = 'FLUXCAPACITORISTHEPOWER',
    MD5_HOST_FINGERPRINT = '64254520742d3d0792e918f3ce945a64',
    HOST_KEY_RSA = fs.readFileSync(join(fixturesdir, 'ssh_host_rsa_key')),
    CLIENT_KEY_RSA = fs.readFileSync(join(fixturesdir, 'id_rsa')),
    CLIENT_KEY_RSA_PUB = utils.genPublicKey(utils.parseKey(CLIENT_KEY_RSA)),
    CLIENT_KEY_DSA = fs.readFileSync(join(fixturesdir, 'id_dsa')),
    CLIENT_KEY_DSA_PUB = utils.genPublicKey(utils.parseKey(CLIENT_KEY_DSA)),
    DEBUG = false;

var tests = [
  { run: function() {
      var self = this,
          what = this.what,
          client,
          server,
          r;

      r = setup(this,
                { username: USER,
                  privateKey: CLIENT_KEY_RSA
                },
                { privateKey: HOST_KEY_RSA
                });
      client = r.client;
      server = r.server;

      server.on('connection', function(conn) {
        conn.on('authentication', function(ctx) {
          assert(ctx.method === 'publickey',
                 makeMsg(what, 'Unexpected auth method: ' + ctx.method));
          assert(ctx.username === USER,
                 makeMsg(what, 'Unexpected username: ' + ctx.username));
          assert(ctx.key.algo === 'ssh-rsa',
                 makeMsg(what, 'Unexpected key algo: ' + ctx.key.algo));
          assert.deepEqual(CLIENT_KEY_RSA_PUB.public,
                           ctx.key.data,
                           makeMsg(what, 'Public key mismatch'));
          if (ctx.signature) {
            var verifier = crypto.createVerify('RSA-SHA1'),
                pem = CLIENT_KEY_RSA_PUB.publicOrig;
            verifier.update(ctx.blob);
            assert(verifier.verify(pem, ctx.signature, 'binary'),
                   makeMsg(what, 'Could not verify PK signature'));
            ctx.accept();
          } else
            ctx.accept();
        }).on('ready', function() {
          conn.end();
        });
      });
    },
    what: 'Authenticate with an RSA key'
  },
  { run: function() {
      var self = this,
          what = this.what,
          client,
          server,
          r;

      r = setup(this,
                { username: USER,
                  privateKey: CLIENT_KEY_DSA
                },
                { privateKey: HOST_KEY_RSA
                });
      client = r.client;
      server = r.server;

      server.on('connection', function(conn) {
        conn.on('authentication', function(ctx) {
          assert(ctx.method === 'publickey',
                 makeMsg(what, 'Unexpected auth method: ' + ctx.method));
          assert(ctx.username === USER,
                 makeMsg(what, 'Unexpected username: ' + ctx.username));
          assert(ctx.key.algo === 'ssh-dss',
                 makeMsg(what, 'Unexpected key algo: ' + ctx.key.algo));
          assert.deepEqual(CLIENT_KEY_DSA_PUB.public,
                           ctx.key.data,
                           makeMsg(what, 'Public key mismatch'));
          if (ctx.signature) {
            var verifier = crypto.createVerify('DSA-SHA1'),
                pem = CLIENT_KEY_DSA_PUB.publicOrig;
            verifier.update(ctx.blob);
            assert(verifier.verify(pem, ctx.signature, 'binary'),
                   makeMsg(what, 'Could not verify PK signature'));
            ctx.accept();
          } else
            ctx.accept();
        }).on('ready', function() {
          conn.end();
        });
      });
    },
    what: 'Authenticate with a DSA key'
  },
  { run: function() {
      var self = this,
          what = this.what,
          hostname = 'foo',
          username = 'bar',
          client,
          server,
          r;

      r = setup(this,
                { username: USER,
                  privateKey: CLIENT_KEY_RSA,
                  localHostname: hostname,
                  localUsername: username
                },
                { privateKey: HOST_KEY_RSA
                });
      client = r.client;
      server = r.server;

      server.on('connection', function(conn) {
        conn.on('authentication', function(ctx) {
          if (ctx.method === 'hostbased') {
            assert(ctx.username === USER,
                   makeMsg(what, 'Unexpected username: ' + ctx.username));
            assert(ctx.key.algo === 'ssh-rsa',
                   makeMsg(what, 'Unexpected key algo: ' + ctx.key.algo));
            assert.deepEqual(CLIENT_KEY_RSA_PUB.public,
                             ctx.key.data,
                             makeMsg(what, 'Public key mismatch'));
            assert(ctx.signature,
                   makeMsg(what, 'Expected signature'));
            assert(ctx.localHostname === hostname,
                   makeMsg(what, 'Wrong local hostname'));
            assert(ctx.localUsername === username,
                   makeMsg(what, 'Wrong local username'));
            var verifier = crypto.createVerify('RSA-SHA1'),
                pem = CLIENT_KEY_RSA_PUB.publicOrig;
            verifier.update(ctx.blob);
            assert(verifier.verify(pem, ctx.signature, 'binary'),
                   makeMsg(what, 'Could not verify hostbased signature'));
            ctx.accept();
          } else
            ctx.reject();
        }).on('ready', function() {
          conn.end();
        });
      });
    },
    what: 'Authenticate with hostbased'
  },
  { run: function() {
      var self = this,
          what = this.what,
          client,
          server,
          r;

      r = setup(this,
                { username: USER,
                  password: PASSWORD
                },
                { privateKey: HOST_KEY_RSA
                });
      client = r.client;
      server = r.server;

      server.on('connection', function(conn) {
        conn.on('authentication', function(ctx) {
          assert(ctx.method === 'password',
                 makeMsg(what, 'Unexpected auth method: ' + ctx.method));
          assert(ctx.username === USER,
                 makeMsg(what, 'Unexpected username: ' + ctx.username));
          assert(ctx.password === PASSWORD,
                 makeMsg(what, 'Unexpected password: ' + ctx.password));
          ctx.accept();
        }).on('ready', function() {
          conn.end();
        });
      });
    },
    what: 'Authenticate with a password'
  },
  { run: function() {
      var self = this,
          what = this.what,
          verified = false,
          client,
          server,
          r;

      r = setup(this,
                { username: USER,
                  password: PASSWORD,
                  hostHash: 'md5',
                  hostVerifier: function(hash) {
                    assert(hash === MD5_HOST_FINGERPRINT,
                           makeMsg(what, 'Host fingerprint mismatch'));
                    verified = true;
                  }
                },
                { privateKey: HOST_KEY_RSA
                });
      client = r.client;
      server = r.server;

      server.on('connection', function(conn) {
        conn.on('authentication', function(ctx) {
          ctx.accept();
        }).on('ready', function() {
          conn.end();
        });
      }).on('close', function() {
        assert(verified, makeMsg(what, 'Failed to verify host fingerprint'));
      });
    },
    what: 'Verify host fingerprint'
  },
  { run: function() {
      var self = this,
          what = this.what,
          out = '',
          outErr = '',
          exitArgs,
          closeArgs,
          client,
          server,
          r;

      r = setup(this,
                { username: USER,
                  password: PASSWORD
                },
                { privateKey: HOST_KEY_RSA
                });
      client = r.client;
      server = r.server;

      server.on('connection', function(conn) {
        conn.on('authentication', function(ctx) {
          ctx.accept();
        }).on('ready', function() {
          conn.once('session', function(accept, reject) {
            var session = accept();
            session.once('exec', function(accept, reject, info) {
              assert(info.command === 'foo --bar',
                     makeMsg(what, 'Wrong exec command: ' + info.command));
              var stream = accept();
              stream.stderr.write('stderr data!\n');
              stream.write('stdout data!\n');
              stream.exit(100);
              stream.end();
              conn.end();
            });
          });
        });
      });
      client.on('ready', function() {
        client.exec('foo --bar', function(err, stream) {
          assert(!err, makeMsg(what, 'Unexpected exec error: ' + err));
          stream.on('data', function(d) {
            out += d;
          }).on('exit', function(code) {
            exitArgs = new Array(arguments.length);
            for (var i = 0; i < exitArgs.length; ++i)
              exitArgs[i] = arguments[i];
          }).on('close', function(code) {
            closeArgs = new Array(arguments.length);
            for (var i = 0; i < closeArgs.length; ++i)
              closeArgs[i] = arguments[i];
          }).stderr.on('data', function(d) {
            outErr += d;
          });
        });
      }).on('end', function() {
        assert.deepEqual(exitArgs,
                         [100],
                         makeMsg(what, 'Wrong exit args: ' + inspect(exitArgs)));
        assert.deepEqual(closeArgs,
                         [100],
                         makeMsg(what,
                                 'Wrong close args: ' + inspect(closeArgs)));
        assert(out === 'stdout data!\n',
               makeMsg(what, 'Wrong stdout data: ' + inspect(out)));
        assert(outErr === 'stderr data!\n',
               makeMsg(what, 'Wrong stderr data: ' + inspect(outErr)));
      });
    },
    what: 'Simple exec'
  },
  { run: function() {
      var self = this,
          what = this.what,
          out = '',
          client,
          server,
          r;

      r = setup(this,
                { username: USER,
                  password: PASSWORD
                },
                { privateKey: HOST_KEY_RSA
                });
      client = r.client;
      server = r.server;

      server.on('connection', function(conn) {
        conn.on('authentication', function(ctx) {
          ctx.accept();
        }).on('ready', function() {
          conn.once('session', function(accept, reject) {
            var session = accept(),
                env = {};
            session.once('env', function(accept, reject, info) {
              env[info.key] = info.val;
              accept && accept();
            }).once('exec', function(accept, reject, info) {
              assert(info.command === 'foo --bar',
                     makeMsg(what, 'Wrong exec command: ' + info.command));
              var stream = accept();
              stream.write(''+env.SSH2NODETEST);
              stream.exit(100);
              stream.end();
              conn.end();
            });
          });
        });
      });
      client.on('ready', function() {
        client.exec('foo --bar',
                    { env: { SSH2NODETEST: 'foo' } },
                    function(err, stream) {
          assert(!err, makeMsg(what, 'Unexpected exec error: ' + err));
          stream.on('data', function(d) {
            out += d;
          });
        });
      }).on('end', function() {
        assert(out === 'foo',
               makeMsg(what, 'Wrong stdout data: ' + inspect(out)));
      });
    },
    what: 'Exec with environment set'
  },
  { run: function() {
      var self = this,
          what = this.what,
          out = '',
          client,
          server,
          r;

      r = setup(this,
                { username: USER,
                  password: PASSWORD
                },
                { privateKey: HOST_KEY_RSA
                });
      client = r.client;
      server = r.server;

      server.on('connection', function(conn) {
        conn.on('authentication', function(ctx) {
          ctx.accept();
        }).on('ready', function() {
          conn.once('session', function(accept, reject) {
            var session = accept(),
                ptyInfo;
            session.once('pty', function(accept, reject, info) {
              ptyInfo = info;
              accept && accept();
            }).once('exec', function(accept, reject, info) {
              assert(info.command === 'foo --bar',
                     makeMsg(what, 'Wrong exec command: ' + info.command));
              var stream = accept();
              stream.write(JSON.stringify(ptyInfo));
              stream.exit(100);
              stream.end();
              conn.end();
            });
          });
        });
      });
      var pty = {
        rows: 2,
        cols: 4,
        width: 0,
        height: 0,
        term: 'vt220',
        modes: {}
      };
      client.on('ready', function() {
        client.exec('foo --bar',
                    { pty: pty },
                    function(err, stream) {
          assert(!err, makeMsg(what, 'Unexpected exec error: ' + err));
          stream.on('data', function(d) {
            out += d;
          });
        });
      }).on('end', function() {
        assert.deepEqual(JSON.parse(out),
                         pty,
                         makeMsg(what, 'Wrong stdout data: ' + inspect(out)));
      });
    },
    what: 'Exec with pty set'
  },
  { run: function() {
      var self = this,
          what = this.what,
          out = '',
          client,
          server,
          r;

      r = setup(this,
                { username: USER,
                  password: PASSWORD
                },
                { privateKey: HOST_KEY_RSA
                });
      client = r.client;
      server = r.server;

      server.on('connection', function(conn) {
        conn.on('authentication', function(ctx) {
          ctx.accept();
        }).on('ready', function() {
          conn.once('session', function(accept, reject) {
            var session = accept(),
                authAgentReq = false;
            session.once('auth-agent', function(accept, reject) {
              authAgentReq = true;
              accept && accept();
            }).once('exec', function(accept, reject, info) {
              assert(info.command === 'foo --bar',
                     makeMsg(what, 'Wrong exec command: ' + info.command));
              var stream = accept();
              stream.write(inspect(authAgentReq));
              stream.exit(100);
              stream.end();
              conn.end();
            });
          });
        });
      });
      client.on('ready', function() {
        client.exec('foo --bar',
                    { agentForward: true },
                    function(err, stream) {
          assert(!err, makeMsg(what, 'Unexpected exec error: ' + err));
          stream.on('data', function(d) {
            out += d;
          });
        });
      }).on('end', function() {
        assert(out === 'true',
               makeMsg(what, 'Wrong stdout data: ' + inspect(out)));
      });
    },
    what: 'Exec with OpenSSH agent forwarding'
  },
  { run: function() {
      var self = this,
          what = this.what,
          out = '',
          client,
          server,
          r;

      r = setup(this,
                { username: USER,
                  password: PASSWORD
                },
                { privateKey: HOST_KEY_RSA
                });
      client = r.client;
      server = r.server;

      server.on('connection', function(conn) {
        conn.on('authentication', function(ctx) {
          ctx.accept();
        }).on('ready', function() {
          conn.once('session', function(accept, reject) {
            var session = accept(),
                x11 = false;
            session.once('x11', function(accept, reject, info) {
              x11 = true;
              accept && accept();
            }).once('exec', function(accept, reject, info) {
              assert(info.command === 'foo --bar',
                     makeMsg(what, 'Wrong exec command: ' + info.command));
              var stream = accept();
              stream.write(inspect(x11));
              stream.exit(100);
              stream.end();
              conn.end();
            });
          });
        });
      });
      client.on('ready', function() {
        client.exec('foo --bar',
                    { x11: true },
                    function(err, stream) {
          assert(!err, makeMsg(what, 'Unexpected exec error: ' + err));
          stream.on('data', function(d) {
            out += d;
          });
        });
      }).on('end', function() {
        assert(out === 'true',
               makeMsg(what, 'Wrong stdout data: ' + inspect(out)));
      });
    },
    what: 'Exec with X11 forwarding'
  },
  { run: function() {
      var self = this,
          what = this.what,
          out = '',
          client,
          server,
          r;

      r = setup(this,
                { username: USER,
                  password: PASSWORD
                },
                { privateKey: HOST_KEY_RSA
                });
      client = r.client;
      server = r.server;

      server.on('connection', function(conn) {
        conn.on('authentication', function(ctx) {
          ctx.accept();
        }).on('ready', function() {
          conn.once('session', function(accept, reject) {
            var session = accept(),
                sawPty = false;
            session.once('pty', function(accept, reject, info) {
              sawPty = true;
              accept && accept();
            }).once('shell', function(accept, reject) {
              var stream = accept();
              stream.write('Cowabunga dude! ' + inspect(sawPty));
              stream.end();
              conn.end();
            });
          });
        });
      });
      client.on('ready', function() {
        client.shell(function(err, stream) {
          assert(!err, makeMsg(what, 'Unexpected exec error: ' + err));
          stream.on('data', function(d) {
            out += d;
          });
        });
      }).on('end', function() {
        assert(out === 'Cowabunga dude! true',
               makeMsg(what, 'Wrong stdout data: ' + inspect(out)));
      });
    },
    what: 'Simple shell'
  },
  { run: function() {
      var self = this,
          what = this.what,
          expHandle = new Buffer([1, 2, 3, 4]),
          sawOpenS = false,
          sawCloseS = false,
          sawOpenC = false,
          sawCloseC = false,
          client,
          server,
          r;

      r = setup(this,
                { username: USER,
                  password: PASSWORD
                },
                { privateKey: HOST_KEY_RSA
                });
      client = r.client;
      server = r.server;

      server.on('connection', function(conn) {
        conn.on('authentication', function(ctx) {
          ctx.accept();
        }).on('ready', function() {
          conn.once('session', function(accept, reject) {
            var session = accept();
            session.once('sftp', function(accept, reject) {
              if (accept) {
                var sftp = accept();
                sftp.once('OPEN', function(id, filename, flags, attrs) {
                  assert(id === 0,
                         makeMsg(what, 'Unexpected sftp request ID: ' + id));
                  assert(filename === 'node.js',
                         makeMsg(what, 'Unexpected filename: ' + filename));
                  assert(flags === OPEN_MODE.READ,
                         makeMsg(what, 'Unexpected flags: ' + flags));
                  sawOpenS = true;
                  sftp.handle(id, expHandle);
                  sftp.once('CLOSE', function(id, handle) {
                    assert(id === 1,
                           makeMsg(what, 'Unexpected sftp request ID: ' + id));
                    assert.deepEqual(handle,
                                     expHandle,
                                     makeMsg(what,
                                             'Wrong sftp file handle: '
                                             + inspect(handle)));
                    sawCloseS = true;
                    sftp.status(id, STATUS_CODE.OK);
                    conn.end();
                  });
                });
              }
            });
          });
        });
      });
      client.on('ready', function() {
        client.sftp(function(err, sftp) {
          assert(!err, makeMsg(what, 'Unexpected sftp error: ' + err));
          sftp.open('node.js', 'r', function(err, handle) {
            assert(!err, makeMsg(what, 'Unexpected sftp error: ' + err));
            assert.deepEqual(handle,
                             expHandle,
                             makeMsg(what,
                                     'Wrong sftp file handle: '
                                     + inspect(handle)));
            sawOpenC = true;
            sftp.close(handle, function(err) {
              assert(!err, makeMsg(what, 'Unexpected sftp error: ' + err));
              sawCloseC = true;
            });
          });
        });
      }).on('end', function() {
        assert(sawOpenS, makeMsg(what, 'Expected sftp open()'));
        assert(sawOpenC, makeMsg(what, 'Expected sftp open() callback'));
        assert(sawCloseS, makeMsg(what, 'Expected sftp open()'));
        assert(sawOpenC, makeMsg(what, 'Expected sftp close() callback'));
      });
    },
    what: 'Simple sftp'
  },
  { run: function() {
      var self = this,
          what = this.what,
          out = '',
          state = {
            readies: 0,
            closes: 0
          },
          clientcfg = {
            username: USER,
            password: PASSWORD
          },
          servercfg = {
            privateKey: HOST_KEY_RSA
          },
          reconnect = false,
          client,
          server,
          r;

      client = new Client(),
      server = new Server(servercfg);

      function onReady() {
        assert(++state.readies <= 4,
               makeMsg(what, 'Wrong ready count: ' + state.readies));
      }
      function onClose() {
        assert(++state.closes <= 3,
               makeMsg(what, 'Wrong close count: ' + state.closes));
        if (state.closes === 2)
          server.close();
        else if (state.closes === 3)
          next();
      }

      server.listen(0, 'localhost', function() {
        clientcfg.host = 'localhost';
        clientcfg.port = server.address().port;
        client.connect(clientcfg);
      });

      server.on('connection', function(conn) {
        conn.on('authentication', function(ctx) {
          ctx.accept();
        }).on('ready', onReady);
      }).on('close', onClose);
      client.on('ready', function() {
        onReady();
        if (reconnect)
          client.end();
        else {
          reconnect = true;
          client.connect(clientcfg);
        }
      }).on('close', onClose);
    },
    what: 'connect() on connected client'
  },
];

function setup(self, clientcfg, servercfg) {
  self.state = {
    readies: 0,
    ends: 0
  };

  if (DEBUG) {
    console.log('========================================================\n'
                + '[TEST] '
                + self.what
                + '\n========================================================');
    clientcfg.debug = function(str) {
      console.log('[CLIENT] ' + str);
    };
    servercfg.debug = function(str) {
      console.log('[SERVER] ' + str);
    };
  }

  var client = new Client(),
      server = new Server(servercfg);

  server.on('error', onError)
        .on('connection', function(conn) {
          conn.on('error', onError)
              .on('ready', onReady);
          server.close();
        })
        .on('close', onClose);
  client.on('error', onError)
        .on('ready', onReady)
        .on('close', onClose);

  function onError(err) {
    var which = (this === client ? 'client' : 'server');
    assert(false, makeMsg(self.what, 'Unexpected ' + which + ' error: ' + err));
  }
  function onReady() {
    assert(self.state.readies < 2,
           makeMsg(self.what, 'Saw too many ready events'));
    if (++self.state.readies === 2)
      self.onReady && self.onReady();
  }
  function onClose() {
    assert(self.state.ends < 2, makeMsg(self.what, 'Saw too many end events'));
    if (++self.state.ends === 2) {
      assert(self.state.readies === 2,
             makeMsg(self.what, 'Expected 2 readies'));
      next();
    }
  }

  process.nextTick(function() {
    server.listen(0, 'localhost', function() {
      clientcfg.host = 'localhost';
      clientcfg.port = server.address().port;
      client.connect(clientcfg);
    });
  });
  return { client: client, server: server };
}

function bufferStream(stream, encoding, cb) {
  var buf;
  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = undefined;
  }
  if (!encoding) {
    var nb = 0;
    stream.on('data', function(d) {
      if (nb === 0)
        buf = [ d ];
      else
        buf.push(d);
      nb += d.length;
    }).on((stream._writableState ? 'close' : 'end'), function() {
      cb(nb ? Buffer.concat(buf, nb) : buf);
    });
  } else {
    stream.on('data', function(d) {
      if (!buf)
        buf = d;
      else
        buf += d;
    }).on((stream._writableState ? 'close' : 'end'), function() {
      cb(buf);
    }).setEncoding(encoding);
  }
}

function next() {
  if (Array.isArray(process._events.exit))
    process._events.exit = process._events.exit[1];
  if (++t === tests.length)
    return;

  var v = tests[t];
  v.run.call(v);
}

function makeMsg(what, msg) {
  return '[' + group + what + ']: ' + msg;
}

process.once('exit', function() {
  assert(t === tests.length,
         makeMsg('_exit',
                 'Only finished ' + t + '/' + tests.length + ' tests'));
});

next();