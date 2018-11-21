var java=null,
	fs = require('fs'),
	path = require('path'),
	extend = require('extend'),
	util = require('util'),
	temp = require('temp'),
	async = require('async');

var defaults = {reports:{}, drivers:{}, conns:{}, tmpPath: '/tmp'};

function walk(dir, done) {
  var results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    var pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = path.join(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
};

/*
 * options: {
 * 	path: , //Path to jasperreports-x.x.x-project directory
 *  tmpPath: '/tmp', // Path to a folder for storing compiled report files
 * 	reports: {
 * 		// Report Definition
 * 		"name": {
 * 			jasper: , //Path to jasper file,
 * 			jrxml: , //Path to jrxml file,
 * 			conn: , //Connection name, definition object or false (if false defaultConn won't apply)
 * 		}
 * 	},
 * 	drivers: {
 *		// Driver Definition
 * 		"name": {
 			path: , //Path to jdbc driver jar
 			class: , //Class name of the driver (what you would tipically place in "Class.forName()" in java)
 			type: //Type of database (mysql, postgres)
 		}
 * 	},
 * 	conns: {
 *		// Connection Definition
 * 		"name": {
 * 			host: , //Database hostname or IP
 * 			port: , //Database Port
 * 			dbname: , //Database Name
 * 			user: , //User Name
 * 			pass: , //User Password
 * 			jdbc: , //jdbc connection string
 *			driver: //name or definition of the driver for this conn
 * 		}
 *	},
 *	defaultConn: , //Default Connection name
	java: //Array of java options, for example ["-Djava.awt.headless=true"]
 * }
 */
function jasper(options) {
	if(options.javaInstance) {
		java = options.javaInstance
	} else {
		java = require('java')
	}
	this.java = java;
	if(options.java) {
		if(util.isArray(options.java)) {
			options.java.forEach(function(javaOption) {
				java.options.push(javaOption);
			});
		}
		if(typeof options.java == 'string') {
			java.options.push(options.java);
		}
	}
	var self = this;
	self.parentPath = path.dirname(module.parent.filename);
	var jrPath = path.resolve(self.parentPath, options.path||'.');
	async.auto({
		jrJars: function(cb) {
			if(fs.statSync(path.join(jrPath, 'lib')).isDirectory() && fs.statSync(path.join(jrPath, 'dist')).isDirectory()) {
				async.parallel([
					function(cb) {
						walk(path.join(jrPath, 'dist'), function(err, results) {
							cb(err, results);
						});
					},
					function(cb) {
						walk(path.join(jrPath, 'lib'), function(err, results) {
							cb(err, results);
						});
					}
				], function(err, results) {
					if(err) return cb(err);
					var r = results.shift();
					results.forEach(function(item) {
						r = r.concat(item);
					});
					cb(null, r);
				})
			} else {
				walk(jrPath, function(err, results) {
					cb(err, results);
				});
			}
		},
		dirverJars: function(cb) {
			var results = [];
			if(options.drivers) {
				for(var i in options.drivers) {
					results.push(path.resolve(self.parentPath, options.drivers[i].path));
				}
			}
			cb(null, results);
		},
		loadJars: ['jrJars', 'dirverJars', function(cb, jars) {
			jars.jrJars.concat(jars.dirverJars).forEach(function(file) {
				if(path.extname(file) == '.jar') {
					java.classpath.push(file)
				}
			});
			cb();
		}],
		debug: ['loadJars', function(cb) {
			if(!options.debug) options.debug = 'off';
			var levels = ['ALL', 'TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL', 'OFF'];
			if(levels.indexOf((options.debug+'').toUpperCase()) == -1) options.debug = 'DEBUG';

			/*
			commented because in java 1.8 this causes

			#
			# A fatal error has been detected by the Java Runtime Environment:
			#
			#  SIGSEGV (0xb) at pc=0x00007f5caeacbac2, pid=7, tid=0x00007f5caf3c8ae8
			#
			# JRE version: OpenJDK Runtime Environment (8.0_181-b13) (build 1.8.0_181-b13)
			# Java VM: OpenJDK 64-Bit Server VM (25.181-b13 mixed mode linux-amd64 compressed oops)
			# Derivative: IcedTea 3.9.0
			# Distribution: Custom build (Tue Oct 23 12:48:04 GMT 2018)
			# Problematic frame:
			# C  [nodejavabridge_bindings.node+0x20ac2]  javaGetEnv(JavaVM_*, _jobject*)+0xa2
			*/

			/*
			var appender  = java.newInstanceSync('org.apache.log4j.ConsoleAppender');
			var pattern = java.newInstanceSync('org.apache.log4j.PatternLayout', "%d [%p|%c|%C{1}] %m%n");
			appender.setLayout(pattern);
			appender.setThreshold(java.getStaticFieldValue("org.apache.log4j.Level", (options.debug+'').toUpperCase()));
			appender.activateOptions();
			var root = java.callStaticMethodSync("org.apache.log4j.Logger", "getRootLogger");
			root.addAppender(appender);
			*/
			cb();
		}],
		loadClass: ['loadJars', function(cb) {
			var cl = java.callStaticMethodSync("java.lang.ClassLoader","getSystemClassLoader")
			for(var i in options.drivers) {
				cl.loadClassSync(options.drivers[i].class).newInstanceSync();
			}
			cb();
		}],
		imports: ['loadClass', function(cb) {
			self.dm = java.import('java.sql.DriverManager');
			self.jreds = java.import('net.sf.jasperreports.engine.JREmptyDataSource');
			self.jrjsonef = java.import('net.sf.jasperreports.engine.data.JsonDataSource');
			self.jbais = java.import('java.io.ByteArrayInputStream');
			self.jcm = java.import('net.sf.jasperreports.engine.JasperCompileManager');
			self.hm = java.import('java.util.HashMap');
			self.jfm = java.import('net.sf.jasperreports.engine.JasperFillManager');
			self.jem = java.import('net.sf.jasperreports.engine.JasperExportManager');
			self.loc = java.import('java.util.Locale');

			cb();
		}]

	}, function() {
	    if(self.ready) {
	        self.ready();
	    }
	});

	delete options.path;
	extend(self, defaults, options);
}

jasper.prototype.ready = function(f) {
    var self = this;
    self.ready = f;
};

/*
 * name = Report Name
 * def = Report Definition
 */
jasper.prototype.add = function(name, def) {
	this.reports[name] = def;
}

jasper.prototype.pdf = function(report) {
  return this.export(report, 'pdf');
}

/*
 * report can be of any of the following types:
 * _ A string that represents report's name. No data is supplied.. defaultConn will be applied to get data with reports internal query.
 * _ An object that represents report's definition. No data is supplied.. defaultConn will be applied to get data with reports internal query.
 * _ An object that represents reports, data and properties to override for this specific method call.
 *
 * 	{
 * 		report: , //name, definition or an array with any combination of both
 * 		data: {}, //Data to be applied to the report. If there is an array of reports, data will be applied to each.
 * 		override: {} //properties of report to override for this specific method call.
 * 	}
 * _ An array with any combination of the three posibilities described before.
 * _ A function returning any combination of the four posibilities described before.
 */

var validConnections = {};
jasper.prototype.export = function(report, type) {

	var self = this;

	if(!type) return;

	type = type.charAt(0).toUpperCase()+type.toLowerCase().slice(1);

	var processReport = function(report) {
		if(typeof report == 'string') {
			return [extend({},self.reports[report])];
		} else if(util.isArray(report)) {
			var ret = [];
			report.forEach(function(i) {
				ret = ret.concat(processReport(i));
			});
			return ret;
		} else if(typeof report == 'function') {
			return processReport(report());
		} else if(typeof report == 'object') {
			if(report.data||report.override) {
				var reps = processReport(report.report);
				return reps.map(function(i) {
					if(report.override) {
						extend(i, report.override);
					}
					i.data = report.data;
					i.dataset = report.dataset;
					i.query = report.query;
					return i;
				})
			} else {
				return [report];
			}
		}
	};

	var processConn = function(conn, item) {
		if(conn == 'in_memory_json') {
			var jsonString = JSON.stringify(item.dataset);

			var byteArray = [];
			var buffer = Buffer(jsonString);
			for (var i = 0; i < buffer.length; i++) {
				byteArray.push(buffer[i]);
			}
			byteArray = java.newArray('byte', byteArray);

			return new self.jrjsonef(new self.jbais(byteArray), item.query || '');
		}else if(typeof conn == 'string') {
			conn = self.conns[conn];
		} else if (typeof conn == 'function') {
			conn = conn();
		} else if(conn !== false && self.defaultConn) {
			conn = self.conns[self.defaultConn];
		}

		if(conn) {
			if(typeof conn.driver == 'string') {
				conn.driver = self.drivers[conn.driver];
			}
			var connStr = conn.jdbc?conn.jdbc:'jdbc:'+conn.driver.type+'://'+conn.host+':'+conn.port+'/'+conn.dbname;

			if(!validConnections[connStr] || !validConnections[connStr].isValidSync(conn.validationTimeout || 1)){
				validConnections[connStr] = self.dm.getConnectionSync(connStr, conn.user, conn.pass);
			}
			return validConnections[connStr];
		} else {

			return new self.jreds();

		}

	};

	var parseLocale = function (localeString) {
		var tokens = localeString.split(/[_|-]/);

		if (tokens.length > 1) {
			return self.loc(tokens[0], tokens[1]);
		}
		else {
			return self.loc(tokens[0]);
		}
	}

	var reports = processReport(report);
	var prints = [];
	reports.forEach(function(item) {
		if(!item.jasper && item.jrxml) {
			item.jasper = self.compileSync(item.jrxml, self.tmpPath);
		}

		if(item.jasper) {
			var data = null;
			if(item.data) {
				data = new self.hm();
				for(var j in item.data) {
					if (j === 'REPORT_LOCALE') {
						item.data[j] = parseLocale(item.data[j]);
					}
					data.putSync(j, item.data[j])
				}
			}

			var conn = processConn(item.conn, item);
			var p = self.jfm.fillReportSync(path.resolve(self.parentPath,item.jasper), data, conn);
			prints.push(p);
		}
	});
	if(prints.length) {
		var master = prints.shift();
		prints.forEach(function(p) {
			var s = p.getPagesSync().sizeSync();
			for(var j = 0; j < s; j++) {
				master.addPageSync(p.getPagesSync().getSync(j));
			}
		});
		var tempName = temp.path({suffix: '.pdf'});
		self.jem['exportReportTo'+type+'FileSync'](master, tempName);
		var exp = fs.readFileSync(tempName);
		fs.unlinkSync(tempName);
		return exp;
	}
	return '';
}

/*
 * compiles all reports added to the reports definition collection with a jrxml file specified
 *
 * dstFolder = destination folder path where the compiled report files will be placed. If not specified, will use the options tmpPath or the defaults tmpPath value.
 *
 */
jasper.prototype.compileAllSync = function (dstFolder) {
	var self = this;
    for (var name in self.reports) {
        var report = self.reports[name];
        if (report.jrxml) {
            report.jasper = self.compileSync(report.jrxml, dstFolder || self.tmpPath);
        }
	}
}

/*
 * compiles a jrxml report file to a jasper file with the same name
 *
 * dstFolder = destination folder path where the compiled report files will be placed. If not specified, will use the options tmpPath or the defaults tmpPath value.
 *
 * returns the full path of the created jasper file
 *
 */
jasper.prototype.compileSync = function (jrxmlFile, dstFolder) {
	var self = this;
    var name = path.basename(jrxmlFile, '.jrxml');
    var file = path.join(dstFolder || self.tmpPath, name + '.jasper');
    java.callStaticMethodSync(
        "net.sf.jasperreports.engine.JasperCompileManager",
        "compileReportToFile",
        path.resolve(self.parentPath, jrxmlFile), file
    );
    return file;
};

jasper.prototype.toJsonDataSource = function (dataset,query) {
	var self = this;
	var jsonString = JSON.stringify(dataset);
	var byteArray = java.newArray('byte', jsonString.split('').map(function(c, i) {
		return java.newByte(jsonString.charCodeAt(i));
	}));
	return new self.jrjsonef(new self.jbais(byteArray), query || '');
}

module.exports = function(options) {
	return new jasper(options)
};
